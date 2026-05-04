const Settlement = require('../models/Settlement');
const Group = require('../models/Group');
const User = require('../models/User');
const mailer = require('../utils/mailer');

exports.createSettlement = async (req, res, next) => {
  try {
    const { groupId, paidTo, amount, currency, notes } = req.body;

    if (!groupId || !paidTo || !amount) {
      return res.status(400).json({ message: 'groupId, paidTo, and amount are required' });
    }

    const group = await Group.findOne({ _id: groupId, 'members.user': req.user._id });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const recipientIsMember = group.members.some((m) => m.user.toString() === paidTo);
    if (!recipientIsMember) {
      return res.status(400).json({ message: 'Recipient must be a group member' });
    }

    const settlement = await Settlement.create({
      group: groupId,
      paidBy: req.user._id,
      paidTo,
      amount,
      currency: currency || group.currency,
      notes,
      recordedBy: req.user._id,
    });

    await settlement.populate([
      { path: 'paidBy', select: 'name email avatar' },
      { path: 'paidTo', select: 'name email avatar' },
      { path: 'group', select: 'name' },
    ]);

    // Notify the recipient (in-app + email)
    const recipient = await User.findById(paidTo);
    if (recipient) {
      await recipient.updateOne({
        $push: {
          notifications: {
            message: `${req.user.name} paid you ${settlement.currency} ${amount} in "${group.name}"`,
            type: 'settled',
            relatedGroup: groupId,
          },
        },
      });
      mailer.sendSettlementRecorded({
        to: recipient.email,
        payerName: req.user.name,
        amount,
        currency: settlement.currency,
        groupName: group.name,
      });
    }

    res.status(201).json(settlement);
  } catch (err) {
    next(err);
  }
};

exports.getGroupSettlements = async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.groupId, 'members.user': req.user._id });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const settlements = await Settlement.find({ group: req.params.groupId })
      .populate('paidBy', 'name email avatar')
      .populate('paidTo', 'name email avatar')
      .sort({ settledAt: -1 });

    res.json(settlements);
  } catch (err) {
    next(err);
  }
};

exports.getUserSettlements = async (req, res, next) => {
  try {
    const settlements = await Settlement.find({
      $or: [{ paidBy: req.user._id }, { paidTo: req.user._id }],
    })
      .populate('paidBy', 'name email avatar')
      .populate('paidTo', 'name email avatar')
      .populate('group', 'name')
      .sort({ settledAt: -1 })
      .limit(50);

    res.json(settlements);
  } catch (err) {
    next(err);
  }
};

exports.deleteSettlement = async (req, res, next) => {
  try {
    const settlement = await Settlement.findById(req.params.id);
    if (!settlement) return res.status(404).json({ message: 'Settlement not found' });

    if (settlement.recordedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the recorder can delete this settlement' });
    }

    await settlement.deleteOne();
    res.json({ message: 'Settlement deleted' });
  } catch (err) {
    next(err);
  }
};
