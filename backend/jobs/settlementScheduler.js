const { Trade } = require('../models');
const { settleTradeAndUpdateTrade } = require('../services/settlementService');

// Demo stand-in for a real T+1 (next business day) settlement cycle — NOT
// the same thing as Settlement.T1Date (the real "due the day after
// settlement" display field shown to admins in AdminSettlements.jsx,
// deliberately left untouched, since that's a real informational date, not
// a delay this code enforces). 60 seconds here purely so automatic
// settlement is actually observable in a demo/classroom setting; nothing
// about real energy-market settlement happens on a one-minute cycle.
const SETTLEMENT_DELAY_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;

let intervalHandle = null;
let running = false;

/**
 * Finds every trade that's been sitting at 'matched' for longer than the
 * demo delay and settles it — same real pipeline (EnergyTrade.recordTrade
 * + Settlement.settleTrade + the net wallet credit) the admin-triggered
 * route already used, just invoked on a timer instead of a click. A
 * per-trade failure (e.g. a missing wallet address, an RPC hiccup) is
 * logged and left at 'matched' — the next tick retries it automatically,
 * so there's no separate retry/backoff mechanism to build.
 *
 * `running` guard added after a real bug found live: with several stuck
 * trades all failing against a slow/unresponsive RPC endpoint, one full
 * sweep of dueTrades can take longer than CHECK_INTERVAL_MS — without this
 * guard the next tick starts before the previous one finishes, and two
 * concurrent settleTrade() calls for the SAME trade can each pass
 * settlementService's "does a Settlement already exist" check before
 * either one's write lands, each creating its own document (confirmed
 * live: one stuck trade accumulated 5 separate Settlement docs in 3
 * minutes despite settlementService.js already being fixed to reuse one
 * document per trade — that fix only closes the sequential-retry case,
 * not genuinely overlapping ticks). Mirrors auctionScheduler.js's
 * identical guard.
 */
async function runOnce() {
  if (running) {
    console.log('[settlementScheduler] previous sweep still running — skipping this tick');
    return 0;
  }
  running = true;
  try {
    const cutoff = new Date(Date.now() - SETTLEMENT_DELAY_MS);
    const dueTrades = await Trade.find({ status: 'matched', createdAt: { $lte: cutoff } });

    for (const trade of dueTrades) {
      try {
        const settlement = await settleTradeAndUpdateTrade(trade);
        console.log(
          `[settlementScheduler] auto-settled trade ${trade._id} — blockchainTxHash: ${settlement.blockchainTxHash}`
        );
      } catch (err) {
        console.error(`[settlementScheduler] failed to settle trade ${trade._id}:`, err.message);
      }
    }

    return dueTrades.length;
  } finally {
    running = false;
  }
}

function start() {
  if (intervalHandle) return; // already running — safe to call more than once
  console.log(`[settlementScheduler] starting — checking every ${CHECK_INTERVAL_MS / 1000}s for trades matched over ${SETTLEMENT_DELAY_MS / 1000}s ago`);
  runOnce().catch((err) => console.error('[settlementScheduler] initial run failed:', err.message));
  intervalHandle = setInterval(() => {
    runOnce().catch((err) => console.error('[settlementScheduler] run failed:', err.message));
  }, CHECK_INTERVAL_MS);
}

function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { start, stop, runOnce, SETTLEMENT_DELAY_MS };
