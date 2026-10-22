/* Friends api m2, without a server: the share projection (friends/stats.js memberWeek), the planned
   count, targets with unknown days, the moments derived from projections (friends/moments.js),
   the goal kinds and the streak (friends/week.js), and the one-minute memo of projections
   (friends/cache.js), invalidated per person. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempData } from './helpers.mjs';
import { memberWeek, plannedAsOf, TARGET_MOMENT_DAYS } from '../friends/stats.js';
import { momentsOf, momentId, parseMomentId } from '../friends/moments.js';
import { accountMaps, countsIn, visibleMember, isActiveUser, addDays } from '../friends/rules.js';
import { state, workout, ALL, NONE } from './friends-server.mjs';

// cache.js (and week.js through it) reads DATA_DIR when it loads: set it first.
const dir = tempData();
const { memberProjection, invalidateMember, MEMO_MS } = await import('../friends/cache.js');
const { goalOf, streakOf, plausibleDate, goalLineOf, targetsWeek, joinedOnOf } = await import('../friends/week.js');

const WED = '2026-10-14';

test('a workout marked "Don\'t share this one" counts as a session and shows as nothing else', () => {
  const S = state({ workouts: [
    workout({ id: 'a', d: '2026-10-12', prs: ['0085'] }),
    workout({ id: 'b', d: '2026-10-13', name: 'Secret day', prs: ['0032'], share: { off: true, best: ['0032'] } })
  ] });
  const p = memberWeek(S, ALL, WED);
  assert.equal(p.done, 2);
  assert.deepEqual(p.recent.map(r => r.title), ['Push A']);
  assert.deepEqual(p.workouts.map(w => w.date), ['2026-10-12']);
  assert.deepEqual(p.dayCounts, [1, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(p.bests.map(b => b.id), ['0085'], 'not even a best it was asked to share');
});

test('weeks are Monday to Sunday on the stored date: a Sunday workout is last week\'s on Monday', () => {
  const S = state({ workouts: [workout({ id: 'sun', d: '2026-10-18' }), workout({ id: 'mon', d: '2026-10-19' })] });
  assert.equal(memberWeek(S, ALL, '2026-10-18').done, 1, 'Sunday is in the week of Monday 12');
  const next = memberWeek(S, ALL, '2026-10-19');
  assert.equal(next.done, 1, 'Monday starts a new week');
  assert.deepEqual(next.history.at(-2), { week: '2026-10-12', done: 1, planned: 3, targets: { hit: 0, of: 0, days: [null, null, null, null, null, null, null] } });
  assert.deepEqual(next.workouts.map(w => w.date), ['2026-10-19', '2026-10-18'], 'moments look back seven days, across the week');
});

test('no scheduled day is no plan: planned 0, consistency null for that week, never 0', () => {
  const S = state({ week: {}, workouts: [workout({ d: '2026-10-13' })] });
  const p = memberWeek(S, ALL, WED);
  assert.deepEqual([p.planned, p.noPlan, p.done], [0, true, 1]);
  assert.ok(p.consistency.every(c => c.share === null), JSON.stringify(p.consistency));
  const planned = memberWeek(state({ workouts: [workout({ d: '2026-10-13' })] }), ALL, WED);
  assert.equal(planned.consistency.at(-1).share, 0.33);
  assert.equal(planned.consistency.at(-2).share, 0, 'a planned week with nothing done is 0');
});

test('planned is the schedule as it is now: a routine deleted or a day added changes it, the queue counts once started', () => {
  assert.equal(plannedAsOf(state(), WED), 3);
  assert.equal(plannedAsOf(state({ week: { 1: 'r1', 2: 'gone', 3: ['gone', 'r2'] } }), WED), 2, 'a day pointing at a deleted routine is rest');
  assert.equal(plannedAsOf(state({ week: { 1: 'r1', 2: 'r1', 3: 'r2', 4: 'r1', 5: 'r1' } }), WED), 5);
  const queued = state({ week: { 1: 'r1', 3: 'r2', 5: 'r1' }, queue: { ids: ['r1', 'r1', 'gone'], since: 0, startsOn: '2026-10-12' } });
  assert.equal(plannedAsOf(queued, WED), 2, 'the queue session, plus Wednesday (Monday and Friday are the queue\'s)');
  assert.equal(plannedAsOf({ ...queued, queue: { ...queued.queue, startsOn: '2026-10-20' } }, WED), 3, 'a queue not started yet');
  assert.equal(plannedAsOf(null, WED), 0);
});

test('targets: a day the client did not judge is unknown, counted nowhere; a later day is unknown too', () => {
  const S = state({ targetsReached: { '2026-10-12': { all: true, protein: true }, '2026-10-14': { all: false, protein: true }, '2026-10-15': { all: true, protein: true }, '2026-10-13': 'yes' } });
  const p = memberWeek(S, ALL, WED);
  assert.deepEqual(p.targets, { reached: 1, of: 2, days: [true, null, false, null, null, null, null] });
  assert.equal('targets' in memberWeek(S, { ...ALL, targets: false }, WED), false);
  assert.equal('protein' in memberWeek(S, { ...ALL, targets: false }, WED), false);
});

test('switches: nothing of a switch that is off is in the projection', () => {
  const S = state({ workouts: [workout({ d: '2026-10-12', prs: ['0085'] })], targetsReached: { '2026-10-12': { all: true, protein: true } } });
  const p = memberWeek(S, NONE, WED);
  for (const k of ['recent', 'days', 'dayCounts', 'workouts', 'consistency', 'targets', 'protein', 'bests', 'bestMoments']) assert.equal(k in p, false, k);
  assert.deepEqual([p.done, p.planned], [1, 3]);
  assert.ok(p.history.every(h => h.targets === null));
});

test('bests: catalogue exercises only, the newest of each, by the switch or by that workout', () => {
  const S = state({ workouts: [
    workout({ id: 'a', d: '2026-10-01', prs: ['0085', 'my-own-lift'] }),
    workout({ id: 'b', d: '2026-10-13', prs: ['0085', '0001'], share: { best: ['0001'] } }),
    workout({ id: 'c', d: '2026-08-01', prs: ['0032'] })
  ] });
  assert.deepEqual(memberWeek(S, ALL, WED).bests, [{ id: '0085', exercise: 'barbell romanian deadlift', date: '2026-10-13' }, { id: '0001', exercise: '3/4 sit-up', date: '2026-10-13' }]);
  assert.deepEqual(memberWeek(S, { ...ALL, bests: false }, WED).bests.map(b => b.id), ['0001']);
  assert.equal('bests' in memberWeek(state({ workouts: [workout({ d: '2026-10-13', prs: ['0085'] })] }), { ...ALL, bests: false }, WED), false);
});

test('a damaged state shows as nothing, never throws', () => {
  for (const S of [null, {}, { workouts: 'x', routines: 7, week: null }, { workouts: [null, 3, { d: 'not a date' }, { d: '2026-10-13', start: 'x', end: -1, entries: 'no' }] }]) {
    const p = memberWeek(S, ALL, WED);
    assert.ok(p.done <= 1 && p.planned === 0);
  }
});

const rowsOf = (byUid, share = ALL, date = WED) => Object.entries(byUid).map(([uid, S]) => ({ uid, p: memberWeek(S, share, date) }));

test('moments: workouts, Trained together for the same routine on the same day, bests, a protein target', () => {
  const protein = Object.fromEntries(['2026-10-12', '2026-10-13', '2026-10-14'].map(d => [d, { all: false, protein: true }]));
  const rows = rowsOf({
    u_ana: state({ workouts: [workout({ id: 'a1', d: '2026-10-12', name: 'Push A' })] }),
    u_bea: state({ workouts: [workout({ id: 'b1', d: '2026-10-12', name: 'push a', routineId: 'other', prs: ['0085'] }), workout({ id: 'b2', d: '2026-10-13', name: 'Push A' })], targetsReached: protein }),
    u_cy: state({ workouts: [workout({ id: 'c1', d: '2026-10-13', name: 'Legs' })] })
  });
  const ms = momentsOf({ rows, date: WED });
  const together = ms.filter(m => m.kind === 'together');
  assert.equal(together.length, 1, 'the name decides, case aside; Bea alone on the 13th');
  assert.deepEqual([together[0].who, together[0].date], [['u_ana', 'u_bea'], '2026-10-12']);
  assert.ok(together[0].id.startsWith('together:2026-10-12:u_ana+u_bea:'));
  assert.deepEqual(ms.filter(m => m.kind === 'best').map(m => [m.who[0], m.title, m.detail.exercise]), [['u_bea', 'barbell romanian deadlift', '0085']]);
  assert.equal(ms.filter(m => m.kind === 'target').length, 0, `three days is below ${TARGET_MOMENT_DAYS}`);
  assert.deepEqual(ms.map(m => m.date), [...ms.map(m => m.date)].sort().reverse(), 'newest first');

  const five = Object.fromEntries(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'].map(d => [d, { all: true, protein: true }]));
  const fri = momentsOf({ rows: rowsOf({ u_vlad: state({ targetsReached: five }) }, ALL, '2026-10-16'), date: '2026-10-16' });
  assert.deepEqual(fri.map(m => [m.kind, m.date, m.detail]), [['target', '2026-10-16', { target: 'protein', days: 5, of: 7 }]]);
});

test('moments: the last seven days only, a removed one hidden, ids stable and parseable', () => {
  const rows = rowsOf({ u_ana: state({ workouts: [workout({ id: 'old', d: '2026-10-07' }), workout({ id: 'edge', d: '2026-10-08' }), workout({ id: 'new', d: WED })] }) });
  const ms = momentsOf({ rows, date: WED });
  assert.deepEqual(ms.map(m => m.date), [WED, '2026-10-08'], 'the 7th is eight days back: gone');
  const again = momentsOf({ rows: rowsOf({ u_ana: state({ workouts: [workout({ id: 'old', d: '2026-10-07' }), workout({ id: 'edge', d: '2026-10-08' }), workout({ id: 'new', d: WED })] }) }), date: WED });
  assert.deepEqual(again.map(m => m.id), ms.map(m => m.id), 'the same ids on every read');
  assert.deepEqual(momentsOf({ rows, date: WED, removed: new Set([ms[0].id]) }).map(m => m.id), [ms[1].id]);
  assert.deepEqual(parseMomentId(momentId('together', WED, ['u_bea', 'u_ana'], 'Ab_12-xY')), { kind: 'together', date: WED, who: ['u_ana', 'u_bea'] });
  for (const bad of ['', 'nope', 'workout:2026-10-14::x', 'party:2026-10-14:u_ana:x', 'workout:2026-10-14:u ana:x', 7]) assert.equal(parseMomentId(bad), null, String(bad));
});

test('goals: planned leaves out who has no plan, number counts everyone, targets sums who shares them', () => {
  const rows = [
    { done: 3, planned: 4, noPlan: false, targets: { hit: 5, of: 7 } },
    { done: 2, planned: 0, noPlan: true, targets: null },
    { done: 1, planned: 1, noPlan: false, targets: { hit: 2, of: 2 } }
  ];
  assert.deepEqual(goalOf({ kind: 'planned' }, rows), { done: 4, planned: 5, targets: { hit: 7, of: 9 }, hit: false });
  assert.equal(goalOf({ kind: 'planned' }, [rows[0], { ...rows[2], done: 2 }]).hit, true);
  assert.equal(goalOf({ kind: 'planned' }, [rows[1]]).hit, null, 'a week nobody planned is neither');
  assert.deepEqual(goalOf({ kind: 'number', n: 6 }, rows), { done: 6, planned: 5, targets: { hit: 7, of: 9 }, hit: true });
  assert.equal(goalOf({ kind: 'targets' }, rows).hit, false);
  assert.equal(goalOf({ kind: 'targets' }, [rows[2]]).hit, true);
  assert.equal(goalOf({ kind: 'targets' }, [rows[1]]).hit, null);
  assert.deepEqual(goalLineOf({ kind: 'number', n: 15 }), { kind: 'number', n: 15 });
  assert.deepEqual(goalLineOf(undefined), { kind: 'planned' });
});

test('targets goal: 5 days reached in the week, counted absolutely; a mid-week joiner needs their share of 5', () => {
  const MON = '2026-10-12';
  const wk = (...on) => ({ days: Array.from({ length: 7 }, (_, i) => (on.includes(i) ? true : on.includes(-i - 1) ? false : null)) });
  assert.deepEqual(targetsWeek(wk(0, 1, 2, 3, 4), MON, '2026-10-01'), { hit: 5, of: 5 }, '5 hits is a hit');
  assert.deepEqual(targetsWeek(wk(0, 1, 2, 3), MON, '2026-10-01'), { hit: 4, of: 5 }, '4 is not');
  assert.deepEqual(targetsWeek(wk(0, 1, 2), MON, MON), { hit: 3, of: 5 }, '3 of 3 known days is not: a day without data is not reached');
  assert.deepEqual(targetsWeek(wk(0, 1, 2, 3, 4, 5, 6), MON, MON), { hit: 5, of: 5 }, 'capped at the need');
  // Joined on Friday: 3 days in the group, ceil(5/7 x 3) = 3; the days before joining do not count.
  assert.deepEqual(targetsWeek(wk(0, 1, 4, 5, 6), MON, '2026-10-16'), { hit: 3, of: 3 });
  assert.deepEqual(targetsWeek(wk(0, 1, 2, 3, 4, 5), MON, '2026-10-16'), { hit: 2, of: 3 });
  assert.deepEqual(targetsWeek(wk(6), MON, '2026-10-18'), { hit: 1, of: 1 }, 'joined on Sunday');
  assert.deepEqual(targetsWeek(wk(1, 2, 3, 4, 5, 6), MON, '2026-10-13'), { hit: 5, of: 5 }, 'six days still need 5');
  assert.equal(targetsWeek(wk(0), MON, '2026-10-19'), null, 'joined after the week: not counted');
  assert.equal(targetsWeek(null, MON, MON), null, 'not shared');
  assert.deepEqual(targetsWeek(wk(0, 1, 2, 3, 4), MON, null), { hit: 5, of: 5 }, 'no join date: the full week');

  const rows = targets => targets.map(t => ({ done: 0, planned: 0, noPlan: true, targets: t }));
  assert.equal(goalOf({ kind: 'targets' }, rows([{ hit: 5, of: 5 }, { hit: 3, of: 3 }])).hit, true, 'everyone hit');
  assert.deepEqual(goalOf({ kind: 'targets' }, rows([{ hit: 5, of: 5 }, { hit: 4, of: 5 }, null])).targets, { hit: 9, of: 10 });
  assert.equal(goalOf({ kind: 'targets' }, rows([{ hit: 5, of: 5 }, { hit: 4, of: 5 }])).hit, false, 'one short is a miss');
  assert.equal(goalOf({ kind: 'targets' }, rows([null, null])).hit, null, 'nobody shares targets: neither');
  assert.equal(joinedOnOf({ members: [{ uid: 'a', joined: '2026-10-14T23:30:00.000Z', joinedOn: '2026-10-15' }] }, 'a'), '2026-10-15', 'the local date wins');
  assert.equal(joinedOnOf({ members: [{ uid: 'a', joined: '2026-10-14T23:30:00.000Z' }] }, 'a'), '2026-10-14');
  assert.equal(joinedOnOf({ members: [] }, 'a'), null);
});

test('streak: weeks in a row hit back from last week; a week that is neither is skipped; a miss ends it', () => {
  const W = '2026-10-12';
  const results = { [addDays(W, -7)]: true, [addDays(W, -14)]: null, [addDays(W, -21)]: true, [addDays(W, -28)]: false, [addDays(W, -35)]: true };
  assert.equal(streakOf({ results }, W, null), 2);
  assert.equal(streakOf({ results }, W, true), 3, 'this week once it is hit');
  assert.equal(streakOf({ results }, W, false), 2, 'this week not hit yet takes nothing away');
  assert.equal(streakOf({ results: { [addDays(W, -7)]: false, [addDays(W, -14)]: true } }, W, null), 0, 'a missed week resets to 0');
  assert.equal(streakOf({ results: { [addDays(W, -14)]: true } }, W, null), 0, 'an unjudged week ends the run');
  assert.equal(streakOf({}, W, true), 1);
});

test('a date is plausible within a day of the server’s UTC date, in any time zone', () => {
  const noon = Date.parse('2026-10-14T12:00:00Z');
  for (const d of ['2026-10-13', '2026-10-14', '2026-10-15']) assert.ok(plausibleDate(d, noon), d);
  for (const d of ['2026-10-12', '2026-10-16', '2026-10-11', '2026-10-17', '2099-01-01', 'x']) assert.ok(!plausibleDate(d, noon), d);
  // UTC+14 just before UTC midnight is already tomorrow; UTC-12 just after is still yesterday.
  assert.ok(plausibleDate('2026-10-15', Date.parse('2026-10-14T23:59:00Z')));
  assert.ok(plausibleDate('2026-10-13', Date.parse('2026-10-14T00:01:00Z')));
  // Saturday by the server: the next Monday is server date + 2 and cannot close the week early.
  assert.ok(!plausibleDate('2026-10-19', Date.parse('2026-10-17T23:00:00Z')));
});

test('who shows and who counts: Friends off and a disabled account count for nothing; the viewer always sees themselves', () => {
  const { accounts, active } = accountMaps([{ id: 'u_a' }, { id: 'u_b', disabled: true }, { id: 'u_c' }, null, { id: 'bad id' }]);
  assert.deepEqual([...accounts.keys()], ['u_a', 'u_b', 'u_c']);
  assert.deepEqual([...active.keys()], ['u_a', 'u_c']);
  assert.ok(!isActiveUser({ id: 'u_b', disabled: true }));
  const data = { people: { u_a: { on: true }, u_b: { on: true }, u_c: { on: false } } };
  assert.deepEqual(['u_a', 'u_b', 'u_c'].map(u => countsIn(data, u, active)), [true, false, false]);
  assert.ok(visibleMember(data, 'u_c', 'u_c', active), 'Friends off still sees themselves');
  assert.ok(!visibleMember(data, 'u_c', 'u_a', active));
  assert.ok(!visibleMember(data, 'u_b', 'u_a', active));
});

test('the memo serves a projection for a minute, per person, day and switches; invalidateMember drops it', () => {
  const file = path.join(dir, 'state-u_m.json');
  const write = n => fs.writeFileSync(file, JSON.stringify(state({ workouts: Array.from({ length: n }, (_, i) => workout({ id: `w${i}`, d: '2026-10-12' })) })));
  const t0 = 1_000_000;
  write(1);
  assert.equal(memberProjection('u_m', ALL, WED, t0).done, 1);
  write(2);
  assert.equal(memberProjection('u_m', ALL, WED, t0 + MEMO_MS - 1).done, 1, 'within the minute');
  assert.equal(memberProjection('u_m', { ...ALL, training: false }, WED, t0 + 1).done, 2, 'other switches are another entry');
  assert.equal('recent' in memberProjection('u_m', { ...ALL, training: false }, WED, t0 + 2), false);
  assert.equal(memberProjection('u_m', ALL, WED, t0 + MEMO_MS).done, 2, 'a minute on');
  write(3);
  invalidateMember('u_m');
  assert.equal(memberProjection('u_m', ALL, WED, t0 + MEMO_MS + 1).done, 3, 'dropped by a write of the state');
  assert.equal(memberProjection('u_nobody', ALL, WED, t0).done, 0, 'no state file is nothing');
});
