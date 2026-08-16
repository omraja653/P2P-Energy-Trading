const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    // Login identity — stored lowercase/trimmed so lookups are case-insensitive.
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, 'Please provide a valid email address'],
    },
    // Bcrypt hash only — never store or return the plain password.
    // Set via the virtual `password` field below so hashing always happens.
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    // consumer = only buys energy, prosumer = generates and can sell surplus.
    // 'admin' is an internal addition (beyond the consumer/prosumer spec) so
    // routes like settlement-triggering have someone authorized to call them.
    type: {
      type: String,
      enum: ['consumer', 'prosumer', 'admin'],
      required: true,
      default: 'consumer',
    },
    // On-chain wallet used for settlement payouts / trade signing.
    // Optional at signup (added once the user links a wallet), so it's
    // sparse-unique: many docs can have no walletAddress, but no two can share one.
    walletAddress: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    // Know-Your-Customer verification flag — gates real-money trading/settlement.
    kycVerified: { type: Boolean, default: false },
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

// email and walletAddress already get unique indexes from `unique: true`
// above (walletAddress is also `sparse` so docs without one don't collide).

// Write-only virtual: `user.password = 'plaintext'` (or passing `password` to
// User.create/new User) hashes into passwordHash on save. Enforces the
// 8-character minimum on the raw password, before it's ever hashed.
userSchema
  .virtual('password')
  .set(function setPassword(plainPassword) {
    if (!plainPassword || plainPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    this._plainPassword = plainPassword;
  });

// Runs before validation (not pre('save')) so passwordHash is already
// populated by the time the `required` check on it runs.
userSchema.pre('validate', async function hashPassword(next) {
  if (!this._plainPassword) return next();
  this.passwordHash = await bcrypt.hash(this._plainPassword, 10);
  this._plainPassword = undefined;
  next();
});

// Used at login: compares a submitted plain-text password against the stored hash.
userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
