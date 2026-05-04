/**
 * Seed script — creates the "Badminton Buddies" demo group with 4 members
 * and a "Court" expense (AED 50, equally split).
 *
 * Usage:
 *   node scripts/seed.js                    # uses default test users
 *   node scripts/seed.js you@example.com    # also adds your account to the group
 *
 * Idempotent — safe to run repeatedly. Cleans only the Badminton Buddies group.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Group = require('../src/models/Group');
const Expense = require('../src/models/Expense');

async function findOrCreateUser(name, email, password, currency = 'AED') {
  let user = await User.findOne({ email });
  if (user) {
    console.log(`  ↳ exists: ${email}`);
    return user;
  }
  user = await User.create({ name, email, password, currency });
  console.log(`  ↳ created: ${email}`);
  return user;
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const extraEmail = process.argv[2]; // optional — current user's email

  console.log('\nSeeding users:');
  const users = await Promise.all([
    findOrCreateUser('Zain Haider', 'zain@splitease.demo', 'password123'),
    findOrCreateUser('Nasir', 'nasir@splitease.demo', 'password123'),
    findOrCreateUser('Wasib Raza', 'wasib@splitease.demo', 'password123'),
    findOrCreateUser('Salman Maqsood', 'salman@splitease.demo', 'password123'),
  ]);

  // Optionally include the caller's existing account
  if (extraEmail) {
    const me = await User.findOne({ email: extraEmail.toLowerCase() });
    if (me && !users.find((u) => u._id.equals(me._id))) {
      users.push(me);
      console.log(`  ↳ added you: ${me.email}`);
    } else if (!me) {
      console.log(`  ⚠ ${extraEmail} not found — skipping`);
    }
  }

  console.log('\nSeeding group:');
  // Replace any existing Badminton Buddies group + its expenses
  const existing = await Group.findOne({ name: 'Badminton Buddies' });
  if (existing) {
    await Expense.deleteMany({ group: existing._id });
    await Group.deleteOne({ _id: existing._id });
    console.log('  ↳ removed previous Badminton Buddies group + expenses');
  }

  const group = await Group.create({
    name: 'Badminton Buddies',
    description: '4-player badminton court bookings',
    type: 'other',
    currency: 'AED',
    members: users.map((u, i) => ({ user: u._id, role: i === 0 ? 'admin' : 'member' })),
    createdBy: users[0]._id,
    isActive: true,
  });
  console.log(`  ↳ created Badminton Buddies (${users.length} members, AED)`);

  console.log('\nSeeding expense:');
  const amount = 50;
  const share = Math.round((amount / users.length) * 100) / 100;
  const remainder = Math.round((amount - share * users.length) * 100) / 100;

  await Expense.create({
    group: group._id,
    description: 'Court',
    amount,
    currency: 'AED',
    splitType: 'equal',
    paidBy: [{ user: users[0]._id, amount }], // Zain paid the full amount
    splits: users.map((u, idx) => ({
      user: u._id,
      amount: idx === 0 ? share + remainder : share,
    })),
    notes: '',
    category: 'entertainment',
    date: new Date('2026-05-04'),
    createdBy: users[0]._id,
  });
  console.log(`  ↳ Court — AED ${amount.toFixed(2)} paid by Zain, split equally (${share} each)`);

  // Notify all members (except creator)
  await User.updateMany(
    { _id: { $in: users.slice(1).map((u) => u._id) } },
    {
      $push: {
        notifications: {
          message: `Zain Haider added you to the group "Badminton Buddies"`,
          type: 'group_added',
          relatedGroup: group._id,
        },
      },
    }
  );

  console.log('\n✓ Seed complete!\n');
  console.log('Demo accounts (password: password123):');
  users.slice(0, 4).forEach((u) => console.log(`  • ${u.email}  (${u.name})`));
  console.log('\nLog in at http://localhost:5173/login');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
