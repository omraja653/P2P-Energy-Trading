const express = require('express');
const axios = require('axios');
const { EnergyListing, Trade } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requireFields } = require('../middleware/validation');

const router = express.Router();

// Azure AI Foundry's unified model-inference API — different request shape
// than plain OpenAI: URL is a fixed /models/chat/completions path (not
// scoped to the deployment), the deployment name goes in the body as
// `model`, and auth is `Authorization: Bearer` rather than `api-key`.
const AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-05-01-preview';
const MAX_MESSAGE_LENGTH = 500;

function buildAzureUrl() {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/+$/, '');
  return `${endpoint}/models/chat/completions?api-version=${AZURE_API_VERSION}`;
}

// Mirrors backend/routes/pricing.js — the grid tariff P2P prices are
// benchmarked against, used here just to ground the assistant's answers.
const GRID_PRICE_PER_KWH = 0.15;
const GRID_BUYBACK_PER_KWH = 0.05;

/**
 * Pulls a short snapshot of live marketplace state so the assistant can
 * answer "what's the price right now" / "who's selling" questions instead
 * of only speaking in generalities.
 */
async function buildMarketContext() {
  const [stats, sample] = await Promise.all([
    EnergyListing.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalKWh: { $sum: '$quantityKWh' },
          avgPrice: { $avg: '$pricePerKwh' },
          minPrice: { $min: '$pricePerKwh' },
          maxPrice: { $max: '$pricePerKwh' },
        },
      },
    ]),
    EnergyListing.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('prosumerId', 'firstName'),
  ]);

  if (!stats[0]) {
    return 'Live market data: no active listings right now.';
  }

  const { count, totalKWh, avgPrice, minPrice, maxPrice } = stats[0];
  const listingLines = sample
    .map((l) => {
      const name = l.prosumerId?.firstName || 'A prosumer';
      return `- ${name}: ${l.quantityKWh} kWh at $${l.pricePerKwh}/kWh (${l.tradingType})`;
    })
    .join('\n');

  return [
    'Live market data:',
    `- Active listings: ${count}, totaling ${totalKWh.toFixed(2)} kWh available`,
    `- P2P price range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)} per kWh (avg $${avgPrice.toFixed(2)})`,
    `- Grid retail price for comparison: $${GRID_PRICE_PER_KWH.toFixed(2)}/kWh`,
    'Nearby prosumers currently selling:',
    listingLines || '(none listed at the moment)',
  ].join('\n');
}

/**
 * Pulls the requesting user's own trade data — pending trades and a real
 * this-month savings/earnings figure — so "my trades" / "my savings"
 * questions are answered from the database, not invented by the model.
 */
async function buildUserContext(user) {
  const userId = user.id;

  const pendingTrades = await Trade.find({
    $or: [{ buyerId: userId }, { sellerId: userId }],
    status: { $in: ['matched', 'verified'] },
  })
    .sort({ createdAt: -1 })
    .limit(5);

  const pendingLines = pendingTrades
    .map((t) => {
      const role = String(t.buyerId) === String(userId) ? 'Buying' : 'Selling';
      return `- ${role} ${t.quantityKWh} kWh @ $${t.pricePerKwh}/kWh ($${t.totalAmount.toFixed(2)} total) — status: ${t.status}`;
    })
    .join('\n');

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const isProsumer = user.type === 'prosumer';
  const monthTrades = await Trade.find({
    [isProsumer ? 'sellerId' : 'buyerId']: userId,
    status: { $in: ['verified', 'settled'] },
    createdAt: { $gte: startOfMonth },
  });

  let savingsLine;
  if (isProsumer) {
    const earned = monthTrades.reduce((sum, t) => sum + t.totalAmount, 0);
    const buybackEquivalent = monthTrades.reduce((sum, t) => sum + t.quantityKWh * GRID_BUYBACK_PER_KWH, 0);
    savingsLine = `This month: earned $${earned.toFixed(2)} from P2P sales, vs an estimated $${buybackEquivalent.toFixed(2)} if sold back to the grid at $${GRID_BUYBACK_PER_KWH}/kWh — $${(earned - buybackEquivalent).toFixed(2)} more.`;
  } else {
    const paid = monthTrades.reduce((sum, t) => sum + t.totalAmount, 0);
    const gridEquivalent = monthTrades.reduce((sum, t) => sum + t.quantityKWh * GRID_PRICE_PER_KWH, 0);
    savingsLine = `This month: paid $${paid.toFixed(2)} for P2P energy, vs an estimated $${gridEquivalent.toFixed(2)} at the grid retail price of $${GRID_PRICE_PER_KWH}/kWh — $${(gridEquivalent - paid).toFixed(2)} saved.`;
  }

  return [
    `This user is a ${user.type}.`,
    "Their pending trades (matched or verified, not yet settled):",
    pendingLines || '(none right now)',
    savingsLine,
  ].join('\n');
}

const SYSTEM_PROMPT = `You are GridMate, the assistant for a peer-to-peer (P2P) solar energy trading platform.

How the platform works, for context:
- Prosumers (households with solar panels) list surplus energy for sale, either "intraday" (same-day) or "dayahead" (next-day).
- Consumers buy directly from prosumers at a "fair price" set by supply and demand — usually cheaper than the grid retail price, but better for the seller than the grid's buyback rate.
- A trade moves through stages: matched -> verified (smart meter data confirms the energy was actually delivered) -> settled (payment is split between the prosumer, a grid wheeling/transport fee, and a small platform fee).
- Settlement can also be recorded on the Polygon blockchain for transparency.

How to handle common requests:
- Price alerts ("alert me below $X/kWh"): confirm the threshold back clearly and compare it to today's live price. Be upfront that this chat doesn't send push notifications — the alert is only noted for this conversation, not saved as a background job.
- "My trades" / trade status: answer from the "pending trades" data below, which is real and specific to this user. If it's empty, say so plainly rather than inventing a trade.
- "Nearby prosumers": this platform has no location/distance data yet, so treat "nearby" as "currently active platform-wide" and list from the live market data below. If the user specifically asks about distance or location, say that isn't supported yet.
- Savings / earnings: use the "this month" figure below — it's a real calculation from their trade history, not an estimate you invent.
- Prosumer tips: there's no seller-rating system on this platform yet, so don't claim one exists if asked. Give general actionable advice instead: price competitively against the current range, list consistently, and verify meter data promptly so trades settle faster.

Keep answers short and actionable: 2-4 sentences by default, concrete numbers or next steps over long explanations. Only go longer if the user explicitly asks for detail. If asked something outside this platform's scope, politely redirect to what you can help with.`;

router.post('/', requireAuth, requireFields(['message']), async (req, res, next) => {
  try {
    const { message } = req.body;

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message must be a non-empty string' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `message must be under ${MAX_MESSAGE_LENGTH} characters` });
    }

    if (!process.env.OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_DEPLOYMENT) {
      return res.status(503).json({ error: 'Chat assistant is not configured' });
    }

    const [marketContext, userContext] = await Promise.all([
      buildMarketContext(),
      buildUserContext(req.user),
    ]);

    const response = await axios.post(
      buildAzureUrl(),
      {
        model: process.env.AZURE_OPENAI_DEPLOYMENT,
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}\n\n${marketContext}\n\n${userContext}` },
          { role: 'user', content: message.trim() },
        ],
        max_tokens: 220,
        temperature: 0.4,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(502).json({ error: 'No response from assistant' });
    }

    res.json({ reply });
  } catch (err) {
    if (err.response) {
      // OpenAI responded with an error status — surface a clean message
      // instead of leaking their raw error shape.
      console.error('OpenAI API error:', err.response.status, err.response.data);
      return res.status(502).json({ error: 'Assistant is temporarily unavailable' });
    }
    next(err);
  }
});

module.exports = router;
