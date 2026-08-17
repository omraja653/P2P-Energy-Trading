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
    // Not required for Google-authenticated accounts, which have no password.
    passwordHash: {
      type: String,
      required: [
        function passwordRequired() {
          return this.authProvider !== 'google';
        },
        'Password is required',
      ],
      select: false,
    },
    // E.164-ish phone number used for SMS OTP verification / mobile-OTP
    // login. Optional at registration (for everyone, local or Google) —
    // mobileVerified gates specific actions (mobile-OTP login, trading)
    // rather than account activation itself.
    mobileNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    // local = email+password registration (gated by OTP verification below).
    // google = signed up via Google Identity Services; pre-verified, no OTP step.
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    // Google's stable per-account subject id, used to look up a returning
    // Google user without depending on their email staying constant.
    googleId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    // PENDING accounts can't log in yet — set to ACTIVE once email OTP
    // verification succeeds (or immediately for Google sign-ups). Mobile
    // verification is independent of this: it's optional and gates its own
    // things (mobile-OTP login, trading) rather than account activation.
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE'],
      default: 'PENDING',
    },
    emailVerified: { type: Boolean, default: false },
    mobileVerified: { type: Boolean, default: false },
    // OTP fields are select:false — never returned by a normal query, and
    // cleared out once used (or once superseded by a fresh one).
    emailOtp: { type: String, select: false },
    emailOtpExpiresAt: { type: Date, select: false },
    mobileOtp: { type: String, select: false },
    mobileOtpExpiresAt: { type: Date, select: false },
    // Separate from emailOtp on purpose — a password-reset request must not
    // clobber (or be clobbered by) an unrelated in-flight registration/login
    // OTP for the same account.
    resetPasswordOtp: { type: String, select: false },
    resetPasswordOtpExpiresAt: { type: Date, select: false },
    // consumer = only buys energy, prosumer = generates and can sell surplus.
    // 'admin' is an internal addition (beyond the consumer/prosumer spec) so
    // routes like settlement-triggering have someone authorized to call them.
    // Deliberately NOT required / no default — new accounts (local or
    // Google) start with no type at all, and the frontend's RoleSelector
    // modal is what sets it post-login, exactly once, via PATCH /auth/role.
    type: {
      type: String,
      enum: ['consumer', 'prosumer', 'admin'],
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
