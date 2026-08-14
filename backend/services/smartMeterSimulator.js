/**
 * Generates simulated smart-meter readings for demo/testing purposes.
 * Enabled via SMART_METER_SIMULATOR=true in .env.
 */
function generateReading({ meterId, baseProductionKwh = 5, baseConsumptionKwh = 3 } = {}) {
  const jitter = () => (Math.random() - 0.5) * 2; // -1 .. 1

  return {
    meterId,
    energyProducedKwh: Math.max(0, Number((baseProductionKwh + jitter()).toFixed(2))),
    energyConsumedKwh: Math.max(0, Number((baseConsumptionKwh + jitter()).toFixed(2))),
    recordedAt: new Date(),
  };
}

function isSimulatorEnabled() {
  return process.env.SMART_METER_SIMULATOR === 'true';
}

module.exports = { generateReading, isSimulatorEnabled };
