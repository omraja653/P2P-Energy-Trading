/**
 * Generates simulated smart-meter readings for demo/testing purposes.
 * Enabled via SMART_METER_SIMULATOR=true in .env.
 */
function generateReading({ meterId, baseGenerationKW = 5, baseConsumptionKW = 3 } = {}) {
  const jitter = () => (Math.random() - 0.5) * 2; // -1 .. 1

  return {
    meterId,
    generationKW: Math.max(0, Number((baseGenerationKW + jitter()).toFixed(2))),
    consumptionKW: Math.max(0, Number((baseConsumptionKW + jitter()).toFixed(2))),
    timestamp: new Date(),
  };
}

function isSimulatorEnabled() {
  return process.env.SMART_METER_SIMULATOR === 'true';
}

module.exports = { generateReading, isSimulatorEnabled };
