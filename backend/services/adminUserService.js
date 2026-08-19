const { User, Trade } = require('../models');
const { generateOtp, otpExpiryDate } = require('./otpService');
const { sendEmailOtp } = require('./emailService');
const { sendMobileOtp } = require('./smsService');

const USER_LIST_FIELDS = 'firstName lastName email mobileNumber type status emailVerified mobileVerified kycVerified createdAt lastLogin';

async function getUsers({ role, status, emailVerified, mobileVerified, kycVerified, search } = {}) {
  const query = {};
  if (role) query.type = role;
  if (status) query.status = status;
  if (emailVerified !== undefined) query.emailVerified = emailVerified === 'true';
  if (mobileVerified !== undefined) query.mobileVerified = mobileVerified === 'true';
  if (kycVerified !== undefined) query.kycVerified = kycVerified === 'true';

  if (search) {
    const re = new RegExp(search.trim(), 'i');
    query.$or = [{ firstName: re }, { lastName: re }, { email: re }];
  }

  return User.find(query).select(USER_LIST_FIELDS).sort({ createdAt: -1 });
}

async function getUserDetail(userId) {
  const user = await User.findById(userId).select(
    'firstName lastName email mobileNumber type status emailVerified mobileVerified kycVerified createdAt lastLogin authProvider'
  );
  if (!user) return null;

  const trades = await Trade.find({ $or: [{ buyerId: userId }, { sellerId: userId }] })
    .sort({ createdAt: -1 })
    .limit(10);

  return { user, recentTrades: trades };
}

async function setStatus(userId, status) {
  const user = await User.findById(userId);
  if (!user) return null;
  user.status = status;
  await user.save();
  return user;
}

async function verifyEmail(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  user.emailVerified = true;
  if (user.status === 'PENDING') user.status = 'ACTIVE';
  user.emailOtp = undefined;
  user.emailOtpExpiresAt = undefined;
  await user.save();
  return user;
}

async function verifyMobile(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  user.mobileVerified = true;
  user.mobileOtp = undefined;
  user.mobileOtpExpiresAt = undefined;
  await user.save();
  return user;
}

async function resendOtp(userId, channel) {
  const user = await User.findById(userId);
  if (!user) return { ok: false, error: 'User not found', status: 404 };

  if (channel === 'email') {
    user.emailOtp = generateOtp();
    user.emailOtpExpiresAt = otpExpiryDate();
    await user.save();
    await sendEmailOtp(user.email, user.emailOtp);
  } else if (channel === 'mobile') {
    if (!user.mobileNumber) return { ok: false, error: 'No mobile number on file for this user', status: 400 };
    user.mobileOtp = generateOtp();
    user.mobileOtpExpiresAt = otpExpiryDate();
    await user.save();
    await sendMobileOtp(user.mobileNumber, user.mobileOtp);
  } else {
    return { ok: false, error: "channel must be 'email' or 'mobile'", status: 400 };
  }

  return { ok: true };
}

async function deleteUser(userId) {
  const result = await User.deleteOne({ _id: userId });
  return result.deletedCount > 0;
}

module.exports = { getUsers, getUserDetail, setStatus, verifyEmail, verifyMobile, resendOtp, deleteUser };
