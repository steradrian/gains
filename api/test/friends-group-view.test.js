/* Friends api m2 over HTTP: GET /groups/{id}, GET /groups/{id}/members/{uid} and
   POST /groups/{id}/moments/{mid}/remove against the real server.js, its clock pinned by
   fake-clock.mjs: the ring and its high-water mark, plan changes, a week off, the streak across
   weeks (a miss resets it, a creator change does not), mutes, Friends off, Trained together and
   its removal, non-members, a removed member, the seven-day window, Monday-to-Sunday weeks, the
   projection memo dropped by PUT /api/data, and a disabled account: hidden everywhere, never
   purged, back exactly as it was on enable. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, state, workout, user, USERS, ALL, TODAY, MONDAY, NOT_FOUND, DAY, T_WED } from './friends-server.mjs';

const at = date => Date.parse(date + 'T12:00:00.000Z');
const row = (view, uid) => view.members.find(m => m.uid === uid);
const ofKind = (view, kind) => view.moments.filter(m => m.kind === kind);
const ONE_DAY_PLAN = { week: { 1: 'r1' } };

test('the ring never goes back on done work; a plan change re-adds planned and leaves done', async t => {
  const h = await startServer(t, { states: {
    u_ana: state(),
    u_bea: state({ workouts: [workout({ id: 'b1', d: '2026-10-12' }), workout({ id: 'b2', d: '2026-10-13', name: 'Legs' })] })
  } });
  const gid = await h.crew(['u_ana', 'u_bea']);
  let v = await h.view('u_ana', gid);
  assert.deepEqual([row(v, 'u_bea').done, row(v, 'u_bea').planned], [2, 3]);
  assert.deepEqual(v.week, { done: 2, planned: 6 });
  assert.equal(h.friends().groups[gid].highWater[MONDAY].u_bea, 2);

  await h.state('u_bea', state({ workouts: [workout({ id: 'b1', d: '2026-10-12' })] }));
  v = await h.view('u_ana', gid);
  assert.equal(row(v, 'u_bea').done, 2, 'a deleted workout does not take the ring back');
  assert.equal((await h.member('u_ana', gid, 'u_bea')).body.week.done, 2);
  assert.equal(ofKind(v, 'workout').filter(m => m.who[0] === 'u_bea').length, 1, 'the moment of the deleted one is gone');

  await h.state('u_bea', state({ week: { 1: 'r1' }, workouts: [workout({ id: 'b1', d: '2026-10-12' })] }));
  v = await h.view('u_ana', gid);
  assert.deepEqual([row(v, 'u_bea').done, row(v, 'u_bea').planned], [2, 1], 'planned follows the plan, done stays');
  await h.state('u_bea', state({ week: { 1: 'r1', 2: 'r2', 3: 'r1', 4: 'r2' }, workouts: [workout({ id: 'b1', d: '2026-10-12' })] }));
  assert.equal(row(await h.view('u_ana', gid), 'u_bea').planned, 4, 'and re-adds it');
});

test('a week off: no plan, left out of the planned goal, consistency null not 0, targets still shared', async t => {
  const h = await startServer(t, { states: {
    u_ana: state({ ...ONE_DAY_PLAN, workouts: [workout({ d: MONDAY })] }),
    u_cy: state({ week: {}, workouts: [workout({ d: '2026-10-13', name: 'Walk' })], targetsReached: { [MONDAY]: { all: true, protein: false } } })
  } });
  const gid = await h.crew(['u_ana', 'u_cy']);
  const v = await h.view('u_ana', gid);
  assert.deepEqual([row(v, 'u_cy').planned, row(v, 'u_cy').noPlan], [0, true]);
  assert.deepEqual(v.week, { done: 1, planned: 1 }, 'the goal adds up only who planned');
  const cy = (await h.member('u_ana', gid, 'u_cy')).body;
  assert.deepEqual(cy.week, { noPlan: true });
  assert.ok(cy.consistency.every(c => c.share === null), 'a week off shows empty, never 0');
  assert.deepEqual(cy.targets, { reached: 1, of: 1, days: [true, null, null, null, null, null, null] });
});

test('the streak: a hit week counts, a missed week resets it to 0 silently, and it outlives a creator change', async t => {
  const plan = workouts => state({ ...ONE_DAY_PLAN, workouts });
  const h = await startServer(t, { states: {
    u_ana: plan([workout({ d: MONDAY })]), u_bea: plan([workout({ d: MONDAY })]), u_cy: plan([workout({ d: MONDAY })])
  } });
  const gid = await h.crew(['u_ana', 'u_bea', 'u_cy']);
  let v = await h.view('u_ana', gid);
  assert.deepEqual([v.week.done, v.week.planned, v.streak], [3, 3, 1], 'this week counts once it is hit');

  await h.at(at('2026-10-21'));
  v = await h.view('u_ana', gid, '2026-10-21');
  assert.equal(v.streak, 1, 'last week hit, this one not yet');
  assert.deepEqual(h.friends().groups[gid].results, { [MONDAY]: true });
  assert.deepEqual(v.moments, [], 'moments older than seven days are gone');

  // The creator leaves: the group keeps its weeks.
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/leave`, { as: 'u_ana', body: {} })).status, 200);
  v = await h.view('u_bea', gid, '2026-10-21');
  assert.deepEqual([v.creator, v.isCreator, v.streak], ['u_bea', true, 1]);

  await h.at(at('2026-10-28'));
  v = await h.view('u_bea', gid, '2026-10-28');
  assert.equal(v.streak, 0, 'nobody trained the week of the 19th');
  assert.deepEqual(h.friends().groups[gid].results, { [MONDAY]: true, '2026-10-19': false });
  assert.ok(!/miss/i.test(JSON.stringify(v)), 'no message, no names');
  const list = await h.req('GET', '/api/friends/groups?date=2026-10-28', { as: 'u_cy' });
  assert.equal(list.body[0].streak, 0);

  await h.state('u_bea', plan([workout({ d: '2026-10-26' })]));
  await h.state('u_cy', plan([workout({ d: '2026-10-26' })]));
  v = await h.view('u_cy', gid, '2026-10-28');
  assert.equal(v.streak, 1);
  // Read again with nothing new: nothing is written.
  const before = JSON.stringify(h.friends());
  await h.view('u_cy', gid, '2026-10-28');
  assert.equal(JSON.stringify(h.friends()), before);
});

test('a made-up date is answered but settles nothing', async t => {
  const h = await startServer(t, { states: { u_ana: state({ workouts: [workout({ d: '2030-01-07' })] }) } });
  const gid = await h.crew(['u_ana']);
  const before = JSON.stringify(h.friends());
  const v = await h.view('u_ana', gid, '2030-01-08');
  assert.equal(v.week.done, 1, 'answered from the data');
  assert.equal(JSON.stringify(h.friends()), before, 'no high-water, no results, no lastWeek from the future');
});

test('a Saturday read dated the next Monday cannot close the running week early', async t => {
  const plan = workouts => state({ ...ONE_DAY_PLAN, workouts });
  const h = await startServer(t, { states: { u_ana: plan([]), u_bea: plan([]) } });
  const gid = await h.crew(['u_ana', 'u_bea']);
  await h.at(Date.parse('2026-10-17T12:00:00.000Z'));
  await h.view('u_ana', gid, '2026-10-17');
  const before = JSON.stringify(h.friends().groups[gid]);
  await h.view('u_ana', gid, '2026-10-19');
  assert.equal(JSON.stringify(h.friends().groups[gid]), before, 'server date + 2 settles nothing');
  assert.ok(!Object.hasOwn(h.friends().groups[gid].results || {}, MONDAY), 'the week of the 12th is still open');
});

test('targets goal: each member needs 5 days reached, absolutely; a Friday joiner needs 3', async t => {
  const reached = (...ds) => ({ targetsReached: Object.fromEntries(ds.map(d => [d, { all: true, protein: true }])) });
  const MON_TO = n => Array.from({ length: n }, (_, i) => `2026-10-1${2 + i}`);
  const h = await startServer(t, { now: at(MONDAY), states: { u_ana: state(reached(...MON_TO(5))), u_bea: state(reached(...MON_TO(4))) } });
  const gid = await h.crew(['u_ana', 'u_bea'], { goal: { kind: 'targets' } });
  await h.at(at('2026-10-16'));
  await h.on('u_cy');
  const link = await h.req('POST', `/api/friends/groups/${gid}/invites`, { as: 'u_ana', body: {} });
  assert.equal((await h.req('POST', `/api/friends/join/${link.body.code}?date=2026-10-16`, { as: 'u_cy', body: {} })).status, 200);
  assert.equal(h.friends().groups[gid].members.find(m => m.uid === 'u_cy').joinedOn, '2026-10-16', 'the joiner’s local date is kept');
  await h.state('u_cy', state(reached('2026-10-12', '2026-10-16', '2026-10-17', '2026-10-18')));

  await h.at(at('2026-10-18'));
  let v = await h.view('u_bea', gid, '2026-10-18');
  assert.deepEqual(v.targets, { hit: 12, of: 13 }, 'Ana 5 of 5, Bea 4 of 5, Cy 3 of 3 (her Monday was before she joined)');
  assert.equal(v.streak, 0, 'Bea at 4 is not a hit');

  await h.state('u_bea', state(reached(...MON_TO(4), '2026-10-18')));
  v = await h.view('u_bea', gid, '2026-10-18');
  assert.deepEqual([v.targets, v.streak], [{ hit: 13, of: 13 }, 1], 'everyone hit: the week counts');

  await h.at(at('2026-10-19'));
  v = await h.view('u_ana', gid, '2026-10-19');
  assert.equal(h.friends().groups[gid].results[MONDAY], true);
  assert.deepEqual(v.targets, { hit: 0, of: 15 }, 'a new week: nothing reached yet, every day of it counts');
});

test('a muted member’s moments are left out for that viewer only, and they still count', async t => {
  const h = await startServer(t, { states: {
    u_ana: state(), u_bea: state({ workouts: [workout({ d: MONDAY, name: 'Legs' })] }), u_cy: state()
  } });
  const gid = await h.crew(['u_ana', 'u_bea', 'u_cy']);
  assert.equal((await h.req('PUT', `/api/friends/groups/${gid}/mutes`, { as: 'u_ana', body: { uid: 'u_bea', muted: true } })).status, 200);
  const ana = await h.view('u_ana', gid);
  assert.deepEqual(ana.moments, []);
  assert.deepEqual([row(ana, 'u_bea').muted, row(ana, 'u_bea').done, ana.week.done], [true, 1, 1]);
  assert.equal(ana.weekDays[0].workouts, 1, 'the dots count her too');
  const cy = await h.view('u_cy', gid);
  assert.deepEqual(cy.moments.map(m => m.who), [['u_bea']]);
  assert.equal(row(cy, 'u_bea').muted, false);
  const bea = await h.view('u_bea', gid);
  assert.ok(!bea.members.some(m => m.muted), 'the muted person is never told');
});

test('a member with Friends off is hidden everywhere and counts for nothing; they still see the group', async t => {
  const h = await startServer(t, { states: {
    u_ana: state({ workouts: [workout({ d: MONDAY })] }), u_bea: state({ workouts: [workout({ d: MONDAY })] })
  } });
  const gid = await h.crew(['u_ana', 'u_bea']);
  await h.req('PUT', '/api/friends/me', { as: 'u_bea', body: { on: false } });
  const ana = await h.view('u_ana', gid);
  assert.deepEqual(ana.members.map(m => m.uid), ['u_ana']);
  assert.deepEqual(ana.week, { done: 1, planned: 3 });
  assert.equal(ana.weekDays[0].workouts, 1);
  assert.deepEqual(ana.moments, [], 'and Ana is the only one counting: no moments, the client shows Invite');
  assert.ok(!JSON.stringify(ana).includes('u_bea'));
  assert.deepEqual([(await h.member('u_ana', gid, 'u_bea')).status, (await h.member('u_ana', gid, 'u_bea')).body], [404, NOT_FOUND]);
  const bea = await h.view('u_bea', gid);
  assert.deepEqual(bea.members.map(m => [m.uid, m.you]), [['u_ana', false], ['u_bea', true]]);
  assert.deepEqual(bea.week, { done: 1, planned: 3 }, 'her own row is not in the total');
});

test('Trained together: two members, same routine, same day; either removes it, for everyone', async t => {
  const h = await startServer(t, { states: {
    u_ana: state({ workouts: [workout({ id: 'a1', d: MONDAY, name: 'Push A' })] }),
    u_bea: state({ workouts: [workout({ id: 'b1', d: MONDAY, name: 'Push A', routineId: 'zz' })] }),
    u_cy: state({ workouts: [workout({ id: 'c1', d: '2026-10-13', name: 'Push A' })] })
  } });
  const gid = await h.crew(['u_ana', 'u_bea', 'u_cy']);
  const v = await h.view('u_cy', gid);
  const together = ofKind(v, 'together');
  assert.equal(together.length, 1);
  assert.deepEqual([together[0].who, together[0].title, together[0].date, together[0].mine], [['u_ana', 'u_bea'], 'Push A', MONDAY, false]);
  const mid = encodeURIComponent(together[0].id);
  const remove = as => h.req('POST', `/api/friends/groups/${gid}/moments/${mid}/remove`, { as, body: {} });

  assert.deepEqual([(await remove('u_cy')).status, (await remove('u_cy')).body], [404, NOT_FOUND], 'not hers to remove');
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/moments/${mid}/remove`, { as: 'u_bea', body: { x: 1 } })).body.code, 'bad-body');
  assert.deepEqual((await remove('u_bea')).body, { ok: true });
  assert.deepEqual((await remove('u_ana')).body, { ok: true }, 'the other participant, again: still ok');
  for (const u of ['u_ana', 'u_bea', 'u_cy']) assert.deepEqual(ofKind(await h.view(u, gid), 'together'), [], u);
  assert.deepEqual(h.friends().groups[gid].removedMoments, [together[0].id]);

  const own = ofKind(await h.view('u_ana', gid), 'workout').find(m => m.who[0] === 'u_bea');
  const ownMid = encodeURIComponent(own.id);
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/moments/${ownMid}/remove`, { as: 'u_ana', body: {} })).status, 404, 'someone else’s workout');
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/moments/${ownMid}/remove`, { as: 'u_bea', body: {} })).status, 200, 'her own');
  const gone = encodeURIComponent(`workout:${MONDAY}:u_bea:nothingHere1`);
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/moments/${gone}/remove`, { as: 'u_bea', body: {} })).status, 404, 'a moment that is not there');
});

test('a non-member gets exactly what an unknown id gets on the three routes, and nothing changes', async t => {
  const h = await startServer(t, { states: { u_ana: state({ workouts: [workout({ d: MONDAY })] }) } });
  const gid = await h.crew(['u_ana', 'u_bea']);
  await h.on('u_dan');
  const mid = encodeURIComponent((await h.view('u_ana', gid)).moments[0].id);
  const before = JSON.stringify(h.friends());
  for (const id of [gid, 'NoSuchGroup1', '%E0%A4%A']) {
    for (const [m, p] of [['GET', `/api/friends/groups/${id}?date=${TODAY}`], ['GET', `/api/friends/groups/${id}/members/u_ana?date=${TODAY}`], ['POST', `/api/friends/groups/${id}/moments/${mid}/remove`]]) {
      const r = await h.req(m, p, { as: 'u_dan', body: m === 'POST' ? {} : undefined });
      assert.deepEqual([r.status, r.body], [404, NOT_FOUND], `${m} ${p}`);
    }
  }
  assert.equal(JSON.stringify(h.friends()), before);
  for (const uid of ['u_dan', 'u_nobody', 'a%2Fb']) assert.deepEqual((await h.member('u_ana', gid, uid)).body, NOT_FOUND, uid);
  assert.equal((await h.req('GET', `/api/friends/groups/${gid}`, { as: 'u_ana' })).body.code, 'bad-date');
  assert.equal((await h.req('GET', `/api/friends/groups/${gid}?date=${TODAY}`)).status, 401);
});

test('a removed member’s workouts vanish from the group, their own data untouched', async t => {
  const BEA = state({ workouts: [workout({ d: MONDAY, name: 'Legs' })] });
  const h = await startServer(t, { states: { u_ana: state(), u_bea: BEA } });
  const gid = await h.crew(['u_ana', 'u_bea']);
  assert.equal((await h.view('u_ana', gid)).week.done, 1);
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/members/u_bea/remove`, { as: 'u_ana', body: {} })).status, 200);
  const v = await h.view('u_ana', gid);
  assert.deepEqual([v.members.map(m => m.uid), v.week.done, v.weekDays[0].workouts, v.moments], [['u_ana'], 0, 0, []]);
  assert.equal(h.friends().groups[gid].highWater[MONDAY]?.u_bea, undefined);
  assert.deepEqual([(await h.req('GET', `/api/friends/groups/${gid}?date=${TODAY}`, { as: 'u_bea' })).status], [404]);
  const own = await h.req('GET', '/api/data', { as: 'u_bea' });
  assert.equal(own.body.state.workouts.length, 1);
});

test('weeks run Monday to Sunday on the stored dates: Sunday is last week, Monday starts the next', async t => {
  const h = await startServer(t, { now: at('2026-10-18'), states: {
    u_ana: state(), u_bea: state({ workouts: [workout({ id: 'sun', d: '2026-10-18' }), workout({ id: 'mon', d: '2026-10-19' })] })
  } });
  const gid = await h.crew(['u_ana', 'u_bea']);
  let v = await h.view('u_ana', gid, '2026-10-18');
  assert.deepEqual([row(v, 'u_bea').done, v.weekDays[6].date, v.weekDays[6].workouts], [1, '2026-10-18', 1]);
  await h.at(at('2026-10-19'));
  v = await h.view('u_ana', gid, '2026-10-19');
  assert.deepEqual([row(v, 'u_bea').done, v.weekDays[0].date, v.weekDays[0].workouts, v.weekDays[6].workouts], [1, '2026-10-19', 1, 0]);
});

test('only you in the group: no moments; a week with nothing done is quiet; the viewer’s notification switch', async t => {
  const h = await startServer(t, { states: { u_ana: state({ workouts: [workout({ d: MONDAY })] }) } });
  const solo = await h.crew(['u_ana']);
  const v = await h.view('u_ana', solo);
  assert.deepEqual([v.moments, v.quiet, v.members.length, v.cheersForMe, v.challenges, v.muteNotifications], [[], false, 1, 0, [], false]);
  const r = await h.req('POST', '/api/friends/groups', { as: 'u_bea', body: { name: 'Quiet', goal: { kind: 'number', n: 5 } } });
  assert.equal(r.status, 409, 'Bea is off');
  await h.on('u_bea');
  const quiet = (await h.req('POST', '/api/friends/groups', { as: 'u_bea', body: { name: 'Quiet', goal: { kind: 'number', n: 5 } } })).body.id;
  const q = await h.view('u_bea', quiet);
  assert.deepEqual([q.quiet, q.week, q.goalLine, q.goal], [true, { done: 0, planned: 0 }, { kind: 'number', n: 5 }, { kind: 'number', n: 5 }]);
  await h.req('PUT', `/api/friends/groups/${quiet}/prefs`, { as: 'u_bea', body: { muteNotifications: true } });
  assert.equal((await h.view('u_bea', quiet)).muteNotifications, true);
});

test('PUT /api/data drops that person’s projections at once', async t => {
  const h = await startServer(t, { states: { u_ana: state(), u_bea: state() } });
  const gid = await h.crew(['u_ana', 'u_bea']);
  assert.equal(row(await h.view('u_ana', gid), 'u_bea').done, 0);
  const put = await h.req('PUT', '/api/data', { as: 'u_bea', body: { state: state({ workouts: [workout({ d: MONDAY })] }) } });
  assert.equal(put.status, 200, put.text);
  assert.equal(row(await h.view('u_ana', gid), 'u_bea').done, 1, 'no minute to wait');
});

/* ---------- a disabled account: hidden, never purged ---------- */

test('disable hides an account everywhere Friends reads; enable brings it all back exactly; delete still purges', async t => {
  const h = await startServer(t, { states: {
    u_ana: state({ workouts: [workout({ id: 'a1', d: MONDAY, name: 'Push A' })] }),
    u_bea: state({ workouts: [workout({ id: 'b1', d: MONDAY, name: 'Push A' })] }),
    u_cy: state()
  } });
  const gid = await h.crew(['u_ana', 'u_bea', 'u_cy']);
  await h.on('u_eve');
  await h.req('PUT', `/api/friends/groups/${gid}/mutes`, { as: 'u_ana', body: { uid: 'u_bea', muted: true } });
  await h.req('PUT', `/api/friends/groups/${gid}/mutes`, { as: 'u_bea', body: { uid: 'u_cy', muted: true } });
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/invites/user`, { as: 'u_bea', body: { uid: 'u_eve' } })).status, 200);
  const link = (await h.req('POST', `/api/friends/groups/${gid}/invites`, { as: 'u_ana', body: {} })).body.code;
  assert.equal(ofKind(await h.view('u_cy', gid), 'together').length, 1);
  assert.equal((await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_eve' })).body.invitations.length, 1);
  const snapshot = JSON.stringify(h.friends());
  assert.equal(h.friends().groups[gid].highWater[MONDAY].u_bea, 1);

  const off = await h.req('POST', '/api/admin/user/disable', { as: 'u_root', body: { id: 'u_bea', disabled: true } });
  assert.equal(off.status, 200, off.text);
  assert.equal(JSON.stringify(h.friends()), snapshot, 'nothing purged');

  const list = await h.req('GET', `/api/friends/groups?date=${TODAY}`, { as: 'u_ana' });
  assert.deepEqual([list.body[0].memberCount, list.body[0].members.map(m => m.uid), list.body[0].week], [2, ['u_ana', 'u_cy'], { done: 1, planned: 6 }]);
  const v = await h.view('u_cy', gid);
  assert.ok(!JSON.stringify(v).includes('u_bea'), JSON.stringify(v));
  assert.deepEqual(ofKind(v, 'together'), [], 'no Trained together with her');
  assert.deepEqual((await h.member('u_ana', gid, 'u_bea')).body, NOT_FOUND);
  assert.ok(!(await h.req('GET', '/api/friends/people', { as: 'u_eve' })).body.some(p => p.uid === 'u_bea'));
  const preview = await h.req('GET', `/api/friends/join/${link}`, { as: 'u_eve' });
  assert.deepEqual([preview.body.group.memberCount, preview.body.group.initials], [2, ['A', 'C']]);
  assert.deepEqual((await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_eve' })).body.invitations, [], 'her invitation does not show');
  // Her session is refused, so are her writes (readSession answers null for a disabled account).
  assert.equal((await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_bea' })).status, 401);
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/leave`, { as: 'u_bea', body: {} })).status, 401);
  assert.equal((await h.req('PUT', '/api/friends/me', { as: 'u_bea', body: { on: false } })).status, 401);
  assert.equal(JSON.stringify(h.friends()), snapshot, 'reading around her changed nothing of hers');

  const on = await h.req('POST', '/api/admin/user/disable', { as: 'u_root', body: { id: 'u_bea', disabled: false } });
  assert.equal(on.status, 200, on.text);
  assert.equal(JSON.stringify(h.friends()), snapshot, 'groups, memberships, mutes, invites, high-water: exactly as they were');
  const back = await h.view('u_cy', gid);
  assert.deepEqual([back.members.map(m => m.uid), ofKind(back, 'together').length, row(back, 'u_bea').done], [['u_ana', 'u_bea', 'u_cy'], 1, 1]);
  assert.equal((await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_eve' })).body.invitations.length, 1);
  assert.equal((await h.member('u_ana', gid, 'u_bea')).status, 200);

  await h.req('POST', '/api/admin/user/disable', { as: 'u_root', body: { id: 'u_bea', disabled: true } });
  const del = await h.req('POST', '/api/admin/user/delete', { as: 'u_root', body: { id: 'u_bea' } });
  assert.equal(del.status, 200, del.text);
  assert.ok(!JSON.stringify(h.friends()).includes('u_bea'), 'deleteUserData purges, disabled or not');
});

test('a disabled creator stays creator: no handover, and nobody can remove until they are back', async t => {
  const h = await startServer(t);
  const gid = await h.crew(['u_ana', 'u_bea', 'u_cy']);
  await h.req('POST', '/api/admin/user/disable', { as: 'u_root', body: { id: 'u_ana', disabled: true } });
  const remove = await h.req('POST', `/api/friends/groups/${gid}/members/u_cy/remove`, { as: 'u_bea', body: {} });
  assert.deepEqual([remove.status, remove.body.code], [403, 'forbidden']);
  const v = await h.view('u_bea', gid);
  assert.deepEqual([v.creator, v.isCreator], [null, false]);
  assert.equal(h.friends().groups[gid].creator, 'u_ana');
  await h.req('POST', '/api/admin/user/disable', { as: 'u_root', body: { id: 'u_ana', disabled: false } });
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/members/u_cy/remove`, { as: 'u_ana', body: {} })).status, 200);
});

test('a disabled member still holds a place: the cap of 12 counts them', async t => {
  const twelve = Array.from({ length: 12 }, (_, i) => `u_m${String(i).padStart(2, '0')}`);
  const users = [...USERS, ...twelve.map((id, i) => user(id, `Member ${i}`, i === 11 ? { disabled: true } : {}))];
  const joined = new Date(T_WED - DAY).toISOString();
  const on = { on: true, share: ALL, mutes: {}, groupPrefs: {} };
  const friends = {
    people: Object.fromEntries([...twelve, 'u_eve'].map(id => [id, on])), invitations: [], challenges: {}, cheers: [],
    groups: { g12: { id: 'g12', name: 'Full', goal: { kind: 'planned' }, created: joined, creator: twelve[0], members: twelve.map(uid => ({ uid, joined })), highWater: {}, removedMoments: [] } },
    invites: { FVMMCGDE22: { group: 'g12', by: twelve[0], created: joined, expiresAt: new Date(T_WED + 6 * DAY).toISOString() } }
  };
  const h = await startServer(t, { users, friends });
  const join = await h.req('POST', '/api/friends/join/FVMMCGDE22', { as: 'u_eve', body: {} });
  assert.deepEqual([join.status, join.body.code], [409, 'group-full']);
  const preview = await h.req('GET', '/api/friends/join/FVMMCGDE22', { as: 'u_eve' });
  assert.equal(preview.body.group.memberCount, 11, 'but the preview shows only who is visible');
});
