const User = require('../models/User');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const Group = require('../models/Group');

const ALLOWED_PAYMENT_TYPES = ['iban', 'aani', 'paypal', 'dupay'];

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, avatar, currency } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, avatar, currency },
      { new: true, runValidators: true }
    );
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

// Search users by email (for adding to groups)
exports.searchUsers = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email query is required' });

    const users = await User.find({
      email: { $regex: email, $options: 'i' },
      _id: { $ne: req.user._id },
    }).select('name email avatar').limit(10);

    res.json(users);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /users/balance-summary — overall "you are owed" / "you owe" totals.
 *
 * Algorithm: for each group the user belongs to, compute their net balance
 * using the same authoritative simplifier the group view uses
 * (`simplifyGroupDebts`). The user's net per group is positive when they're
 * a creditor, negative when they're a debtor. Sum positives → totalOwed,
 * absolute negatives → totalOwing.
 *
 * Caveat: amounts are summed numerically across all groups regardless of
 * currency, matching the existing single-currency dashboard. A future
 * multi-currency dashboard should return a per-currency breakdown.
 */
exports.getBalanceSummary = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const { simplifyGroupDebts } = require('../utils/debtSimplifier');

    const groups = await Group.find({ 'members.user': req.user._id, isActive: true }).select('_id');
    const groupIds = groups.map((g) => g._id);

    // Single bulk fetch + group in memory — avoids N+1 queries
    const [expenses, settlements] = await Promise.all([
      Expense.find({ group: { $in: groupIds } }),
      Settlement.find({ group: { $in: groupIds } }),
    ]);

    const expensesByGroup = new Map();
    const settlementsByGroup = new Map();
    for (const e of expenses) {
      const k = e.group.toString();
      if (!expensesByGroup.has(k)) expensesByGroup.set(k, []);
      expensesByGroup.get(k).push(e);
    }
    for (const s of settlements) {
      const k = s.group.toString();
      if (!settlementsByGroup.has(k)) settlementsByGroup.set(k, []);
      settlementsByGroup.get(k).push(s);
    }

    let totalOwed = 0;
    let totalOwing = 0;

    for (const g of groups) {
      const k = g._id.toString();
      const { balances } = simplifyGroupDebts(
        expensesByGroup.get(k) || [],
        settlementsByGroup.get(k) || []
      );
      const myNet = balances[userId] || 0;
      if (myNet > 0.01) totalOwed += myNet;
      else if (myNet < -0.01) totalOwing += Math.abs(myNet);
    }

    res.json({
      totalOwed: Math.round(totalOwed * 100) / 100,
      totalOwing: Math.round(totalOwing * 100) / 100,
      netBalance: Math.round((totalOwed - totalOwing) * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /users/me/payment-methods — replace the current user's payment methods.
 * Body: { paymentMethods: [{ type, label, value, isDefault }] }
 */
exports.updatePaymentMethods = async (req, res, next) => {
  try {
    const { paymentMethods } = req.body;
    if (!Array.isArray(paymentMethods)) {
      return res.status(400).json({ message: 'paymentMethods must be an array' });
    }

    // Validate every entry; only one default at most
    let defaultCount = 0;
    const cleaned = [];
    for (const m of paymentMethods) {
      if (!ALLOWED_PAYMENT_TYPES.includes(m.type)) {
        return res.status(400).json({ message: `Invalid type: ${m.type}` });
      }
      const value = (m.value || '').toString().trim();
      if (!value) return res.status(400).json({ message: 'Each method needs a value' });
      if (value.length > 200) return res.status(400).json({ message: 'Value too long' });

      const isDefault = !!m.isDefault;
      if (isDefault) defaultCount++;
      cleaned.push({
        type: m.type,
        label: (m.label || '').toString().trim().slice(0, 60),
        value,
        isDefault,
      });
    }
    if (defaultCount > 1) return res.status(400).json({ message: 'Only one method may be default' });

    const user = await User.findById(req.user._id);
    user.paymentMethods = cleaned;
    await user.save();

    res.json({ paymentMethods: user.paymentMethods });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /users/:id/payment-methods — fetch a member's payment receive details.
 * Only returned if the requester shares at least one group with the target,
 * so payment info isn't publicly enumerable.
 */
exports.getUserPaymentMethods = async (req, res, next) => {
  try {
    const targetId = req.params.id;

    if (req.user._id.toString() !== targetId) {
      // Verify a shared group exists
      const shared = await Group.findOne({
        'members.user': { $all: [req.user._id, targetId] },
      });
      if (!shared) return res.status(403).json({ message: 'No shared groups' });
    }

    const target = await User.findById(targetId).select('name email paymentMethods');
    if (!target) return res.status(404).json({ message: 'User not found' });

    res.json({
      _id: target._id,
      name: target.name,
      email: target.email,
      paymentMethods: target.paymentMethods || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /users/me/friends — list every user the caller shares a group with,
 * with the pairwise net balance summed across all shared groups.
 *
 * Pairwise (not minimum-cash-flow) is the right primitive here: a friends
 * list should reflect "money that has flowed between us specifically",
 * not the network-simplified result.
 *
 * For each shared group:
 *   For each expense:
 *     If I paid AND friend has a split → friend owes me their share
 *     If friend paid AND I have a split → I owe friend my share
 *   For each settlement:
 *     If I paid friend → reduces my debt (or grows their debt to me)
 *     If friend paid me → reduces their debt
 */
exports.getFriends = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();

    const groups = await Group.find({ 'members.user': req.user._id, isActive: true })
      .select('_id name type currency members')
      .populate('members.user', 'name email avatar');

    const groupIds = groups.map((g) => g._id);
    const [expenses, settlements] = await Promise.all([
      Expense.find({ group: { $in: groupIds } }),
      Settlement.find({ group: { $in: groupIds } }),
    ]);

    const expensesByGroup = new Map();
    const settlementsByGroup = new Map();
    for (const e of expenses) {
      const k = e.group.toString();
      if (!expensesByGroup.has(k)) expensesByGroup.set(k, []);
      expensesByGroup.get(k).push(e);
    }
    for (const s of settlements) {
      const k = s.group.toString();
      if (!settlementsByGroup.has(k)) settlementsByGroup.set(k, []);
      settlementsByGroup.get(k).push(s);
    }

    // friendId -> { user, totalNet, byGroup: [{group, balance, currency}] }
    const friends = new Map();

    const ensureFriend = (friendUser) => {
      const id = friendUser._id.toString();
      if (!friends.has(id)) {
        friends.set(id, {
          user: { _id: friendUser._id, name: friendUser.name, email: friendUser.email, avatar: friendUser.avatar },
          totalNet: 0,
          byGroup: [],
        });
      }
      return friends.get(id);
    };

    for (const group of groups) {
      const k = group._id.toString();
      const groupExpenses = expensesByGroup.get(k) || [];
      const groupSettlements = settlementsByGroup.get(k) || [];

      // Pairwise balances within this group: { friendId: amount }
      // Positive = friend owes me. Negative = I owe friend.
      const pairwise = new Map();

      for (const expense of groupExpenses) {
        const totalPaid = expense.paidBy.reduce((s, p) => s + p.amount, 0);
        if (totalPaid <= 0) continue;

        for (const payer of expense.paidBy) {
          const payerId = payer.user.toString();
          const payerShare = payer.amount / totalPaid;

          for (const split of expense.splits) {
            const debtorId = split.user.toString();
            if (debtorId === payerId) continue;
            const slice = split.amount * payerShare;

            if (debtorId === userId) {
              // I owe payer their slice of this split
              pairwise.set(payerId, (pairwise.get(payerId) || 0) - slice);
            } else if (payerId === userId) {
              // Debtor owes me
              pairwise.set(debtorId, (pairwise.get(debtorId) || 0) + slice);
            }
          }
        }
      }

      for (const s of groupSettlements) {
        const from = s.paidBy.toString();
        const to = s.paidTo.toString();
        if (from === userId) {
          pairwise.set(to, (pairwise.get(to) || 0) + s.amount);
        } else if (to === userId) {
          pairwise.set(from, (pairwise.get(from) || 0) - s.amount);
        }
      }

      // Add every other member as a "friend" — even if balance is zero
      // (we still want to show them in the list)
      for (const m of group.members) {
        const friendId = m.user._id.toString();
        if (friendId === userId) continue;
        const friend = ensureFriend(m.user);
        const balance = pairwise.get(friendId) || 0;
        friend.totalNet += balance;
        friend.byGroup.push({
          group: { _id: group._id, name: group.name, type: group.type },
          balance: Math.round(balance * 100) / 100,
          currency: group.currency,
        });
      }
    }

    const list = Array.from(friends.values()).map((f) => ({
      ...f,
      totalNet: Math.round(f.totalNet * 100) / 100,
    }));

    // Sort: people you owe / who owe you first, then alphabetical
    list.sort((a, b) => {
      const aActive = Math.abs(a.totalNet) > 0.01 ? 1 : 0;
      const bActive = Math.abs(b.totalNet) > 0.01 ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return a.user.name.localeCompare(b.user.name);
    });

    res.json(list);
  } catch (err) {
    next(err);
  }
};

// Mark notifications as read
exports.markNotificationsRead = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $set: { 'notifications.$[].read': true },
    });
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    next(err);
  }
};
