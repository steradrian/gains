/* Friends api m3: the evening cheer digest (friends/digest.js), driven in-process with its
   dependencies as arguments, so every clock, state and push is a value the test sets:
   exactly one push for three cheers from two people, with the copy of the person's language; none
   when muted, nothing unread, Friends off, not yet 19:00, no subscription or the account is on its
   way out; a second tick the same evening sends nothing; no tz and an invalid tz mean no push at
   all (never UTC); cheers from a disabled or departed sender are not counted and not touched. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFriendsStore } from '../friends/store.js';
import { runDigest } from '../friends/digest.js';
import { cheerPush, PUSH_URL } from '../push-messages.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVENING = Date.parse('2026-10-14T19:05:00.000Z');
const iso = ms => new Date(ms).toISOString();
const person = (extra = {}) => ({ on: true, mutes: {}, groupPrefs: {}, ...extra });
const USERS = [
  { id: 'u_ana', name: 'Ana' }, { id: 'u_bea', name: 'Bea' }, { id: 'u_cy', name: 'Cy' }, { id: 'u_dan', name: 'Dan' }
];
const cheer = (from, to, at, extra = {}) => ({ from, to, group: 'g1', kind: 'week', ref: `${to}:2026-10-12`, week: '2026-10-12', at: iso(at), ...extra });

/** Bea has cheers from Ana (twice) and Cy (once, the newest). */
function setup(t, { users = USERS, patch } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-digest-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = createFriendsStore(path.join(dir, 'friends.json'));
  store.mutate(d => {
    d.people = { u_ana: person(), u_bea: person(), u_cy: person(), u_dan: person() };
    d.groups.g1 = { id: 'g1', name: 'Iron Sunday', members: ['u_ana', 'u_bea', 'u_cy', 'u_dan'].map(uid => ({ uid, joined: iso(EVENING - 99999999) })) };
    d.cheers = [
      cheer('u_ana', 'u_bea', EVENING - 3 * 3600000, { kind: 'moment', ref: 'workout:2026-10-12:u_bea:aaaa' }),
      cheer('u_ana', 'u_bea', EVENING - 2 * 3600000, { kind: 'moment', ref: 'workout:2026-10-13:u_bea:bbbb' }),
      cheer('u_cy', 'u_bea', EVENING - 3600000)
    ];
    patch?.(d);
  });
  const sent = [];
  const env = {
    store, users,
    states: { u_bea: { lang: 'en', reminder: { tz: 'Europe/Lisbon' } } },
    local: { date: '2026-10-14', hhmm: '19:05' },
    asked: [],
    subs: new Set(['u_bea']),
    gone: new Set(),
    run(over = {}) {
      return runDigest({
        store, users: env.users, now: EVENING,
        stateOf: uid => env.states[uid] ?? null,
        nowIn: tz => { env.asked.push(tz); return tz === 'Not/AZone' ? null : env.local; },
        hasSub: uid => env.subs.has(uid),
        deletionScheduled: u => env.gone.has(u.id),
        send: (uid, payload) => sent.push({ uid, payload }),
        ...over
      });
    },
    sent
  };
  return env;
}

test('three cheers from two people are one push, newest sender first, in the right words', t => {
  const e = setup(t);
  const out = e.run();
  assert.equal(out.length, 1);
  assert.deepEqual(e.sent, [{ uid: 'u_bea', payload: { title: 'Gains', body: 'Cy and 1 other cheered you', tag: 'cheer', url: '#/me/groups/cheers' } }]);
  assert.equal(PUSH_URL.cheers, '#/me/groups/cheers');
  assert.equal(e.store.read().people.u_bea.digestSent, '2026-10-14');
});

test('one sender, and three senders, read as the copy says', t => {
  const one = setup(t, { patch: d => { d.cheers = d.cheers.filter(c => c.from === 'u_cy'); } });
  one.run();
  assert.equal(one.sent[0].payload.body, 'Cy cheered you');
  const three = setup(t, { patch: d => d.cheers.push(cheer('u_dan', 'u_bea', EVENING - 1000)) });
  three.run();
  assert.equal(three.sent[0].payload.body, 'Dan and 2 others cheered you');
  assert.deepEqual(cheerPush('pt-BR', 'Dan', 2).body, 'Dan e mais 2 pessoas torceram por você');
  assert.deepEqual(cheerPush('pt-BR', 'Dan', 1).body, 'Dan e mais 1 pessoa torceram por você');
  assert.equal(cheerPush('pt-BR', 'Dan', 0).body, 'Dan torceu por você');
  assert.equal(cheerPush('xx', 'Dan', 0).body, 'Dan cheered you', 'English is the fallback');
});

test('the person’s language picks the copy', t => {
  const e = setup(t);
  e.states.u_bea.lang = 'pt-BR';
  e.run();
  assert.equal(e.sent[0].payload.body, 'Cy e mais 1 pessoa torceram por você');
});

test('a second tick the same evening sends nothing, even with a new cheer; the next evening sends what is new', t => {
  const e = setup(t);
  e.run();
  assert.equal(e.sent.length, 1);
  assert.deepEqual(e.run(), []);
  e.store.mutate(d => d.cheers.push(cheer('u_dan', 'u_bea', EVENING + 60000)));
  assert.deepEqual(e.run({ now: EVENING + 120000 }), [], 'once an evening');
  assert.equal(e.sent.length, 1);

  e.local = { date: '2026-10-15', hhmm: '19:00' };
  e.run({ now: EVENING + 86400000 });
  assert.equal(e.sent.length, 2);
  assert.equal(e.sent[1].payload.body, 'Dan cheered you', 'the ones already in a digest are not sent again');
});

test('only from 19:00 to before 22:00 on the person’s own clock', t => {
  const e = setup(t);
  for (const hhmm of ['00:00', '18:59', '22:00', '23:30']) {
    e.local = { date: '2026-10-14', hhmm };
    assert.deepEqual(e.run(), [], hhmm);
  }
  assert.equal(e.store.read().people.u_bea.digestSent, undefined);
  e.local = { date: '2026-10-14', hhmm: '19:00' };
  assert.equal(e.run().length, 1);
});

test('no tz means no push: the clock is never asked, nothing falls back to UTC', t => {
  for (const reminder of [undefined, {}, { tz: '' }, { tz: '   ' }, { tz: 5 }, { tz: null }]) {
    const e = setup(t);
    e.states.u_bea = { lang: 'en', ...(reminder === undefined ? {} : { reminder }) };
    assert.deepEqual(e.run(), [], JSON.stringify(reminder));
    assert.deepEqual(e.asked, [], 'no clock without a zone');
    assert.deepEqual(e.sent, []);
  }
  const noState = setup(t);
  noState.states = {};
  assert.deepEqual(noState.run(), []);
  assert.deepEqual(noState.asked, []);
});

test('a tz that userNow rejects means no push, and nothing is recorded', t => {
  const e = setup(t);
  e.states.u_bea.reminder.tz = 'Not/AZone';
  assert.deepEqual(e.run(), []);
  assert.deepEqual(e.asked, ['Not/AZone']);
  assert.equal(e.store.read().people.u_bea.digestSent, undefined);
  e.states.u_bea.reminder.tz = 'Europe/Lisbon';
  assert.equal(e.run().length, 1, 'sent as soon as a tz is known');
});

test('the digest never names UTC, and the server hands it userNow', () => {
  assert.ok(!/UTC/.test(readFileSync(path.join(API, 'friends', 'digest.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//, '')), 'no UTC fallback in the code');
  const server = readFileSync(path.join(API, 'server.js'), 'utf8');
  const call = server.slice(server.indexOf('runFriendsDigest({'), server.indexOf('runFriendsDigest({') + 400);
  assert.ok(/nowIn: userNow/.test(call), 'the digest asks userNow');
  assert.ok(!/\|\| 'UTC'/.test(call));
});

test('nothing to send: nothing unread, already seen, muted sender, muted group', t => {
  const none = setup(t, { patch: d => { d.cheers = []; } });
  assert.deepEqual(none.run(), []);
  assert.deepEqual(none.asked, []);

  const seen = setup(t, { patch: d => { d.people.u_bea.seen = iso(EVENING - 30 * 60000); d.cheers.push(cheer('u_dan', 'u_bea', EVENING - 60000)); } });
  seen.run();
  assert.equal(seen.sent[0].payload.body, 'Dan cheered you', 'seen ones are not repeated');
  const allSeen = setup(t, { patch: d => { d.people.u_bea.seen = iso(EVENING - 1000); } });
  assert.deepEqual(allSeen.run(), []);

  const mutedSender = setup(t, { patch: d => { d.people.u_bea.mutes.g1 = ['u_cy']; } });
  mutedSender.run();
  assert.equal(mutedSender.sent[0].payload.body, 'Ana cheered you', 'a muted sender is silent, the others are not');
  const mutedBoth = setup(t, { patch: d => { d.people.u_bea.mutes.g1 = ['u_cy', 'u_ana']; } });
  assert.deepEqual(mutedBoth.run(), []);
  const mutedGroup = setup(t, { patch: d => { d.people.u_bea.groupPrefs.g1 = { muteNotifications: true }; } });
  assert.deepEqual(mutedGroup.run(), []);
  assert.equal(mutedGroup.store.read().cheers.length, 3, 'silent, not deleted');
});

test('Friends off, no subscription, an account on its way out: no push', t => {
  const off = setup(t, { patch: d => { d.people.u_bea.on = false; } });
  assert.deepEqual(off.run(), []);
  const noSub = setup(t);
  noSub.subs.clear();
  assert.deepEqual(noSub.run(), []);
  assert.equal(noSub.store.read().people.u_bea.digestSent, undefined, 'a subscription later still gets it');
  noSub.subs.add('u_bea');
  assert.equal(noSub.run().length, 1);
  const leaving = setup(t);
  leaving.gone.add('u_bea');
  assert.deepEqual(leaving.run(), []);
});

test('a disabled account is hidden in both directions; its records stay', t => {
  // Sender disabled: its cheers are not counted, the others still are.
  const sender = setup(t, { users: USERS.map(u => (u.id === 'u_cy' ? { ...u, disabled: true } : u)) });
  sender.run();
  assert.equal(sender.sent[0].payload.body, 'Ana cheered you');
  // Only a disabled sender: nothing at all.
  const only = setup(t, { users: USERS.map(u => (u.id === 'u_cy' || u.id === 'u_ana' ? { ...u, disabled: true } : u)) });
  assert.deepEqual(only.run(), []);
  assert.equal(only.store.read().cheers.length, 3);
  // Recipient disabled: no push.
  const recipient = setup(t, { users: USERS.map(u => (u.id === 'u_bea' ? { ...u, disabled: true } : u)) });
  assert.deepEqual(recipient.run(), []);
  assert.deepEqual(recipient.asked, []);
  // Enabled again, everything is as it was.
  const back = setup(t);
  back.run();
  assert.equal(back.sent[0].payload.body, 'Cy and 1 other cheered you');
});

test('cheers from someone who left the group, or whom Bea no longer sees, are not counted', t => {
  const left = setup(t, { patch: d => { d.groups.g1.members = d.groups.g1.members.filter(m => m.uid !== 'u_cy'); } });
  left.run();
  assert.equal(left.sent[0].payload.body, 'Ana cheered you');
  const friendsOff = setup(t, { patch: d => { d.people.u_ana.on = false; d.people.u_cy.on = false; } });
  assert.deepEqual(friendsOff.run(), []);
});

test('two people with cheers each get their own push, in their own evening', t => {
  const e = setup(t, { patch: d => d.cheers.push(cheer('u_ana', 'u_cy', EVENING - 5000)) });
  e.states.u_cy = { lang: 'en', reminder: { tz: 'Asia/Tokyo' } };
  e.subs.add('u_cy');
  const out = e.run({ nowIn: tz => (tz === 'Asia/Tokyo' ? { date: '2026-10-15', hhmm: '04:00' } : e.local) });
  assert.deepEqual(out.map(x => x.uid), ['u_bea'], 'it is 04:00 in Tokyo');
  assert.equal(e.store.read().people.u_cy.digestSent, undefined);
});
