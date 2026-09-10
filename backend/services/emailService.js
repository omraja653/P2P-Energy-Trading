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

/**
 * Generic notification email for the ticketing system — one function reused
 * for all 4 events (created / assigned / updated / resolved) rather than 4
 * near-duplicate senders, since only the subject/heading/body differ.
 * Never throws on failure to send — ticket actions must succeed even if
 * notification delivery has a hiccup, so callers fire-and-log rather than
 * await-and-fail the whole request over an email.
 */
async function sendTicketNotification({ toEmail, subject, heading, body }) {
  if (!isEmailConfigured()) {
    console.log(`[emailService:DEV FALLBACK] Ticket email to ${toEmail}: "${subject}" — ${body}`);
    return { delivered: false, fallback: true };
  }

  try {
    await sendViaBrevo({
      toEmail,
      subject: `[GridMate Support] ${subject}`,
      text: `${heading}\n\n${body}`,
      html: `<p><strong>${heading}</strong></p><p>${body}</p>`,
    });
    return { delivered: true, fallback: false };
  } catch (err) {
    console.error('Ticket notification email failed:', err.message);
    return { delivered: false, fallback: false, error: err.message };
  }
}

/**
 * The daily "trading session is active" reminder (jobs/morningEmailJob.js).
 * One recipient per call — the job loops over users rather than passing a
 * recipient array, so nobody's address is exposed to anyone else (a single
 * Brevo `to: [...]` with many entries puts every address on one visible
 * header). Returns rather than throws on a send failure so one bad address
 * doesn't abort the whole morning batch.
 */
async function sendTradingReminder({ toEmail, firstName, marketplaceUrl, tradeHistoryUrl, unsubscribeUrl }) {
  const hi = firstName ? `Good morning, ${firstName}!` : 'Good morning!';
  const text = [
    hi,
    '',
    'The energy trading market is open today. Place your buy or sell orders in the marketplace — the market clears every couple of minutes and everyone trades at one fair price set by supply and demand.',
    '',
    `Go to the marketplace: ${marketplaceUrl}`,
    `View your trade history: ${tradeHistoryUrl}`,
    '',
    '— GridMate',
    '',
    `To stop these daily reminders: ${unsubscribeUrl}`,
  ].join('\n');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1e293b;line-height:1.5">
      <h2 style="margin:0 0 12px">⚡ ${hi}</h2>
      <p>The energy trading market is <strong>open today</strong>. Place your buy or sell orders in the
      marketplace — the market clears every couple of minutes and everyone trades at one fair price set by
      supply and demand.</p>
      <p style="margin:20px 0">
        <a href="${marketplaceUrl}" style="background:#009687;color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;display:inline-block">Go to Marketplace</a>
        &nbsp;
        <a href="${tradeHistoryUrl}" style="color:#009687;padding:11px 4px;text-decoration:underline;display:inline-block">View my orders</a>
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
      <p style="font-size:13px;color:#64748b">— GridMate</p>
      <p style="font-size:12px;color:#94a3b8">
        You're receiving this because you have a GridMate trading account.
        <a href="${unsubscribeUrl}" style="color:#94a3b8">Turn off daily reminders</a>.
      </p>
    </div>`;

  if (!isEmailConfigured()) {
    console.log(`[emailService:DEV FALLBACK] Trading reminder to ${toEmail} (BREVO_API_KEY/BREVO_SENDER_EMAIL not set)`);
    return { delivered: false, fallback: true };
  }
  try {
    await sendViaBrevo({ toEmail, subject: '⚡ Energy trading market is open today', text, html });
    return { delivered: true, fallback: false };
  } catch (err) {
    console.error(`Trading reminder email to ${toEmail} failed:`, err.message);
    return { delivered: false, fallback: false, error: err.message };
  }
}

module.exports = {
  sendEmailOtp,
  sendPasswordResetOtp,
  sendTicketNotification,
  sendTradingReminder,
  isEmailConfigured,
};
