/**
 * Turns irregularly-timed HealthData rows into the fixed-step grid the diffusion
 * model was trained on (ai_service/configs/diffusion.yaml: context_length steps).
 *
 * Readings are anchored to the most recent one, snapped to the nearest step, and
 * empty steps become nulls. Those nulls are the "missing values" the imputation
 * model fills in, so real timing gaps (finger off sensor, device offline, dropped
 * packets) turn into genuine missingness instead of being silently ignored.
 */

const CHANNELS = ['heartRate', 'spo2', 'temperature'];

function buildGrid(readings, { stepSeconds = 5, points = 24 } = {}) {
  if (!Array.isArray(readings) || readings.length === 0) {
    return { rows: [], timestamps: [], observedSteps: 0, anchor: null };
  }
  const stepMs = stepSeconds * 1000;
  const valid = readings
    .map((r) => ({ t: new Date(r.createdAt).getTime(), r }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);
  if (valid.length === 0) return { rows: [], timestamps: [], observedSteps: 0, anchor: null };

  const anchor = valid[valid.length - 1].t;
  const start = anchor - (points - 1) * stepMs;
  const rows = Array.from({ length: points }, () => null);

  for (const { t, r } of valid) {
    if (t < start - stepMs / 2) continue;
    const idx = Math.round((t - start) / stepMs);
    if (idx < 0 || idx >= points) continue;
    const row = Object.fromEntries(CHANNELS.map((c) => [c, Number.isFinite(r[c]) ? r[c] : null]));
    // A row with no values (e.g. a "no finger" marker) is a gap, not an observation.
    if (CHANNELS.every((c) => row[c] === null)) continue;
    // Later readings in the same step overwrite earlier ones.
    rows[idx] = row;
  }

  const filled = rows.map((row) => row ?? Object.fromEntries(CHANNELS.map((c) => [c, null])));
  const timestamps = filled.map((_, i) => new Date(start + i * stepMs).toISOString());
  const observedSteps = rows.filter(Boolean).length;
  return { rows: filled, timestamps, observedSteps, anchor };
}

function futureTimestamps(anchor, count, stepSeconds = 5) {
  return Array.from({ length: count }, (_, i) => new Date(anchor + (i + 1) * stepSeconds * 1000).toISOString());
}

module.exports = { buildGrid, futureTimestamps, CHANNELS };
