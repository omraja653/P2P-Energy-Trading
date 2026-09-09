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

/**
 * Finds every trade that's been sitting at 'matched' for longer than the
 * demo delay and settles it — same real pipeline (EnergyTrade.recordTrade
 * + Settlement.settleTrade + the net wallet credit) the admin-triggered
 * route already used, just invoked on a timer instead of a click. A
 * per-trade failure (e.g. a missing wallet address, an RPC hiccup) is
 * logged and left at 'matched' — the next tick retries it automatically,
 * so there's no separate retry/backoff mechanism to build.
 */
async function runOnce() {
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
