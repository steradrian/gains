/* Members asking the admins for an invite: POST /api/invites/request, GET /api/invites/requests/mine,
   POST /api/invites/request/cancel, and the `requests` / `requestId` the admin invite routes gained.
   Who may call what: a member asks, lists and withdraws only their own; nothing a member can call
   lists, makes or revokes invites, or tells them about anyone else's asks. The rules themselves are
   in invites.test.js. Real server.js in a child. Push subscriptions have private endpoints: the
   send path refuses and prunes each one it would have contacted, without opening a socket, so what
   is left in db.json says who was pushed (server-push-device.test.js). */
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
const DAY = 86400000;
const iso = ms => new Date(ms).toISOString();

const token = uid => {
  const payload = `${uid}:${Date.now() + DAY}:0`;
  return payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
};
const as = uid => ({ Cookie: `gymsid=${token(uid)}` });
const user = (id, name, extra = {}) => ({ id, name, created: iso(Date.now()), ...extra });
const USERS = [
  user('adm', 'Adrian', { admin: true }),
  user('adm2', 'Second', { admin: true }),
  user('u1', 'Bea'),
  user('u2', 'Cy'),
  user('u3', 'Locked', { disabled: true })
];
const sub = (userId, n) => ({ userId, endpoint: `https://10.0.0.${n}/${userId}`, keys: { p256dh: 'p', auth: 'a' }, created: iso(Date.now()) });
const SUBS = [sub('adm', 1), sub('adm2', 2), sub('u1', 3), sub('u2', 4)];

async function startServer(t, { inviteRequests = [], subs = SUBS } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-invreq-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users: USERS, creds: [], subs, invites: [], inviteRequests }));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost', INVITE_ONLY: '1',
      ADMIN_UIDS: '', AUDIT_LOG: '1', ALLOWED_PRIVATE_IPS: '', PUSH_SUBS_READONLY: '', REMINDER_TICK_MS: '100000'
    }
  });
  const h = { log: '' };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  h.api = `http://127.0.0.1:${await boundPort(child, () => h.log)}`;
  h.req = async (method, p, { body, uid, headers = {} } = {}) => {
    const r = await fetch(`${h.api}${p}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', ...(uid ? as(uid) : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: r.status, body: await r.json(), headers: r.headers };
  };
  h.ask = (uid, note) => h.req('POST', '/api/invites/request', { uid, body: { note } });
  h.mine = async uid => (await h.req('GET', '/api/invites/requests/mine', { uid })).body.requests;
  h.db = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  h.audit = () => { try { return fs.readFileSync(path.join(dataDir, 'audit.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l)); } catch { return []; } };
  // The users whose subscriptions are still there, i.e. who has not been pushed yet.
  h.unpushed = () => h.db().subs.map(s => s.userId).sort();
  // A push is sent after the answer: wait until the pruning shows, or give up and return as is.
  h.settle = async want => {
    for (let i = 0; i < 40 && JSON.stringify(h.unpushed()) !== JSON.stringify(want); i++) await new Promise(r => setTimeout(r, 50));
    return h.unpushed();
  };
  return h;
}

test('every new route needs a session', async t => {
  const h = await startServer(t);
  for (const [method, p, body] of [
    ['POST', '/api/invites/request', { note: 'x' }],
    ['GET', '/api/invites/requests/mine'],
    ['POST', '/api/invites/request/cancel', { id: 'x' }]
  ]) {
    const r = await h.req(method, p, { body });
    assert.deepEqual([r.status, r.body.error], [401, 'not signed in'], `${method} ${p}`);
  }
  // A disabled account's session is no session.
  assert.equal((await h.ask('u3', 'x')).status, 401);
  assert.deepEqual(h.db().inviteRequests, []);
});

test('a member asks: stored, every admin is pushed and nobody else, the audit has no note', async t => {
  const h = await startServer(t);
  const r = await h.ask('u1', '  my sister\u0000 Ana ');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(Object.keys(r.body).sort(), ['id', 'ok']);
  assert.equal(r.body.ok, true);
  assert.match(r.body.id, /^[0-9a-f]{16}$/);
  const [row] = h.db().inviteRequests;
  assert.deepEqual({ ...row, at: undefined }, { id: r.body.id, by: 'u1', note: 'my sister Ana', at: undefined, status: 'open' });
  assert.deepEqual(await h.settle(['u1', 'u2']), ['u1', 'u2'], 'both admins were pushed, no member was');
  const audit = h.audit().filter(e => e.ev === 'invite.request');
  assert.deepEqual(audit.map(e => [e.uid, e.msg]), [['u1', r.body.id]]);
  assert.ok(!JSON.stringify(h.audit()).includes('sister'), 'the note stays out of the audit log');
  assert.ok(!h.log.includes('sister'), 'and out of the container log');
});

test('the same open note is the same ask: same id, nothing new stored, audited or pushed', async t => {
  const h = await startServer(t, { subs: [] });
  const a = await h.ask('u1', 'Ana');
  const b = await h.ask('u1', 'Ana');
  assert.equal(b.status, 200);
  assert.equal(b.body.id, a.body.id);
  assert.equal(h.db().inviteRequests.length, 1);
  assert.equal(h.audit().filter(e => e.ev === 'invite.request').length, 1);
});

test('an admin is told to make the invite instead, and nothing is stored', async t => {
  const h = await startServer(t);
  const r = await h.ask('adm', 'Ana');
  assert.deepEqual([r.status, r.body.code], [400, 'admin']);
  assert.deepEqual(h.db().inviteRequests, []);
  // An admin's own list of asks is simply empty.
  assert.deepEqual(await h.mine('adm'), []);
});

test('three asks a day per person, then 429 with Retry-After; another member is not counted', async t => {
  const h = await startServer(t, { subs: [] });
  for (const note of ['one', 'two', 'three']) assert.equal((await h.ask('u1', note)).status, 200, note);
  const over = await h.ask('u1', 'four');
  assert.equal(over.status, 429);
  assert.deepEqual([over.body.code, over.body.reason], ['rate-limited', 'daily']);
  const wait = Number(over.headers.get('retry-after'));
  assert.ok(wait > DAY / 1000 - 60 && wait <= DAY / 1000, String(wait));
  assert.equal(over.body.retryAfter, wait);
  // Withdrawing does not give the ask back: it already rang the admins' phones.
  await h.req('POST', '/api/invites/request/cancel', { uid: 'u1', body: { id: (await h.mine('u1'))[0].id } });
  assert.equal((await h.ask('u1', 'four')).status, 429);
  assert.equal((await h.ask('u2', 'four')).status, 200);
  assert.equal(h.db().inviteRequests.filter(r => r.by === 'u1').length, 3);
});

test('three open at once, however old, then 429 reason open', async t => {
  const old = (id, days) => ({ id, by: 'u1', note: id, at: iso(Date.now() - days * DAY), status: 'open' });
  const h = await startServer(t, { subs: [], inviteRequests: [old('a', 5), old('b', 4), old('c', 3)] });
  const over = await h.ask('u1', 'four');
  assert.deepEqual([over.status, over.body.code, over.body.reason], [429, 'rate-limited', 'open']);
  assert.equal(over.headers.get('retry-after'), String(DAY / 1000));
  assert.equal((await h.ask('u1', 'b')).body.id, 'b', 'an identical open ask is still answered');
  assert.equal((await h.req('POST', '/api/invites/request/cancel', { uid: 'u1', body: { id: 'a' } })).status, 200);
  assert.equal((await h.ask('u1', 'four')).status, 200, 'withdrawing one makes room');
});

test('a member sees and withdraws only their own asks; someone else\'s id is answered like an unknown one', async t => {
  const h = await startServer(t, { subs: [] });
  const bea = (await h.ask('u1', 'for Bea\'s sister')).body.id;
  const cy = (await h.ask('u2', 'for Cy\'s friend')).body.id;
  assert.deepEqual((await h.mine('u1')).map(r => [r.id, r.note]), [[bea, 'for Bea\'s sister']]);
  assert.deepEqual((await h.mine('u2')).map(r => r.id), [cy]);
  assert.deepEqual(Object.keys((await h.mine('u1'))[0]).sort(), ['at', 'id', 'note'], 'no asker id, no status');

  const cancel = (uid, id) => h.req('POST', '/api/invites/request/cancel', { uid, body: { id } });
  const notMine = await cancel('u2', bea);
  const unknown = await cancel('u2', 'ffffffffffffffff');
  const malformed = await h.req('POST', '/api/invites/request/cancel', { uid: 'u2', body: {} });
  for (const r of [notMine, unknown, malformed]) assert.deepEqual([r.status, r.body], [200, { ok: true }]);
  assert.equal(h.db().inviteRequests.find(r => r.id === bea).status, 'open', 'Cy cannot withdraw Bea\'s');

  assert.deepEqual((await cancel('u1', bea)).body, { ok: true });
  assert.deepEqual(await h.mine('u1'), []);
  assert.deepEqual((await cancel('u1', bea)).body, { ok: true }, 'withdrawing twice is harmless');
  const admin = await h.req('GET', '/api/admin/invites', { uid: 'adm' });
  assert.deepEqual(admin.body.requests.map(r => r.id), [cy], 'a withdrawn ask leaves the admin list');
  assert.deepEqual(h.audit().filter(e => e.ev === 'invite.request.cancel').map(e => [e.uid, e.msg]), [['u1', bea]]);
});

test('a member cannot list, make or revoke invites, or answer an ask', async t => {
  const h = await startServer(t, { subs: [] });
  const id = (await h.ask('u1', 'Ana')).body.id;
  const code = (await h.req('POST', '/api/admin/invites/new', { uid: 'adm', body: { name: 'Zed' } })).body.invite.code;
  for (const [method, p, body] of [
    ['GET', '/api/admin/invites'],
    ['POST', '/api/admin/invites/new', { name: 'Ana', requestId: id }],
    ['POST', '/api/admin/invites/revoke', { code }]
  ]) {
    for (const uid of ['u1', 'u2']) {
      const r = await h.req(method, p, { uid, body });
      assert.deepEqual([r.status, r.body.error], [403, 'forbidden'], `${uid} ${method} ${p}`);
    }
  }
  const db = h.db();
  assert.equal(db.inviteRequests[0].status, 'open', 'the ask is not answered by a member');
  assert.deepEqual(db.invites.map(i => [i.code, !!i.revoked]), [[code, false]], 'no invite made, none revoked');
});

test('admins see open asks with the asker\'s name; answering one marks it done and pushes only its asker', async t => {
  const h = await startServer(t, {
    subs: [sub('u1', 3), sub('u2', 4)],
    inviteRequests: [{ id: 'locked1', by: 'u3', note: 'hidden', at: iso(Date.now()), status: 'open' }]
  });
  const id = (await h.ask('u1', 'my sister Ana')).body.id;
  await h.ask('u2', 'a friend');
  const list = await h.req('GET', '/api/admin/invites', { uid: 'adm2' });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.requests.map(({ at, ...r }) => r), [
    { id, name: 'Bea', note: 'my sister Ana', by: 'u1' },
    { id: list.body.requests[1].id, name: 'Cy', note: 'a friend', by: 'u2' }
  ], 'oldest first; a disabled asker is left out');
  assert.ok(list.body.requests.every(r => !Number.isNaN(Date.parse(r.at))));

  const made = await h.req('POST', '/api/admin/invites/new', { uid: 'adm', body: { name: 'Ana', note: 'for Bea', requestId: id } });
  assert.equal(made.status, 200);
  const row = h.db().inviteRequests.find(r => r.id === id);
  assert.deepEqual([row.status, row.doneBy, row.inviteCode], ['done', 'adm', `${made.body.invite.code.slice(0, 4)}…`]);
  assert.ok(!JSON.stringify(h.db().inviteRequests).includes(made.body.invite.code), 'no live code in the request');
  assert.deepEqual(await h.settle(['u2']), ['u2'], 'Bea was pushed, Cy was not');
  assert.deepEqual((await h.req('GET', '/api/admin/invites', { uid: 'adm' })).body.requests.map(r => r.by), ['u2']);
  assert.deepEqual(await h.mine('u1'), [], 'an answered ask is no longer waiting');

  // An unknown or already-answered requestId never blocks an admin.
  for (const requestId of [id, 'nope', 42]) {
    const r = await h.req('POST', '/api/admin/invites/new', { uid: 'adm', body: { requestId } });
    assert.equal(r.status, 200, String(requestId));
    assert.ok(r.body.invite.code);
  }
  assert.equal(h.db().invites.length, 4);
});

test('a paired phone asks with its Bearer token; a cross-site page cannot ask with the cookie', async t => {
  const h = await startServer(t, { subs: [] });
  const bearer = await h.req('POST', '/api/invites/request', {
    body: { note: 'from the phone' }, headers: { Authorization: `Bearer ${token('u1')}`, 'Sec-Fetch-Site': 'cross-site', Origin: 'capacitor://localhost' }
  });
  assert.equal(bearer.status, 200, JSON.stringify(bearer.body));
  const forged = await h.req('POST', '/api/invites/request', { uid: 'u2', body: { note: 'forged' }, headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(forged.status, 403);
  const forgedCancel = await h.req('POST', '/api/invites/request/cancel', { uid: 'u1', body: { id: bearer.body.id }, headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(forgedCancel.status, 403);
  assert.deepEqual(h.db().inviteRequests.map(r => [r.by, r.status]), [['u1', 'open']]);
});

test('the invite check still answers a code at /api/invites/{code}, "request" included', async t => {
  const h = await startServer(t, { subs: [] });
  const r = await h.req('GET', '/api/invites/request');
  assert.deepEqual([r.status, r.body.code], [404, 'not-found']);
  const code = (await h.req('POST', '/api/admin/invites/new', { uid: 'adm', body: {} })).body.invite.code;
  assert.equal((await h.req('GET', `/api/invites/${code}`)).body.status, 'valid');
});
