// Run with: npm run test:backend
// Security regressions: backdoors, token handling, signup role injection, device list scope,
// log redaction and admin account management. Database models are stubbed (no MongoDB).
process.env.JWT_SECRET = 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const express = require('express');

// ---------- stub models ----------
const users = new Map(); // email -> user doc
function FakeUser(doc) { Object.assign(this, doc); }
FakeUser.prototype.save = async function save() { users.set(this.email, this); return this; };
FakeUser.findOne = async (q) => {
  const u = users.get(q.email);
  if (!u) return null;
  if (q.role && u.role !== q.role) return null;
  return u;
};
FakeUser.find = async (q) => [...users.values()].filter((u) => !q.role || u.role === q.role);
FakeUser.countDocuments = async () => users.size;

const devices = [
  { deviceId: 'mine-linked', lastSeen: 3 },
  { deviceId: 'mine-by-data', lastSeen: 2 },
  { deviceId: 'someone-else', lastSeen: 1 },
];
const stub = (rel, value) => {
  const p = require.resolve(rel);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: value };
};
stub('../models/User', FakeUser);
stub('../models/OnboardingData', { findOne: async () => null });
stub('../models/Feedback', { countDocuments: async () => 0, find: async () => [] });
stub('../models/Device', {
  find: (q) => ({
    sort: async () => (q && q.deviceId ? devices.filter((d) => q.deviceId.$in.includes(d.deviceId)) : devices),
  }),
  findOne: async () => null,
  findOneAndUpdate: async () => null,
});
stub('../models/UserDevice', {
  find: (q) => ({ distinct: async () => (q.userId === 'u1' ? ['mine-linked'] : []) }),
  findOne: async () => null,
});
stub('../models/HealthData', Object.assign(function HealthData() {}, {
  distinct: async (field, q) => (q.userId === 'u1' ? ['mine-by-data', null] : []),
}));
stub('../services/healthService', { analyzeUserHealth: async () => {} });

const { jwtSecret } = require('../config/jwtSecret');
const { redactUrl } = require('../utils/redact');
const adminAccounts = require('../scripts/adminAccounts');

let server, base;
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/authRoutes'));
  app.use('/api/admin', require('../routes/adminRoutes'));
  app.use('/api/devices', require('../routes/deviceRoutes'));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());
test.beforeEach(() => users.clear());

const post = (path, body, headers = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const bearer = (payload) => ({ Authorization: `Bearer ${jwt.sign(payload, 'test-secret')}` });

// ---------- JWT secret ----------
test('there is no fallback JWT secret', () => {
  const saved = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try {
    assert.throws(() => jwtSecret(), /JWT_SECRET is not set/);
  } finally {
    process.env.JWT_SECRET = saved;
  }
});

test('a token signed with the old public fallback secret is rejected', async () => {
  const forged = jwt.sign({ id: 'x', role: 'admin' }, 'healthpulse_fallback_secret_2026_secure_default');
  const res = await fetch(`${base}/admin/stats`, { headers: { Authorization: `Bearer ${forged}` } });
  assert.strictEqual(res.status, 401);
});

// ---------- admin backdoor ----------
test('the old hardcoded admin credentials no longer work', async () => {
  const res = await post('/admin/login', { username: 'admin', password: 'admin@@@123' });
  assert.strictEqual(res.status, 401);
});

test('a leftover "admin" account in the database cannot log in as admin', async () => {
  users.set('admin', new FakeUser({ email: 'admin', role: 'admin', password: await bcrypt.hash('admin@@@123', 4) }));
  const res = await post('/admin/login', { username: 'admin', password: 'admin@@@123' });
  assert.strictEqual(res.status, 401);
});

test('a real admin account can log in and reach admin routes', async () => {
  users.set('boss@example.com', new FakeUser({ _id: 'a1', email: 'boss@example.com', role: 'admin', password: await bcrypt.hash('correct horse', 4) }));
  const res = await post('/admin/login', { username: 'boss@example.com', password: 'correct horse' });
  assert.strictEqual(res.status, 200);
  const { token } = await res.json();
  assert.strictEqual(jwt.verify(token, 'test-secret').role, 'admin');
  const stats = await fetch(`${base}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(stats.status, 200);
});

test('admin login rejects a wrong password and a non-admin account', async () => {
  users.set('boss@example.com', new FakeUser({ email: 'boss@example.com', role: 'admin', password: await bcrypt.hash('correct horse', 4) }));
  users.set('pat@example.com', new FakeUser({ email: 'pat@example.com', role: 'user', password: await bcrypt.hash('pw123456', 4) }));
  assert.strictEqual((await post('/admin/login', { username: 'boss@example.com', password: 'wrong' })).status, 401);
  assert.strictEqual((await post('/admin/login', { username: 'pat@example.com', password: 'pw123456' })).status, 401);
});

test('a normal user token cannot reach admin routes', async () => {
  const res = await fetch(`${base}/admin/stats`, { headers: bearer({ id: 'u1', role: 'user' }) });
  assert.strictEqual(res.status, 403);
});

// ---------- signup role injection ----------
test('signup cannot create an admin account', async () => {
  const res = await post('/auth/register', { email: 'eve@example.com', password: 'secret123', data: { name: 'Eve', role: 'admin', loginCount: 99 } });
  assert.strictEqual(res.status, 201);
  const saved = users.get('eve@example.com');
  assert.strictEqual(saved.role, 'user');
  assert.strictEqual(saved.name, 'Eve');
  assert.notStrictEqual(saved.loginCount, 99);
  const { session } = await res.json();
  assert.strictEqual(jwt.verify(session.access_token, 'test-secret').role, 'user');
});

// ---------- token handling ----------
test('a token in the URL is no longer accepted', async () => {
  const token = jwt.sign({ id: 'a1', role: 'admin' }, 'test-secret');
  const res = await fetch(`${base}/admin/stats?token=${token}`);
  assert.strictEqual(res.status, 401);
});

test('tokens and keys are masked in logged URLs', () => {
  assert.strictEqual(redactUrl('/api/x?token=abc.def&page=2'), '/api/x?token=[REDACTED]&page=2');
  assert.strictEqual(redactUrl('/data?key=ESP32_KEY'), '/data?key=[REDACTED]');
  assert.strictEqual(redactUrl('/api/health'), '/api/health');
});

// ---------- device list ----------
test('the device list requires sign-in', async () => {
  assert.strictEqual((await fetch(`${base}/devices`)).status, 401);
});

test('a user sees only their own devices (linked or with their readings)', async () => {
  const res = await fetch(`${base}/devices`, { headers: bearer({ id: 'u1', role: 'user' }) });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual((await res.json()).map((d) => d.deviceId).sort(), ['mine-by-data', 'mine-linked']);
});

test('a user with no devices gets an empty list; an admin sees all', async () => {
  const none = await fetch(`${base}/devices`, { headers: bearer({ id: 'u2', role: 'user' }) });
  assert.deepStrictEqual(await none.json(), []);
  const all = await fetch(`${base}/devices`, { headers: bearer({ id: 'a1', role: 'admin' }) });
  assert.strictEqual((await all.json()).length, 3);
});

// ---------- admin account script ----------
test('admin script: promote, demote and lock', async () => {
  users.set('boss@example.com', new FakeUser({ email: 'boss@example.com', role: 'user', password: 'x' }));
  await adminAccounts.promote(FakeUser, 'boss@example.com');
  assert.strictEqual(users.get('boss@example.com').role, 'admin');
  await adminAccounts.demote(FakeUser, 'boss@example.com');
  assert.strictEqual(users.get('boss@example.com').role, 'user');

  users.set('admin', new FakeUser({ email: 'admin', role: 'admin', password: await bcrypt.hash('admin@@@123', 4) }));
  await adminAccounts.lock(FakeUser, 'admin');
  const locked = users.get('admin');
  assert.strictEqual(locked.role, 'user');
  assert.strictEqual(await bcrypt.compare('admin@@@123', locked.password), false);
  await assert.rejects(() => adminAccounts.promote(FakeUser, 'nobody@example.com'), /No account/);
});
