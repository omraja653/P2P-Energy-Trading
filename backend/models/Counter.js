const mongoose = require('mongoose');

// Mongoose has no native auto-increment — this is the standard atomic
// pattern: one document per counter name, incremented with $inc inside
// findOneAndUpdate so concurrent requests can't race to the same number.
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

async function getNextSequence(name) {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return counter.value;
}

module.exports = { Counter, getNextSequence };
