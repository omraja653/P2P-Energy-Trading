const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requireFields } = require('../middleware/validation');
const { generateOtp, otpExpiryDate, isOtpValid } = require('../services/otpService');
const { sendEmailOtp, sendPasswordResetOtp } = require('../services/emailService');
const { sendMobileOtp } = require('../services/smsService');
const { verifyGoogleIdToken, isGoogleAuthConfigured } = require('../services/googleAuthService');

const router = express.Router();

// Min 8 chars, at least 1 uppercase letter, 1 digit, 1 special character.
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
// Strict E.164: leading + and country code are REQUIRED. Twilio rejects
// anything else ("Invalid 'To' Phone Number"), so accepting a bare national
// number here would only surface as a confusing delivery failure later.
const MOBILE_REGEX = /^\+[1-9]\d{7,14}$/;
const REGISTERABLE_TYPES = ['consumer', 'prosumer']; // 'admin' isn't self-assignable

// Includes the verification flags directly in the JWT (in addition to the
// fresh copies always available in the response body / GET /me) so callers
// that only have a token handy can read them without an extra request.
// The trading-gate middleware still re-checks the DB itself rather than
// trusting these claims — they can go stale between token issuances.
function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      type: user.type,
      emailVerified: user.emailVerified,
      mobileVerified: user.mobileVerified,
      kycVerified: user.kycVerified,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '7d' }
  );
}

// Shape returned to clients — never includes passwordHash or OTP fields.
// type is explicitly null (not omitted) when unset, so the frontend can
// always check `user.type === null` to decide whether to show RoleSelector.
function publicUser(user) {
  return {
    id: user._id,
    email: user.email,
    mobileNumber: user.mobileNumber,
    firstName: user.firstName,
    lastName: user.lastName,
    type: user.type || null,
    walletAddress: user.walletAddress,
    location: user.location || null,
    kycVerified: user.kycVerified,
    status: user.status,
    emailVerified: user.emailVerified,
    mobileVerified: user.mobileVerified,
    authProvider: user.authProvider,
  };
}

router.post(
  '/register',
  requireFields(['firstName', 'lastName', 'email', 'password']),
  async (req, res, next) => {
    try {
      const { firstName, lastName, email, mobileNumber, password } = req.body;

      if (mobileNumber && !MOBILE_REGEX.test(mobileNumber)) {
        return res.status(400).json({ error: 'mobileNumber must be a valid phone number, e.g. +14155552671' });
      }
      if (!PASSWORD_REGEX.test(password)) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character',
        });
      }

      // Only include mobileNumber in the uniqueness check when it was
      // actually provided — an $or clause with an undefined value would
      // otherwise match any other account that also skipped mobile.
      const orConditions = [{ email }];
      if (mobileNumber) orConditions.push({ mobileNumber });
      const existing = await User.findOne({ $or: orConditions });
      if (existing) {
        return res.status(409).json({ error: 'Email or mobile number already registered' });
      }

      const emailOtp = generateOtp();
      const userFields = {
        firstName,
        lastName,
        email,
        // type is intentionally not set here — chosen post-verification
        // via RoleSelector (PATCH /auth/role).
        authProvider: 'local',
        status: 'PENDING',
        emailOtp,
        emailOtpExpiresAt: otpExpiryDate(),
      };

      let mobileOtp;
      if (mobileNumber) {
        mobileOtp = generateOtp();
        userFields.mobileNumber = mobileNumber;
        userFields.mobileOtp = mobileOtp;
        userFields.mobileOtpExpiresAt = otpExpiryDate();
      }

      const user = new User(userFields);
      user.password = password; // virtual setter -> hashed into passwordHash on save
      await user.save();

      // Email and mobile delivery are judged separately: email verification
      // is mandatory, mobile is optional. A failed SMS must NOT sink an
      // otherwise-good registration — doing so used to leave the account
      // created-but-unreachable (retrying hit a 409, and the UI never
      // advanced to the OTP screen), soft-locking the user out entirely.
      const [emailResult, smsResult] = await Promise.allSettled([
        sendEmailOtp(email, emailOtp),
        mobileNumber ? sendMobileOtp(mobileNumber, mobileOtp) : Promise.resolve(null),
      ]);

      if (emailResult.status === 'rejected') {
        // Email is mandatory, so this registration can't proceed. Remove the
        // just-created account so the user can simply try again instead of
        // being permanently blocked by "email already registered".
        console.error('Email OTP delivery failed:', emailResult.reason?.message);
        await User.deleteOne({ _id: user._id });
        return res.status(502).json({
          error: 'Could not send the verification email. Please check the address and try again.',
        });
      }

      const smsFailed = mobileNumber && smsResult.status === 'rejected';
      if (smsFailed) {
        console.error('Mobile OTP delivery failed:', smsResult.reason?.message);
        // Drop the unusable mobile OTP but keep the number on file, so the
        // user can retry verification later from MobileVerificationModal.
        user.mobileOtp = undefined;
        user.mobileOtpExpiresAt = undefined;
        await user.save();
      }

      res.status(201).json({
        message: 'OTP sent',
        registrationId: user._id,
        status: user.status,
        emailVerified: user.emailVerified,
        mobileVerified: user.mobileVerified,
        // Whether there's a mobile-OTP step to show at all: false when no
        // number was given, or when the SMS couldn't be delivered (in which
        // case the user finishes with email and can verify mobile later).
        mobileCollected: Boolean(mobileNumber) && !smsFailed,
        ...(smsFailed && {
          warning: "We couldn't send the SMS code. You can verify your mobile number later from your account.",
        }),
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'Email, mobile number, or wallet address already in use' });
      }
      next(err);
    }
  }
);

// Mandatory. Email verification alone activates the account (status ->
// ACTIVE) — mobile is independently optional (see verify-mobile-otp).
// Returns a session immediately so the registration UI can proceed straight
// into the (optional) mobile step and role selection without a manual login.
router.post(
  '/verify-email-otp',
  requireFields(['registrationId', 'otp']),
  async (req, res, next) => {
    try {
      const { registrationId, otp } = req.body;
      const user = await User.findById(registrationId).select('+emailOtp +emailOtpExpiresAt');
      if (!user) return res.status(404).json({ error: 'Registration not found' });

      if (!isOtpValid(otp, user.emailOtp, user.emailOtpExpiresAt)) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }

      user.emailVerified = true;
      user.emailOtp = undefined;
      user.emailOtpExpiresAt = undefined;
      user.status = 'ACTIVE';
      await user.save();

      res.json({
        message: 'Email verified',
        status: user.status,
        user: publicUser(user),
        token: signToken(user),
      });
    } catch (err) {
      next(err);
    }
  }
);

// Optional — can be skipped entirely, or done later via
// POST /auth/request-mobile-otp for an already-authenticated user (e.g. a
// Google sign-in, or a local user who skipped this at registration).
// Doesn't touch `status` (email alone activates the account); just flips
// mobileVerified and returns a fresh session.
router.post(
  '/verify-mobile-otp',
  requireFields(['registrationId', 'otp']),
  async (req, res, next) => {
    try {
      const { registrationId, otp } = req.body;
      const user = await User.findById(registrationId).select('+mobileOtp +mobileOtpExpiresAt');
      if (!user) return res.status(404).json({ error: 'Registration not found' });

      if (!isOtpValid(otp, user.mobileOtp, user.mobileOtpExpiresAt)) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }

      user.mobileVerified = true;
      user.mobileOtp = undefined;
      user.mobileOtpExpiresAt = undefined;
      await user.save();

      res.json({
        message: 'Mobile number verified',
        status: user.status,
        user: publicUser(user),
        token: signToken(user),
      });
    } catch (err) {
      next(err);
    }
  }
);

// Not in the original spec, but the registration UI needs a way to
// re-trigger delivery (e.g. the OTP expired or the SMS never arrived)
// without restarting the whole registration.
router.post(
  '/resend-otp',
  requireFields(['registrationId', 'channel']),
  async (req, res, next) => {
    try {
      const { registrationId, channel } = req.body;
      if (!['email', 'mobile'].includes(channel)) {
        return res.status(400).json({ error: "channel must be 'email' or 'mobile'" });
      }

      const user = await User.findById(registrationId);
      if (!user) return res.status(404).json({ error: 'Registration not found' });

      try {
        if (channel === 'email') {
          if (user.emailVerified) return res.status(400).json({ error: 'Email already verified' });
          user.emailOtp = generateOtp();
          user.emailOtpExpiresAt = otpExpiryDate();
          await user.save();
          await sendEmailOtp(user.email, user.emailOtp);
        } else {
          if (user.mobileVerified) return res.status(400).json({ error: 'Mobile number already verified' });
          if (!user.mobileNumber) return res.status(400).json({ error: 'No mobile number on file for this account' });
          user.mobileOtp = generateOtp();
          user.mobileOtpExpiresAt = otpExpiryDate();
          await user.save();
          await sendMobileOtp(user.mobileNumber, user.mobileOtp);
        }
      } catch (sendErr) {
        // Don't leak the raw provider error (e.g. SMTP/Twilio auth failure
        // details) to the client — same clean-failure pattern as /register.
        console.error('OTP resend failed:', sendErr.message);
        return res.status(502).json({ error: 'Failed to resend OTP. Please try again shortly.' });
      }

      res.json({ message: 'OTP resent' });
    } catch (err) {
      next(err);
    }
  }
);

// Not in the original spec, but MobileVerificationModal needs a way for an
// already-authenticated user (Google sign-in with no mobile on file, or a
// local user who skipped it at registration) to add and verify a mobile
// number after the fact. Reuses verify-mobile-otp for the confirm step —
// the returned registrationId is just this user's own id.
router.post(
  '/request-mobile-otp',
  requireAuth,
  requireFields(['mobileNumber']),
  async (req, res, next) => {
    try {
      const { mobileNumber } = req.body;
      if (!MOBILE_REGEX.test(mobileNumber)) {
        return res.status(400).json({ error: 'mobileNumber must be a valid phone number, e.g. +14155552671' });
      }

      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const conflict = await User.findOne({ mobileNumber, _id: { $ne: user._id } });
      if (conflict) return res.status(409).json({ error: 'Mobile number already registered to another account' });

      user.mobileNumber = mobileNumber;
      user.mobileOtp = generateOtp();
      user.mobileOtpExpiresAt = otpExpiryDate();
      user.mobileVerified = false;
      await user.save();

      try {
        await sendMobileOtp(mobileNumber, user.mobileOtp);
      } catch (sendErr) {
        console.error('Mobile OTP delivery failed:', sendErr.message);
        return res.status(502).json({ error: 'Failed to send OTP. Please try again shortly.' });
      }

      res.json({ message: 'OTP sent', registrationId: user._id });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'Mobile number already registered to another account' });
      }
      next(err);
    }
  }
);

router.post(
  '/login-email-password',
  requireFields(['email', 'password']),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+passwordHash');

      // Guard against Google-only accounts (no passwordHash) before comparing —
      // bcrypt.compare against an undefined hash throws rather than failing cleanly.
      if (!user || !user.passwordHash || !(await user.comparePassword(password))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!user.emailVerified) {
        return res.status(403).json({ error: 'Please verify your email before logging in' });
      }

      res.json({ user: publicUser(user), token: signToken(user) });
    } catch (err) {
      next(err);
    }
  }
);

// Not in the original spec, but login-email-otp / login-mobile-otp need a
// way to actually get an OTP before they can verify one. Only works for
// already-verified channels — this is a passwordless *login* mechanism for
// existing verified accounts, not a way to bootstrap verification.
router.post('/request-login-otp', async (req, res, next) => {
  try {
    const { email, mobileNumber } = req.body;
    if (!email && !mobileNumber) {
      return res.status(400).json({ error: 'Provide either email or mobileNumber' });
    }

    const user = await User.findOne(email ? { email } : { mobileNumber });
    if (!user) return res.status(404).json({ error: 'Account not found' });

    try {
      if (email) {
        if (!user.emailVerified) return res.status(403).json({ error: 'This email is not verified yet' });
        user.emailOtp = generateOtp();
        user.emailOtpExpiresAt = otpExpiryDate();
        await user.save();
        await sendEmailOtp(user.email, user.emailOtp);
      } else {
        if (!user.mobileVerified) return res.status(403).json({ error: 'This mobile number is not verified yet' });
        user.mobileOtp = generateOtp();
        user.mobileOtpExpiresAt = otpExpiryDate();
        await user.save();
        await sendMobileOtp(user.mobileNumber, user.mobileOtp);
      }
    } catch (sendErr) {
      console.error('Login OTP delivery failed:', sendErr.message);
      return res.status(502).json({ error: 'Failed to send OTP. Please try again shortly.' });
    }

    res.json({ message: 'OTP sent' });
  } catch (err) {
    next(err);
  }
});

router.post('/login-email-otp', requireFields(['email', 'otp']), async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email }).select('+emailOtp +emailOtpExpiresAt');
    if (!user || !isOtpValid(otp, user.emailOtp, user.emailOtpExpiresAt)) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }
    if (!user.emailVerified) {
      return res.status(403).json({ error: 'Please verify your email before logging in' });
    }

    user.emailOtp = undefined;
    user.emailOtpExpiresAt = undefined;
    await user.save();

    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login-mobile-otp', requireFields(['mobileNumber', 'otp']), async (req, res, next) => {
  try {
    const { mobileNumber, otp } = req.body;
    const user = await User.findOne({ mobileNumber }).select('+mobileOtp +mobileOtpExpiresAt');
    if (!user || !isOtpValid(otp, user.mobileOtp, user.mobileOtpExpiresAt)) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }
    if (!user.mobileVerified) {
      return res.status(403).json({ error: 'Mobile number not verified — verify it first to use this login method' });
    }

    user.mobileOtp = undefined;
    user.mobileOtpExpiresAt = undefined;
    await user.save();

    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

// Not in the original spec, but "Forgot Password?" needs somewhere to go.
// Only meaningful for local accounts — Google accounts have no password to
// reset, so this points them at Google sign-in instead of issuing a code.
router.post('/forgot-password', requireFields(['email']), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'Account not found' });

    if (user.authProvider === 'google') {
      return res.status(400).json({
        error: 'This account signs in with Google and has no password to reset — use "Sign in with Google" instead.',
      });
    }

    const otp = generateOtp();
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpiresAt = otpExpiryDate();
    await user.save();

    try {
      await sendPasswordResetOtp(email, otp);
    } catch (sendErr) {
      console.error('Password reset OTP delivery failed:', sendErr.message);
      return res.status(502).json({ error: 'Failed to send the reset code. Please try again shortly.' });
    }

    res.json({ message: 'Reset code sent' });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/reset-password',
  requireFields(['email', 'otp', 'newPassword']),
  async (req, res, next) => {
    try {
      const { email, otp, newPassword } = req.body;

      if (!PASSWORD_REGEX.test(newPassword)) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character',
        });
      }

      const user = await User.findOne({ email }).select('+resetPasswordOtp +resetPasswordOtpExpiresAt');
      if (!user || !isOtpValid(otp, user.resetPasswordOtp, user.resetPasswordOtpExpiresAt)) {
        return res.status(400).json({ error: 'Invalid or expired code' });
      }

      user.password = newPassword; // virtual setter -> re-hashed into passwordHash on save
      user.resetPasswordOtp = undefined;
      user.resetPasswordOtpExpiresAt = undefined;
      await user.save();

      // Log the user straight in, same as every other identity-confirming
      // action in this flow (email/mobile verification, role selection).
      res.json({ message: 'Password reset', user: publicUser(user), token: signToken(user) });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/google', requireFields(['idToken']), async (req, res, next) => {
  try {
    if (!isGoogleAuthConfigured()) {
      return res.status(503).json({ error: 'Google login is not configured' });
    }

    let profile;
    try {
      profile = await verifyGoogleIdToken(req.body.idToken);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    let user = await User.findOne({ googleId: profile.googleId });

    if (!user) {
      // Same email already registered locally — link the Google identity
      // to that account instead of creating a duplicate.
      user = await User.findOne({ email: profile.email });
    }

    if (!user) {
      user = new User({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        // type intentionally unset — RoleSelector handles it post-login,
        // same as local registrations.
        authProvider: 'google',
        googleId: profile.googleId,
        status: 'ACTIVE',
        emailVerified: true,
        mobileVerified: false, // no mobile number collected via Google sign-up
      });
      await user.save();
    } else if (!user.googleId) {
      user.googleId = profile.googleId;
      if (!user.emailVerified) user.emailVerified = true;
      await user.save();
    }

    res.json({
      user: publicUser(user),
      token: signToken(user),
      // Lets the frontend show MobileVerificationModal right after Google
      // login when there's no verified mobile number on file yet.
      requiresMobileVerification: !user.mobileVerified,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'This Google account is already linked to another user' });
    }
    next(err);
  }
});

// Sets the caller's own type (consumer/prosumer only — never admin). Called
// by the RoleSelector modal after first login/registration/Google sign-in,
// whenever `user.type` is null. Returns a fresh token because the old one's
// `type` claim (used by requireRole elsewhere) would otherwise be stale
// until the user's next login.
router.patch('/role', requireAuth, requireFields(['type']), async (req, res, next) => {
  try {
    const { type } = req.body;
    if (!REGISTERABLE_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${REGISTERABLE_TYPES.join(', ')}` });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.type = type;
    await user.save();

    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

router.patch('/location', requireAuth, requireFields(['lat', 'lng']), async (req, res, next) => {
  try {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ error: 'lat must be a valid latitude between -90 and 90' });
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'lng must be a valid longitude between -180 and 180' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.location = {
      lat,
      lng,
      label: req.body.label?.trim() || user.location?.label || 'My location',
      city: req.body.city?.trim() || user.location?.city || '',
    };
    await user.save();

    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

// Not in the original spec, but VerificationGate needs a way to check
// *fresh* verification status — the localStorage-cached user object (or an
// old JWT's claims) can go stale as soon as another tab/session changes it.
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
