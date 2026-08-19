const { User, Ticket, Trade, LoginEvent } = require('../models');
const { generateOtp, otpExpiryDate } = require('./otpService');
const { sendMobileOtp } = require('./smsService');

const PROFILE_FIELDS =
  'firstName lastName email mobileNumber type profilePicture bio address ' +
  'kycVerified emailVerified mobileVerified createdAt updatedAt lastLogin passwordChangedAt authProvider';

async function getProfile(userId) {
  return User.findById(userId).select(PROFILE_FIELDS);
}

const EDITABLE_FIELDS = ['firstName', 'lastName', 'bio', 'address', 'profilePicture'];

async function updateProfile(userId, data) {
  const user = await User.findById(userId);
  if (!user) return null;

  for (const field of EDITABLE_FIELDS) {
    if (data[field] !== undefined) user[field] = data[field];
  }
  await user.save();
  return User.findById(userId).select(PROFILE_FIELDS);
}

async function changePassword(userId, oldPassword, newPassword) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) return { ok: false, error: 'User not found', status: 404 };
  if (!user.passwordHash) {
    return { ok: false, error: 'This account signs in with Google and has no password to change', status: 400 };
  }
  if (!(await user.comparePassword(oldPassword))) {
    return { ok: false, error: 'Current password is incorrect', status: 401 };
  }

  user.password = newPassword; // virtual setter -> re-hashed + passwordChangedAt bumped
  await user.save();
  return { ok: true };
}

/**
 * Starts a mobile-number change: same OTP-gated flow as
 * POST /auth/request-mobile-otp — a new number only takes effect once its
 * OTP is verified (via the existing /auth/verify-mobile-otp), so this does
 * NOT write the new number to `mobileNumber` yet. Reuses that endpoint
 * rather than duplicating the verify step here.
 */
async function updateMobile(userId, newMobile) {
  const user = await User.findById(userId);
  if (!user) return { ok: false, error: 'User not found', status: 404 };

  const conflict = await User.findOne({ mobileNumber: newMobile, _id: { $ne: userId } });
  if (conflict) return { ok: false, error: 'Mobile number already registered to another account', status: 409 };

  user.mobileNumber = newMobile;
  user.mobileOtp = generateOtp();
  user.mobileOtpExpiresAt = otpExpiryDate();
  user.mobileVerified = false;
  await user.save();

  try {
    await sendMobileOtp(newMobile, user.mobileOtp);
  } catch (err) {
    console.error('Mobile OTP delivery failed:', err.message);
    return { ok: false, error: 'Failed to send verification code. Please try again shortly.', status: 502 };
  }

  return { ok: true, registrationId: user._id };
}

async function getRecentTickets(userId, limit = 5) {
  return Ticket.find({ userId }).sort({ createdAt: -1 }).limit(limit);
}

/**
 * Merges real events from three sources — logins, trades, support tickets —
 * into one reverse-chronological feed. No fabricated event types (no
 * "profile updated" entries, since that isn't tracked anywhere yet).
 */
async function getRecentActivity(userId, limit = 10) {
  const [logins, trades, tickets] = await Promise.all([
    LoginEvent.find({ userId }).sort({ createdAt: -1 }).limit(limit),
    Trade.find({ $or: [{ buyerId: userId }, { sellerId: userId }] }).sort({ createdAt: -1 }).limit(limit),
    Ticket.find({ userId }).sort({ createdAt: -1 }).limit(limit),
  ]);

  const events = [
    ...logins.map((l) => ({
      type: 'login',
      description: `Logged in via ${l.method.replace('-', ' ')}`,
      timestamp: l.createdAt,
    })),
    ...trades.map((t) => ({
      type: 'trade',
      description: `${String(t.buyerId) === String(userId) ? 'Bought' : 'Sold'} ${t.quantityKWh} kWh at $${t.pricePerKwh}/kWh (${t.status})`,
      timestamp: t.createdAt,
    })),
    ...tickets.map((t) => ({
      type: 'ticket',
      description: `Raised ticket ${t.ticketId}: "${t.subject}"`,
      timestamp: t.createdAt,
    })),
  ];

  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return events.slice(0, limit);
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  updateMobile,
  getRecentTickets,
  getRecentActivity,
};
