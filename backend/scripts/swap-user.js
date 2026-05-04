/**
 * Swap a demo placeholder member in Badminton Buddies for a real registered user.
 *
 * Usage:
 *   node scripts/swap-user.js <demo-email> <real-email>
 *
 * Example:
 *   node scripts/swap-user.js salman@splitease.demo salman.maqsood@live.com
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Group = require('../src/models/Group');
const Expense = require('../src/models/Expense');
const Settlement = require('../src/models/Settlement');

async function swap() {
  const [demoEmail, realEmail] = process.argv.slice(2);
  if (!demoEmail || !realEmail) {
    console.error('Usage: node scripts/swap-user.js <demo-email> <real-email>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const demoUser = await User.findOne({ email: demoEmail.toLowerCase() });
  const realUser = await User.findOne({ email: realEmail.toLowerCase() });

  if (!demoUser) return console.error(`Demo user ${demoEmail} not found`) || process.exit(1);
  if (!realUser) return console.error(`Real user ${realEmail} not found — register first`) || process.exit(1);

  console.log(`Swapping ${demoEmail} → ${realEmail}`);

  // 1. Update group memberships
  const groups = await Group.find({ 'members.user': demoUser._id });
  for (const g of groups) {
    g.members = g.members.map((m) =>
      m.user.equals(demoUser._id) ? { ...m.toObject(), user: realUser._id } : m
    );
    await g.save();
    console.log(`  ↳ Group "${g.name}": replaced member`);
  }

  // 2. Update expense paidBy and splits
  const expenses = await Expense.find({
    $or: [{ 'paidBy.user': demoUser._id }, { 'splits.user': demoUser._id }],
  });
  for (const e of expenses) {
    e.paidBy = e.paidBy.map((p) => p.user.equals(demoUser._id) ? { ...p.toObject(), user: realUser._id } : p);
    e.splits = e.splits.map((s) => s.user.equals(demoUser._id) ? { ...s.toObject(), user: realUser._id } : s);
    if (e.createdBy.equals(demoUser._id)) e.createdBy = realUser._id;
    await e.save();
    console.log(`  ↳ Expense "${e.description}": rewrote ownership`);
  }

  // 3. Update settlements
  await Settlement.updateMany({ paidBy: demoUser._id }, { paidBy: realUser._id });
  await Settlement.updateMany({ paidTo: demoUser._id }, { paidTo: realUser._id });

  // 4. Add a notification to the real user
  await realUser.updateOne({
    $push: {
      notifications: {
        message: `You've been added to the group "Badminton Buddies"`,
        type: 'group_added',
      },
    },
  });

  // 5. Delete the demo placeholder user
  await User.deleteOne({ _id: demoUser._id });
  console.log(`  ↳ Deleted placeholder ${demoEmail}`);

  console.log('\n✓ Swap complete. Log in as', realEmail);
  await mongoose.disconnect();
}

swap().catch((err) => {
  console.error('Swap failed:', err);
  process.exit(1);
});
