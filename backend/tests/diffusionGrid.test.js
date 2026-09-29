// Run with: node --test backend/tests/diffusionGrid.test.js
const test = require('node:test');
const assert = require('node:assert');
const { buildGrid, futureTimestamps } = require('../services/diffusionGrid');

const T0 = Date.parse('2026-01-01T00:00:00.000Z');
const at = (sec, hr = 70) => ({ createdAt: new Date(T0 + sec * 1000), heartRate: hr, spo2: 98, temperature: 36.6 });

test('empty input yields an empty grid', () => {
  const g = buildGrid([], { stepSeconds: 5, points: 4 });
  assert.deepStrictEqual(g.rows, []);
  assert.strictEqual(g.observedSteps, 0);
});

test('regular readings fill every step, anchored on the latest reading', () => {
  const g = buildGrid([at(0), at(5), at(10), at(15)], { stepSeconds: 5, points: 4 });
  assert.strictEqual(g.observedSteps, 4);
  assert.strictEqual(g.timestamps[3], new Date(T0 + 15000).toISOString());
  assert.ok(g.rows.every((r) => r.heartRate === 70));
});

test('a timing gap becomes null steps (real missingness)', () => {
  const g = buildGrid([at(0, 60), at(5, 61), at(25, 65)], { stepSeconds: 5, points: 6 });
  assert.strictEqual(g.observedSteps, 3);
  assert.strictEqual(g.rows[2].heartRate, null);
  assert.strictEqual(g.rows[3].heartRate, null);
  assert.strictEqual(g.rows[5].heartRate, 65);
});

test('input order does not matter and old readings outside the window are dropped', () => {
  const g = buildGrid([at(15, 4), at(0, 1), at(-100, 9), at(10, 3), at(5, 2)], { stepSeconds: 5, points: 4 });
  assert.deepStrictEqual(g.rows.map((r) => r.heartRate), [1, 2, 3, 4]);
});

test('jittered timestamps snap to the nearest step; latest timestamp in a step wins', () => {
  const g = buildGrid([at(0.4, 1), at(5.2, 2), at(4.9, 3), at(10.1, 4)], { stepSeconds: 5, points: 3 });
  assert.deepStrictEqual(g.rows.map((r) => r.heartRate), [1, 2, 4]);
});

test('future timestamps continue from the anchor', () => {
  const f = futureTimestamps(T0, 2, 5);
  assert.deepStrictEqual(f, [new Date(T0 + 5000).toISOString(), new Date(T0 + 10000).toISOString()]);
});
