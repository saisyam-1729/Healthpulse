/**
 * Physical plausibility checks for incoming sensor readings.
 *
 * These bounds only reject values that cannot be real measurements (hardware faults,
 * transmission errors, sensor sentinels such as the DS18B20's -127 C "disconnected" and
 * 85 C power-on value). They are NOT clinical thresholds: a fingertip skin temperature of
 * 28 C is a normal reading and must be kept.
 *
 * An implausible value is dropped for that channel only (stored as null); the other
 * channels of the same reading are kept.
 */
const PLAUSIBLE_RANGES = {
  heartRate: [30, 220],
  spo2: [0, 100],
  temperature: [15, 45],
};

function sanitizeVitals(input = {}) {
  const values = {};
  const discarded = [];
  for (const [field, [lo, hi]] of Object.entries(PLAUSIBLE_RANGES)) {
    const raw = input[field];
    if (raw === null || raw === undefined || raw === '') {
      values[field] = null;
      continue;
    }
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(n) && n >= lo && n <= hi) {
      values[field] = n;
    } else {
      values[field] = null;
      discarded.push(field);
    }
  }
  return { values, discarded };
}

module.exports = { sanitizeVitals, PLAUSIBLE_RANGES };
