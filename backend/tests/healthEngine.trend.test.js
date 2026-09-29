// Run with: node --test backend/tests
const test = require('node:test');
const assert = require('node:assert');
const { generateHealthInsights } = require('../services/healthEngine');

const reading = (heartRate, spo2) => ({ heartRate, spo2 });
const trendAlerts = (history, current) =>
  generateHealthInsights({}, current, history).alerts.filter((a) => a.type === 'trend');

test('rising heart rate above 90 raises a trend alert', () => {
  const alerts = trendAlerts([reading(88, 98), reading(92, 98), reading(96, 98)], reading(97, 98));
  assert.strictEqual(alerts.length, 1);
});

test('falling heart rate does not raise a trend alert', () => {
  assert.strictEqual(trendAlerts([reading(100, 98), reading(96, 98), reading(92, 98)], reading(92, 98)).length, 0);
});

test('flat elevated heart rate does not raise a trend alert', () => {
  assert.strictEqual(trendAlerts([reading(95, 98), reading(95, 98), reading(95, 98)], reading(95, 98)).length, 0);
});

test('falling SpO2 raises a trend alert', () => {
  const alerts = trendAlerts([reading(70, 98), reading(70, 96), reading(70, 94)], reading(70, 94));
  assert.strictEqual(alerts.length, 1);
});

test('fewer than three readings never raises a trend alert', () => {
  assert.strictEqual(trendAlerts([reading(90, 98), reading(99, 90)], reading(99, 90)).length, 0);
});
