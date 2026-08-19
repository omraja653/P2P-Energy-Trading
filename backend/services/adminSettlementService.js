const { Settlement } = require('../models');

async function getSettlements({ status, from, to } = {}) {
  const query = {};
  if (status) query.status = status;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  return Settlement.find(query)
    .sort({ createdAt: -1 })
    .populate({
      path: 'tradeId',
      select: 'sellerId buyerId quantityKWh totalAmount',
      populate: [
        { path: 'sellerId', select: 'firstName lastName' },
        { path: 'buyerId', select: 'firstName lastName' },
      ],
    });
}

async function getSettlementDetail(id) {
  return Settlement.findById(id).populate({
    path: 'tradeId',
    populate: [
      { path: 'sellerId', select: 'firstName lastName email' },
      { path: 'buyerId', select: 'firstName lastName email' },
    ],
  });
}

// Manual override — for when blockchain verification failed/hung and an
// admin needs to correct the record by hand. Does not retry the on-chain
// call; just corrects the stored status/tx hash.
async function setStatus(id, status, txHash) {
  const settlement = await Settlement.findById(id);
  if (!settlement) return null;
  settlement.status = status;
  if (txHash !== undefined) settlement.blockchainTxHash = txHash;
  if (status === 'completed' && !settlement.settledAt) settlement.settledAt = new Date();
  await settlement.save();
  return settlement;
}

module.exports = { getSettlements, getSettlementDetail, setStatus };
