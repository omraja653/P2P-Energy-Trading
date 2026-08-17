const crypto = require('crypto');

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/** Cryptographically random 6-digit OTP, zero-padded (e.g. "004821"). */
function generateOtp() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function otpExpiryDate() {
  return new Date(Date.now() + OTP_EXPIRY_MS);
}

/** True if `otp` matches `storedOtp` and `expiresAt` hasn't passed. */
function isOtpValid(otp, storedOtp, expiresAt) {
  return Boolean(storedOtp) && otp === storedOtp && expiresAt && expiresAt.getTime() > Date.now();
}

module.exports = { generateOtp, otpExpiryDate, isOtpValid, OTP_EXPIRY_MS };
