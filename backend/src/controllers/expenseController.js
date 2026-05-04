const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const mailer = require('../utils/mailer');

/**
 * Computes splits array based on splitType:
 *  - equal: amount / memberCount for each member
 *  - exact: as provided
 *  - percentage: member.percentage/100 * totalAmount
 */
function computeSplits(splitType, amount, members, providedSplits) {
  if (splitType === 'equal') {
    const share = Math.round((amount / members.length) * 100) / 100;
    const remainder = Math.round((amount - share * members.length) * 100) / 100;
    return members.map((userId, idx) => ({
      user: userId,
      amount: idx === 0 ? share + remainder : share, // assign rounding remainder to first member
    }));
  }

  if (splitType === 'exact') {
    const total = providedSplits.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(total - amount) > 0.01) {
      throw new Error(`Exact amounts (${total}) must sum to total (${amount})`);
    }
    return providedSplits;
  }

  if (splitType === 'percentage') {
    const totalPct = providedSplits.reduce((sum, s) => sum + s.percentage, 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      throw new Error(`Percentages must sum to 100, got ${totalPct}`);
    }
    return providedSplits.map((s) => ({
      user: s.user,
      amount: Math.round((s.percentage / 100) * amount * 100) / 100,
      percentage: s.percentage,
    }));
  }

  throw new Error('Invalid splitType');
}

exports.createExpense = async (req, res, next) => {
  try {
    const {
      groupId,
      description,
      amount,
      currency,
      splitType,
      paidBy,
      splits: providedSplits,
      notes,
      category,
      date,
      isRecurring,
      recurringFrequency,
    } = req.body;

    const group = await Group.findOne({ _id: groupId, 'members.user': req.user._id });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const memberIds = group.members.map((m) => m.user.toString());

    // Validate payers are group members
    for (const p of paidBy) {
      if (!memberIds.includes(p.user.toString())) {
        return res.status(400).json({ message: 'Payer must be a group member' });
      }
    }

    // If splits not provided for equal, use all members
    const splitMembers =
      splitType === 'equal' && (!providedSplits || providedSplits.length === 0)
        ? memberIds
        : providedSplits.map((s) => s.user.toString());

    let computedSplits;
    try {
      computedSplits = computeSplits(splitType, amount, splitMembers, providedSplits || []);
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    // For recurring expenses, set when the next instance should spawn
    let recurringNextDate = null;
    if (isRecurring && recurringFrequency) {
      const { advanceDate } = require('../utils/recurringScheduler');
      recurringNextDate = advanceDate(new Date(date || Date.now()), recurringFrequency);
    }

    const expense = await Expense.create({
      group: groupId,
      description,
      amount,
      currency: currency || group.currency,
      splitType,
      paidBy,
      splits: computedSplits,
      notes,
      category,
      date: date || Date.now(),
      createdBy: req.user._id,
      isRecurring: !!isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
      recurringNextDate,
    });

    await expense.populate([
      { path: 'paidBy.user', select: 'name email avatar' },
      { path: 'splits.user', select: 'name email avatar' },
      { path: 'createdBy', select: 'name email' },
    ]);

    // Notify group members (except creator)
    const otherMemberIds = memberIds.filter((id) => id !== req.user._id.toString());
    if (otherMemberIds.length > 0) {
      await User.updateMany(
        { _id: { $in: otherMemberIds } },
        {
          $push: {
            notifications: {
              message: `${req.user.name} added expense "${description}" (${expense.currency} ${amount}) in "${group.name}"`,
              type: 'expense_added',
              relatedGroup: groupId,
            },
          },
        }
      );

      // Email each member with their share
      const otherMembers = await User.find({ _id: { $in: otherMemberIds } });
      for (const m of otherMembers) {
        const mySplit = expense.splits.find((s) => s.user._id?.toString() === m._id.toString() || s.user.toString() === m._id.toString());
        mailer.sendExpenseAdded({
          to: m.email,
          payerName: req.user.name,
          groupName: group.name,
          description,
          amount,
          currency: expense.currency,
          share: mySplit?.amount || 0,
        });
      }
    }

    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
};

exports.getGroupExpenses = async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.groupId, 'members.user': req.user._id });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const expenses = await Expense.find({ group: req.params.groupId })
      .populate('paidBy.user', 'name email avatar')
      .populate('splits.user', 'name email avatar')
      .populate('comments.user', 'name email avatar')
      .populate('reactions.user', 'name email avatar')
      .populate('createdBy', 'name email')
      .sort({ date: -1 });

    res.json(expenses);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /expenses — list expenses across all groups, with rich filtering.
 *
 * Query params (all optional):
 *   q         — text search on description (case-insensitive)
 *   category  — exact category match
 *   groupId   — restrict to one group
 *   from / to — ISO date range filter on expense.date
 *   minAmount / maxAmount — numeric range
 *   payerId   — only expenses where this user paid
 *   sort      — "date" (default desc) | "amount"
 *   limit     — defaults to 100, max 500
 */
exports.getUserExpenses = async (req, res, next) => {
  try {
    const {
      q, category, groupId, from, to,
      minAmount, maxAmount, payerId,
      sort = 'date',
      limit = 100,
    } = req.query;

    const groups = await Group.find({ 'members.user': req.user._id }).select('_id');
    const myGroupIds = groups.map((g) => g._id);

    const filter = { group: groupId ? groupId : { $in: myGroupIds } };
    if (q)        filter.description = { $regex: q.trim(), $options: 'i' };
    if (category) filter.category = category;
    if (payerId)  filter['paidBy.user'] = payerId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to)   filter.date.$lte = new Date(to);
    }
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = parseFloat(minAmount);
      if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
    }

    const sortKey = sort === 'amount' ? { amount: -1 } : { date: -1 };
    const safeLimit = Math.min(parseInt(limit, 10) || 100, 500);

    const expenses = await Expense.find(filter)
      .populate('group', 'name currency type')
      .populate('paidBy.user', 'name email avatar')
      .populate('splits.user', 'name email avatar')
      .sort(sortKey)
      .limit(safeLimit);

    res.json(expenses);
  } catch (err) {
    next(err);
  }
};

exports.getExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('paidBy.user', 'name email avatar')
      .populate('splits.user', 'name email avatar')
      .populate('createdBy', 'name email')
      .populate('group', 'name');

    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    const group = await Group.findOne({ _id: expense.group._id, 'members.user': req.user._id });
    if (!group) return res.status(403).json({ message: 'Not authorized' });

    res.json(expense);
  } catch (err) {
    next(err);
  }
};

exports.updateExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    const group = await Group.findOne({ _id: expense.group, 'members.user': req.user._id });
    if (!group) return res.status(403).json({ message: 'Not authorized' });

    const isCreator = expense.createdBy.toString() === req.user._id.toString();
    const isAdmin = group.members.find(
      (m) => m.user.toString() === req.user._id.toString() && m.role === 'admin'
    );
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Only the creator or admin can edit this expense' });
    }

    const { description, amount, currency, splitType, paidBy, splits: providedSplits, notes, category, date } = req.body;

    const memberIds = group.members.map((m) => m.user.toString());
    const splitMembers =
      splitType === 'equal' && (!providedSplits || providedSplits.length === 0)
        ? memberIds
        : (providedSplits || []).map((s) => s.user.toString());

    let computedSplits;
    try {
      computedSplits = computeSplits(splitType, amount, splitMembers, providedSplits || []);
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    Object.assign(expense, {
      description,
      amount,
      currency,
      splitType,
      paidBy,
      splits: computedSplits,
      notes,
      category,
      date,
    });

    await expense.save();
    await expense.populate([
      { path: 'paidBy.user', select: 'name email avatar' },
      { path: 'splits.user', select: 'name email avatar' },
    ]);

    res.json(expense);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /expenses/:id/comments — add a comment to an expense.
 * Notifies (in-app + email) all OTHER group members.
 */
exports.addComment = async (req, res, next) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Comment text is required' });
    if (text.length > 500) return res.status(400).json({ message: 'Comment too long (max 500 chars)' });

    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    const group = await Group.findOne({ _id: expense.group, 'members.user': req.user._id });
    if (!group) return res.status(403).json({ message: 'Not authorized' });

    expense.comments.push({ user: req.user._id, text });
    await expense.save();

    await expense.populate([
      { path: 'comments.user', select: 'name email avatar' },
      { path: 'paidBy.user', select: 'name email avatar' },
      { path: 'splits.user', select: 'name email avatar' },
    ]);

    // Notify other group members
    const otherMemberIds = group.members
      .map((m) => m.user.toString())
      .filter((id) => id !== req.user._id.toString());

    if (otherMemberIds.length > 0) {
      await User.updateMany(
        { _id: { $in: otherMemberIds } },
        {
          $push: {
            notifications: {
              message: `${req.user.name} commented on "${expense.description}" in "${group.name}"`,
              type: 'comment',
              relatedGroup: group._id,
            },
          },
        }
      );

      const otherMembers = await User.find({ _id: { $in: otherMemberIds } });
      for (const m of otherMembers) {
        mailer.sendExpenseComment({
          to: m.email,
          commenterName: req.user.name,
          groupName: group.name,
          expenseDescription: expense.description,
          commentText: text,
        });
      }
    }

    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /expenses/:id/reactions — toggle an emoji reaction.
 * Body: { emoji }
 * If the user has already reacted with this emoji, it's removed.
 * Otherwise it's added. Returns the updated expense.
 */
exports.toggleReaction = async (req, res, next) => {
  try {
    const emoji = (req.body.emoji || '').toString().trim();
    if (!emoji) return res.status(400).json({ message: 'Emoji is required' });
    if (emoji.length > 10) return res.status(400).json({ message: 'Invalid emoji' });

    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    // Verify user is in the expense's group
    const group = await Group.findOne({ _id: expense.group, 'members.user': req.user._id });
    if (!group) return res.status(403).json({ message: 'Not authorized' });

    const userId = req.user._id.toString();
    const existingIdx = expense.reactions.findIndex(
      (r) => r.user.toString() === userId && r.emoji === emoji
    );

    if (existingIdx >= 0) {
      expense.reactions.splice(existingIdx, 1); // toggle off
    } else {
      expense.reactions.push({ user: req.user._id, emoji });
    }
    await expense.save();

    await expense.populate([
      { path: 'reactions.user', select: 'name email avatar' },
      { path: 'comments.user', select: 'name email avatar' },
      { path: 'paidBy.user', select: 'name email avatar' },
      { path: 'splits.user', select: 'name email avatar' },
    ]);

    res.json(expense);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /expenses/:id/comments/:commentId — remove your own comment (or admin).
 */
exports.deleteComment = async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    const group = await Group.findOne({ _id: expense.group, 'members.user': req.user._id });
    if (!group) return res.status(403).json({ message: 'Not authorized' });

    const comment = expense.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    const isAuthor = comment.user.toString() === req.user._id.toString();
    const isAdmin = group.members.find(
      (m) => m.user.toString() === req.user._id.toString() && m.role === 'admin'
    );
    if (!isAuthor && !isAdmin) return res.status(403).json({ message: 'Not authorized to delete this comment' });

    comment.deleteOne();
    await expense.save();

    await expense.populate([
      { path: 'comments.user', select: 'name email avatar' },
      { path: 'paidBy.user', select: 'name email avatar' },
      { path: 'splits.user', select: 'name email avatar' },
    ]);

    res.json(expense);
  } catch (err) {
    next(err);
  }
};

exports.deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    const group = await Group.findOne({ _id: expense.group, 'members.user': req.user._id });
    if (!group) return res.status(403).json({ message: 'Not authorized' });

    const isCreator = expense.createdBy.toString() === req.user._id.toString();
    const isAdmin = group.members.find(
      (m) => m.user.toString() === req.user._id.toString() && m.role === 'admin'
    );
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Only the creator or admin can delete this expense' });
    }

    expense.isDeleted = true;
    await expense.save();

    res.json({ message: 'Expense deleted' });
  } catch (err) {
    next(err);
  }
};
