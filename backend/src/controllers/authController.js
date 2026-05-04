const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Group = require('../models/Group');
const Invitation = require('../models/Invitation');
const mailer = require('../utils/mailer');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { name, email, password, currency } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, currency });
    const token = signToken(user._id);

    // Auto-accept any pending invitations for this email
    const pendingInvites = await Invitation.find({
      email: user.email,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    let joinedGroups = 0;
    for (const invite of pendingInvites) {
      const group = await Group.findById(invite.group);
      if (!group) continue;
      const alreadyMember = group.members.some((m) => m.user.toString() === user._id.toString());
      if (!alreadyMember) {
        group.members.push({ user: user._id, role: 'member' });
        await group.save();
        joinedGroups++;

        await user.updateOne({
          $push: {
            notifications: {
              message: `You joined "${group.name}" via invitation`,
              type: 'group_added',
              relatedGroup: group._id,
            },
          },
        });
      }
      invite.status = 'accepted';
      await invite.save();
    }

    // Welcome email (non-blocking — don't fail registration if mail fails)
    mailer.sendWelcome({ to: user.email, name: user.name });

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        currency: user.currency,
        paymentMethods: user.paymentMethods || [],
      },
      joinedGroups, // tells the frontend how many groups they auto-joined
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/forgot-password — start a reset flow.
 *
 * Always returns 200 even if email doesn't exist, to avoid leaking
 * which addresses are registered.
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });

    if (user) {
      // Generate raw token for the email link, store hashed version in DB
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      mailer.sendPasswordReset({ to: user.email, name: user.name, token: rawToken });
    }

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/reset-password — complete the reset flow with a fresh password.
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+password +passwordResetToken +passwordResetExpires');

    if (!user) return res.status(400).json({ message: 'Token is invalid or has expired' });

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    const jwtToken = signToken(user._id);

    res.json({
      message: 'Password reset successful',
      token: jwtToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        currency: user.currency,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user._id);

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        currency: user.currency,
        paymentMethods: user.paymentMethods || [],
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};
