/**
 * Clear all demo seed data — keeps real user accounts intact.
 *
 * Removes:
 *   - Demo users (anyone with email @splitease.demo)
 *   - Groups that contained any demo user (Badminton Buddies)
 *   - All expenses, settlements, invitations tied to those groups
 *   - Notifications on real users that pointed to deleted groups
 *
 * Real accounts (e.g. salman.maqsood@live.com) keep their:
 *   - Profile, password, payment methods
 *   - Theme/appearance preferences
 *   - Anything not tied to a demo group
 *
 * Usage:  node scripts/clear-demo.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Group = require('../src/models/Group');
const Expense = require('../src/models/Expense');
const Settlement = require('../src/models/Settlement');
const Invitation = require('../src/models/Invitation');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // 1. Find all demo users
  const demoUsers = await User.find({ email: { $regex: '@splitease\\.demo$' } });
  const demoUserIds = demoUsers.map((u) => u._id);
  console.log(`Found ${demoUsers.length} demo user(s):`);
  demoUsers.forEach((u) => console.log(`  • ${u.email} (${u.name})`));

  // 2. Find groups that contained any demo user — these are the "demo groups"
  const demoGroups = await Group.find({ 'members.user': { $in: demoUserIds } });
  const demoGroupIds = demoGroups.map((g) => g._id);
  console.log(`\nFound ${demoGroups.length} demo group(s):`);
  demoGroups.forEach((g) => console.log(`  • ${g.name} (${g.members.length} members)`));

  // 3. Delete expenses in those groups
  const expensesDeleted = await Expense.deleteMany({ group: { $in: demoGroupIds } });
  console.log(`\nDeleted ${expensesDeleted.deletedCount} expense(s)`);

  // 4. Delete settlements in those groups
  const settlementsDeleted = await Settlement.deleteMany({ group: { $in: demoGroupIds } });
  console.log(`Deleted ${settlementsDeleted.deletedCount} settlement(s)`);

  // 5. Delete invitations to those groups
  const invitesDeleted = await Invitation.deleteMany({ group: { $in: demoGroupIds } });
  console.log(`Deleted ${invitesDeleted.deletedCount} invitation(s)`);

  // 6. Delete the groups
  const groupsDeleted = await Group.deleteMany({ _id: { $in: demoGroupIds } });
  console.log(`Deleted ${groupsDeleted.deletedCount} group(s)`);

  // 7. Delete the demo users
  const usersDeleted = await User.deleteMany({ _id: { $in: demoUserIds } });
  console.log(`Deleted ${usersDeleted.deletedCount} demo user(s)`);

  // 8. Clean up dangling notifications on real users that pointed to those groups
  const notifClean = await User.updateMany(
    {},
    { $pull: { notifications: { relatedGroup: { $in: demoGroupIds } } } }
  );
  console.log(`Cleaned notifications on ${notifClean.modifiedCount} user(s)`);

  // 9. Show what remains
  const remainingUsers = await User.find().select('name email');
  const remainingGroups = await Group.find().select('name');
  console.log(`\n✓ Cleanup complete!`);
  console.log(`\nRemaining users (${remainingUsers.length}):`);
  remainingUsers.forEach((u) => console.log(`  • ${u.email} (${u.name})`));
  console.log(`\nRemaining groups (${remainingGroups.length}):`);
  if (remainingGroups.length === 0) console.log('  (none — clean slate)');
  else remainingGroups.forEach((g) => console.log(`  • ${g.name}`));

  await mongoose.disconnect();
})().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
