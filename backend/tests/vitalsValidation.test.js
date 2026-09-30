// Run with: npm run test:backend
const test = require('node:test');
const assert = require('node:assert');
const { sanitizeVitals } = require('../services/vitalsValidation');
const { generateHealthInsights } = require('../services/healthEngine');

test('valid readings pass through unchanged', () => {
  const { values, discarded } = sanitizeVitals({ heartRate: 72, spo2: 98, temperature: 36.4 });
  assert.deepStrictEqual(values, { heartRate: 72, spo2: 98, temperature: 36.4 });
  assert.deepStrictEqual(discarded, []);
});

test('a cold fingertip is a real reading and is kept', () => {
  const { values, discarded } = sanitizeVitals({ heartRate: 70, spo2: 97, temperature: 27.5 });
  assert.strictEqual(values.temperature, 27.5);
  assert.deepStrictEqual(discarded, []);
});

test('an implausible channel is nulled without losing the others', () => {
  const { values, discarded } = sanitizeVitals({ heartRate: 75, spo2: 96, temperature: -127 });
  assert.deepStrictEqual(values, { heartRate: 75, spo2: 96, temperature: null });
  assert.deepStrictEqual(discarded, ['temperature']);
});

test('DS18B20 power-on value and out-of-range HR are discarded', () => {
  const { values, discarded } = sanitizeVitals({ heartRate: 5, spo2: 98, temperature: 85 });
  assert.deepStrictEqual(values, { heartRate: null, spo2: 98, temperature: null });
  assert.deepStrictEqual(discarded.sort(), ['heartRate', 'temperature']);
});

test('missing fields are null, not placeholders, and not reported as discarded', () => {
  const { values, discarded } = sanitizeVitals({ heartRate: 80, spo2: null });
  assert.deepStrictEqual(values, { heartRate: 80, spo2: null, temperature: null });
  assert.deepStrictEqual(discarded, []);
});

test('numeric strings are accepted, junk is discarded', () => {
  const { values, discarded } = sanitizeVitals({ heartRate: '81', spo2: 'abc', temperature: NaN });
  assert.strictEqual(values.heartRate, 81);
  assert.strictEqual(values.spo2, null);
  assert.deepStrictEqual(discarded.sort(), ['spo2', 'temperature']);
});

test('trend detection ignores missing (null) readings', () => {
  const r = (heartRate, spo2) => ({ heartRate, spo2 });
  const history = [r(88, 98), r(null, null), r(92, 98), r(null, null), r(96, 98)];
  const alerts = generateHealthInsights({}, { heartRate: 97, spo2: 98 }, history).alerts.filter((a) => a.type === 'trend');
  assert.strictEqual(alerts.length, 1);
});

test('mostly-missing history never produces a trend alert', () => {
  const r = (heartRate, spo2) => ({ heartRate, spo2 });
  const history = [r(null, null), r(95, null), r(null, 93), r(99, null)];
  const alerts = generateHealthInsights({}, { heartRate: 99, spo2: 93 }, history).alerts.filter((a) => a.type === 'trend');
  assert.strictEqual(alerts.length, 0);
});

test('a missing SpO2 never raises an oxygen alert', () => {
  const alerts = generateHealthInsights({}, { heartRate: 70, spo2: null, temperature: null }, []).alerts;
  assert.ok(!alerts.some((a) => /SpO2|Oxygen/i.test(a.message)));
});
