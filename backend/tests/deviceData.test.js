// Run with: npm run test:backend
// POST /api/device/data with the database models and the analysis service stubbed, so it
// needs no MongoDB. Checks what would actually be written to HealthData.
process.env.JWT_SECRET = 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const express = require('express');

const saved = [];
const analysed = [];
function stub(relPath, exportsValue) {
  const p = require.resolve(relPath);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exportsValue };
}
function FakeHealthData(doc) { Object.assign(this, doc); }
FakeHealthData.prototype.save = async function save() { saved.push({ ...this }); return this; };

stub('../models/HealthData', FakeHealthData);
stub('../models/Device', { findOneAndUpdate: async () => ({ deviceId: 'dev-1' }), findOne: async () => ({ deviceId: 'dev-1' }) });
stub('../models/UserDevice', { findOne: async () => null });
stub('../services/healthService', { analyzeUserHealth: async (userId, vitals) => { analysed.push(vitals); } });

const router = require('../routes/deviceRoutes');
const token = jwt.sign({ id: 'user-1' }, 'test-secret');

let server, base;
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/device', router);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/api/device`;
});
test.after(() => server.close());
test.beforeEach(() => { saved.length = 0; analysed.length = 0; });

const post = (body) => fetch(`${base}/data`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ deviceId: 'dev-1', ...body }),
});

test('a cold fingertip reading is stored in full (previously rejected with 400)', async () => {
  const res = await post({ heartRate: 72, spo2: 97, temperature: 27.4 });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].temperature, 27.4);
  assert.strictEqual(saved[0].heartRate, 72);
});

test('a disconnected temperature probe keeps the heart rate and SpO2', async () => {
  const res = await post({ heartRate: 80, spo2: 96, temperature: -127 });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual((await res.json()).discardedFields, ['temperature']);
  assert.deepStrictEqual([saved[0].heartRate, saved[0].spo2, saved[0].temperature], [80, 96, null]);
});

test('missing values are stored as null, never as 0 or 36.5', async () => {
  await post({ heartRate: 75, spo2: null, temperature: null });
  assert.strictEqual(saved[0].spo2, null);
  assert.strictEqual(saved[0].temperature, null);
});

test('the analysis receives the sanitised values, not the raw payload', async () => {
  await post({ heartRate: 90, spo2: 97, temperature: 85 });
  assert.deepStrictEqual(analysed[0], { heartRate: 90, spo2: 97, temperature: null });
});

test('a reading with no valid HR or SpO2 is not stored', async () => {
  const res = await post({ heartRate: 5, spo2: null, temperature: 33 });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(saved.length, 0);
});

test('deviceId is still required', async () => {
  const res = await fetch(`${base}/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ heartRate: 70 }),
  });
  assert.strictEqual(res.status, 400);
});
