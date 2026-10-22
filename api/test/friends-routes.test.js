/* Friends over HTTP (friends/routes.js), against the real server.js in a child with its clock
   driven by test/fake-clock.mjs: turning Friends on and off, groups, membership authorization (a
   non-member hears exactly what an unknown id answers, on every {id} route), creator-only remove,
   leave and succession, mutes and prefs, invite links (single use under two redemptions at once,
   seven days to the millisecond, revoked), in-app invitations, the people list, the join preview
   and its rate limit, and the purge of an account through deleteUserData (admin delete and the
   scheduled self-deletion); disable hides and never purges (Friends api m2). No answer may carry
   `usedBy`, an e-mail, or the id of someone outside the caller's group. */
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
const DAY = 86400000;
const ORIGIN = 'http://localhost:8080';
const T0 = Math.floor(Date.now() / 1000) * 1000;
const TODAY = new Date(T0).toISOString().slice(0, 10);
const ALL = { training: true, consistency: true, targets: true, bests: true };
const NOT_FOUND = { error: 'not found', code: 'not-found' };

// Sessions good for a year, so a clock moved a week ahead keeps them valid.
const cookieFor = uid => {
  const payload = `${uid}:${Date.now() + 365 * DAY}:0`;
  return 'gymsid=' + payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
};
const user = (id, name, extra = {}) => ({ id, name, created: '2026-08-14T10:00:00.000Z', email: `${id}@mail.test`, ...extra });
const USERS = [
  user('u_root', 'Root', { admin: true }),
  user('u_ana', 'Ana'), user('u_bea', 'Bea'), user('u_cy', 'Cy'), user('u_dan', 'Dan'), user('u_eve', 'Eve')
];

async function startServer(t, { users = USERS, friends, env = {} } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-friends-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users, creds: [], subs: [], invites: [] }));
  if (friends !== undefined) fs.writeFileSync(path.join(dataDir, 'friends.json'), typeof friends === 'string' ? friends : JSON.stringify(friends));
  const child = spawn(process.execPath, ['--import', './test/fake-clock.mjs', 'server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost', TRUST_PROXY: '1', INVITE_ONLY: '', ADMIN_UIDS: '', AUDIT_LOG: '', ...env }
  });
  const h = { log: '', dataDir };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  h.api = `http://127.0.0.1:${await boundPort(child, () => h.log)}`;
  h.at = now => new Promise(resolve => {
    const done = m => { if (m && m.now === now) { child.off('message', done); resolve(); } };
    child.on('message', done);
    child.send({ now });
  });
  await h.at(T0);
  h.req = async (method, p, { as, body, ip = '198.51.100.1' } = {}) => {
    const r = await fetch(`${h.api}${p}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', 'X-Forwarded-For': ip, ...(as ? { Cookie: cookieFor(as) } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await r.text();
    return { status: r.status, body: text ? JSON.parse(text) : null, text, headers: r.headers };
  };
  h.friends = () => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'friends.json'), 'utf8')); } catch { return null; } };
  h.db = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  h.on = async (uid, share = ALL) => {
    const r = await h.req('PUT', '/api/friends/me', { as: uid, body: { on: true, share } });
    assert.equal(r.status, 200, r.text);
  };
  h.group = async (uid, name = 'Iron Sunday', goal = { kind: 'planned' }) => {
    const r = await h.req('POST', `/api/friends/groups?date=${TODAY}`, { as: uid, body: { name, goal } });
    assert.equal(r.status, 200, r.text);
    return r.body.id;
  };
  h.link = async (uid, gid) => {
    const r = await h.req('POST', `/api/friends/groups/${gid}/invites`, { as: uid, body: {} });
    assert.equal(r.status, 200, r.text);
    return r.body.code;
  };
  h.join = (uid, code) => h.req('POST', `/api/friends/join/${code}?date=${new Date(h.now).toISOString().slice(0, 10)}`, { as: uid, body: {} });
  // Ana's group with Bea and Cy in it, in that order, everyone on.
  h.trio = async () => {
    for (const u of ['u_ana', 'u_bea', 'u_cy']) await h.on(u);
    const gid = await h.group('u_ana');
    for (const u of ['u_bea', 'u_cy']) assert.equal((await h.join(u, await h.link('u_ana', gid))).status, 200);
    return gid;
  };
  return h;
}

/** Nothing in an answer that must never leave the server. */
function assertClean(r, foreignUids = []) {
  assert.ok(!r.text.includes('usedBy'), `usedBy in ${r.text}`);
  assert.ok(!r.text.includes('@mail.test'), `an e-mail in ${r.text}`);
  assert.ok(!r.text.includes('"email"'), r.text);
  for (const uid of foreignUids) assert.ok(!r.text.includes(uid), `${uid} in ${r.text}`);
}

test('signed in only, and the reads need the client’s date', async t => {
  const h = await startServer(t);
  for (const [m, p] of [['GET', `/api/friends/me?date=${TODAY}`], ['PUT', '/api/friends/me'], ['GET', `/api/friends/groups?date=${TODAY}`], ['POST', '/api/friends/groups'], ['GET', '/api/friends/people'], ['GET', '/api/friends/join/ABCDEFGHJK'], ['POST', '/api/friends/join/ABCDEFGHJK'], ['POST', '/api/friends/groups/x/leave']]) {
    const r = await h.req(m, p, { body: m === 'GET' ? undefined : {} });
    assert.equal(r.status, 401, `${m} ${p}`);
  }
  for (const q of ['', '?date=', '?date=2026-02-30', '?date=21-10-2026', '?date=2026-10-21T00:00']) {
    const r = await h.req('GET', `/api/friends/me${q}`, { as: 'u_ana' });
    assert.deepEqual([r.status, r.body.code], [400, 'bad-date'], q);
  }
  const me = await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_ana' });
  assert.deepEqual(me.body, { on: false, share: { training: false, consistency: false, targets: false, bests: false }, groups: [], invitations: [], newCount: 0, challengeInvites: [] });
  assert.equal(h.friends(), null, 'reading writes nothing');
});

test('turning on asks what to share first; off keeps the switches and the memberships', async t => {
  const h = await startServer(t);
  const first = await h.req('PUT', '/api/friends/me', { as: 'u_ana', body: { on: true } });
  assert.deepEqual([first.status, first.body.code], [409, 'needs-share']);
  assert.equal(h.friends(), null, 'refused, nothing stored');

  for (const [body, code] of [[{ on: 'yes' }, 'bad-on'], [{ share: { weight: true } }, 'bad-share'], [{ share: { training: 1 } }, 'bad-share'], [{ share: [] }, 'bad-share'], [{ on: true, extra: 1 }, 'bad-body']]) {
    const r = await h.req('PUT', '/api/friends/me', { as: 'u_ana', body });
    assert.deepEqual([r.status, r.body.code], [400, code], JSON.stringify(body));
  }

  const onR = await h.req('PUT', '/api/friends/me', { as: 'u_ana', body: { on: true, share: { training: true } } });
  assert.equal(onR.status, 200);
  assert.equal(onR.body.on, true);
  assert.deepEqual(onR.body.share, { training: true, consistency: false, targets: false, bests: false });
  const gid = await h.group('u_ana');

  const off = await h.req('PUT', '/api/friends/me', { as: 'u_ana', body: { on: false } });
  assert.equal(off.body.on, false);
  assert.deepEqual(off.body.share, { training: true, consistency: false, targets: false, bests: false }, 'the switches stay');
  assert.deepEqual(off.body.groups.map(g => g.id), [gid], 'so does the membership');

  const back = await h.req('PUT', '/api/friends/me', { as: 'u_ana', body: { on: true } });
  assert.equal(back.status, 200, 'switches stored once are enough to turn on again');
  const partial = await h.req('PUT', '/api/friends/me', { as: 'u_ana', body: { share: { bests: true } } });
  assert.deepEqual(partial.body.share, { training: true, consistency: false, targets: false, bests: true });
});

test('creating a group: validated name and goal, Friends on, creator first; the list is mine only', async t => {
  const h = await startServer(t);
  const off = await h.req('POST', `/api/friends/groups?date=${TODAY}`, { as: 'u_ana', body: { name: 'Iron Sunday', goal: { kind: 'planned' } } });
  assert.deepEqual([off.status, off.body.code], [409, 'friends-off']);
  await h.on('u_ana');
  for (const [body, code] of [
    [{ name: '   ', goal: { kind: 'planned' } }, 'bad-name'], [{ goal: { kind: 'planned' } }, 'bad-name'], [{ name: 7, goal: { kind: 'planned' } }, 'bad-name'],
    [{ name: 'X', goal: { kind: 'number', n: 0 } }, 'bad-goal'], [{ name: 'X', goal: { kind: 'number', n: 201 } }, 'bad-goal'],
    [{ name: 'X', goal: { kind: 'weekly' } }, 'bad-goal'], [{ name: 'X', goal: { kind: 'planned', n: 3 } }, 'bad-goal'], [{ name: 'X' }, 'bad-goal'],
    [{ name: 'X', goal: { kind: 'planned' }, creator: 'u_bea' }, 'bad-body']
  ]) {
    const r = await h.req('POST', `/api/friends/groups?date=${TODAY}`, { as: 'u_ana', body });
    assert.deepEqual([r.status, r.body.code], [400, code], JSON.stringify(body));
  }
  const r = await h.req('POST', `/api/friends/groups?date=${TODAY}`, { as: 'u_ana', body: { name: '  Iron\n Sunday ' + 'x'.repeat(40), goal: { kind: 'number', n: 15 } } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.name, ('Iron Sunday ' + 'x'.repeat(40)).slice(0, 40));
  assert.deepEqual(r.body.goal, { kind: 'number', n: 15 });
  assert.deepEqual(r.body.goalLine, { kind: 'number', n: 15 });
  assert.deepEqual(r.body.members, [{ uid: 'u_ana', name: 'Ana', initial: 'A' }]);
  assert.equal(r.body.memberCount, 1);
  assert.deepEqual(r.body.week, { done: 0, planned: 0 });
  assert.equal(r.body.streak, 0);
  assert.equal(r.body.creator, 'u_ana');
  assert.equal(r.body.isCreator, true);
  assert.equal(r.body.since, new Date(T0).toISOString());

  // A write needs the client's local today: missing, malformed or implausible is bad-date, never UTC.
  for (const q of ['', '?date=nope', '?date=2099-12-31', '?date=2020-01-01']) {
    const bad = await h.req('POST', `/api/friends/groups${q}`, { as: 'u_ana', body: { name: 'Late', goal: { kind: 'planned' } } });
    assert.deepEqual([bad.status, bad.body.code], [400, 'bad-date'], `create ${q}`);
    const join = await h.req('POST', `/api/friends/join/NNPE234567${q}`, { as: 'u_ana', body: {} });
    assert.deepEqual([join.status, join.body.code], [400, 'bad-date'], `join ${q}`);
  }

  const mine = await h.req('GET', `/api/friends/groups?date=${TODAY}`, { as: 'u_ana' });
  assert.deepEqual(mine.body.map(g => g.id), [r.body.id]);
  assert.deepEqual((await h.req('GET', `/api/friends/groups?date=${TODAY}`, { as: 'u_bea' })).body, []);
  const stored = h.friends().groups[r.body.id];
  assert.deepEqual(stored.members.map(m => m.uid), ['u_ana']);
  assert.ok(!JSON.stringify(h.friends()).includes('Ana'), 'names are never copied into friends.json');
});

test('a non-member gets exactly what an unknown or malformed id gets, on every {id} route, and nothing changes', async t => {
  const h = await startServer(t);
  const gid = await h.trio();
  await h.on('u_dan');
  const routes = id => [
    ['POST', `/api/friends/groups/${id}/leave`, {}],
    ['POST', `/api/friends/groups/${id}/members/u_bea/remove`, {}],
    ['PUT', `/api/friends/groups/${id}/mutes`, { uid: 'u_bea', muted: true }],
    ['PUT', `/api/friends/groups/${id}/prefs`, { muteNotifications: true }],
    ['POST', `/api/friends/groups/${id}/invites`, {}],
    ['POST', `/api/friends/groups/${id}/invites/user`, { uid: 'u_eve' }],
    ['GET', `/api/friends/people?group=${id}`, undefined]
  ];
  const before = JSON.stringify(h.friends());
  for (const id of [gid, 'NoSuchGroup1', '%E0%A4%A', 'x'.repeat(65)]) {
    for (const [m, p, body] of routes(id)) {
      const r = await h.req(m, p, { as: 'u_dan', body });
      assert.equal(r.status, 404, `${m} ${p}`);
      assert.deepEqual(r.body, NOT_FOUND, `${m} ${p}`);
    }
  }
  assert.equal(JSON.stringify(h.friends()), before);
});

test('only the creator removes, never themselves; the removed person loses the group at once', async t => {
  const h = await startServer(t);
  const gid = await h.trio();
  const byMember = await h.req('POST', `/api/friends/groups/${gid}/members/u_cy/remove`, { as: 'u_bea', body: {} });
  assert.deepEqual([byMember.status, byMember.body.code], [403, 'forbidden']);
  const self = await h.req('POST', `/api/friends/groups/${gid}/members/u_ana/remove`, { as: 'u_ana', body: {} });
  assert.deepEqual([self.status, self.body.code], [400, 'self']);
  const nobody = await h.req('POST', `/api/friends/groups/${gid}/members/u_dan/remove`, { as: 'u_ana', body: {} });
  assert.deepEqual([nobody.status, nobody.body], [404, NOT_FOUND]);

  const ok = await h.req('POST', `/api/friends/groups/${gid}/members/u_bea/remove`, { as: 'u_ana', body: {} });
  assert.deepEqual([ok.status, ok.body], [200, { ok: true }]);
  assert.deepEqual((await h.req('GET', `/api/friends/groups?date=${TODAY}`, { as: 'u_bea' })).body, []);
  assert.deepEqual((await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_bea' })).body.groups, []);
  for (const [m, p, body] of [['POST', `/api/friends/groups/${gid}/leave`, {}], ['PUT', `/api/friends/groups/${gid}/prefs`, { muteNotifications: true }], ['POST', `/api/friends/groups/${gid}/invites`, {}]]) {
    const r = await h.req(m, p, { as: 'u_bea', body });
    assert.deepEqual([r.status, r.body], [404, NOT_FOUND], `${m} ${p}`);
  }
  const ana = await h.req('GET', `/api/friends/groups?date=${TODAY}`, { as: 'u_ana' });
  assert.deepEqual(ana.body[0].members.map(m => m.uid), ['u_ana', 'u_cy']);
  assertClean(ana, ['u_bea']);
});

test('leaving: the creator hands over to the longest-standing member, the last one out deletes the group', async t => {
  const h = await startServer(t);
  const gid = await h.trio();
  const spare = await h.link('u_cy', gid);
  assert.deepEqual((await h.req('POST', `/api/friends/groups/${gid}/leave`, { as: 'u_ana', body: {} })).body, { ok: true });
  assert.equal(h.friends().groups[gid].creator, 'u_bea');
  assert.deepEqual(h.friends().groups[gid].members.map(m => m.uid), ['u_bea', 'u_cy']);
  const again = await h.req('POST', `/api/friends/groups/${gid}/leave`, { as: 'u_ana', body: {} });
  assert.deepEqual([again.status, again.body], [404, NOT_FOUND]);
  // Bea is creator now: she may remove.
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/members/u_cy/remove`, { as: 'u_bea', body: {} })).status, 200);
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/leave`, { as: 'u_bea', body: {} })).status, 200);
  const d = h.friends();
  assert.equal(d.groups[gid], undefined);
  assert.ok(!JSON.stringify(d.invites).includes(gid), 'its invites went with it');
  const preview = await h.req('GET', `/api/friends/join/${spare}`, { as: 'u_dan' });
  assert.deepEqual([preview.status, preview.body], [404, NOT_FOUND]);
});

test('mutes are mine only, never on myself or a non-member, and the muted person cannot see them', async t => {
  const h = await startServer(t);
  const gid = await h.trio();
  for (const [body, code] of [[{ uid: 'u_ana', muted: true }, 'self'], [{ uid: 'u_dan', muted: true }, 'bad-uid'], [{ uid: 'a/b', muted: true }, 'bad-uid'], [{ uid: 'u_bea', muted: 'yes' }, 'bad-muted'], [{ uid: 'u_bea' }, 'bad-muted']]) {
    const r = await h.req('PUT', `/api/friends/groups/${gid}/mutes`, { as: 'u_ana', body });
    assert.deepEqual([r.status, r.body.code], [400, code], JSON.stringify(body));
  }
  for (let i = 0; i < 2; i++) assert.equal((await h.req('PUT', `/api/friends/groups/${gid}/mutes`, { as: 'u_ana', body: { uid: 'u_bea', muted: true } })).status, 200);
  assert.deepEqual(h.friends().people.u_ana.mutes, { [gid]: ['u_bea'] }, 'idempotent');
  assert.equal(h.friends().people.u_bea.mutes[gid], undefined);
  const bea = await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_bea' });
  assert.ok(!/mute/i.test(bea.text), bea.text);
  await h.req('PUT', `/api/friends/groups/${gid}/mutes`, { as: 'u_ana', body: { uid: 'u_bea', muted: false } });
  assert.deepEqual(h.friends().people.u_ana.mutes, {});

  const bad = await h.req('PUT', `/api/friends/groups/${gid}/prefs`, { as: 'u_bea', body: { muteNotifications: 1 } });
  assert.deepEqual([bad.status, bad.body.code], [400, 'bad-prefs']);
  assert.equal((await h.req('PUT', `/api/friends/groups/${gid}/prefs`, { as: 'u_bea', body: { muteNotifications: true } })).status, 200);
  assert.deepEqual(h.friends().people.u_bea.groupPrefs, { [gid]: { muteNotifications: true } });
});

test('an invite link: g/<code>, seven days to the millisecond, then expired', async t => {
  const h = await startServer(t);
  await h.on('u_ana'); await h.on('u_bea');
  const gid = await h.group('u_ana');
  const r = await h.req('POST', `/api/friends/groups/${gid}/invites`, { as: 'u_ana', body: {} });
  assert.match(r.body.code, /^[A-HJKMNP-Z2-9]{10}$/);
  assert.equal(r.body.url, `g/${r.body.code}`);
  assert.equal(r.body.expiresAt, new Date(T0 + 7 * DAY).toISOString());

  await h.at(T0 + 7 * DAY - 1);
  const valid = await h.req('GET', `/api/friends/join/${r.body.code.toLowerCase()}`, { as: 'u_bea' });
  assert.deepEqual(valid.body, { status: 'valid', from: { name: 'Ana' }, group: { id: gid, name: 'Iron Sunday', memberCount: 1, initials: ['A'] } });
  await h.at(T0 + 7 * DAY);
  const expired = await h.req('GET', `/api/friends/join/${r.body.code}`, { as: 'u_bea' });
  assert.deepEqual(expired.body, { status: 'expired', from: { name: 'Ana' } }, 'no group for a code that opens nothing');
  const join = await h.join('u_bea', r.body.code);
  assert.deepEqual([join.status, join.body.code], [410, 'invite-expired']);
  assert.deepEqual(h.friends().groups[gid].members.map(m => m.uid), ['u_ana']);
});

test('a code works once, even for two redemptions at the same moment', async t => {
  const h = await startServer(t);
  for (const u of ['u_ana', 'u_bea', 'u_cy', 'u_dan']) await h.on(u);
  const gid = await h.group('u_ana');
  const code = await h.link('u_ana', gid);
  const [a, b] = await Promise.all([h.join('u_bea', code), h.join('u_cy', code)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 410], `${a.text} ${b.text}`);
  const loser = a.status === 410 ? a : b;
  assert.equal(loser.body.code, 'invite-used');
  const members = h.friends().groups[gid].members.map(m => m.uid);
  assert.equal(members.length, 2);
  assert.equal(members[0], 'u_ana');
  const winner = members[1];
  const third = await h.join('u_dan', code);
  assert.deepEqual([third.status, third.body.code], [410, 'invite-used']);
  const preview = await h.req('GET', `/api/friends/join/${code}`, { as: 'u_dan' });
  assert.deepEqual(preview.body, { status: 'used', from: { name: 'Ana' } });
  assertClean(preview, [winner, 'u_ana']);
  const mine = await h.req('GET', `/api/friends/join/${code}`, { as: winner });
  assert.equal(mine.body.status, 'member');
  assertClean(mine);
});

test('join answers: unknown, already a member, revoked, Friends off, group full, and a good one', async t => {
  const twelve = Array.from({ length: 12 }, (_, i) => `u_m${String(i).padStart(2, '0')}`);
  const users = [...USERS, ...twelve.map(id => user(id, `Member ${id.slice(3)}`))];
  const people = Object.fromEntries([...twelve, 'u_eve'].map(id => [id, { on: true, share: ALL, mutes: {}, groupPrefs: {} }]));
  const at = new Date(T0).toISOString();
  const friends = {
    people, invitations: [], challenges: {}, cheers: [],
    groups: { full12: { id: 'full12', name: 'Full', goal: { kind: 'planned' }, created: at, creator: twelve[0], members: twelve.map(uid => ({ uid, joined: at })), highWater: {}, removedMoments: [] } },
    invites: { FVMMCGDE22: { group: 'full12', by: twelve[0], created: at, expiresAt: new Date(T0 + 7 * DAY).toISOString() } }
  };
  const h = await startServer(t, { users, friends });

  // Unknown but well-formed, too short, undecodable, and a character the alphabet leaves out.
  for (const p of ['/api/friends/join/NNPE234567', '/api/friends/join/short', '/api/friends/join/%E0%A4%A', '/api/friends/join/ABCDEFGHJ0']) {
    for (const m of ['GET', 'POST']) {
      const r = await h.req(m, m === 'POST' ? `${p}?date=${TODAY}` : p, { as: 'u_eve', body: m === 'POST' ? {} : undefined });
      assert.deepEqual([r.status, r.body], [404, NOT_FOUND], `${m} ${p}`);
    }
  }

  const full = await h.join('u_eve', 'FVMMCGDE22');
  assert.deepEqual([full.status, full.body.code], [409, 'group-full']);
  const fullMint = await h.req('POST', '/api/friends/groups/full12/invites', { as: twelve[0], body: {} });
  assert.deepEqual([fullMint.status, fullMint.body.code], [409, 'group-full']);
  const preview = await h.req('GET', '/api/friends/join/FVMMCGDE22', { as: 'u_eve' });
  assert.equal(preview.body.group.memberCount, 12);
  assert.deepEqual(preview.body.group.initials, ['M', 'M', 'M', 'M'], 'four initials, no names');
  assertClean(preview, twelve);

  await h.on('u_ana'); await h.on('u_bea');
  const gid = await h.group('u_ana');
  const code = await h.link('u_ana', gid);
  const off = await h.join('u_dan', code);
  assert.deepEqual([off.status, off.body.code], [409, 'friends-off'], 'Friends off cannot join');
  assert.equal((await h.req('GET', `/api/friends/join/${code}`, { as: 'u_dan' })).body.status, 'valid', 'but may look first');

  const joined = await h.join('u_bea', code);
  assert.equal(joined.status, 200, joined.text);
  assert.equal(joined.body.id, gid);
  assert.deepEqual(joined.body.members.map(m => m.uid), ['u_ana', 'u_bea'], 'at the end of join order');
  assert.equal(joined.body.isCreator, false);
  assertClean(joined);
  const second = await h.link('u_ana', gid);
  const member = await h.join('u_bea', second);
  assert.deepEqual([member.status, member.body], [409, { error: 'already in this group', code: 'already-member', group: { id: gid } }]);
  assert.equal((await h.req('GET', `/api/friends/join/${second}`, { as: 'u_bea' })).body.status, 'member');

  // Ana leaves: the links she minted stop working.
  const third = await h.link('u_ana', gid);
  await h.req('POST', `/api/friends/groups/${gid}/leave`, { as: 'u_ana', body: {} });
  await h.on('u_cy');
  const revoked = await h.req('GET', `/api/friends/join/${third}`, { as: 'u_cy' });
  assert.deepEqual(revoked.body, { status: 'revoked', from: { name: 'Ana' } });
  const redeem = await h.join('u_cy', third);
  assert.deepEqual([redeem.status, redeem.body.code], [410, 'invite-expired']);
});

test('the preview is rate limited per address, signed-in callers only', async t => {
  const h = await startServer(t);
  await h.on('u_ana');
  const gid = await h.group('u_ana');
  const code = await h.link('u_ana', gid);
  for (let i = 0; i < 40; i++) assert.equal((await h.req('GET', `/api/friends/join/${code}`, { ip: '198.51.100.70' })).status, 401);
  let limited = null;
  for (let i = 0; i < 31 && !limited; i++) {
    const r = await h.req('GET', `/api/friends/join/${code}`, { as: 'u_bea', ip: '198.51.100.70' });
    if (r.status === 429) limited = r;
  }
  assert.ok(limited, 'the 31st check in a minute is refused, and the signed-out ones did not count');
  assert.equal(limited.body.code, 'rate-limited');
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  const redeem = await h.req('POST', `/api/friends/join/${code}?date=${TODAY}`, { as: 'u_bea', body: {}, ip: '198.51.100.70' });
  assert.equal(redeem.status, 429, 'redeeming spends the same budget');
  assert.equal((await h.req('GET', `/api/friends/join/${code}`, { as: 'u_bea', ip: '198.51.100.71' })).status, 200, 'another address is not limited');
  await h.at(T0 + 61000);
  assert.equal((await h.req('GET', `/api/friends/join/${code}`, { as: 'u_bea', ip: '198.51.100.70' })).status, 200, 'a minute later');
});

test('in-app invitations: the same answer for anyone, listed for the invitee, bound to them, cleared on join', async t => {
  const h = await startServer(t);
  const gid = await h.trio();
  await h.on('u_eve');
  for (const uid of ['u_eve', 'u_nobody', 'u_dan', 'u_bea', 'u_ana', 'u_eve']) {
    const r = await h.req('POST', `/api/friends/groups/${gid}/invites/user`, { as: 'u_bea', body: { uid } });
    assert.deepEqual([r.status, r.body], [200, { ok: true }], uid);
  }
  const bad = await h.req('POST', `/api/friends/groups/${gid}/invites/user`, { as: 'u_bea', body: { uid: 7 } });
  assert.deepEqual([bad.status, bad.body.code], [400, 'bad-uid']);
  const stored = h.friends().invitations;
  assert.deepEqual(stored.map(x => [x.to, x.from]), [['u_eve', 'u_bea']], 'only the one person who can be invited, once');

  const eve = await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_eve' });
  assert.equal(eve.body.invitations.length, 1);
  const inv = eve.body.invitations[0];
  assert.deepEqual({ ...inv, code: 'x' }, { code: 'x', group: { id: gid, name: 'Iron Sunday' }, from: { name: 'Bea' } });
  assertClean(eve, ['u_bea', 'u_ana', 'u_cy']);
  assert.deepEqual((await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_dan' })).body.invitations, []);

  await h.on('u_dan');
  for (const m of ['GET', 'POST']) {
    const r = await h.req(m, `/api/friends/join/${inv.code}${m === 'POST' ? `?date=${TODAY}` : ''}`, { as: 'u_dan', body: m === 'POST' ? {} : undefined });
    assert.deepEqual([r.status, r.body], [404, NOT_FOUND], `${m}: someone else's in-app code does not exist`);
  }
  assert.equal((await h.join('u_eve', inv.code)).status, 200);
  assert.deepEqual((await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_eve' })).body.invitations, []);
  assert.deepEqual(h.friends().invitations, []);
});

test('people: only Friends-on accounts outside the group, name and join month, at most 20', async t => {
  const pats = Array.from({ length: 25 }, (_, i) => user(`u_p${String(i).padStart(2, '0')}`, `Pat ${String(i).padStart(2, '0')}`));
  const users = [...USERS, ...pats, user('u_zed', 'Zed'), user('u_gone', 'Gone', { disabled: true }), user('u_late', 'Late', { deletion: { requestedAt: T0, at: T0 + 7 * DAY } })];
  const on = { on: true, share: ALL, mutes: {}, groupPrefs: {} };
  const people = { ...Object.fromEntries(pats.map(u => [u.id, on])), u_gone: on, u_late: on, u_zed: { ...on, on: false } };
  const h = await startServer(t, { users, friends: { people, groups: {}, invites: {}, invitations: [], challenges: {}, cheers: [] } });
  const offCaller = await h.req('GET', '/api/friends/people', { as: 'u_ana' });
  assert.deepEqual([offCaller.status, offCaller.body.code], [409, 'friends-off']);
  await h.on('u_ana');
  const all = await h.req('GET', '/api/friends/people', { as: 'u_ana' });
  assert.equal(all.body.length, 20);
  assert.deepEqual(all.body[0], { uid: 'u_p00', name: 'Pat 00', since: '2026-08' });
  assert.ok(all.body.every(p => p.uid.startsWith('u_p')), 'not me, not Friends-off, not disabled, not leaving');
  assertClean(all);
  const some = await h.req('GET', '/api/friends/people?q=%20pAT%202', { as: 'u_ana' });
  assert.deepEqual(some.body.map(p => p.name), ['Pat 20', 'Pat 21', 'Pat 22', 'Pat 23', 'Pat 24'], 'trimmed, any case, a part of the name');
  assert.deepEqual((await h.req('GET', '/api/friends/people?q=zed', { as: 'u_ana' })).body, []);

  const gid = await h.group('u_ana');
  await h.join('u_p00', await h.link('u_ana', gid));
  const outside = await h.req('GET', `/api/friends/people?group=${gid}&q=pat%200`, { as: 'u_ana' });
  assert.ok(!outside.body.some(p => p.uid === 'u_p00'), 'members are not invitable');
  assert.equal(outside.body.length, 9);
});

test('a member with Friends off is hidden from the others, and still sees the group themselves', async t => {
  const h = await startServer(t);
  const gid = await h.trio();
  await h.req('PUT', '/api/friends/me', { as: 'u_bea', body: { on: false } });
  const ana = await h.req('GET', `/api/friends/groups?date=${TODAY}`, { as: 'u_ana' });
  assert.deepEqual(ana.body[0].members.map(m => m.uid), ['u_ana', 'u_cy']);
  assert.equal(ana.body[0].memberCount, 2);
  assertClean(ana, ['u_bea']);
  const bea = await h.req('GET', `/api/friends/groups?date=${TODAY}`, { as: 'u_bea' });
  assert.deepEqual(bea.body[0].members.map(m => m.uid), ['u_ana', 'u_bea', 'u_cy']);
  const preview = await h.req('GET', `/api/friends/join/${await h.link('u_ana', gid)}`, { as: 'u_eve' });
  assert.equal(preview.body.group.memberCount, 2);
  const mint = await h.req('POST', `/api/friends/groups/${gid}/invites`, { as: 'u_bea', body: {} });
  assert.deepEqual([mint.status, mint.body.code], [409, 'friends-off']);
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/leave`, { as: 'u_bea', body: {} })).status, 200, 'leaving always works');
});

test('an account awaiting deletion can leave but cannot share more', async t => {
  const users = USERS.map(u => (u.id === 'u_bea' ? { ...u, deletion: { requestedAt: T0, at: T0 + 7 * DAY } } : u));
  const h = await startServer(t, { users });
  await h.on('u_ana');
  const gid = await h.group('u_ana');
  const code = await h.link('u_ana', gid);
  const on = await h.req('PUT', '/api/friends/me', { as: 'u_bea', body: { on: true, share: ALL } });
  assert.deepEqual([on.status, on.body.code], [423, 'deletion-scheduled']);
  const join = await h.join('u_bea', code);
  assert.equal(join.status, 423);
  assert.equal((await h.req('PUT', '/api/friends/me', { as: 'u_bea', body: { on: false, share: { training: false } } })).status, 200, 'switching off is never refused');
});

/* ---------- the purge ---------- */

// Victim created g1 (with Ana after them) and holds a link into it, invited Bea in-app, is muted by
// Ana, and is alone in g2.
function purgeFixture() {
  const at = new Date(T0).toISOString();
  const later = new Date(T0 + 1000).toISOString();
  const exp = new Date(T0 + 7 * DAY).toISOString();
  const on = { on: true, share: ALL, mutes: {}, groupPrefs: {} };
  return {
    people: { u_vic: { ...on, mutes: { g1: ['u_ana'] } }, u_ana: { ...on, mutes: { g1: ['u_vic'] } }, u_bea: on },
    groups: {
      g1: { id: 'g1', name: 'Iron Sunday', goal: { kind: 'planned' }, created: at, creator: 'u_vic', members: [{ uid: 'u_vic', joined: at }, { uid: 'u_ana', joined: later }], highWater: { '2026-10-19': { u_vic: 3, u_ana: 1 } }, removedMoments: [] },
      g2: { id: 'g2', name: 'Solo', goal: { kind: 'planned' }, created: at, creator: 'u_vic', members: [{ uid: 'u_vic', joined: at }], highWater: {}, removedMoments: [] }
    },
    invites: {
      VKCMNK2345: { group: 'g1', by: 'u_vic', created: at, expiresAt: exp },
      VKBEA23456: { group: 'g1', by: 'u_vic', to: 'u_bea', created: at, expiresAt: exp }
    },
    invitations: [{ code: 'VKBEA23456', group: 'g1', from: 'u_vic', to: 'u_bea' }],
    challenges: {}, cheers: []
  };
}
function assertPurged(h) {
  const d = h.friends();
  assert.ok(!JSON.stringify(d).includes('u_vic'), JSON.stringify(d));
  assert.equal(d.groups.g1.creator, 'u_ana', 'the longest-standing member took over');
  assert.deepEqual(d.groups.g1.members.map(m => m.uid), ['u_ana']);
  assert.equal(d.groups.g2, undefined, 'the group left empty is gone');
  assert.equal(d.invites.VKCMNK2345.revoked, true);
  assert.deepEqual(d.invitations, []);
}

test('the admin’s delete purges the account from Friends (through deleteUserData)', async t => {
  const users = [...USERS, user('u_vic', 'Vic')];
  const h = await startServer(t, { users, friends: purgeFixture() });
  const r = await h.req('POST', '/api/admin/user/delete', { as: 'u_root', body: { id: 'u_vic' } });
  assert.equal(r.status, 200, r.text);
  assertPurged(h);
  const ana = await h.req('GET', `/api/friends/groups?date=${TODAY}`, { as: 'u_ana' });
  assert.deepEqual(ana.body.map(g => [g.id, g.memberCount]), [['g1', 1]]);
  const link = await h.req('GET', '/api/friends/join/VKCMNK2345', { as: 'u_eve' });
  assert.deepEqual(link.body, { status: 'revoked', from: { name: null } });
});

test('the scheduled self-deletion purges the account from Friends (the same deleteUserData)', async t => {
  const users = [...USERS, user('u_vic', 'Vic', { deletion: { requestedAt: T0 - 8 * DAY, at: T0 - 1000 } })];
  const h = await startServer(t, { users, friends: purgeFixture(), env: { ACCOUNT_SWEEP_MS: '100' } });
  // The sweep runs at boot, before the server listens.
  assert.ok(!h.db().users.some(u => u.id === 'u_vic'), 'deleted');
  assertPurged(h);
});

// Friends api m2: disabling is reversible, so it hides the account and purges nothing
// (friends-group-view.test.js covers the round trip in full).
test('disabling an account keeps its Friends data and only hides it; enabling shows it again', async t => {
  const users = [...USERS, user('u_vic', 'Vic')];
  const h = await startServer(t, { users, friends: purgeFixture() });
  const before = JSON.stringify(h.friends());
  const r = await h.req('POST', '/api/admin/user/disable', { as: 'u_root', body: { id: 'u_vic', disabled: true } });
  assert.equal(r.status, 200, r.text);
  assert.equal(JSON.stringify(h.friends()), before, 'nothing purged');
  const ana = await h.req('GET', `/api/friends/groups?date=${TODAY}`, { as: 'u_ana' });
  assert.deepEqual(ana.body.map(g => [g.id, g.memberCount, g.members.map(m => m.uid)]), [['g1', 1, ['u_ana']]]);
  assertClean(ana, ['u_vic']);
  await h.req('POST', '/api/admin/user/disable', { as: 'u_root', body: { id: 'u_vic', disabled: false } });
  const back = await h.req('GET', `/api/friends/groups?date=${TODAY}`, { as: 'u_ana' });
  assert.deepEqual(back.body.map(g => [g.id, g.memberCount]), [['g1', 2]]);
});

test('a member whose account is gone without a purge is skipped on every read', async t => {
  const fixture = purgeFixture();
  fixture.groups.g1.members.push({ uid: 'u_bea', joined: new Date(T0 + 2000).toISOString() });
  const h = await startServer(t, { friends: fixture });   // u_vic is in no db.json
  const ana = await h.req('GET', `/api/friends/groups?date=${TODAY}`, { as: 'u_ana' });
  assert.deepEqual(ana.body[0].members.map(m => m.uid), ['u_ana', 'u_bea']);
  assertClean(ana, ['u_vic']);
  // The creator is gone, so the longest-standing member who is not may remove.
  assert.equal((await h.req('POST', '/api/friends/groups/g1/members/u_bea/remove', { as: 'u_ana', body: {} })).status, 200);
});

test('a damaged friends.json does not stop the boot, and is kept aside', async t => {
  const h = await startServer(t, { friends: '{"groups": {' });
  assert.equal((await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_ana' })).status, 200);
  assert.ok(fs.readdirSync(h.dataDir).some(n => n.startsWith('friends.json.unreadable-')));
});
