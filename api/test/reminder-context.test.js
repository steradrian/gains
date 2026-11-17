/* reminderContext (reminder-context.js): the body of GET /api/sync/reminder-context, on its own.
   The route, its token and its refusals are in server-reminder-context.test.js. The cases are the
   fixture file the gains-be contract suite replays (fixtures/reminder-context.json). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reminderContext, coachCadenceOn, LIVE_STALE_MS } from '../reminder-context.js';
import { nudgeDetail, nudgeFor } from '../nudge.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'reminder-context.json'), 'utf8'));
const NOW = Date.parse('2026-10-18T17:00:00Z');
const HOUR = 3600000;
const base = (over = {}) => ({ lang: 'en', routines: [{ id: 'push', name: 'Push A', emoji: '💪' }], week: { 0: 'push' }, workouts: [], ...over });
const ctx = (S, opts = {}) => reminderContext(S, '2026-10-18', { now: NOW, ...opts });

test('every fixture case answers exactly its expected body', () => {
  assert.ok(fixture.cases.length >= 20);
  for (const c of fixture.cases) {
    const before = JSON.stringify(c.state);
    const got = reminderContext(c.state, c.date, { coachRecord: c.coach, now: c.now ? Date.parse(c.now) : NOW });
    assert.deepEqual(got, c.expected, c.name);
    assert.equal(JSON.stringify(c.state), before, `${c.name}: the stored state is never changed`);
  }
});

test('the keys are the contract’s, in snake_case, and nothing else about the profile', () => {
  const got = ctx(base({ name: 'Ana', email: 'a@example.test', bodyweight: [{ d: '2026-10-01', w: 80 }] }));
  assert.deepEqual(Object.keys(got), ['lang', 'date', 'planned', 'workout_logged', 'excused', 'nudge', 'capabilities', 'live', 'coach', 'coach_cadence_on', 'legacy_reminder']);
  assert.ok(!JSON.stringify(got).includes('example.test'));
});

test('live: stale means more than 12 h since the last activity, on the server clock; exactly 12 h is still live', () => {
  const live = (startedAt, lastSetAt = null) => ctx(base({ workoutLive: { workoutId: 'w1', startedAt, lastSetAt } })).live;
  assert.equal(LIVE_STALE_MS, 12 * HOUR);
  assert.equal(live(NOW - 12 * HOUR)?.workout_id, 'w1');
  assert.equal(live(NOW - 12 * HOUR - 1), null);
  assert.equal(live(NOW - 20 * HOUR, NOW - 12 * HOUR + 1)?.workout_id, 'w1');
  assert.equal(live(NOW - 20 * HOUR, NOW - 12 * HOUR - 1), null);
  // The same instant, as an ISO string, is read the same.
  assert.deepEqual(live('2026-10-18T16:02:11Z', '2026-10-18T16:40:00Z'), { workout_id: 'w1', started_at: '2026-10-18T16:02:11Z', last_set_at: '2026-10-18T16:40:00Z' });
});

test('live: a malformed record is no live workout, and the capability follows the key, not the value', () => {
  for (const bad of [{}, { workoutId: 'w1' }, { workoutId: '', startedAt: NOW }, { workoutId: 'w1', startedAt: 'soon' }, { workoutId: 5, startedAt: NOW }, 'x', 7, []]) {
    const got = ctx(base({ workoutLive: bad }));
    assert.equal(got.live, null, JSON.stringify(bad));
    assert.deepEqual(got.capabilities, { live: true }, JSON.stringify(bad));
  }
  // A set time that does not parse reads as no set yet; the workout itself is still there.
  assert.deepEqual(ctx(base({ workoutLive: { workoutId: 'w1', startedAt: NOW, lastSetAt: 'x' } })).live, { workout_id: 'w1', started_at: '2026-10-18T17:00:00Z', last_set_at: null });
  assert.deepEqual(ctx(base()).capabilities, { live: false });
});

test('coach: expiry is on the server clock, a record that is not a proposal is none, and cadence needs consent', () => {
  const rec = over => ({ pending: { id: 'p1', kind: 'review', createdAt: NOW - HOUR, expiresAt: NOW + HOUR, changes: [{}], ...over } });
  assert.equal(ctx(base(), { coachRecord: rec() }).coach.pending_id, 'p1');
  assert.equal(ctx(base(), { coachRecord: rec({ expiresAt: NOW - 1 }) }).coach, null);
  assert.equal(ctx(base(), { coachRecord: rec({ expiresAt: NOW }) }).coach?.pending_id, 'p1');
  for (const none of [undefined, null, {}, { pending: null }, rec({ id: '' }), rec({ id: 5 }), { pending: 'x' }]) assert.equal(ctx(base(), { coachRecord: none }).coach, null, JSON.stringify(none));
  assert.equal(ctx(base(), { coachRecord: rec({ changes: 'x' }) }).coach.changes, 0);
  assert.ok(!('cadence_on' in ctx(base(), { coachRecord: rec() }).coach), 'cadence moved out of `coach`');
});

test('coach_cadence_on: consent given and a cadence set, with or without a proposal pending', () => {
  const rec = { pending: { id: 'p1', createdAt: NOW - HOUR, expiresAt: NOW + HOUR, changes: [] } };
  for (const coachRecord of [undefined, rec]) {
    const on = coach => ctx(base({ coach }), { coachRecord }).coach_cadence_on;
    assert.equal(on({ consent: { agreedAt: 1 }, cadence: { weekly: { day: 0 } } }), true);
    assert.equal(on({ consent: { agreedAt: 1 }, cadence: { everyWorkouts: 3 } }), true);
    assert.equal(on({ consent: { agreedAt: 1 }, cadence: 'off' }), false);
    assert.equal(on({ consent: { agreedAt: 1 } }), false);
    assert.equal(on({ cadence: { everyWorkouts: 3 } }), false);
    assert.equal(on(undefined), false);
  }
  assert.equal(coachCadenceOn({ coach: { consent: { agreedAt: 1 }, cadence: { everyWorkouts: 3 } } }), true);
  assert.equal(coachCadenceOn(null), false);
});

test('Coach switched off on the server: coach null and coach_cadence_on false, whatever is stored', () => {
  const S = base({ coach: { consent: { agreedAt: 1 }, cadence: { everyWorkouts: 3 } } });
  const coachRecord = { pending: { id: 'p1', createdAt: NOW - HOUR, expiresAt: NOW + HOUR, changes: [{}] } };
  const on = ctx(S, { coachRecord });
  assert.deepEqual([on.coach?.pending_id, on.coach_cadence_on], ['p1', true]);
  const off = ctx(S, { coachRecord, coachOn: false });
  assert.deepEqual([off.coach, off.coach_cadence_on], [null, false]);
});

test('a state with the wrong shapes still answers: workouts, routines and reminder that are not what they should be', () => {
  const got = reminderContext({ workouts: 'x', routines: { a: 1 }, week: null, reminder: 'on', lang: 5 }, '2026-10-18', { now: NOW });
  assert.deepEqual(got, {
    lang: 'en', date: '2026-10-18', planned: null, workout_logged: false, excused: false, nudge: null,
    capabilities: { live: false }, live: null, coach: null, coach_cadence_on: false, legacy_reminder: null
  });
  assert.equal(reminderContext({ workouts: [null, 3, { d: '2026-10-18' }] }, '2026-10-18', { now: NOW }).workout_logged, true);
});

test('legacy_reminder is the five stored fields, as the preference import reads them', () => {
  const r = ctx(base({ reminder: { on: true, time: '17:30', tz: 'Europe/Lisbon', nudge: false, tone: 'drill', extra: 'x', lastFired: 1 } })).legacy_reminder;
  assert.deepEqual(r, { on: true, time: '17:30', tz: 'Europe/Lisbon', nudge: false, tone: 'drill' });
  assert.deepEqual(ctx(base({ reminder: { on: 1 } })).legacy_reminder, { on: true, time: null, tz: null, nudge: false, tone: 'friendly' });
  assert.equal(ctx(base({ reminder: null })).legacy_reminder, null);
});

test('planned names the stored routine; a plan that points at no routine is no plan', () => {
  assert.deepEqual(ctx(base({ routines: [{ id: 'push', name: 'Push A', emoji: '' }] })).planned, { routine_id: 'push', name: 'Push A', emoji: null });
  assert.equal(ctx(base({ routines: [{ id: 'push', emoji: '💪' }] })).planned.name, '');
});

test('nudgeDetail: the routine and how many missed days in a row it is, and nudgeFor still answers its routine id', () => {
  const S = { routines: [{ id: 'push', name: 'Push' }], week: { 1: 'push', 3: 'push', 5: 'push' }, dayPlan: {}, workouts: [{ id: 'w', d: '2026-09-04', routineId: 'push' }] };
  assert.deepEqual(nudgeDetail(S, '2026-09-07'), { routineId: 'push', missedStreak: 1 });
  assert.deepEqual(nudgeDetail(S, '2026-09-11'), { routineId: 'push', missedStreak: 3 });
  assert.equal(nudgeDetail(S, '2026-09-14'), null);
  assert.equal(nudgeDetail(S, '2026-09-08'), null);
  for (const d of ['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14', '2026-09-08']) assert.equal(nudgeFor(S, d), nudgeDetail(S, d)?.routineId ?? null, d);
});
