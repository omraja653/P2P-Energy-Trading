const axios = require('axios');

// Brevo's transactional email API — replaced Gmail/Nodemailer SMTP, which
// kept rejecting auth regardless of App Password fixes. Brevo's free tier
// (300 emails/day) needs just an API key + one verified sender address,
// no OAuth/app-password dance.
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function isEmailConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

async function sendViaBrevo({ toEmail, subject, text, html }) {
  await axios.post(
    BREVO_API_URL,
    {
      sender: { name: 'GridMate', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: toEmail }],
      subject,
      textContent: text,
      htmlContent: html,
    },
    {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 15000,
    }
  );
}

/**
 * Sends a registration/login OTP by email via Brevo. Falls back to logging
 * the OTP to the server console when BREVO_API_KEY/BREVO_SENDER_EMAIL
 * aren't configured — lets registration be exercised end-to-end in dev
 * before real credentials are wired up (mirrors this repo's
 * SMART_METER_SIMULATOR pattern).
 */
async function sendEmailOtp(toEmail, otp) {
  if (!isEmailConfigured()) {
    console.log(`[emailService:DEV FALLBACK] OTP for ${toEmail}: ${otp} (BREVO_API_KEY/BREVO_SENDER_EMAIL not set)`);
    return { delivered: false, fallback: true };
  }

  await sendViaBrevo({
    toEmail,
    subject: 'Your GridMate verification code',
    text: `Your GridMate verification code is ${otp}. It expires in 10 minutes.`,
    html: `<p>Your GridMate verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
  });
  return { delivered: true, fallback: false };
}

/** Same delivery mechanism, distinct subject/copy so the email reads correctly. */
async function sendPasswordResetOtp(toEmail, otp) {
  if (!isEmailConfigured()) {
    console.log(
      `[emailService:DEV FALLBACK] Password reset code for ${toEmail}: ${otp} (BREVO_API_KEY/BREVO_SENDER_EMAIL not set)`
    );
    return { delivered: false, fallback: true };
  }

  await sendViaBrevo({
    toEmail,
    subject: 'Reset your GridMate password',
    text: `Your GridMate password reset code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `<p>Your GridMate password reset code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p><p>If you didn't request this, you can ignore this email.</p>`,
  });
  return { delivered: true, fallback: false };
}

module.exports = { sendEmailOtp, sendPasswordResetOtp, isEmailConfigured };
