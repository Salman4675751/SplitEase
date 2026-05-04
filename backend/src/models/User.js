const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    avatar: {
      type: String,
      default: '',
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'AED', 'INR', 'JPY', 'CAD', 'AUD'],
    },
    notifications: [
      {
        message: String,
        type: { type: String, enum: ['group_added', 'expense_added', 'settled', 'comment', 'general'] },
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        relatedGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
      },
    ],
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    /**
     * Payment receive details — shown to other group members in Settle Up.
     * SplitEase never processes money; this just gives the payer a one-tap
     * way to copy the recipient's IBAN / Aani / PayPal / DU Pay handle and
     * complete the transfer in their own banking app (free + instant).
     */
    paymentMethods: [
      {
        type: {
          type: String,
          enum: ['iban', 'aani', 'paypal', 'dupay'],
          required: true,
        },
        label: { type: String, trim: true, maxlength: 60, default: '' },
        value: { type: String, required: true, trim: true, maxlength: 200 },
        isDefault: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
