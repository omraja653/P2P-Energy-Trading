function isSmsConfigured() {
  return Boolean(process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE);
}

let client;
function getClient() {
  if (!client) {
    // Lazily required so the twilio package never has to touch its own
    // env-var checks when SMS isn't configured at all (dev fallback path).
    const twilio = require('twilio');
    client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

/**
 * Sends a registration OTP by SMS. Falls back to logging the OTP to the
 * server console when Twilio isn't configured — same dev-fallback pattern
 * as emailService, so registration works locally before real credentials
 * are wired up.
 */
async function sendMobileOtp(toMobileNumber, otp) {
  if (!isSmsConfigured()) {
    console.log(`[smsService:DEV FALLBACK] OTP for ${toMobileNumber}: ${otp} (TWILIO_* not set)`);
    return { delivered: false, fallback: true };
  }

  await getClient().messages.create({
    from: process.env.TWILIO_PHONE,
    to: toMobileNumber,
    body: `Your GridMate verification code is ${otp}. It expires in 10 minutes.`,
  });
  return { delivered: true, fallback: false };
}

module.exports = { sendMobileOtp, isSmsConfigured };
