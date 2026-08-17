const { User } = require('../models');

/**
 * Gates trading (placing a trade) behind mobileVerified AND kycVerified.
 * Does a fresh DB lookup rather than trusting the JWT's claims, since those
 * can go stale between token issuances (e.g. an admin revokes KYC, or the
 * user verifies mobile in another tab without refreshing this one's token).
 *
 * Applied to trade *creation*, not trade viewing — history stays readable
 * while unverified.
 */
async function requireTradingVerification(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.mobileVerified || !user.kycVerified) {
      return res.status(403).json({
        error: 'Verification required before trading',
        requiresMobileVerification: !user.mobileVerified,
        requiresKyc: !user.kycVerified,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireTradingVerification };
