/* Friends api m3, challenges over HTTP against the real server.js (clock pinned by fake-clock.mjs).
   Each template's counting on fixtures (the weekend rule: one per day; bests: a number, never the
   exercise), a leave that lowers only that person's work, join idempotent, done (kept once seen)
   and missed at the span's end, the weekly streak, the cap of three, authorisation and body
   validation, disabled accounts hidden from joined, invited and the totals without a record
   touched, the invitations feed, and the purge of participation. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, state, workout, NONE, TODAY, MONDAY, NOT_FOUND } from './friends-server.mjs';

const base = gid => `/api/friends/groups/${gid}/challenges`;
const create = (h, gid, as, body, date = TODAY) => h.req('POST', `${base(gid)}?date=${date}`, { as, body });
const act = (h, gid, cid, verb, as, date = TODAY) => h.req('POST', `${base(gid)}/${cid}/${verb}?date=${date}`, { as, body: {} });
const get = (h, gid, cid, as, date = TODAY) => h.req('GET', `${base(gid)}/${cid}?date=${date}`, { as });
const row = (c, uid) => c.joined.find(j => j.uid === uid);
const w = (d, id = `w-${d}`, extra = {}) => workout({ id, d, name: `Day ${d}`, ...extra });
const days = (...ds) => ds.map(d => w(d));

async function start(t, states, opts) {
  const h = await startServer(t, { states });
  const gid = await h.crew(['u_ana', 'u_bea', 'u_cy'], opts);
  return { h, gid };
}

test('workouts: finished workouts count, capped per person; the creator is in and nobody else is added', async t => {
  const { h, gid } = await start(t, {
    u_ana: state({ workouts: days(MONDAY) }),
    u_bea: state({ workouts: days(MONDAY, '2026-10-13') }),
    u_cy: state()
  });
  const made = await create(h, gid, 'u_ana', { template: 'workouts', span: 'week' });
  assert.equal(made.status, 200, made.text);
  const c = made.body;
  assert.deepEqual([c.template, c.span, c.start, c.end, c.state, c.perPerson], ['workouts', 'week', MONDAY, '2026-10-18', 'active', 3]);
  assert.equal(c.title, 'Everyone trains 3x this week');
  assert.deepEqual(c.startedBy, { uid: 'u_ana', name: 'Ana' });
  assert.deepEqual(c.joined, [{ uid: 'u_ana', name: 'Ana', count: 1, planned: 3 }]);
  assert.deepEqual([c.total, c.goal, c.you], [1, 3, { in: true }]);
  assert.deepEqual(c.invited, ['u_bea', 'u_cy'], 'invited, not added');

  const joined = (await act(h, gid, c.id, 'join', 'u_bea')).body;
  assert.deepEqual([joined.total, joined.goal, joined.joined.map(j => j.uid)], [3, 6, ['u_ana', 'u_bea']]);
  assert.deepEqual(joined.invited, ['u_cy']);
  const again = (await act(h, gid, c.id, 'join', 'u_bea')).body;
  assert.deepEqual([again.joined.length, again.total], [2, 3], 'joining twice changes nothing');
  await act(h, gid, c.id, 'join', 'u_cy');
  assert.deepEqual((await get(h, gid, c.id, 'u_cy')).body.you, { in: true });

  // Leaving takes only Bea's counted work off the bar; Ana's stays.
  const left = (await act(h, gid, c.id, 'leave', 'u_bea')).body;
  assert.deepEqual([left.total, left.goal, row(left, 'u_ana').count, left.joined.map(j => j.uid), left.you], [1, 6, 1, ['u_ana', 'u_cy'], { in: false }]);
  assert.deepEqual(left.invited, ['u_bea']);
  assert.equal((await act(h, gid, c.id, 'leave', 'u_bea')).status, 200, 'leaving twice is fine');
  const back = (await act(h, gid, c.id, 'join', 'u_bea')).body;
  assert.equal(row(back, 'u_bea').count, 2, 'joining again is the Undo: the same work is back');
});

test('a person is capped at the template’s number', async t => {
  const { h, gid } = await start(t, { u_ana: state({ workouts: days(MONDAY, '2026-10-13', TODAY, '2026-10-15', '2026-10-16') }), u_bea: state(), u_cy: state() });
  const c = (await create(h, gid, 'u_ana', { template: 'workouts', span: 'week' })).body;
  assert.deepEqual([row(c, 'u_ana').count, c.total, c.goal, c.state], [3, 3, 3, 'done']);
});

test('protein: days the protein target was reached, inside the span only', async t => {
  const reached = (...ds) => Object.fromEntries(ds.map(d => [d, { all: false, protein: true }]));
  const { h, gid } = await start(t, {
    u_ana: state({ targetsReached: { ...reached(MONDAY, '2026-10-13', TODAY, '2026-10-11'), '2026-10-15': { all: true, protein: false } } }),
    u_bea: state({ targetsReached: reached(MONDAY) }),
    u_cy: state()
  });
  const c = (await create(h, gid, 'u_ana', { template: 'protein', span: 'week' })).body;
  assert.equal(c.title, 'Protein target 5 of 7 days');
  assert.equal(row(c, 'u_ana').count, 3, 'the day before the span and a day with the protein target missed do not count');
  const j = (await act(h, gid, c.id, 'join', 'u_bea')).body;
  assert.deepEqual([j.perPerson, j.goal, j.total], [5, 10, 4]);
  const twoWeeks = (await create(h, gid, 'u_ana', { template: 'protein', span: 'twoWeeks' })).body;
  assert.deepEqual([twoWeeks.perPerson, twoWeeks.end], [10, '2026-10-25']);
});

test('protein: someone in with Food targets off is not counted, whatever their synced state holds', async t => {
  const reached = (...ds) => Object.fromEntries(ds.map(d => [d, { all: true, protein: true }]));
  const { h, gid } = await start(t, {
    u_ana: state({ targetsReached: reached(MONDAY) }),
    u_bea: state({ targetsReached: reached(MONDAY, '2026-10-13', TODAY) }),
    u_cy: state()
  });
  const c = (await create(h, gid, 'u_ana', { template: 'protein', span: 'week' })).body;
  await h.share('u_bea', { training: true, consistency: true, targets: false, bests: true });
  const j = (await act(h, gid, c.id, 'join', 'u_bea')).body;
  assert.deepEqual(row(j, 'u_bea'), { uid: 'u_bea', name: 'Bea', count: 0, planned: 0 }, 'in, not counted');
  assert.deepEqual([j.total, j.goal, j.state, j.you], [1, 5, 'active', { in: true }], 'the goal does not wait on Bea');
  await h.share('u_bea', { training: true, consistency: true, targets: true, bests: true });
  const back = (await get(h, gid, c.id, 'u_ana')).body;
  assert.deepEqual([row(back, 'u_bea').count, row(back, 'u_bea').planned, back.total, back.goal], [3, 5, 4, 10], 'switching targets on counts the days again');
  // Other templates ignore the targets switch.
  await h.share('u_bea', { training: true, consistency: true, targets: false, bests: true });
  const w = (await create(h, gid, 'u_bea', { template: 'workouts', span: 'week' })).body;
  assert.equal(row(w, 'u_bea').planned, 3);
});

test('weekend: a workout on a Saturday or Sunday, one per person per day', async t => {
  const { h, gid } = await start(t, {
    u_ana: state({ workouts: [w('2026-10-17', 'sat1'), w('2026-10-17', 'sat2'), w(MONDAY)] }),
    u_bea: state({ workouts: days('2026-10-16', '2026-10-15') }),
    u_cy: state()
  });
  const c = (await create(h, gid, 'u_ana', { template: 'weekend', span: 'week' })).body;
  assert.deepEqual([c.title, c.perPerson, row(c, 'u_ana').count], ['Weekend moving', 2, 1]);
  assert.equal(row((await act(h, gid, c.id, 'join', 'u_bea')).body, 'u_bea').count, 0, 'weekdays do not count');
  await h.state('u_ana', state({ workouts: [w('2026-10-17', 'sat1'), w('2026-10-17', 'sat2'), w('2026-10-18', 'sun1'), w('2026-10-18', 'sun2')] }));
  assert.equal(row((await get(h, gid, c.id, 'u_ana')).body, 'u_ana').count, 2, 'Saturday and Sunday, once each');
});

test('bests: a number, once per person, shared or not; the exercise never leaves', async t => {
  const { h, gid } = await start(t, {
    u_ana: state({ workouts: [w(MONDAY, 'a1', { prs: ['0085', '0032'], entries: [{ id: '0085', sets: [{ w: 123, r: 4, done: true }] }] }), w('2026-10-13', 'a2', { prs: ['0085'] })] }),
    u_bea: state({ workouts: [w(MONDAY, 'b1', { prs: ['0001'], share: { off: true } })] }),
    u_cy: state()
  }, { share: NONE });
  const c = (await create(h, gid, 'u_ana', { template: 'bests', span: 'month' })).body;
  assert.deepEqual([c.perPerson, c.end, row(c, 'u_ana').count], [1, '2026-11-08', 1], 'one best is one, however many');
  const j = (await act(h, gid, c.id, 'join', 'u_bea')).body;
  assert.deepEqual([row(j, 'u_bea').count, j.goal, j.total, j.state], [1, 2, 2, 'done'], 'unshared and "don’t share this one" still count');
  for (const hidden of ['0085', '0032', '0001']) assert.ok(!JSON.stringify(j).includes(hidden), `${hidden} must not leave: ${JSON.stringify(j)}`);
});

test('done is kept once seen; missed at the end of the span; the weekly streak', async t => {
  const { h, gid } = await start(t, {
    u_ana: state({ workouts: days(MONDAY, '2026-10-13', TODAY) }),
    u_bea: state(), u_cy: state()
  });
  const first = (await create(h, gid, 'u_ana', { template: 'workouts', span: 'week' })).body;
  assert.equal(first.state, 'done');
  assert.equal(first.streak, undefined, 'one week is not a streak');
  const later = await create(h, gid, 'u_bea', { template: 'workouts', span: 'week' });
  assert.equal(later.body.state, 'active');
  assert.ok(h.friends().challenges[first.id].hitAt, 'recorded when seen');

  await h.state('u_ana', state({ workouts: days(MONDAY) }));
  const after = (await get(h, gid, first.id, 'u_cy')).body;
  assert.deepEqual([after.state, after.total], ['done', 1], 'deleting workouts does not undo it');

  // The next Monday: Bea's challenge ended unmet.
  await h.at(Date.parse('2026-10-19T12:00:00.000Z'));
  const missed = (await get(h, gid, later.body.id, 'u_bea', '2026-10-19')).body;
  assert.deepEqual([missed.state, missed.total, missed.goal], ['missed', 0, 3]);
  assert.equal((await get(h, gid, first.id, 'u_bea', '2026-10-19')).body.state, 'done');

  // A second week hit in a row.
  await h.state('u_ana', state({ workouts: [...days(MONDAY), ...days('2026-10-19', '2026-10-20', '2026-10-21')] }));
  const second = (await create(h, gid, 'u_ana', { template: 'workouts', span: 'week' }, '2026-10-19')).body;
  assert.deepEqual([second.start, second.state, second.streak], ['2026-10-19', 'done', 2]);
});

test('at most three running challenges per group', async t => {
  const { h, gid } = await start(t, { u_ana: state(), u_bea: state(), u_cy: state() });
  for (const template of ['workouts', 'protein', 'weekend']) assert.equal((await create(h, gid, 'u_ana', { template, span: 'week' })).status, 200);
  const fourth = await create(h, gid, 'u_bea', { template: 'bests', span: 'week' });
  assert.deepEqual([fourth.status, fourth.body.code], [409, 'challenge-limit']);
  assert.equal(Object.keys(h.friends().challenges).length, 3);
  // Another group has its own three.
  const other = await h.req('POST', '/api/friends/groups', { as: 'u_ana', body: { name: 'Other', goal: { kind: 'planned' } } });
  assert.equal((await create(h, other.body.id, 'u_ana', { template: 'bests', span: 'week' })).status, 200);
});

test('a far-future date counts as the server’s today: no challenge years out, no full cap, no other group swept', async t => {
  const { h, gid } = await start(t, { u_ana: state(), u_bea: state(), u_cy: state(), u_dan: state(), u_eve: state() });
  const g2 = await h.crew(['u_dan', 'u_eve'], { name: 'Elsewhere' });
  const theirs = (await create(h, g2, 'u_dan', { template: 'workouts', span: 'week' })).body;
  const ours = (await create(h, gid, 'u_ana', { template: 'workouts', span: 'week' })).body;

  const future = await create(h, gid, 'u_bea', { template: 'protein', span: 'week' }, '2099-12-31');
  assert.equal(future.status, 200, future.text);
  assert.deepEqual([future.body.start, future.body.end, future.body.state], [MONDAY, '2026-10-18', 'active'], 'started this week, not in 2099');
  assert.ok(h.friends().challenges[theirs.id], 'another group’s challenge survives');
  assert.ok(h.friends().challenges[ours.id], 'this group’s running challenge survives');
  const joined = await act(h, g2, theirs.id, 'join', 'u_eve', '2099-12-31');
  assert.deepEqual([joined.status, joined.body.state], [200, 'active'], 'a far-future join does not see it ended');

  // The cap fills with this week's challenges only, and frees up when they end.
  assert.equal((await create(h, gid, 'u_cy', { template: 'weekend', span: 'week' }, '2099-12-31')).status, 200);
  assert.equal((await create(h, gid, 'u_ana', { template: 'bests', span: 'week' }, '2099-12-31')).body.code, 'challenge-limit');
  await h.at(Date.parse('2026-10-19T12:00:00.000Z'));
  const next = await create(h, gid, 'u_ana', { template: 'bests', span: 'week' }, '2026-10-19');
  assert.deepEqual([next.status, next.body.start], [200, '2026-10-19']);

  // Retention by the server's clock, in the group written to only.
  await h.at(Date.parse('2026-12-28T12:00:00.000Z'));
  assert.equal((await create(h, gid, 'u_ana', { template: 'bests', span: 'week' }, '2026-12-28')).status, 200);
  const left = h.friends().challenges;
  assert.ok(!left[ours.id] && !left[future.body.id], 'this group’s challenges over 60 days old are dropped');
  assert.ok(left[theirs.id], 'the other group’s are left to its own writes');
});

test('only members: 404 for a stranger, an unknown challenge or another group’s challenge; bodies are validated', async t => {
  const { h, gid } = await start(t, { u_ana: state(), u_bea: state(), u_cy: state() });
  await h.on('u_dan');
  const c = (await create(h, gid, 'u_ana', { template: 'workouts', span: 'week' })).body;
  assert.deepEqual((await create(h, gid, 'u_dan', { template: 'workouts', span: 'week' })).body, NOT_FOUND);
  assert.equal((await get(h, gid, c.id, 'u_dan')).status, 404);
  assert.equal((await act(h, gid, c.id, 'join', 'u_dan')).status, 404);
  assert.equal((await act(h, gid, c.id, 'leave', 'u_dan')).status, 404);
  assert.equal((await get(h, gid, 'nope', 'u_ana')).status, 404);
  assert.equal((await act(h, gid, 'nope', 'join', 'u_ana')).status, 404);

  const code = async body => (await create(h, gid, 'u_bea', body)).body.code;
  assert.equal(await code({ template: 'nope', span: 'week' }), 'bad-template');
  assert.equal(await code({ template: 'workouts', span: 'year' }), 'bad-span');
  assert.equal(await code({ span: 'week' }), 'bad-template');
  assert.equal(await code({ template: 'workouts', span: 'week', n: 5 }), 'bad-body');
  assert.equal((await h.req('POST', `${base(gid)}/${c.id}/join`, { as: 'u_bea', body: { extra: 1 } })).body.code, 'bad-body');
  assert.equal((await h.req('GET', `${base(gid)}/${c.id}`, { as: 'u_bea' })).body.code, 'bad-date');
  assert.equal((await create(h, gid, 'u_bea', { template: 'workouts', span: 'week' }, 'nope')).body.code, 'bad-date');
});

test('the group page lists challenges with their state; GET /me lists the ones I have not joined', async t => {
  const { h, gid } = await start(t, { u_ana: state({ workouts: days(MONDAY) }), u_bea: state(), u_cy: state() });
  const c = (await create(h, gid, 'u_ana', { template: 'workouts', span: 'week' })).body;
  await act(h, gid, c.id, 'join', 'u_bea');
  const v = await h.view('u_cy', gid);
  assert.equal(v.challenges.length, 1);
  assert.deepEqual(v.challenges[0], {
    id: c.id, template: 'workouts', title: c.title, start: MONDAY, end: '2026-10-18', total: 1, goal: 6, perPerson: 3, state: 'active',
    you: { in: false }, joined: [{ uid: 'u_ana' }, { uid: 'u_bea' }], invited: ['u_cy']
  });
  const invites = (await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_cy' })).body.challengeInvites;
  assert.deepEqual(invites.map(i => [i.cid, i.group, i.from]), [[c.id, { id: gid, name: 'Iron Sunday' }, { name: 'Ana' }]]);
  assert.equal(typeof invites[0].at, 'string');
  assert.deepEqual((await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_bea' })).body.challengeInvites, [], 'already in');
  await act(h, gid, c.id, 'join', 'u_cy');
  assert.deepEqual((await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_cy' })).body.challengeInvites, []);
});

test('a challenge can be cheered; the cheer reaches the others who are in it', async t => {
  const { h, gid } = await start(t, { u_ana: state(), u_bea: state(), u_cy: state() });
  const c = (await create(h, gid, 'u_ana', { template: 'bests', span: 'week' })).body;
  await act(h, gid, c.id, 'join', 'u_bea');
  const r = await h.req('POST', `/api/friends/cheers?date=${TODAY}`, { as: 'u_ana', body: { group: gid, kind: 'challenge', ref: c.id } });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(h.friends().cheers.map(x => x.to), ['u_bea'], 'cy is not in it');
  const list = (await h.req('GET', `/api/friends/cheers?date=${TODAY}`, { as: 'u_bea' })).body;
  assert.deepEqual(list[0].label, { kind: 'challenge', title: 'Each of us beats one best', detail: '' });
});

test('a disabled account is hidden from joined, invited, the totals and the invitations; nothing is purged', async t => {
  const { h, gid } = await start(t, { u_ana: state({ workouts: days(MONDAY) }), u_bea: state({ workouts: days(MONDAY, '2026-10-13') }), u_cy: state() });
  const c = (await create(h, gid, 'u_ana', { template: 'workouts', span: 'week' })).body;
  await act(h, gid, c.id, 'join', 'u_bea');
  const stored = JSON.stringify(h.friends().challenges);
  const disable = (id, disabled) => h.req('POST', '/api/admin/user/disable', { as: 'u_root', body: { id, disabled } });

  await disable('u_bea', true);
  const hidden = (await get(h, gid, c.id, 'u_ana')).body;
  assert.deepEqual([hidden.joined.map(j => j.uid), hidden.total, hidden.goal, hidden.invited], [['u_ana'], 1, 3, ['u_cy']]);
  assert.ok(!JSON.stringify((await h.view('u_cy', gid)).challenges).includes('u_bea'));

  await disable('u_bea', false);
  await disable('u_ana', true);
  const noCreator = (await get(h, gid, c.id, 'u_cy')).body;
  assert.deepEqual([noCreator.joined.map(j => j.uid), noCreator.startedBy, noCreator.invited], [['u_bea'], null, ['u_cy']]);
  assert.deepEqual((await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_cy' })).body.challengeInvites.map(i => i.from.name), ['Bea'], 'sent by someone who shows');
  await disable('u_bea', true);
  assert.deepEqual((await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_cy' })).body.challengeInvites, [], 'nobody visible to send it');

  assert.equal(JSON.stringify(h.friends().challenges), stored, 'records untouched');
  await disable('u_bea', false);
  await disable('u_ana', false);
  assert.deepEqual((await get(h, gid, c.id, 'u_cy')).body.joined.map(j => j.uid), ['u_ana', 'u_bea']);
});

test('leaving a group, a removal and a deleted account take the person out of its challenges', async t => {
  const { h, gid } = await start(t, { u_ana: state(), u_bea: state(), u_cy: state() });
  const c = (await create(h, gid, 'u_bea', { template: 'workouts', span: 'week' })).body;
  await act(h, gid, c.id, 'join', 'u_ana');
  await act(h, gid, c.id, 'join', 'u_cy');
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/leave`, { as: 'u_cy', body: {} })).status, 200);
  assert.deepEqual(h.friends().challenges[c.id].joined.map(j => j.uid), ['u_bea', 'u_ana']);

  const r = await h.req('POST', '/api/admin/user/delete', { as: 'u_root', body: { id: 'u_bea' } });
  assert.equal(r.status, 200, r.text);
  const stored = h.friends().challenges[c.id];
  assert.deepEqual([stored.joined.map(j => j.uid), stored.creator], [['u_ana'], null]);
  const seen = (await get(h, gid, c.id, 'u_ana')).body;
  assert.deepEqual([seen.startedBy, seen.joined.map(j => j.uid)], [null, ['u_ana']]);

  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/leave`, { as: 'u_ana', body: {} })).status, 200);
  assert.deepEqual(h.friends().challenges, {}, 'the last one out takes the group’s challenges with it');
});

test('Friends off: no challenges to start or join', async t => {
  const { h, gid } = await start(t, { u_ana: state(), u_bea: state(), u_cy: state() });
  const c = (await create(h, gid, 'u_ana', { template: 'workouts', span: 'week' })).body;
  await h.req('PUT', '/api/friends/me', { as: 'u_bea', body: { on: false } });
  assert.equal((await act(h, gid, c.id, 'join', 'u_bea')).body.code, 'friends-off');
  assert.equal((await create(h, gid, 'u_bea', { template: 'protein', span: 'week' })).body.code, 'friends-off');
});
