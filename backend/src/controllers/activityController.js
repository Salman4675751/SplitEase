/**
 * Activity feed — aggregates events across all groups the user belongs to.
 *
 * Sources:
 *   - Expenses: created event + comment events
 *   - Settlements: payment recorded
 *   - Groups: member joined / created
 *
 * Returns a unified, time-sorted timeline so the user sees everything that
 * happened across their groups in one chronological view.
 */

const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');

exports.getActivityFeed = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 80, 200);

    const groups = await Group.find({ 'members.user': req.user._id }).select('_id name type currency members createdBy createdAt');
    const groupIds = groups.map((g) => g._id);
    const groupMap = new Map(groups.map((g) => [g._id.toString(), g]));

    // Pull in parallel for speed
    const [expenses, settlements] = await Promise.all([
      Expense.find({ group: { $in: groupIds } })
        .populate('paidBy.user', 'name email avatar')
        .populate('createdBy', 'name email avatar')
        .populate('comments.user', 'name email avatar')
        .sort({ updatedAt: -1 })
        .limit(limit * 2),
      Settlement.find({ group: { $in: groupIds } })
        .populate('paidBy', 'name email avatar')
        .populate('paidTo', 'name email avatar')
        .sort({ createdAt: -1 })
        .limit(limit),
    ]);

    const events = [];

    // Group creation events
    for (const g of groups) {
      events.push({
        type: 'group_created',
        timestamp: g.createdAt,
        actor: null,
        group: { _id: g._id, name: g.name, type: g.type },
        title: `Group "${g.name}" was created`,
      });
    }

    // Expense events
    for (const e of expenses) {
      const g = groupMap.get(e.group.toString());
      events.push({
        type: 'expense_added',
        timestamp: e.createdAt,
        actor: e.createdBy,
        group: g ? { _id: g._id, name: g.name, type: g.type, currency: g.currency } : null,
        title: `${e.createdBy?.name || 'Someone'} added "${e.description}"`,
        amount: e.amount,
        currency: e.currency,
        category: e.category,
        expenseId: e._id,
      });

      // Comment events on this expense
      for (const c of e.comments || []) {
        events.push({
          type: 'comment',
          timestamp: c.createdAt,
          actor: c.user,
          group: g ? { _id: g._id, name: g.name, type: g.type } : null,
          title: `${c.user?.name || 'Someone'} commented on "${e.description}"`,
          comment: c.text,
          expenseId: e._id,
        });
      }
    }

    // Settlement events
    for (const s of settlements) {
      const g = groupMap.get(s.group.toString());
      events.push({
        type: 'settled',
        timestamp: s.createdAt,
        actor: s.paidBy,
        group: g ? { _id: g._id, name: g.name, type: g.type, currency: g.currency } : null,
        title: `${s.paidBy?.name || 'Someone'} paid ${s.paidTo?.name || 'someone'}`,
        amount: s.amount,
        currency: s.currency,
        recipient: s.paidTo,
      });
    }

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json(events.slice(0, limit));
  } catch (err) {
    next(err);
  }
};
