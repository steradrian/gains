/* Friends api m2: scaffolding for the Friends tests that need the real server.js in a child, its
 * clock driven by fake-clock.mjs and pinned to a known Wednesday, so every date in a test is a
 * fixed string. State files are written straight to the data directory; `h.state` then moves the
 * clock past the projection memo (friends/cache.js MEMO_MS), as a minute going by would. */
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
export const DAY = 86400000;
const ORIGIN = 'http://localhost:8080';

// Wednesday 14 October 2026, noon UTC: the week is Monday 12 to Sunday 18 October.
export const T_WED = Date.parse('2026-10-14T12:00:00.000Z');
export const TODAY = '2026-10-14';
export const MONDAY = '2026-10-12';
export const ALL = { training: true, consistency: true, targets: true, bests: true };
export const NONE = { training: false, consistency: false, targets: false, bests: false };
export const NOT_FOUND = { error: 'not found', code: 'not-found' };

// Sessions good for years, so a clock moved about keeps them valid.
const cookieFor = uid => {
  const payload = `${uid}:${Date.now() + 3 * 365 * DAY}:0`;
  return 'gymsid=' + payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
};
export const user = (id, name, extra = {}) => ({ id, name, created: '2026-08-14T10:00:00.000Z', email: `${id}@mail.test`, ...extra });
export const USERS = [
  user('u_root', 'Root', { admin: true }),
  user('u_ana', 'Ana'), user('u_bea', 'Bea'), user('u_cy', 'Cy'), user('u_dan', 'Dan'), user('u_eve', 'Eve')
];

/** A finished workout on `d` (a stored date string), `min` minutes long, starting 17:00 UTC. */
export function workout({ id, d, name = 'Push A', routineId = 'r1', min = 50, prs = [], share, entries, ...extra }) {
  const start = Date.parse(d + 'T17:00:00.000Z');
  return {
    id: id || `w-${d}-${name}`, d, name, routineId, routineIds: routineId ? [routineId] : [], start, end: start + min * 60000, prs,
    entries: entries || [{ id: '0085', sets: [{ w: 60, r: 8, done: true }] }],
    ...(share ? { share } : {}),
    ...extra
  };
}

/** A state with routines r1 (Push A) and r2 (Legs), planned Monday, Wednesday and Friday. */
export function state(over = {}) {
  return {
    unit: 'kg', lang: 'en',
    routines: [{ id: 'r1', name: 'Push A', ex: [] }, { id: 'r2', name: 'Legs', ex: [] }],
    week: { 1: 'r1', 3: 'r2', 5: 'r1' },
    dayPlan: {},
    workouts: [],
    ...over
  };
}

export async function startServer(t, { users = USERS, friends, states = {}, now = T_WED, env = {} } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-friends-m2-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users, creds: [], subs: [], invites: [] }));
  if (friends !== undefined) fs.writeFileSync(path.join(dataDir, 'friends.json'), JSON.stringify(friends));
  const writeState = (uid, S) => fs.writeFileSync(path.join(dataDir, `state-${uid}.json`), JSON.stringify(S));
  for (const [uid, S] of Object.entries(states)) writeState(uid, S);
  const child = spawn(process.execPath, ['--import', './test/fake-clock.mjs', 'server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost', TRUST_PROXY: '1', INVITE_ONLY: '', ADMIN_UIDS: '', AUDIT_LOG: '', ...env }
  });
  const h = { log: '', dataDir, now };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  h.api = `http://127.0.0.1:${await boundPort(child, () => h.log)}`;
  h.at = ms => new Promise(resolve => {
    h.now = ms;
    const done = m => { if (m && m.now === ms) { child.off('message', done); resolve(); } };
    child.on('message', done);
    child.send({ now: ms });
  });
  await h.at(now);
  /** Writes a state file, then lets a minute go by so no projection of the old one is served. */
  h.state = async (uid, S) => { writeState(uid, S); await h.at(h.now + 61000); };
  h.req = async (method, p, { as, body } = {}) => {
    const r = await fetch(`${h.api}${p}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', 'X-Forwarded-For': '198.51.100.9', ...(as ? { Cookie: cookieFor(as) } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await r.text();
    return { status: r.status, body: text ? JSON.parse(text) : null, text };
  };
  h.friends = () => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'friends.json'), 'utf8')); } catch { return null; } };
  h.on = async (uid, share = ALL) => {
    const r = await h.req('PUT', '/api/friends/me', { as: uid, body: { on: true, share } });
    assert.equal(r.status, 200, r.text);
  };
  h.share = async (uid, share) => {
    const r = await h.req('PUT', '/api/friends/me', { as: uid, body: { share } });
    assert.equal(r.status, 200, r.text);
  };
  /** A group created by the first of `uids`, the others joining in order, everyone on (`share`). */
  h.crew = async (uids, { goal = { kind: 'planned' }, share = ALL, name = 'Iron Sunday' } = {}) => {
    for (const u of uids) await h.on(u, share);
    const r = await h.req('POST', '/api/friends/groups', { as: uids[0], body: { name, goal } });
    assert.equal(r.status, 200, r.text);
    for (const u of uids.slice(1)) {
      const link = await h.req('POST', `/api/friends/groups/${r.body.id}/invites`, { as: uids[0], body: {} });
      assert.equal(link.status, 200, link.text);
      const j = await h.req('POST', `/api/friends/join/${link.body.code}`, { as: u, body: {} });
      assert.equal(j.status, 200, j.text);
    }
    return r.body.id;
  };
  h.view = async (uid, gid, date = TODAY) => {
    const r = await h.req('GET', `/api/friends/groups/${gid}?date=${date}`, { as: uid });
    assert.equal(r.status, 200, r.text);
    return r.body;
  };
  h.member = (uid, gid, target, date = TODAY) => h.req('GET', `/api/friends/groups/${gid}/members/${target}?date=${date}`, { as: uid });
  return h;
}

/** Calls `onKey(key, path)` for every object key and `onValue(value, path)` for every leaf. */
export function walk(v, onKey, onValue, at = '$') {
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, onKey, onValue, `${at}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { onKey(k, at); walk(x, onKey, onValue, `${at}.${k}`); }
  else onValue(v, at);
}
