/* GET /api/sync/reminder-context (sync-routes.js, reminder-context.js): what gains-be reads to decide
   whether a reminder is still owed. Same token rules as every per-profile sync route, read-only,
   the person's own local date in the query. Real server.js in a child, the harness of
   server-sync.test.js. The body shapes are in reminder-context.test.js and the fixture file. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { ISSUER, hubKey, jwks, mint, badTokens } from './hub-fixtures.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const ORIGIN = 'http://localhost:8080';
const KEY = hubKey('hub-1');
const fixture = JSON.parse(fs.readFileSync(path.join(API, 'test', 'fixtures', 'reminder-context.json'), 'utf8'));
const session = uid => {
  const payload = `${uid}:${Date.now() + 86400000}:0`;
  return payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
};
const user = (id, name, extra = {}) => ({ id, name, created: new Date().toISOString(), ...extra });
const USERS = [user('u1', 'Ana'), user('u2', 'Bea', { disabled: true }), user('u3', 'Cy')];
const PATH = '/api/sync/reminder-context';
const tok = (sub = 'u1', claims = {}) => mint(KEY, { sub, claims });
const WEEK = { routines: [{ id: 'push', name: 'Push A', emoji: '💪' }], week: { 1: 'push' }, workouts: [{ id: 'w0', d: '2026-09-04', routineId: 'push' }], lang: 'en', _rev: 3, _wid: 'aaaaaaaaaaaaaaaa' };

async function startServer(t, { env = { HUB_JWKS: jwks(KEY), HUB_ISSUER: ISSUER }, users = USERS, states = { u1: WEEK }, coach = {}, coachConfig = { enabled: true, provider: 'fixture' } } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-rctx-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users, creds: [], subs: [], invites: [], gone: [] }));
  for (const [uid, S] of Object.entries(states)) fs.writeFileSync(path.join(dataDir, `state-${uid}.json`), typeof S === 'string' ? S : JSON.stringify(S));
  // Coach switched on for the instance (the fixture provider counts as connected); null leaves it off.
  if (coachConfig) fs.writeFileSync(path.join(dataDir, 'coach.json'), JSON.stringify(coachConfig));
  fs.mkdirSync(path.join(dataDir, 'coach'));
  for (const [uid, rec] of Object.entries(coach)) fs.writeFileSync(path.join(dataDir, 'coach', `${uid}.json`), JSON.stringify(rec));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost', ADMIN_UIDS: '', AUDIT_LOG: '1', HUB_JWKS: '', HUB_ISSUER: '', ...env }
  });
  const h = { log: '', dataDir };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  h.api = `http://127.0.0.1:${await boundPort(child, () => h.log)}`;
  h.get = async (query, { token, cookie } = {}) => {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (cookie) headers.Cookie = 'gymsid=' + cookie;
    const r = await fetch(`${h.api}${PATH}${query}`, { headers });
    return { status: r.status, body: await r.json(), headers: r.headers };
  };
  h.read = (...p) => fs.readFileSync(path.join(dataDir, ...p), 'utf8');
  return h;
}

test('every fixture case without a pinned clock is what the route answers, for the person asked about', async t => {
  const cases = fixture.cases.filter(c => !c.now);
  assert.ok(cases.length >= 10);
  const states = Object.fromEntries(cases.map((c, i) => [`c${i}`, c.state]));
  const coach = Object.fromEntries(cases.flatMap((c, i) => (c.coach ? [[`c${i}`, c.coach]] : [])));
  const h = await startServer(t, { users: cases.map((_, i) => user(`c${i}`, `C${i}`)), states, coach });
  for (const [i, c] of cases.entries()) {
    const r = await h.get(`?date=${c.date}`, { token: tok(`c${i}`) });
    assert.deepEqual([r.status, r.body], [200, c.expected], c.name);
  }
});

test('a valid sync token reads the day: 200, no-store, and the answer is the contract’s body', async t => {
  const h = await startServer(t);
  const r = await h.get('?date=2026-09-07', { token: tok() });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.deepEqual(r.body, {
    lang: 'en', date: '2026-09-07',
    planned: { routine_id: 'push', name: 'Push A', emoji: '💪' },
    workout_logged: false, excused: false,
    nudge: { routine_id: 'push', name: 'Push A', missed_streak: 1 },
    capabilities: { live: false }, live: null, coach: null, coach_cadence_on: false, legacy_reminder: null
  });
});

test('live and coach come from the stored state and the Coach record, on the server clock', async t => {
  const now = Date.now();
  const h = await startServer(t, {
    states: {
      u1: { ...WEEK, workoutLive: { workoutId: 'w_1', startedAt: now - 3600000, lastSetAt: now - 60000 }, coach: { consent: { agreedAt: 1 }, cadence: { everyWorkouts: 3 } } },
      u3: { ...WEEK, workoutLive: { workoutId: 'w_2', startedAt: now - 13 * 3600000, lastSetAt: null } }
    },
    coach: {
      u1: { pending: { id: 'p_1', kind: 'review', createdAt: now - 1000, expiresAt: now + 86400000, changes: [{}, {}, {}] } },
      u3: { pending: { id: 'p_2', kind: 'review', createdAt: now - 9e8, expiresAt: now - 1000, changes: [{}] } }
    }
  });
  const a = (await h.get('?date=2026-09-07', { token: tok('u1') })).body;
  assert.equal(a.capabilities.live, true);
  assert.equal(a.live.workout_id, 'w_1');
  assert.equal(a.live.started_at, new Date(now - 3600000).toISOString().replace(/\.\d{3}Z$/, 'Z'));
  assert.deepEqual({ ...a.coach, created_at: typeof a.coach.created_at, expires_at: typeof a.coach.expires_at }, { pending_id: 'p_1', changes: 3, created_at: 'string', expires_at: 'string' });
  assert.equal(a.coach_cadence_on, true);
  const c = (await h.get('?date=2026-09-07', { token: tok('u3') })).body;
  assert.deepEqual([c.capabilities, c.live, c.coach, c.coach_cadence_on], [{ live: true }, null, null, false]);
});

test('coach_cadence_on does not need a proposal; with Coach switched off on the server, coach is null and the cadence off, whatever is stored', async t => {
  const now = Date.now();
  const states = { u1: { ...WEEK, coach: { consent: { agreedAt: 1 }, cadence: { weekly: { day: 0 } } } } };
  const pending = { pending: { id: 'p_1', kind: 'review', createdAt: now - 1000, expiresAt: now + 86400000, changes: [{}] } };
  const bare = await startServer(t, { states });
  const a = (await bare.get('?date=2026-09-07', { token: tok() })).body;
  assert.deepEqual([a.coach, a.coach_cadence_on], [null, true]);
  const on = await startServer(t, { states, coach: { u1: pending } });
  assert.deepEqual((await on.get('?date=2026-09-07', { token: tok() })).body.coach_cadence_on, true);
  for (const coachConfig of [null, { enabled: false, provider: 'fixture' }, { enabled: true, provider: 'openai' }]) {
    const off = await startServer(t, { states, coach: { u1: pending }, coachConfig });
    const b = (await off.get('?date=2026-09-07', { token: tok() })).body;
    assert.deepEqual([b.coach, b.coach_cadence_on], [null, false], JSON.stringify(coachConfig));
  }
});

test('it is read-only: the state document and the Coach record are byte for byte what they were, an expired proposal included', async t => {
  const now = Date.now();
  const h = await startServer(t, { coach: { u1: { pending: { id: 'p_old', kind: 'review', createdAt: 1, expiresAt: now - 1000, changes: [{}] }, history: [] } } });
  const before = [h.read('state-u1.json'), h.read('coach', 'u1.json')];
  assert.equal((await h.get('?date=2026-09-07', { token: tok() })).body.coach, null);
  assert.deepEqual([h.read('state-u1.json'), h.read('coach', 'u1.json')], before);
  assert.deepEqual((await (await fetch(`${h.api}/api/data/rev`, { headers: { Cookie: 'gymsid=' + session('u1') } })).json()), { rev: 3, wid: 'aaaaaaaaaaaaaaaa' });
});

test('the date is the person’s and is required: a missing or malformed one is 400 invalid', async t => {
  const h = await startServer(t);
  for (const q of ['', '?date=', '?date=today', '?date=2026-9-7', '?date=2026-02-30', '?date=2026-09-07T00:00:00Z', '?date=1800-01-01', '?date=2999-01-01']) {
    const r = await h.get(q, { token: tok() });
    assert.deepEqual([r.status, r.body.code], [400, 'invalid'], q);
  }
});

test('the person must be there and have a state: user-gone, disabled and no-state, with the codes the other sync routes use', async t => {
  const h = await startServer(t);
  assert.deepEqual((await h.get('?date=2026-09-07', { token: tok('nobody') })).body.code, 'user-gone');
  const off = await h.get('?date=2026-09-07', { token: tok('u2') });
  assert.deepEqual([off.status, off.body.code], [401, 'disabled']);
  const none = await h.get('?date=2026-09-07', { token: tok('u3') });
  assert.deepEqual([none.status, none.body.code], [404, 'no-state']);
  const broken = await startServer(t, { states: { u1: '{not json' } });
  const r = await broken.get('?date=2026-09-07', { token: tok() });
  assert.deepEqual([r.status, r.body.code], [503, 'state-unreadable']);
});

test('only a per-profile sync token gets in: every wrong token, a user scope, another audience, a replay, a session', async t => {
  const h = await startServer(t);
  for (const [name, token] of Object.entries(badTokens(KEY))) {
    const r = await h.get('?date=2026-09-07', { token });
    assert.deepEqual([r.status, r.body.code], [401, 'token-invalid'], name);
  }
  for (const [name, claims] of [['scope user', { scope: 'user' }], ['scope sync-list', { scope: 'sync-list' }], ['audience nutritrace', { aud: 'nutritrace' }], ['listing audience', { aud: 'opengym-sync-users', scope: 'sync-list' }]]) {
    const r = await h.get('?date=2026-09-07', { token: tok('u1', claims) });
    assert.deepEqual([r.status, r.body.code], [401, 'token-invalid'], name);
  }
  const once = tok();
  assert.equal((await h.get('?date=2026-09-07', { token: once })).status, 200);
  assert.deepEqual((await h.get('?date=2026-09-07', { token: once })).body.code, 'replay');
  assert.equal((await h.get('?date=2026-09-07', { cookie: session('u1') })).status, 401);
  assert.equal((await h.get('?date=2026-09-07')).status, 401);
  assert.ok(!h.log.includes('server error'));
});

test('a token for the listing is no credential here, and a per-profile one is none there', async t => {
  const h = await startServer(t);
  const list = mint(KEY, { sub: 'hub', claims: { aud: 'opengym-sync-users', scope: 'sync-list' } });
  assert.equal((await h.get('?date=2026-09-07', { token: list })).status, 401);
  const r = await fetch(`${h.api}/api/sync/users`, { headers: { Authorization: 'Bearer ' + tok('u1') } });
  assert.equal(r.status, 401);
});

test('without HUB_JWKS the route does not exist: a plain 404', async t => {
  const h = await startServer(t, { env: {} });
  const r = await h.get('?date=2026-09-07', { token: tok() });
  assert.deepEqual([r.status, r.body], [404, { error: 'not found' }]);
});

test('120 a minute per person, counting only calls that carry a valid token; another person is not held by it', async t => {
  const h = await startServer(t, { states: { u1: WEEK, u3: WEEK } });
  for (let i = 0; i < 150; i++) assert.equal((await h.get('?date=2026-09-07', { token: 'not-a-token' })).status, 401);
  for (let i = 0; i < 120; i++) assert.equal((await h.get('?date=2026-09-07', { token: tok() })).status, 200, `call ${i + 1}`);
  const over = await h.get('?date=2026-09-07', { token: tok() });
  assert.equal(over.status, 429);
  assert.equal(over.body.code, 'rate-limited');
  assert.ok(Number(over.headers.get('retry-after')) >= 1);
  assert.equal((await h.get('?date=2026-09-07', { token: tok('u3') })).status, 200);
});
