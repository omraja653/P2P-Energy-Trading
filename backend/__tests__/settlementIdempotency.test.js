// Regression test for a real bug found during a live audit: settleTrade()
// used to Settlement.create() a brand-new document on every call, and
// settlementScheduler retries a failing trade every 60s forever — with the
// relayer wallet out of testnet gas, 13 stuck trades produced ~4,800
// duplicate 'failed' Settlement rows between them (7,507 total in the
// collection) before this fix. This test proves repeated attempts on the
// same trade reuse one Settlement document instead of multiplying.
jest.mock('../services/blockchainService', () => ({
  recordTradeOnChain: jest.fn(),
  settleOnChain: jest.fn(),
}));

require('../server'); // side effect: establishes the mongoose connection tests rely on
const { User, Trade, Settlement } = require('../models');
const { recordTradeOnChain } = require('../services/blockchainService');
const { settleTrade } = require('../services/settlementService');

const TAG = 'settle-idempotent-test';
let buyer;
let seller;
let trade;

beforeAll(async () => {
  buyer = await new User({
    email: `${TAG}-buyer@example.com`,
    firstName: 'Idem',
    lastName: 'Buyer',
    type: 'consumer',
    status: 'ACTIVE',
    password: 'Str0ng!Pass1',
  }).save();
  seller = await new User({
    email: `${TAG}-seller@example.com`,
    firstName: 'Idem',
    lastName: 'Seller',
    type: 'prosumer',
    status: 'ACTIVE',
    password: 'Str0ng!Pass1',
  }).save();

  trade = await Trade.create({
    sellerId: seller._id,
    buyerId: buyer._id,
    quantityKWh: 10,
    pricePerKwh: 5,
    totalAmount: 50,
    tradingType: 'intraday',
    status: 'matched',
  });
});

afterAll(async () => {
  await Trade.deleteOne({ _id: trade._id });
  await Settlement.deleteMany({ tradeId: trade._id });
  await User.deleteMany({ email: { $regex: `^${TAG}-` } });
});

describe('settlementService.settleTrade idempotency', () => {
  it('reuses one Settlement document across repeated failed attempts on the same trade', async () => {
    recordTradeOnChain.mockRejectedValue(new Error('insufficient funds for gas (simulated)'));

    await expect(settleTrade(trade)).rejects.toThrow();
    await expect(settleTrade(trade)).rejects.toThrow();
    await expect(settleTrade(trade)).rejects.toThrow();

    const settlements = await Settlement.find({ tradeId: trade._id });
    expect(settlements).toHaveLength(1);
    expect(settlements[0].status).toBe('failed');
  });

  it('the same document flips to completed once the attempt succeeds — no second document created', async () => {
    recordTradeOnChain.mockResolvedValue({ txHash: '0xdeadbeef', onChainTradeId: null, totalPriceWei: 0n });

    const settlement = await settleTrade(trade);

    const settlements = await Settlement.find({ tradeId: trade._id });
    expect(settlements).toHaveLength(1);
    expect(settlements[0]._id.toString()).toBe(settlement._id.toString());
    expect(settlements[0].status).toBe('completed');
  });
});
