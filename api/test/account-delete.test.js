/* Deleting your own account after a 7-day grace (PR-06): the proof scheduling asks, what the
   grace leaves working (reads, sign-in) and what it stops (writes, uploads), cancelling, the last
   admin, and the sweep that removes a profile once its deadline has passed — through the same
   deleteUserData the admin's delete uses (server-admin-delete.test.js keeps that one honest).
   Real server.js in a child, the harness of server-passkeys.test.js; every test talks from its own
   X-Forwarded-For address (TRUST_PROXY=1), so one test's budget never touches another's. */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../password.js';
import { boundPort } from './helpers.mjs';
import { softPasskey, ORIGIN } from './soft-passkey.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const DAY = 86400000;
const GRACE = 7 * DAY;

const mintSession = (uid, sv = 0) => {
  const payload = `${uid}:${Date.now() + DAY}:${sv}`;
  return 'gymsid=' + payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
};

const GOOD = 'correct horse battery staple';
let pwHash;
before(async () => { pwHash ??= await hashPassword(GOOD); });

const user = (id, name, extra = {}) => ({ id, name, created: new Date().toISOString(), ...extra });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startServer(t, { env = {}, users = [], creds = [], subs = [], states = {}, uploads = [], prepare } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-acct-del-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users, creds, subs, invites: [] }));
  for (const [uid, S] of Object.entries(states)) fs.writeFileSync(path.join(dataDir, `state-${uid}.json`), JSON.stringify(S));
  for (const uid of uploads) {
    fs.mkdirSync(path.join(dataDir, 'uploads', uid), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'uploads', uid, 'a'.repeat(64) + '.jpg'), 'not really a photo');
  }
  prepare?.(dataDir);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost',
      PASSWORD_LOGIN: '1', TRUST_PROXY: '1', INVITE_ONLY: '', ADMIN_UIDS: '', AUDIT_LOG: '1', ...env
    }
  });
  const h = { log: '', dataDir };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => {
    child.kill('SIGKILL');
    // A test may leave an upload folder read-only on purpose.
    try { fs.chmodSync(path.join(dataDir, 'uploads', 'u1'), 0o700); } catch { /* none */ }
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  h.api = `http://127.0.0.1:${await boundPort(child, () => h.log)}`;
  h.req = async (method, p, { body, cookie, ip = '198.51.100.1', raw } = {}) => {
    const r = await fetch(`${h.api}${p}`, {
      method,
      headers: {
        'Content-Type': raw ? 'image/jpeg' : 'application/json', 'Sec-Fetch-Site': 'same-origin', 'X-Forwarded-For': ip,
        ...(cookie ? { Cookie: cookie } : {})
      },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body))
    });
    return { status: r.status, body: await r.json() };
  };
  h.db = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  h.u = id => h.db().users.find(u => u.id === id);
  h.audit = () => { try { return fs.readFileSync(path.join(dataDir, 'audit.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l)); } catch { return []; } };
  h.stateExists = uid => fs.existsSync(path.join(dataDir, `state-${uid}.json`));
  h.uploadsExist = uid => fs.existsSync(path.join(dataDir, 'uploads', uid));
  // Step one, then an assertion over its challenge: the proof Settings sends.
  h.proof = async (key, cookie, ip) => {
    const r = await h.req('POST', '/api/account/delete/options', { body: {}, cookie, ip });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return { cid: r.body.cid, credential: key.assertion(r.body.options.challenge) };
  };
  h.schedule = async (key, cookie, ip) => h.req('POST', '/api/account/delete', { body: await h.proof(key, cookie, ip), cookie, ip });
  return h;
}

// The same deadline, give or take the time the request took.
const near = (iso, ms, slack = 60000) => Math.abs(Date.parse(iso) - ms) < slack;

test('every route wants a session', async t => {
  const h = await startServer(t, { users: [user('u1', 'Ana')] });
  for (const p of ['/api/account/delete/options', '/api/account/delete', '/api/account/delete/cancel']) {
    const r = await h.req('POST', p, { body: {}, ip: '198.51.100.10' });
    assert.equal(r.status, 401, p);
  }
  assert.equal(h.u('u1').deletion, undefined);
});

test('scheduling needs a proof, and a missing or wrong one deletes nothing', async t => {
  const ana = softPasskey(), bea = softPasskey();
  const h = await startServer(t, { users: [user('u1', 'Ana'), user('u2', 'Bea')], creds: [ana.row('u1'), bea.row('u2')] });
  const ip = '198.51.100.11', cookie = mintSession('u1');

  const bare = await h.req('POST', '/api/account/delete', { body: {}, cookie, ip });
  assert.equal(bare.status, 403);
  assert.equal(bare.body.code, 'passkey-required');

  // Ana's session confirmed with Bea's passkey.
  const wrong = await h.req('POST', '/api/account/delete', { body: await h.proof(bea, cookie, ip), cookie, ip });
  assert.equal(wrong.status, 403);
  assert.equal(wrong.body.code, 'passkey');

  // A challenge minted for Bea's session, answered by Ana: bound to the other profile.
  const forBea = await h.req('POST', '/api/account/delete/options', { body: {}, cookie: mintSession('u2'), ip });
  const crossed = await h.req('POST', '/api/account/delete', { body: { cid: forBea.body.cid, credential: ana.assertion(forBea.body.options.challenge) }, cookie, ip });
  assert.equal(crossed.status, 403);

  // A garbage assertion over a real challenge.
  const opt = await h.req('POST', '/api/account/delete/options', { body: {}, cookie, ip });
  const junk = await h.req('POST', '/api/account/delete', { body: { cid: opt.body.cid, credential: { id: ana.id, response: {} } }, cookie, ip });
  assert.equal(junk.status, 403);

  assert.equal(h.u('u1').deletion, undefined, 'nothing scheduled');
  assert.equal(h.u('u2').deletion, undefined);
  assert.ok(h.audit().some(e => e.ev === 'auth.proof.fail' && e.act === 'account-delete' && e.uid === 'u1'));
  assert.ok(!h.audit().some(e => e.ev === 'account.delete.schedule'));
});

test('step one lists the profile’s own passkeys, and its challenge is spent once', async t => {
  const a = softPasskey(), b = softPasskey(), other = softPasskey();
  const h = await startServer(t, { users: [user('u1', 'Ana'), user('u2', 'Bea')], creds: [a.row('u1'), b.row('u1'), other.row('u2')] });
  const ip = '198.51.100.12', cookie = mintSession('u1');
  const opt = await h.req('POST', '/api/account/delete/options', { body: {}, cookie, ip });
  assert.equal(opt.status, 200);
  assert.deepEqual(opt.body.options.allowCredentials.map(c => c.id).sort(), [a.id, b.id].sort());
  assert.equal(opt.body.password, false);
  const body = { cid: opt.body.cid, credential: a.assertion(opt.body.options.challenge) };
  const ok = await h.req('POST', '/api/account/delete', { body, cookie, ip });
  assert.equal(ok.status, 200);
  // Cancelled, then the same assertion replayed: the challenge is gone.
  await h.req('POST', '/api/account/delete/cancel', { body: {}, cookie, ip });
  const replay = await h.req('POST', '/api/account/delete', { body, cookie, ip });
  assert.equal(replay.status, 403);
  assert.equal(h.u('u1').deletion, undefined);
});

test('the challenge dies with "sign out everywhere"', async t => {
  const key = softPasskey();
  const h = await startServer(t, { users: [user('u1', 'Ana')], creds: [key.row('u1')] });
  const ip = '198.51.100.13';
  const opt = await h.req('POST', '/api/account/delete/options', { body: {}, cookie: mintSession('u1', 0), ip });
  assert.equal((await h.req('POST', '/api/logout/all', { body: {}, cookie: mintSession('u1', 0), ip })).status, 200);
  const r = await h.req('POST', '/api/account/delete', {
    body: { cid: opt.body.cid, credential: key.assertion(opt.body.options.challenge) }, cookie: mintSession('u1', 1), ip
  });
  assert.equal(r.status, 403);
  assert.equal(h.u('u1').deletion, undefined);
});

test('scheduled: /api/me says when, reads work, writes and uploads are 423, cancel restores writes', async t => {
  const key = softPasskey();
  const h = await startServer(t, {
    users: [user('u1', 'Ana')], creds: [key.row('u1')],
    states: { u1: { unit: 'kg', workouts: [], _rev: 3 } }
  });
  const ip = '198.51.100.14', cookie = mintSession('u1');
  const before = Date.now();
  const s = await h.schedule(key, cookie, ip);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.ok, true);
  assert.ok(near(s.body.at, before + GRACE), s.body.at);
  assert.ok(near(s.body.requestedAt, before), s.body.requestedAt);
  const stored = h.u('u1').deletion;
  assert.equal(stored.at - stored.requestedAt, GRACE);
  assert.equal(new Date(stored.at).toISOString(), s.body.at);
  assert.ok(h.audit().some(e => e.ev === 'account.delete.schedule' && e.uid === 'u1' && e.msg === 'passkey'));

  const me = await h.req('GET', '/api/me', { cookie, ip });
  assert.equal(me.status, 200, 'sessions stay valid');
  assert.deepEqual(me.body.user.deletion, { at: s.body.at, requestedAt: s.body.requestedAt });

  const put = await h.req('PUT', '/api/data', { body: { state: { unit: 'lb', workouts: [] }, baseRev: 3 }, cookie, ip });
  assert.equal(put.status, 423);
  assert.deepEqual(put.body, { error: 'deletion scheduled', code: 'deletion-scheduled', at: s.body.at });
  const got = await h.req('GET', '/api/data', { cookie, ip });
  assert.equal(got.status, 200);
  assert.equal(got.body.state.unit, 'kg', 'everything is still there, unchanged');
  assert.equal((await h.req('GET', '/api/data/rev', { cookie, ip })).status, 200);
  const up = await h.req('PUT', `/api/media/${'b'.repeat(64)}`, { raw: Buffer.from('xyz'), cookie, ip });
  assert.equal(up.status, 423);
  assert.equal(up.body.code, 'deletion-scheduled');

  const c = await h.req('POST', '/api/account/delete/cancel', { body: {}, cookie, ip });
  assert.deepEqual(c, { status: 200, body: { ok: true } });
  assert.equal(h.u('u1').deletion, undefined);
  assert.ok(h.audit().some(e => e.ev === 'account.delete.cancel' && e.uid === 'u1'));
  const me2 = await h.req('GET', '/api/me', { cookie, ip });
  assert.equal('deletion' in me2.body.user, false);
  const put2 = await h.req('PUT', '/api/data', { body: { state: { unit: 'lb', workouts: [] }, baseRev: 3 }, cookie, ip });
  assert.equal(put2.status, 200, JSON.stringify(put2.body));
});

test('scheduling twice keeps the first deadline; step one refuses while one is pending', async t => {
  const key = softPasskey();
  const h = await startServer(t, { users: [user('u1', 'Ana')], creds: [key.row('u1')] });
  const ip = '198.51.100.15', cookie = mintSession('u1');
  const first = await h.schedule(key, cookie, ip);
  assert.equal(first.status, 200);
  const stored = h.u('u1').deletion;
  await sleep(20);
  const again = await h.req('POST', '/api/account/delete', { body: {}, cookie, ip });
  assert.equal(again.status, 200);
  assert.equal(again.body.at, first.body.at);
  assert.deepEqual(h.u('u1').deletion, stored, 'the clock never restarts');
  const opt = await h.req('POST', '/api/account/delete/options', { body: {}, cookie, ip });
  assert.equal(opt.status, 409);
  assert.equal(opt.body.code, 'deletion-scheduled');
  assert.equal(opt.body.at, first.body.at);
  assert.equal(h.audit().filter(e => e.ev === 'account.delete.schedule').length, 1);
});

test('cancelling with nothing pending is fine and logs nothing', async t => {
  const h = await startServer(t, { users: [user('u1', 'Ana')] });
  const r = await h.req('POST', '/api/account/delete/cancel', { body: {}, cookie: mintSession('u1'), ip: '198.51.100.16' });
  assert.deepEqual(r, { status: 200, body: { ok: true } });
  assert.ok(!h.audit().some(e => e.ev === 'account.delete.cancel'));
});

test('the last admin cannot schedule; one of two admins can', async t => {
  const a = softPasskey(), b = softPasskey();
  const h = await startServer(t, { users: [user('a1', 'Root', { admin: true }), user('u1', 'Ana')], creds: [a.row('a1')] });
  const ip = '198.51.100.17', cookie = mintSession('a1');
  const opt = await h.req('POST', '/api/account/delete/options', { body: {}, cookie, ip });
  assert.equal(opt.status, 409);
  assert.equal(opt.body.code, 'last-admin');
  const del = await h.req('POST', '/api/account/delete', { body: {}, cookie, ip });
  assert.equal(del.status, 409);
  assert.equal(del.body.code, 'last-admin');
  assert.equal(h.u('a1').deletion, undefined);

  const h2 = await startServer(t, { users: [user('a1', 'Root', { admin: true }), user('a2', 'Two', { admin: true })], creds: [a.row('a1'), b.row('a2')] });
  const ok = await h2.schedule(a, mintSession('a1'), ip);
  assert.equal(ok.status, 200);
  assert.ok(h2.u('a1').deletion);
});

test('a profile with only a password proves it with the password', async t => {
  const h = await startServer(t, { users: [user('u1', 'Ana', { pw: { h: pwHash, set: new Date().toISOString() } })] });
  const ip = '198.51.100.18', cookie = mintSession('u1');
  const opt = await h.req('POST', '/api/account/delete/options', { body: {}, cookie, ip });
  assert.deepEqual(opt, { status: 200, body: { password: true } });
  const none = await h.req('POST', '/api/account/delete', { body: {}, cookie, ip });
  assert.equal(none.status, 403);
  assert.equal(none.body.code, 'current-required');
  const bad = await h.req('POST', '/api/account/delete', { body: { current: 'not it at all, sorry' }, cookie, ip });
  assert.equal(bad.status, 403);
  assert.equal(bad.body.code, 'current-wrong');
  assert.equal(h.u('u1').deletion, undefined);
  const ok = await h.req('POST', '/api/account/delete', { body: { current: GOOD }, cookie, ip });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.ok(h.audit().some(e => e.ev === 'account.delete.schedule' && e.msg === 'password'));
});

test('with no passkey and password sign-in off, nothing can prove it: 409 no-passkey', async t => {
  const h = await startServer(t, { env: { PASSWORD_LOGIN: '' }, users: [user('u1', 'Ana', { pw: { h: pwHash, set: new Date().toISOString() } })] });
  const ip = '198.51.100.19', cookie = mintSession('u1');
  for (const p of ['/api/account/delete/options', '/api/account/delete']) {
    const r = await h.req('POST', p, { body: { current: GOOD }, cookie, ip });
    assert.equal(r.status, 409, p);
    assert.deepEqual(r.body, { error: 'no passkey', code: 'no-passkey' });
  }
  assert.equal(h.u('u1').deletion, undefined);
});

test('the sweep leaves a deadline in the future alone, and profiles with no schedule', async t => {
  const h = await startServer(t, {
    env: { ACCOUNT_SWEEP_MS: '50' },
    users: [
      user('u1', 'Ana', { deletion: { requestedAt: Date.now() - DAY, at: Date.now() + DAY } }),
      user('u2', 'Bea'),
      user('u3', 'Cy', { deletion: { at: 'tomorrow' } })   // not a schedule
    ],
    states: { u1: { unit: 'kg' }, u2: { unit: 'kg' }, u3: { unit: 'kg' } }
  });
  await sleep(400);
  assert.deepEqual(h.db().users.map(u => u.id), ['u1', 'u2', 'u3']);
  for (const id of ['u1', 'u2', 'u3']) assert.ok(h.stateExists(id), id);
  assert.ok(!h.audit().some(e => e.ev === 'account.delete.purge'));
  // The malformed field neither pauses sync nor shows on /api/me; cancel clears it.
  const ip = '198.51.100.20', cookie = mintSession('u3');
  assert.equal('deletion' in (await h.req('GET', '/api/me', { cookie, ip })).body.user, false);
  assert.equal((await h.req('PUT', '/api/data', { body: { state: { unit: 'lb' } }, cookie, ip })).status, 200);
  await h.req('POST', '/api/account/delete/cancel', { body: {}, cookie, ip });
  assert.equal('deletion' in h.u('u3'), false);
});

test('at boot, a profile past its deadline is removed with everything of it', async t => {
  const ana = softPasskey(), bea = softPasskey();
  const h = await startServer(t, {
    users: [user('u1', 'Ana', { deletion: { requestedAt: Date.now() - GRACE - 1000, at: Date.now() - 1000 } }), user('u2', 'Bea')],
    creds: [ana.row('u1'), bea.row('u2')],
    subs: [{ endpoint: 'https://push/ana', userId: 'u1' }, { endpoint: 'https://push/bea', userId: 'u2' }],
    states: { u1: { unit: 'kg', _rev: 4 }, u2: { unit: 'kg' } },
    uploads: ['u1', 'u2']
  });
  const db = h.db();
  assert.deepEqual(db.users.map(u => u.id), ['u2']);
  assert.deepEqual(db.creds.map(c => c.userId), ['u2']);
  assert.deepEqual(db.subs.map(s => s.userId), ['u2']);
  assert.ok(db.gone.some(g => g.id === 'u1'), 'listed as gone for the sync hub');
  assert.equal(h.stateExists('u1'), false);
  assert.equal(h.uploadsExist('u1'), false);
  assert.ok(h.stateExists('u2') && h.uploadsExist('u2'), 'nobody else is touched');
  const row = h.audit().find(e => e.ev === 'account.delete.purge');
  assert.ok(row, 'audited');
  assert.equal(row.uid, 'u1');
  assert.equal(row.msg, 'Ana');
  assert.equal((await h.req('GET', '/api/me', { cookie: mintSession('u1'), ip: '198.51.100.21' })).status, 401);
});

test('a running server removes a profile once its deadline passes', async t => {
  const h = await startServer(t, {
    env: { ACCOUNT_SWEEP_MS: '100' },
    users: [user('u1', 'Ana', { deletion: { requestedAt: Date.now() - GRACE, at: Date.now() + 3000 } }), user('u2', 'Bea')],
    states: { u1: { unit: 'kg' }, u2: { unit: 'kg' } }
  });
  assert.ok(h.u('u1'), 'not before the deadline');
  assert.equal((await h.req('GET', '/api/data', { cookie: mintSession('u1'), ip: '198.51.100.22' })).status, 200);
  const until = Date.now() + 9000;
  while (h.u('u1') && Date.now() < until) await sleep(100);
  assert.equal(h.u('u1'), undefined, 'removed after the deadline');
  assert.equal(h.stateExists('u1'), false);
  assert.ok(h.u('u2'));
  assert.equal(h.audit().filter(e => e.ev === 'account.delete.purge').length, 1);
});

// A file that cannot be removed must not cost the profile its record: the record is how the sweep
// finds the leftovers. The failure is injected before boot; it is lifted while the server runs and
// the next sweep has to finish the job.
const FAILURES = {
  'the state file cannot be unlinked': {
    prepare: dir => { fs.mkdirSync(path.join(dir, 'state-u1.json')); fs.writeFileSync(path.join(dir, 'state-u1.json', 'x'), '1'); },
    lift: dir => { fs.rmSync(path.join(dir, 'state-u1.json'), { recursive: true }); }
  },
  'the uploads cannot be removed': {
    skip: process.getuid?.() === 0 ? 'root ignores directory permissions' : false,
    prepare: dir => { fs.writeFileSync(path.join(dir, 'state-u1.json'), '{}'); fs.chmodSync(path.join(dir, 'uploads', 'u1'), 0o500); },
    lift: dir => { fs.chmodSync(path.join(dir, 'uploads', 'u1'), 0o700); }
  }
};
for (const [what, { prepare, lift, skip }] of Object.entries(FAILURES)) {
  test(`when ${what}, the profile stays scheduled and the next sweep finishes it`, { skip }, async t => {
    const ana = softPasskey();
    const h = await startServer(t, {
      env: { ACCOUNT_SWEEP_MS: '100' },
      users: [user('u1', 'Ana', { deletion: { requestedAt: Date.now() - GRACE - 1000, at: Date.now() - 1000 } }), user('u2', 'Bea')],
      creds: [ana.row('u1')],
      states: { u2: { unit: 'kg' } },
      uploads: ['u1'],
      prepare
    });
    await sleep(500);
    assert.ok(h.u('u1')?.deletion, 'record and schedule kept while a file is stuck');
    assert.equal(h.db().creds.length, 1, 'passkeys kept with it');
    assert.ok(!h.db().gone?.some(g => g.id === 'u1'));
    assert.ok(h.log.includes('account purge failed for u1'), h.log);
    assert.ok(!h.audit().some(e => e.ev === 'account.delete.purge'), 'not audited as done');
    lift(h.dataDir);
    const until = Date.now() + 9000;
    while (h.u('u1') && Date.now() < until) await sleep(100);
    assert.equal(h.u('u1'), undefined, 'the next sweep removed it');
    assert.equal(h.stateExists('u1'), false);
    assert.equal(h.uploadsExist('u1'), false);
    assert.deepEqual(h.db().creds, []);
    // The audit line follows the db write by a moment.
    const logged = Date.now() + 3000;
    while (!h.audit().some(e => e.ev === 'account.delete.purge') && Date.now() < logged) await sleep(50);
    assert.equal(h.audit().filter(e => e.ev === 'account.delete.purge').length, 1);
    assert.ok(h.stateExists('u2'));
  });
}

test('the sweep skips the last admin and keeps the schedule', async t => {
  const h = await startServer(t, {
    users: [user('a1', 'Root', { admin: true, deletion: { requestedAt: Date.now() - GRACE - 1000, at: Date.now() - 1000 } }), user('u1', 'Ana')],
    states: { a1: { unit: 'kg' } }
  });
  assert.ok(h.u('a1').deletion);
  assert.ok(h.stateExists('a1'));
  assert.ok(!h.audit().some(e => e.ev === 'account.delete.purge'));
});

test('the admin’s delete goes through the same purge and still logs the admin', async t => {
  const h = await startServer(t, {
    users: [user('a1', 'Root', { admin: true }), user('u1', 'Ana', { deletion: { requestedAt: Date.now(), at: Date.now() + GRACE } })],
    states: { u1: { unit: 'kg' } }, uploads: ['u1']
  });
  const r = await h.req('POST', '/api/admin/user/delete', { body: { id: 'u1' }, cookie: mintSession('a1'), ip: '198.51.100.25' });
  assert.deepEqual(r, { status: 200, body: { ok: true, id: 'u1' } });
  assert.deepEqual(h.db().users.map(u => u.id), ['a1']);
  assert.equal(h.stateExists('u1'), false);
  assert.equal(h.uploadsExist('u1'), false);
  const row = h.audit().find(e => e.ev === 'admin.user.delete');
  assert.equal(row.uid, 'a1');
  assert.equal(row.msg, 'Ana');
});

test('the routes spend the sign-in burst budget', async t => {
  const h = await startServer(t, { users: [user('u1', 'Ana')] });
  const ip = '198.51.100.23', cookie = mintSession('u1');
  let last;
  for (let i = 0; i < 61; i++) last = await h.req('POST', '/api/account/delete/cancel', { body: {}, cookie, ip });
  assert.equal(last.status, 429);
  assert.equal(last.body.code, 'locked');
  assert.equal((await h.req('POST', '/api/account/delete', { body: {}, cookie, ip })).status, 429);
  // Another address is not paused.
  assert.equal((await h.req('POST', '/api/account/delete/cancel', { body: {}, cookie, ip: '198.51.100.24' })).status, 200);
});
