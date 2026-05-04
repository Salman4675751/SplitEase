/**
 * Recurring expense scheduler.
 *
 * On boot + every hour, scans for recurring "template" expenses whose
 * `recurringNextDate` has arrived. For each, clones the template into a fresh
 * expense dated today and advances the template's next-date by one period.
 *
 * Notes:
 *  - The template itself is the original expense that the user marked recurring.
 *    Clones link back via `recurringParent` so we can show "this is a copy of X".
 *  - We compare on full timestamp; the daily check granularity means a recurring
 *    expense may fire up to 1 hour after its target time, which is fine.
 *  - If multiple periods passed (e.g. server was offline for a month), we
 *    catch up by spawning all missed instances.
 */

const Expense = require('../models/Expense');
const User = require('../models/User');
const Group = require('../models/Group');
const mailer = require('./mailer');

const TICK_MS = 60 * 60 * 1000; // hourly

function advanceDate(date, frequency) {
  const d = new Date(date);
  if (frequency === 'weekly')  d.setDate(d.getDate() + 7);
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  if (frequency === 'yearly')  d.setFullYear(d.getFullYear() + 1);
  return d;
}

async function spawnInstance(template) {
  // Clone the template's split + paidBy structure but with a fresh date
  const instance = await Expense.create({
    group: template.group,
    description: template.description,
    amount: template.amount,
    currency: template.currency,
    splitType: template.splitType,
    paidBy: template.paidBy.map((p) => ({ user: p.user, amount: p.amount })),
    splits: template.splits.map((s) => ({
      user: s.user,
      amount: s.amount,
      percentage: s.percentage,
    })),
    notes: template.notes,
    category: template.category,
    date: new Date(),
    createdBy: template.createdBy,
    isRecurring: false,           // the instance itself is not a template
    recurringParent: template._id,
  });

  // Email all members + add in-app notification
  try {
    const group = await Group.findById(template.group);
    const memberIds = group?.members?.map((m) => m.user.toString()) || [];
    if (memberIds.length > 0) {
      await User.updateMany(
        { _id: { $in: memberIds } },
        {
          $push: {
            notifications: {
              message: `Recurring expense "${template.description}" was added to "${group.name}"`,
              type: 'expense_added',
              relatedGroup: group._id,
            },
          },
        }
      );
      const recipients = await User.find({ _id: { $in: memberIds } });
      for (const r of recipients) {
        const mySplit = instance.splits.find((s) => s.user.toString() === r._id.toString());
        mailer.sendExpenseAdded({
          to: r.email,
          payerName: 'SplitEase (recurring)',
          groupName: group.name,
          description: template.description,
          amount: template.amount,
          currency: instance.currency,
          share: mySplit?.amount || 0,
        });
      }
    }
  } catch (err) {
    console.error('Recurring notification failed:', err.message);
  }

  return instance;
}

async function runOnce() {
  const now = new Date();
  const due = await Expense.find({
    isRecurring: true,
    recurringNextDate: { $lte: now, $ne: null },
  });

  if (due.length === 0) return;
  console.log(`🔁 Recurring scheduler: ${due.length} due`);

  for (const template of due) {
    let nextDate = template.recurringNextDate;
    let spawned = 0;

    // Catch up — spawn one for each period that's elapsed
    while (nextDate <= now && spawned < 24) { // safety cap to prevent runaway
      await spawnInstance(template);
      nextDate = advanceDate(nextDate, template.recurringFrequency);
      spawned++;
    }

    template.recurringNextDate = nextDate;
    await template.save();
    console.log(`  ↳ "${template.description}" — spawned ${spawned} instance(s), next: ${nextDate.toISOString()}`);
  }
}

function start() {
  // Run shortly after boot, then every hour
  setTimeout(() => {
    runOnce().catch((err) => console.error('Recurring scheduler error:', err));
  }, 30 * 1000);

  setInterval(() => {
    runOnce().catch((err) => console.error('Recurring scheduler error:', err));
  }, TICK_MS);

  console.log('🔁 Recurring scheduler started (checks hourly)');
}

module.exports = { start, runOnce, advanceDate };
