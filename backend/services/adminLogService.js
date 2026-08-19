const { AdminLog } = require('../models');

/** Best-effort audit log write — never blocks or fails the admin action itself. */
async function logAction(adminId, action, targetType, targetId, details) {
  try {
    await AdminLog.create({ adminId, action, targetType, targetId, details });
  } catch (err) {
    console.error('Failed to write admin log:', err.message);
  }
}

async function getLogs({ limit = 50, targetType, adminId } = {}) {
  const query = {};
  if (targetType) query.targetType = targetType;
  if (adminId) query.adminId = adminId;
  return AdminLog.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('adminId', 'firstName lastName email');
}

module.exports = { logAction, getLogs };
