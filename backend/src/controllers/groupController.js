const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const Invitation = require('../models/Invitation');
const { simplifyGroupDebts } = require('../utils/debtSimplifier');
const mailer = require('../utils/mailer');

exports.getGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({
      'members.user': req.user._id,
      isActive: true,
    })
      .populate('members.user', 'name email avatar')
      .populate('createdBy', 'name email')
      .sort({ updatedAt: -1 });

    res.json(groups);
  } catch (err) {
    next(err);
  }
};

exports.createGroup = async (req, res, next) => {
  try {
    const { name, description, type, currency, memberEmails = [] } = req.body;

    const members = [{ user: req.user._id, role: 'admin' }];
    const invitedUnregistered = []; // emails of people not yet on SplitEase

    // Normalize emails
    const cleanEmails = memberEmails
      .map((e) => (e || '').toLowerCase().trim())
      .filter((e) => e && e !== req.user.email.toLowerCase());

    if (cleanEmails.length > 0) {
      const existingUsers = await User.find({ email: { $in: cleanEmails } });
      const existingEmails = new Set(existingUsers.map((u) => u.email));

      for (const u of existingUsers) {
        members.push({ user: u._id, role: 'member' });
      }
      for (const email of cleanEmails) {
        if (!existingEmails.has(email)) invitedUnregistered.push(email);
      }
    }

    const group = await Group.create({
      name,
      description,
      type,
      currency: currency || req.user.currency || 'USD',
      members,
      createdBy: req.user._id,
    });

    await group.populate('members.user', 'name email avatar');

    // Send in-app + email notifications to existing members
    const addedUserIds = members.filter((m) => m.user.toString() !== req.user._id.toString()).map((m) => m.user);
    if (addedUserIds.length > 0) {
      const addedUsers = await User.find({ _id: { $in: addedUserIds } });
      await User.updateMany(
        { _id: { $in: addedUserIds } },
        {
          $push: {
            notifications: {
              message: `${req.user.name} added you to the group "${name}"`,
              type: 'group_added',
              relatedGroup: group._id,
            },
          },
        }
      );
      for (const u of addedUsers) {
        mailer.sendGroupInvite({ to: u.email, inviterName: req.user.name, groupName: name, isNewUser: false });
      }
    }

    // For unregistered emails: create Invitation records and send signup-link emails
    for (const email of invitedUnregistered) {
      const invite = await Invitation.create({
        email,
        group: group._id,
        invitedBy: req.user._id,
      });
      mailer.sendGroupInvite({
        to: email,
        inviterName: req.user.name,
        groupName: name,
        isNewUser: true,
        inviteToken: invite.token,
      });
    }

    res.status(201).json({
      ...group.toObject(),
      invitedUnregisteredCount: invitedUnregistered.length,
    });
  } catch (err) {
    next(err);
  }
};

exports.getGroup = async (req, res, next) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      'members.user': req.user._id,
      isActive: true,
    })
      .populate('members.user', 'name email avatar')
      .populate('createdBy', 'name email');

    if (!group) return res.status(404).json({ message: 'Group not found' });

    res.json(group);
  } catch (err) {
    next(err);
  }
};

exports.updateGroup = async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, 'members.user': req.user._id });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const adminMember = group.members.find(
      (m) => m.user.toString() === req.user._id.toString() && m.role === 'admin'
    );
    if (!adminMember) return res.status(403).json({ message: 'Only admins can update the group' });

    const { name, description, type, currency } = req.body;
    Object.assign(group, { name, description, type, currency });
    await group.save();

    await group.populate('members.user', 'name email avatar');
    res.json(group);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /groups/:id — delete a group.
 *
 * Authorisation: any group admin (or the original creator) can delete.
 *
 * Default behaviour is a HARD delete: the group, all its expenses,
 * settlements, and pending invitations are permanently removed. This
 * matches user expectations from the "Delete Group" button.
 *
 * Pass ?soft=true to instead archive the group (sets isActive=false,
 * data preserved). Useful for "I might want this back" cases.
 */
exports.deleteGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const userIdStr = req.user._id.toString();
    const isAdmin = group.members.some(
      (m) => m.user.toString() === userIdStr && m.role === 'admin'
    );
    const isCreator = group.createdBy.toString() === userIdStr;
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Only group admins can delete this group' });
    }

    const soft = req.query.soft === 'true';
    if (soft) {
      group.isActive = false;
      await group.save();
      return res.json({ message: 'Group archived', mode: 'soft' });
    }

    // Hard delete cascade — remove every record tied to this group
    const [expensesDel, settlementsDel, invitesDel] = await Promise.all([
      Expense.deleteMany({ group: group._id }),
      Settlement.deleteMany({ group: group._id }),
      Invitation.deleteMany({ group: group._id }),
    ]);
    await group.deleteOne();

    // Clean dangling notifications on members that referenced this group
    await User.updateMany(
      { 'notifications.relatedGroup': group._id },
      { $pull: { notifications: { relatedGroup: group._id } } }
    );

    res.json({
      message: 'Group permanently deleted',
      mode: 'hard',
      deleted: {
        expenses: expensesDel.deletedCount,
        settlements: settlementsDel.deletedCount,
        invitations: invitesDel.deletedCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.addMember = async (req, res, next) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const group = await Group.findOne({ _id: req.params.id, 'members.user': req.user._id });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const userToAdd = await User.findOne({ email });

    // Branch 1 — user is already on SplitEase: add them directly
    if (userToAdd) {
      const alreadyMember = group.members.some((m) => m.user.toString() === userToAdd._id.toString());
      if (alreadyMember) return res.status(400).json({ message: 'User is already a member' });

      group.members.push({ user: userToAdd._id, role: 'member' });
      await group.save();

      await userToAdd.updateOne({
        $push: {
          notifications: {
            message: `${req.user.name} added you to the group "${group.name}"`,
            type: 'group_added',
            relatedGroup: group._id,
          },
        },
      });

      mailer.sendGroupInvite({
        to: userToAdd.email,
        inviterName: req.user.name,
        groupName: group.name,
        isNewUser: false,
      });

      await group.populate('members.user', 'name email avatar');
      return res.json({ group, status: 'added' });
    }

    // Branch 2 — user not yet registered: create invitation + email signup link
    // Don't duplicate pending invitations for same email/group
    let invite = await Invitation.findOne({ email, group: group._id, status: 'pending' });
    if (!invite) {
      invite = await Invitation.create({ email, group: group._id, invitedBy: req.user._id });
    }

    mailer.sendGroupInvite({
      to: email,
      inviterName: req.user.name,
      groupName: group.name,
      isNewUser: true,
      inviteToken: invite.token,
    });

    await group.populate('members.user', 'name email avatar');
    res.json({ group, status: 'invited', message: `Invitation sent to ${email}. They'll auto-join after signing up.` });
  } catch (err) {
    next(err);
  }
};

exports.removeMember = async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, 'members.user': req.user._id });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isAdmin = group.members.some(
      (m) => m.user.toString() === req.user._id.toString() && m.role === 'admin'
    );
    const isSelf = req.params.userId === req.user._id.toString();

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: 'Not authorized to remove this member' });
    }

    group.members = group.members.filter((m) => m.user.toString() !== req.params.userId);
    await group.save();

    await group.populate('members.user', 'name email avatar');
    res.json(group);
  } catch (err) {
    next(err);
  }
};

exports.getGroupBalances = async (req, res, next) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      'members.user': req.user._id,
    }).populate('members.user', 'name email avatar');

    if (!group) return res.status(404).json({ message: 'Group not found' });

    const [expenses, settlements] = await Promise.all([
      Expense.find({ group: group._id }),
      Settlement.find({ group: group._id }),
    ]);

    const { balances, transactions } = simplifyGroupDebts(expenses, settlements);

    // Enrich with user info
    const memberMap = {};
    for (const m of group.members) {
      memberMap[m.user._id.toString()] = m.user;
    }

    const enrichedTransactions = transactions.map((t) => ({
      from: memberMap[t.from] || { _id: t.from, name: 'Unknown' },
      to: memberMap[t.to] || { _id: t.to, name: 'Unknown' },
      amount: t.amount,
      currency: group.currency,
    }));

    const enrichedBalances = Object.entries(balances).map(([userId, amount]) => ({
      user: memberMap[userId] || { _id: userId, name: 'Unknown' },
      amount: Math.round(amount * 100) / 100,
    }));

    res.json({ balances: enrichedBalances, transactions: enrichedTransactions });
  } catch (err) {
    next(err);
  }
};
