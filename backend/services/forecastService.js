const { ForecastData } = require('../models');

// NOT a trained ML model — there's no historical-data pipeline, training
// step, or model file anywhere in this project. This is a shaped curve
// (solar bell-curve for generation, a two-peak daily-use curve for
// consumption) plus random jitter, regenerated fresh once per user per day.
// It's a reasonable stand-in for demo purposes, but the UI must not claim
// more than this — see ForecastDashboard.jsx's disclosure copy.

function buildProsumerHourly() {
  const hourly = [];
  let peakHour = 12;
  let maxGen = 0;

  for (let hour = 0; hour < 24; hour++) {
    let generation = 0;
    if (hour >= 6 && hour <= 18) {
      const distanceFromNoon = Math.abs(hour - 12.5);
      generation = 5 * Math.max(0, Math.cos((distanceFromNoon * Math.PI) / 6));
      generation *= 0.8 + Math.random() * 0.4; // weather-like variation
    }
    if (generation > maxGen) {
      maxGen = generation;
      peakHour = hour;
    }
    hourly.push({
      hour,
      forecast: Number(generation.toFixed(2)),
      confidence: generation > 0 ? 85 : 60, // lower confidence off-peak: less signal to shape the curve from
      recommendation: generation > 3 ? 'Good time to sell' : 'Low generation',
    });
  }
  return { hourly, peakHour };
}

function buildConsumerHourly() {
  const hourly = [];
  let peakHour = 19;
  let maxConsumption = 0;

  for (let hour = 0; hour < 24; hour++) {
    let consumption = 0.5; // base load
    if (hour >= 6 && hour <= 9) consumption += 2 + Math.random() * 1;
    else if (hour >= 14 && hour <= 16) consumption += 0.5 + Math.random() * 0.5;
    else if (hour >= 18 && hour <= 22) consumption += 3 + Math.random() * 1.5;

    if (consumption > maxConsumption) {
      maxConsumption = consumption;
      peakHour = hour;
    }
    hourly.push({
      hour,
      forecast: Number(consumption.toFixed(2)),
      confidence: Math.round(90 + Math.random() * 10),
      recommendation: consumption > 3 ? 'Buy now (high demand)' : 'Low consumption',
    });
  }
  return { hourly, peakHour };
}

async function generateForecast(userId, userType, date) {
  const { hourly, peakHour } = userType === 'prosumer' ? buildProsumerHourly() : buildConsumerHourly();
  const totalForecast = Number(hourly.reduce((sum, h) => sum + h.forecast, 0).toFixed(2));

  return ForecastData.findOneAndUpdate(
    { userId, date },
    { userId, userType, date, hourly, peakHour, totalForecast },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

/** Cached-per-day: returns the existing row for today, or generates one. */
async function getForecast(userId, userType, date) {
  const existing = await ForecastData.findOne({ userId, date });
  if (existing) return existing;
  return generateForecast(userId, userType, date);
}

module.exports = { getForecast, generateForecast };
