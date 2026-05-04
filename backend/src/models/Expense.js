const mongoose = require('mongoose');

// A split entry: who owes how much for this expense
const splitSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    percentage: { type: Number, min: 0, max: 100 },
  },
  { _id: false }
);

// Who actually paid (supports multiple payers)
const payerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be positive'],
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'AED', 'INR', 'JPY', 'CAD', 'AUD'],
    },
    // splitType determines how the expense is divided
    splitType: {
      type: String,
      enum: ['equal', 'exact', 'percentage'],
      default: 'equal',
    },
    paidBy: [payerSchema],
    splits: [splitSchema],
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    receiptUrl: String,
    category: {
      type: String,
      enum: ['food', 'transport', 'accommodation', 'entertainment', 'utilities', 'shopping', 'health', 'other'],
      default: 'other',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    // Recurring expense support
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringFrequency: {
      type: String,
      enum: ['weekly', 'monthly', 'yearly'],
    },
    /** Next date a recurring template should spawn a new instance. */
    recurringNextDate: { type: Date, default: null },
    /** Set on auto-generated instances; points back to the template expense. */
    recurringParent: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true, trim: true, maxlength: 500 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    /**
     * Slack-style emoji reactions. A user can leave multiple distinct emojis
     * but only one entry per (user, emoji) pair (toggling re-clicks remove).
     */
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, required: true, maxlength: 10 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Only return non-deleted expenses by default
expenseSchema.pre(/^find/, function (next) {
  if (!this._conditions.isDeleted) {
    this.where({ isDeleted: false });
  }
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);
