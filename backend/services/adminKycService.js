const { User } = require('../models');

// There is no document-upload/KYC-submission system in this project — no
// ID/address/selfie images, no submission model, nothing for a user to
// actually submit yet. `kycVerified` is just a boolean flag on User, set
// directly by an admin. This service (and the admin/kyc.js routes on top
// of it) is honestly scoped to that reality: a review queue over the
// boolean flag, not a document review workflow. "Pending" here means "has
// picked a role but isn't kycVerified yet" — the closest real proxy for
// "needs KYC" this data model has.
async function getQueue({ status } = {}) {
  const query = { type: { $in: ['consumer', 'prosumer'] } };
  if (status === 'approved') query.kycVerified = true;
  else if (status === 'pending') query.kycVerified = false;
  // 'rejected' / 'resubmit' have no distinct state in this data model —
  // rejecting just leaves kycVerified false, same as pending. Callers
  // asking for those statuses get the same pending list; there's no way to
  // tell "never submitted" apart from "rejected" without a real KYC model.

  return User.find(query)
    .select('firstName lastName email type kycVerified createdAt')
    .sort({ createdAt: -1 });
}

async function getDetail(userId) {
  return User.findById(userId).select('firstName lastName email mobileNumber type kycVerified createdAt address');
}

async function approve(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  user.kycVerified = true;
  await user.save();
  return user;
}

async function reject(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  user.kycVerified = false;
  await user.save();
  return user;
}

module.exports = { getQueue, getDetail, approve, reject };
