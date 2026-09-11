const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { sendTradingReminder } = require('../services/emailService');

// Once-a-day "the market is open, come trade" reminder. Uses plain timers
// (same style as settlementScheduler / auctionScheduler) rather than adding
// a cron dependency — the only scheduling need here is "fire at HH:00 IST
// every day", which is a next-occurrence calculation plus a 24h interval.
//
// IST is UTC+5:30 with no daylight saving, so the offset is a constant.

const IST_OFFSET_MIN = 5 * 60 + 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// Small pause between individual sends (Brevo rate-limit friendliness);
// disabled under test so the mocked-send suite stays fast.
const SEND_GAP_MS = process.env.NODE_ENV === 'test' ? 0 : 200;

const ENABLED = process.env.MORNING_EMAIL_ENABLED !== 'false'; // default on
const HOUR_IST = clampHour(Number(process.env.MORNING_EMAIL_HOUR_IST));
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://p2p-energy-trading-one.vercel.app';

let timeoutHandle = null;
let intervalHandle = null;
let lastRunISTDate = null; // 'YYYY-MM-DD' in IST — dedupe across restarts within a day

function clampHour(h) {
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 7;
}

function istDateString(d = new Date()) {
  return new Date(d.getTime() + IST_OFFSET_MIN * 60 * 1000).toISOString().slice(0, 10);
}

/** UTC epoch ms of the next HH:00 IST strictly after `from`. */
function nextRunAt(from = Date.now()) {
  const ist = new Date(from + IST_OFFSET_MIN * 60 * 1000);
  ist.setUTCHours(HOUR_IST, 0, 0, 0);
  let runUtc = ist.getTime() - IST_OFFSET_MIN * 60 * 1000;
  if (runUtc <= from) runUtc += DAY_MS;
  return runUtc;
}

/**
 * One-click unsubscribe link. No expiry — an unsubscribe link should keep
 * working indefinitely. `purpose` scopes it so it can't double as a session
 * token. Points at the API host (API_PUBLIC_URL) since the route renders its
 * own confirmation page; falls back to a relative path when unset (works
 * when the API is same-origin, e.g. local dev via the Vite proxy).
 */
function buildUnsubscribeUrl(userId) {
  const token = jwt.sign({ uid: String(userId), purpose: 'email-unsub' }, process.env.JWT_SECRET);
  const base = (process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
  return `${base}/api/notifications/email/unsubscribe?token=${token}`;
}

/**
 * @param {{ force?: boolean }} [opts] force:true bypasses the once-per-day
 *   dedupe (used by the admin test endpoint).
 * @returns {Promise<{ enabled:boolean, sent:number, failed:number, skipped:number, recipients:number }>}
 */
async function runOnce(opts = {}) {
  if (!ENABLED && !opts.force) {
    console.log('[morningEmailJob] disabled (MORNING_EMAIL_ENABLED=false)');
    return { enabled: false, sent: 0, failed: 0, skipped: 0, recipients: 0 };
  }

  const today = istDateString();
  if (!opts.force && lastRunISTDate === today) {
    console.log(`[morningEmailJob] already ran for ${today} — skipping`);
    return { enabled: true, sent: 0, failed: 0, skipped: 0, recipients: 0 };
  }

  // Real traders only — not admin/support, not PENDING/SUSPENDED/BLOCKED
  // accounts, not anyone who used the unsubscribe link. `@example.com` is
  // excluded on purpose: scripts/seed.js's demo accounts all use it and
  // those addresses don't exist, so mailing them just accrues hard bounces
  // against the Brevo sender's reputation every single day.
  const users = await User.find({
    status: 'ACTIVE',
    type: { $in: ['consumer', 'prosumer'] },
    dailyEmailOptOut: { $ne: true },
    email: { $exists: true, $ne: null, $not: /@example\.(com|org|net)$/i },
  }).select('email firstName');

  const marketplaceUrl = `${FRONTEND_URL}/marketplace`;
  const tradeHistoryUrl = `${FRONTEND_URL}/trade-history`;

  let sent = 0;
  let failed = 0;
  for (const u of users) {
    const res = await sendTradingReminder({
      toEmail: u.email,
      firstName: u.firstName,
      marketplaceUrl,
      tradeHistoryUrl,
      unsubscribeUrl: buildUnsubscribeUrl(u._id),
    });
    if (res.delivered) sent += 1;
    else if (!res.fallback) failed += 1;
    if (SEND_GAP_MS) await new Promise((r) => setTimeout(r, SEND_GAP_MS));
  }

  lastRunISTDate = today;
  const skipped = users.length - sent - failed;
  console.log(
    `[morningEmailJob] ${today}: ${users.length} recipient(s) — ${sent} sent, ${failed} failed, ${skipped} dev-fallback/skipped`
  );
  return { enabled: true, sent, failed, skipped, recipients: users.length };
}

function scheduleNext() {
  const at = nextRunAt();
  const delay = at - Date.now();
  console.log(
    `[morningEmailJob] next run ${new Date(at).toISOString()} (in ${Math.round(delay / 60000)} min), then daily at ${String(HOUR_IST).padStart(2, '0')}:00 IST`
  );
  timeoutHandle = setTimeout(() => {
    runOnce().catch((err) => console.error('[morningEmailJob] run failed:', err.message));
    intervalHandle = setInterval(() => {
      runOnce().catch((err) => console.error('[morningEmailJob] run failed:', err.message));
    }, DAY_MS);
  }, delay);
}

function start() {
  if (timeoutHandle || intervalHandle) return;
  if (!ENABLED) {
    console.log('[morningEmailJob] not started (MORNING_EMAIL_ENABLED=false)');
    return;
  }
  scheduleNext();
}

function stop() {
  if (timeoutHandle) clearTimeout(timeoutHandle);
  if (intervalHandle) clearInterval(intervalHandle);
  timeoutHandle = null;
  intervalHandle = null;
}

module.exports = { start, stop, runOnce, HOUR_IST, ENABLED };
