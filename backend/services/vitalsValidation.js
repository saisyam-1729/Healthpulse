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

// Earliest accepted device clock (2023-11-15): anything before means the device has not synced NTP.
const MIN_DEVICE_TIME_MS = 1700000000000;
const MAX_CLOCK_AHEAD_MS = 24 * 60 * 60 * 1000;

/**
 * Optional reading metadata sent by firmware >= 2.3. Anything malformed is ignored (null),
 * never allowed to reject the reading itself.
 */
function sanitizeMetadata(input = {}, now = Date.now()) {
  const fingerPresent = typeof input.fingerPresent === 'boolean' ? input.fingerPresent : null;
  const seq = Number.isInteger(input.seq) && input.seq >= 0 && input.seq <= 0xffffffff ? input.seq : null;
  const t = typeof input.deviceTime === 'number' ? input.deviceTime : NaN;
  const deviceTime = Number.isFinite(t) && t >= MIN_DEVICE_TIME_MS && t <= now + MAX_CLOCK_AHEAD_MS ? new Date(t) : null;
  const fw = input.firmwareVersion;
  const firmwareVersion = typeof fw === 'string' && /^[\w.-]{1,16}$/.test(fw) ? fw : null;
  return { fingerPresent, seq, deviceTime, firmwareVersion };
}

module.exports = { sanitizeVitals, sanitizeMetadata, PLAUSIBLE_RANGES };
