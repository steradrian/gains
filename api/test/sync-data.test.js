/* sync-data.js: what the hub's data routes read out of a state and write into it. The routes
   themselves, over HTTP, are in server-sync.test.js. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toKg, fromKg, isDate, workoutId, workoutItem, trackWorkouts, changesSince, decodeCursor,
  bodyweightView, weighInOf, withWeighIn, withoutWeighIn
} from '../sync-data.js';

const set = (over = {}) => ({ w: 60, r: 8, done: true, ...over });
const workout = (id, over = {}) => ({
  id, d: '2026-10-10', start: 1_760_000_000_000, end: 1_760_000_000_000 + 58 * 60000, name: 'Push day',
  routineId: 'r1', bw: 80, _ts: 1_760_000_100_000,
  entries: [{ id: '0001', sets: [set(), set(), set({ done: false })] }],
  ...over
});
const doc = (rev, wid, over = {}) => ({ unit: 'kg', _rev: rev, _wid: wid, workouts: [], ...over });
// Every page of one pass, as the hub reads it.
function pass(log, S, opts) {
  const pages = [];
  let cursor = null;
  do {
    const p = changesSince(log, S, { ...opts, cursor: cursor && decodeCursor(cursor) });
    pages.push(p);
    cursor = p.next_cursor;
  } while (cursor);
  return {
    full: pages.every(p => p.full),
    items: pages.flatMap(p => p.items.map(i => i.id)),
    deleted: pages.flatMap(p => p.deleted.map(d => d.id)),
    pages: pages.length
  };
}

describe('units', () => {
  it('kg on the wire, the profile’s unit in the state, both ways', () => {
    assert.equal(fromKg(78.4, 'kg'), 78.4);
    assert.equal(fromKg(78.4, 'lb'), 172.8);
    assert.equal(toKg(172.8, 'lb'), 78.38);
    assert.equal(toKg(78.4, 'kg'), 78.4);
  });

  it('a weigh-in in lb read as kg and written back lands on the same 0.1 lb', () => {
    for (let lb = 90; lb <= 400; lb = Math.round((lb + 0.1) * 10) / 10) {
      assert.equal(fromKg(toKg(lb, 'lb'), 'lb'), lb, `${lb} lb`);
    }
  });

  it('a kg value written to an lb profile and read back is within 0.05 kg', () => {
    for (let kg = 40; kg <= 200; kg = Math.round((kg + 0.1) * 10) / 10) {
      assert.ok(Math.abs(toKg(fromKg(kg, 'lb'), 'lb') - kg) <= 0.05, `${kg} kg`);
    }
  });

  it('dates are real YYYY-MM-DD dates', () => {
    for (const d of ['2026-10-14', '2024-02-29']) assert.equal(isDate(d), true, d);
    for (const d of ['2026-02-30', '2025-02-29', '2026-1-01', '2026-10-14T00:00', '', null, 20261014]) assert.equal(isDate(d), false, String(d));
  });
});

describe('workoutItem', () => {
  it('summarises a session: done sets, duration, the body weight used in kg, the date as stored', () => {
    const it = workoutItem(workout('w1'), 'kg');
    assert.equal(it.id, 'w1');
    assert.equal(it.date, '2026-10-10');
    assert.equal(it.duration_min, 58);
    assert.equal(it.sets_done, 2);
    assert.equal(it.strength_sets, 2);
    assert.deepEqual(it.cardio, []);
    assert.equal(it.distance_km, null);
    assert.equal(it.bodyweight_kg, 80);
    assert.equal(it.routine_id, 'r1');
    assert.equal(it.edited_at, 1_760_000_100_000);
    assert.match(it.content_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(workoutItem(workout('w1', { bw: 176.4 }), 'lb').bodyweight_kg, 80);
  });

  it('a unit switch, which converts every stored weight, leaves the hash where it was', () => {
    const LB = 2.2046226218;
    for (let kg = 50; kg <= 150; kg = Math.round((kg + 0.1) * 10) / 10) {
      const lb = Math.round(kg * LB * 10) / 10;   // the app's switch (lib/units.js convertBodyWeight)
      assert.equal(workoutItem(workout('w1', { bw: lb }), 'lb').content_hash, workoutItem(workout('w1', { bw: kg }), 'kg').content_hash, `${kg} kg`);
    }
  });

  it('reads cardio rows: minutes, km/h and the distance they make', () => {
    const w = workout('w2', {
      entries: [
        { id: 'run', target: { mode: 'cardio' }, sets: [{ min: 30, speed: 10, done: true }, { min: 10, speed: 6, done: true }] },
        { id: 'bike', sets: [{ min: 20, done: true }] },
        { id: 'plank', target: { mode: 'time' }, sets: [{ sec: 60, min: 1, done: true }] },
        { id: 'curl', sets: [set(), { sides: { L: { w: 10, r: 8, done: true }, R: { w: 10, r: 8, done: false } } }] }
      ]
    });
    const it = workoutItem(w, 'kg');
    assert.deepEqual(it.cardio, [{ min: 30, speed_kmh: 10, km: 5 }, { min: 10, speed_kmh: 6, km: 1 }, { min: 20, speed_kmh: null, km: null }]);
    assert.equal(it.distance_km, 6);
    assert.equal(it.sets_done, 6);
    assert.equal(it.strength_sets, 3);
  });

  it('a session without a usable start or end has no duration', () => {
    assert.equal(workoutItem(workout('w', { end: null }), 'kg').duration_min, null);
    assert.equal(workoutItem(workout('w', { end: 1 }), 'kg').duration_min, null);
  });

  it('the hash moves with what the hub reads, not with a note or a photo', () => {
    const a = workoutItem(workout('w1'), 'kg').content_hash;
    assert.equal(workoutItem(workout('w1', { note: 'felt good', media: [{ hash: 'x' }], _ts: 9 }), 'kg').content_hash, a);
    assert.notEqual(workoutItem(workout('w1', { name: 'Pull day' }), 'kg').content_hash, a);
    assert.notEqual(workoutItem(workout('w1', { d: '2026-10-11' }), 'kg').content_hash, a);
  });

  it('a workout without an id goes by the data contract’s d<date>s<start>; one with neither has no name', () => {
    assert.equal(workoutId({ d: '2026-10-10', start: 123 }), 'd2026-10-10s123');
    assert.equal(workoutId({ d: '2026-10-10' }), null);
    assert.equal(workoutItem({ d: '2026-10-10' }, 'kg'), null);
  });
});

describe('trackWorkouts and changesSince', () => {
  it('a hub with no revision yet gets everything, in full', () => {
    const S = doc(5, 'a1', { workouts: [workout('w1'), workout('w2')], deleted: { workouts: { w0: 100 } } });
    const log = trackWorkouts(undefined, S);
    const p = pass(log, S, { since: null });
    assert.equal(p.full, true);
    assert.deepEqual(p.items, ['w1', 'w2']);
    assert.deepEqual(p.deleted, ['w0']);
  });

  it('since a revision: what changed after the pass before it, edits and removals included', () => {
    let S = doc(5, 'a1', { workouts: [workout('w1'), workout('w2'), workout('w3')] });
    let log = trackWorkouts(undefined, S);
    assert.equal(pass(log, S, { since: 5 }).full, true, 'no pass of this log ended at 5 yet');

    S = doc(6, 'a2', { workouts: [workout('w1', { name: 'Renamed' }), workout('w3'), workout('w4')], deleted: { workouts: { w2: 200 } } });
    log = trackWorkouts(log, S);
    // 5 is the first pass this log served: the one before it is everything.
    assert.equal(pass(log, S, { since: 5 }).full, true);

    // A change the hub cannot see is no change; a write of something else is none either. What the
    // pass at 6 handed out (w1, w4, w2 gone) comes once more, then no more.
    S = doc(7, 'a3', { workouts: [workout('w1', { name: 'Renamed', note: 'x' }), workout('w3'), workout('w4')], targetW: 75 });
    log = trackWorkouts(log, S);
    const p = pass(log, S, { since: 6 });
    assert.equal(p.full, false);
    assert.deepEqual(p.items, ['w1', 'w4']);
    assert.deepEqual(p.deleted, ['w2']);
    assert.deepEqual(changesSince(log, S, { since: 6 }).deleted, [{ id: 'w2', deleted_at: 200 }]);
    // Brought back after a removal: an item again, and no longer gone.
    S = doc(8, 'a4', { workouts: [...S.workouts, workout('w2')] });
    log = trackWorkouts(log, S);
    assert.deepEqual(pass(log, S, { since: 7 }), { full: false, items: ['w2'], deleted: [], pages: 1 });
  });

  it('an answer lost on the way loses nothing, whichever revision the hub asks from next', () => {
    let S = doc(10, 'g1', { workouts: [workout('w1'), workout('w2')] });
    let log = trackWorkouts(undefined, S);
    pass(log, S, { since: null });
    S = doc(11, 'g2', { _wids: ['g1'], workouts: S.workouts });
    log = trackWorkouts(log, S);
    pass(log, S, { since: 10 });                         // passes ended at 10 and 11; the hub has 11
    // w1 is edited (12) and a pass answers it, but the answer never arrives.
    S = doc(12, 'g3', { _wids: ['g1', 'g2'], workouts: [workout('w1', { name: 'Edited' }), workout('w2')] });
    log = trackWorkouts(log, S);
    assert.deepEqual(pass(log, S, { since: 11 }).items, ['w1']);
    // The hub's own weigh-in write moves the document to 13.
    S = doc(13, 'g4', { _wids: ['g1', 'g2', 'g3'], workouts: S.workouts });
    log = trackWorkouts(log, S);
    // A revision this route never ended a pass at (the write's own): everything.
    const p = pass(log, S, { since: 13, wid: 'g4' });
    assert.equal(p.full, true);
    assert.ok(p.items.includes('w1'));
    // Or the hub's own last revision, or the lost one's (a write that answered 12 too).
    for (const since of [11, 12]) {
      const q = pass(log, S, { since, wid: since === 11 ? 'g2' : 'g3' });
      assert.equal(q.full, false, `since ${since}`);
      assert.ok(q.items.includes('w1'), `since ${since}: the edit still comes`);
    }
  });

  it('pages in revision order and a change between pages is not missed', () => {
    const ids = Array.from({ length: 25 }, (_, i) => `w${String(i).padStart(2, '0')}`);
    let S = doc(1, 'b1', { workouts: ids.map(id => workout(id)) });
    let log = trackWorkouts(undefined, S);
    const first = changesSince(log, S, { since: null, limit: 10 });
    assert.equal(first.items.length, 10);
    assert.ok(first.next_cursor);
    // A workout already handed out is edited, and a new one logged, before the next page.
    S = doc(2, 'b2', { workouts: [...S.workouts.map(w => (w.id === 'w00' ? { ...w, name: 'Edited' } : w)), workout('w99')] });
    log = trackWorkouts(log, S);
    const seen = [...first.items.map(i => i.id)];
    let cursor = first.next_cursor;
    while (cursor) {
      const p = changesSince(log, S, { cursor: decodeCursor(cursor), limit: 10 });
      seen.push(...p.items.map(i => i.id));
      cursor = p.next_cursor;
    }
    assert.deepEqual(new Set(seen), new Set([...ids, 'w99']));
    assert.equal(seen.filter(id => id === 'w00').length, 2, 'the edited one comes again, as edited');
    assert.equal(log.items.get('w00').name, 'Edited');
  });

  it('a log started over (a restart, a restore) gives a hub from before it everything again', () => {
    const S = doc(9, 'c1', { workouts: [workout('w1')], deleted: { workouts: { 'w0': 50, '2026-01-01|123': 60 } } });
    const log = trackWorkouts(undefined, S);
    // Even at the very revision: what the hub was given at 9 came from another log, or not from here.
    const p = pass(log, S, { since: 9 });
    assert.equal(p.full, true);
    assert.deepEqual(p.items, ['w1']);
    assert.deepEqual(p.deleted.sort(), ['d2026-01-01s123', 'w0']);
  });

  it('a revision ahead of the profile, or a write id it does not descend from, is a full pass', () => {
    let S = doc(4, 'd2', { _wids: ['d1'], workouts: [workout('w1')] });
    let log = trackWorkouts(undefined, S);
    pass(log, S, { since: null });
    S = doc(5, 'd3', { _wids: ['d1', 'd2'], workouts: [workout('w1')] });
    log = trackWorkouts(log, S);
    pass(log, S, { since: 4 });
    assert.equal(pass(log, S, { since: 12 }).full, true);
    assert.equal(pass(log, S, { since: 5, wid: 'ffff' }).full, true);
    assert.equal(pass(log, S, { since: 5, wid: 'd3' }).full, false);
    assert.equal(pass(log, S, { since: 5, wid: 'd2' }).full, false);
  });

  it('the same revision with another write id starts the log over', () => {
    const log = trackWorkouts(undefined, doc(4, 'e1', { workouts: [workout('w1')] }));
    const S = doc(4, 'e2', { workouts: [workout('w1', { name: 'Other' })] });
    const next = trackWorkouts(log, S);
    assert.notEqual(next, log);
    assert.equal(next.items.get('w1').name, 'Other');
  });

  it('a cursor from before the log started over starts the pass over, in full', () => {
    let S = doc(1, 'f1', { workouts: [workout('w1'), workout('w2')] });
    let log = trackWorkouts(undefined, S);
    const first = changesSince(log, S, { since: null, limit: 1 });
    S = doc(1, 'f9', { workouts: [workout('w1'), workout('w2')] });
    log = trackWorkouts(log, S);
    const p = changesSince(log, S, { cursor: decodeCursor(first.next_cursor), limit: 10 });
    assert.equal(p.full, true);
    assert.deepEqual(p.items.map(i => i.id), ['w1', 'w2']);
  });

  it('refuses a cursor it did not make', () => {
    for (const c of ['', 'abc', '!!', Buffer.from('{"s":1}').toString('base64url'), 'x'.repeat(600)]) assert.equal(decodeCursor(c), null, c);
  });
});

describe('body weight', () => {
  const S = {
    unit: 'lb', _rev: 3,
    bodyweight: [
      { d: '2026-10-01', w: 172.8, t: 100 }, { d: '2026-10-02', w: 173.5, t: 200 }, { d: '2026-10-02', w: 174, t: 300 },
      { d: '2026-10-03', w: 175, t: 100 }, { d: '2026-10-04', w: 'x', t: 1 }
    ],
    deleted: { bodyweight: { '2026-10-03': 150, '2026-09-30': 90 } }
  };

  it('one value per date in kg, the later entry of a day, none where a later removal is on record', () => {
    const v = bodyweightView(S);
    assert.equal(v.unit, 'lb');
    assert.deepEqual(v.items, [{ date: '2026-10-01', kg: 78.38, t: 100 }, { date: '2026-10-02', kg: 78.93, t: 300 }]);
    assert.deepEqual(v.deleted, [{ date: '2026-09-30', deleted_at: 90 }, { date: '2026-10-03', deleted_at: 150 }]);
    assert.deepEqual(bodyweightView(S, { from: '2026-10-02', to: '2026-10-03' }).items.map(i => i.date), ['2026-10-02']);
  });

  it('a write stores the profile’s unit and a t later than anything the day or the document holds', () => {
    const next = withWeighIn(S, '2026-10-02', 80, { now: 50 });
    const day = next.bodyweight.filter(e => e.d === '2026-10-02');
    assert.equal(day.length, 1, 'one entry for the day');
    assert.equal(day[0].w, 176.4);
    assert.ok(day[0].t > 300);
    assert.deepEqual(weighInOf(next, '2026-10-02').kg, 80.01);
    assert.deepEqual(S.bodyweight.length, 5, 'the stored copy is left as it was');
    // Over a removal on record: later than it, so every device keeps it.
    const back = withWeighIn(S, '2026-10-03', 79, { now: 50 });
    assert.ok(back.bodyweight.find(e => e.d === '2026-10-03').t > 150);
    assert.equal(weighInOf(back, '2026-10-03').kg, 79.02, '174.2 lb');
  });

  it('stamps with the server’s clock, never ahead of it, and moves the document’s _ts to the same', () => {
    const now = 1_760_000_000_000;
    const next = withWeighIn({ ...S, _ts: now - 5000 }, '2026-10-05', 79, { now });
    assert.equal(next.bodyweight.find(e => e.d === '2026-10-05').t, now);
    assert.equal(next._ts, now);
    const gone = withoutWeighIn({ ...S, _ts: now - 5000 }, '2026-10-01', { now });
    assert.equal(gone.deleted.bodyweight['2026-10-01'], now);
    assert.equal(gone._ts, now);
  });

  it('writing back what was read is no change, to within half the stored step', () => {
    assert.equal(withWeighIn(S, '2026-10-01', 78.38), null);
    for (const [unit, w] of [['kg', 78.4], ['kg', 80.45], ['lb', 180.25], ['lb', 172.8], ['lb', 176.45]]) {
      const P = { unit, bodyweight: [{ d: '2026-10-01', w, t: 1 }] };
      assert.equal(withWeighIn(P, '2026-10-01', weighInOf(P, '2026-10-01').kg), null, `${w} ${unit}`);
    }
    // A step the app can show is a change.
    assert.notEqual(withWeighIn({ unit: 'kg', bodyweight: [{ d: '2026-10-01', w: 80.45, t: 1 }] }, '2026-10-01', 80.55), null);
    assert.notEqual(withWeighIn({ unit: 'lb', bodyweight: [{ d: '2026-10-01', w: 180.2, t: 1 }] }, '2026-10-01', 81.78), null);
  });

  it('keeps what else the app stored on the weigh-in', () => {
    const next = withWeighIn({ unit: 'kg', bodyweight: [{ d: '2026-10-01', w: 78, t: 1, src: 'scale' }] }, '2026-10-01', 79);
    assert.equal(next.bodyweight[0].src, 'scale');
  });

  it('a removal takes every entry of the day and puts a removal on record later than them', () => {
    const next = withoutWeighIn(S, '2026-10-02', { now: 50 });
    assert.equal(next.bodyweight.some(e => e.d === '2026-10-02'), false);
    assert.ok(next.deleted.bodyweight['2026-10-02'] > 300);
    assert.equal(withoutWeighIn(S, '2026-10-03'), null, 'already removed');
    assert.equal(withoutWeighIn(S, '2026-11-01'), null, 'never there');
  });
});
