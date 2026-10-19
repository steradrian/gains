/* PUSH_SUBS_READONLY=1, the cutover freeze: subscribe, unsubscribe and rest-timer answer 503
   `push-readonly` with Retry-After 30, and db.json (the subscriptions) cannot change. Off, they
   behave as they always did. Real server.js in a child. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const ORIGIN = 'http://localhost:8080';
const payload = `u_test_1:${Date.now() + 86400000}:0`;
const cookie = `gymsid=${payload}.${crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')}`;
const SUB = { endpoint: 'https://push.example.test/abc', keys: { p256dh: 'p', auth: 'a' } };
const HELD = { userId: 'u_test_1', endpoint: 'https://push.example.test/held', keys: { p256dh: 'p', auth: 'a' }, deviceId: 'dev_held0001', created: '2026-01-01T00:00:00.000Z' };

async function startServer(t, env = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-pushro-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({
    users: [{ id: 'u_test_1', name: 'One', created: new Date().toISOString() }], creds: [], invites: [], subs: [HELD]
  }));
  fs.writeFileSync(path.join(dataDir, 'state-u_test_1.json'), JSON.stringify({ _rev: 1, lang: 'en', workouts: [], routines: [] }));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost', AUDIT_LOG: '0', REMINDER_TICK_MS: '100000', PUSH_SUBS_READONLY: '', ...env }
  });
  const h = { dataDir, log: '' };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  h.api = `http://127.0.0.1:${await boundPort(child, () => h.log)}`;
  h.post = async (p, body, withCookie = true) => {
    const r = await fetch(h.api + p, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(withCookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body)
    });
    return { status: r.status, body: await r.json(), retryAfter: r.headers.get('retry-after') };
  };
  h.db = () => fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8');
  return h;
}

const WRITES = [
  ['/api/push/subscribe', { subscription: SUB, deviceId: 'dev_new00001' }],
  ['/api/push/unsubscribe', { endpoint: HELD.endpoint }],
  ['/api/push/rest-timer', { seconds: 60, deviceId: 'dev_held0001' }]
];

for (const on of ['1', 'true']) {
  test(`PUSH_SUBS_READONLY=${on}: subscribe, unsubscribe and rest-timer are 503 push-readonly with Retry-After 30, and the subscriptions do not change`, async t => {
    const h = await startServer(t, { PUSH_SUBS_READONLY: on });
    const before = h.db();
    for (const [p, body] of WRITES) {
      const r = await h.post(p, body);
      assert.deepEqual([r.status, r.body.code, r.retryAfter], [503, 'push-readonly', '30'], p);
      assert.equal(typeof r.body.error, 'string', p);
    }
    assert.equal(h.db(), before);
    await new Promise(res => setTimeout(res, 200));
    assert.equal(h.db(), before, 'and nothing lands a moment later either');
  });
}

test('PUSH_SUBS_READONLY=1 still asks who is calling first, and leaves the reads and the cancel alone', async t => {
  const h = await startServer(t, { PUSH_SUBS_READONLY: '1' });
  for (const [p, body] of WRITES) assert.equal((await h.post(p, body, false)).status, 401, p);
  assert.equal((await fetch(`${h.api}/api/push/public-key`)).status, 200);
  const status = await fetch(`${h.api}/api/push/status?endpoint=${encodeURIComponent(HELD.endpoint)}`, { headers: { Cookie: cookie } });
  assert.deepEqual(await status.json(), { subscribed: true, deviceId: 'dev_held0001' });
  assert.equal((await h.post('/api/push/rest-timer/cancel', { deviceId: 'dev_held0001' })).status, 200);
});

for (const env of [{}, { PUSH_SUBS_READONLY: '0' }, { PUSH_SUBS_READONLY: 'off' }]) {
  test(`PUSH_SUBS_READONLY ${JSON.stringify(env.PUSH_SUBS_READONLY ?? null)}: the writes work as ever`, async t => {
    const h = await startServer(t, env);
    assert.equal((await h.post('/api/push/subscribe', { subscription: SUB, deviceId: 'dev_new00001' })).status, 200);
    assert.deepEqual(JSON.parse(h.db()).subs.map(s => s.endpoint).sort(), [HELD.endpoint, SUB.endpoint].sort());
    assert.equal((await h.post('/api/push/rest-timer', { seconds: 60, deviceId: 'dev_new00001' })).status, 200);
    assert.equal((await h.post('/api/push/unsubscribe', { endpoint: SUB.endpoint })).status, 200);
    assert.deepEqual(JSON.parse(h.db()).subs.map(s => s.endpoint), [HELD.endpoint]);
  });
}
