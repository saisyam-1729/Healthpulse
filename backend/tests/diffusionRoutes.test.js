// Run with: node --test backend/tests/diffusionRoutes.test.js
// Uses a stubbed HealthData model and an in-process fake of the Python service,
// so it needs neither MongoDB nor the Flask app.
process.env.JWT_SECRET = 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const express = require('express');

let readings = [];
const modelPath = require.resolve('../models/HealthData');
require.cache[modelPath] = {
  id: modelPath, filename: modelPath, loaded: true,
  exports: { find: () => ({ sort: () => ({ limit: () => ({ lean: async () => readings }) }) }) },
};
const router = require(path.join('..', 'routes', 'diffusionRoutes'));

const token = jwt.sign({ id: 'user-1' }, 'test-secret');
const auth = { Authorization: `Bearer ${token}` };

const listen = (server) => new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
const T0 = Date.parse('2026-01-01T00:00:00.000Z');
const row = (sec, hr) => ({ createdAt: new Date(T0 + sec * 1000), heartRate: hr, spo2: 98, temperature: 36.6 });
const denseReadings = () => Array.from({ length: 10 }, (_, i) => row(i * 5, 70 + i)).reverse();

let upstream, upstreamBehavior, upstreamCalls, appServer, base;

test.before(async () => {
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      upstreamCalls.push({ url: req.url, body: body ? JSON.parse(body) : null });
      if (upstreamBehavior.delayMs) await new Promise((r) => setTimeout(r, upstreamBehavior.delayMs));
      res.writeHead(upstreamBehavior.status || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(upstreamBehavior.body(req.url, body ? JSON.parse(body) : {})));
    });
  });
  const upstreamPort = await listen(upstream);
  process.env.DIFFUSION_SERVICE_URL = `http://127.0.0.1:${upstreamPort}`;

  const app = express();
  app.use(express.json());
  app.use('/api/diffusion', router);
  appServer = http.createServer(app);
  base = `http://127.0.0.1:${await listen(appServer)}/api/diffusion`;
});

test.after(() => { upstream.close(); appServer.close(); });

test.beforeEach(() => {
  readings = denseReadings();
  upstreamCalls = [];
  upstreamBehavior = {
    body: (url, body) => {
      const n = (body.readings || []).length;
      const est = (count) => Array.from({ length: count }, () => ({ heartRate: 75, spo2: 98, temperature: 36.6 }));
      if (url.endsWith('/forecast')) {
        const p = body.predictionLength;
        return { forecast: est(p), lower: est(p), upper: est(p), context: { imputed: est(n), lower: est(n), upper: est(n) } };
      }
      if (url.endsWith('/generate')) return { sequence: est(body.length) };
      return { modelLoaded: true };
    },
  };
});

const get = (p, headers = auth) => fetch(`${base}${p}`, { headers });

test('rejects requests without a token', async () => {
  assert.strictEqual((await get('/insights', {})).status, 401);
});

test('rejects an invalid predictionLength', async () => {
  for (const v of ['0', '13', 'abc', '2.5']) {
    assert.strictEqual((await get(`/insights?predictionLength=${v}`)).status, 400, v);
  }
});

test('returns 422 when there are too few recent readings', async () => {
  readings = [row(0, 70), row(5, 71)];
  const res = await get('/insights');
  assert.strictEqual(res.status, 422);
  assert.match((await res.json()).error, /Not enough recent readings/);
});

test('happy path returns a labelled, gap-aware payload', async () => {
  readings = [...denseReadings(), row(100, 90)]; // leaves a gap between step 45s and 100s
  const res = await get('/insights?predictionLength=4');
  assert.strictEqual(res.status, 200);
  const body = await res.json();

  assert.strictEqual(body.generated, true);
  assert.match(body.disclaimer, /Not measurements/);
  assert.strictEqual(body.context.timestamps.length, 24);
  assert.strictEqual(body.context.imputed.length, 24);
  assert.strictEqual(body.forecast.mean.length, 4);
  assert.strictEqual(body.forecast.timestamps.length, 4);
  assert.strictEqual(body.stale, true);
  assert.ok(body.context.observed.includes(false), 'gaps should be flagged as not observed');

  assert.strictEqual(upstreamCalls.length, 1, 'a single model run serves both imputation and forecast');
  const call = upstreamCalls[0];
  assert.ok(call.url.endsWith('/forecast'));
  assert.ok(call.body.readings.some((r) => r.heartRate === null), 'gaps are sent as nulls');
  assert.strictEqual(call.body.predictionLength, 4);
  assert.strictEqual(call.body.includeContext, true);
  assert.strictEqual(call.body.numSamples, 10);
  assert.strictEqual(call.body.samplingSteps, 25);
});

test('maps "model not loaded" from the Python service to 503 with its message', async () => {
  upstreamBehavior = { status: 503, body: () => ({ error: 'Diffusion model checkpoint not loaded.' }) };
  const res = await get('/insights');
  assert.strictEqual(res.status, 503);
  assert.match((await res.json()).error, /not loaded/);
});

test('maps other upstream failures to 502', async () => {
  upstreamBehavior = { status: 500, body: () => ({ error: 'boom' }) };
  assert.strictEqual((await get('/insights')).status, 502);
});

test('maps a slow upstream to 504', async () => {
  process.env.DIFFUSION_TIMEOUT_MS = '100';
  upstreamBehavior = { delayMs: 500, body: () => ({}) };
  try {
    assert.strictEqual((await get('/insights')).status, 504);
  } finally {
    delete process.env.DIFFUSION_TIMEOUT_MS;
  }
});

test('reports service unavailable when the Python service is down', async () => {
  const saved = process.env.DIFFUSION_SERVICE_URL;
  process.env.DIFFUSION_SERVICE_URL = 'http://127.0.0.1:1';
  try {
    assert.strictEqual((await get('/insights')).status, 503);
    const status = await (await get('/status')).json();
    assert.deepStrictEqual(status, { available: false, modelLoaded: false });
  } finally {
    process.env.DIFFUSION_SERVICE_URL = saved;
  }
});

test('generate is always flagged synthetic and validates length', async () => {
  const bad = await fetch(`${base}/generate`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ length: 0 }) });
  assert.strictEqual(bad.status, 400);
  const ok = await fetch(`${base}/generate`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ length: 5 }) });
  assert.strictEqual(ok.status, 200);
  const body = await ok.json();
  assert.strictEqual(body.synthetic, true);
  assert.strictEqual(body.sequence.length, 5);
});
