import { describe, expect, it } from 'vitest'
import * as Server from '../../../api/sync-stamps.js'
import { mergeDeletions, mergeStates, stampChange } from './sync-merge.js'

// Me fix measure: a day's measurements deleted from the Edit drawer is a tombstone in
// S.deleted.measurements, keyed by the day and held against the entry's own `t` (DEL_LISTS and
// DEL_TIME, here and in api/sync-stamps.js). It must never come back from another device or a stale
// push; an Undo (an add-back, `-now`, with the entry re-stamped now) must bring it back everywhere.
const T = 1_800_000_000_000
const DAY = '2026-10-11'
const clone = v => JSON.parse(JSON.stringify(v))
const day = (t, waist = 84, d = DAY) => ({ d, t, waist, chest: 101.5, other: [] })
const base = (measurements, over = {}) => ({
  unit: 'kg', restSec: 90, lang: 'en', week: {}, dayPlan: {},
  workouts: [], routines: [], bodyweight: [], customEx: [], favEx: [], exWeights: {}, exNotes: {}, barWeights: {},
  equipProfiles: [], gymCards: [], measurements, _ts: 0, ...over,
})
const both = (a, b, opts) => [mergeStates(a, b, opts), mergeStates(b, a, opts)]
const days = S => (S.measurements || []).map(e => e.d).sort()
const on = (S, d = DAY) => (S.measurements || []).find(e => e.d === d) || null
const change = (prev, mut, wall) => { const n = clone(prev); mut(n); n._ts = stampChange(prev, n, wall); return n }
// What PUT /api/data does with the app's own push over the revision it read (api/sync-stamps.js).
const put = (stored, pushed, now) => Server.stampPut(clone(stored), clone(pushed), { stamped: true, overRead: true, now })

describe('a deleted day of measurements syncs as a tombstone', () => {
  const start = base([day(T - 100, 85, '2026-10-04'), day(T - 100)], { _ts: T - 50 })
  const deleted = change(start, S => { S.measurements = S.measurements.filter(e => e.d !== DAY) }, T)

  it('the store\'s change records it after the entry\'s own time, and the server keeps it', () => {
    expect(deleted.deleted.measurements).toEqual({ [DAY]: T })
    const stored = put(start, deleted, T + 1)
    expect(stored.deleted.measurements).toEqual({ [DAY]: T })
    expect(days(stored)).toEqual(['2026-10-04'])
    expect(Server.mergeDeletions(start.deleted, deleted.deleted)).toEqual(mergeDeletions(start.deleted, deleted.deleted))
  })

  it('stays deleted against a device that still holds the day, in both merge orders', () => {
    // The other device's copy is the newer one as a whole: it changed a setting since.
    const held = change(start, S => { S.restSec = 120 }, T + 50)
    for (const m of both(held, deleted)) {
      expect(days(m)).toEqual(['2026-10-04'])
      expect(m.deleted.measurements).toEqual({ [DAY]: T })
      expect(m.restSec).toBe(120)
    }
  })

  it('a stale push from a device still holding the day: refused, merged, and the day stays gone', () => {
    const stored = put(start, deleted, T + 1)
    // The phone read the copy before the delete and changed something else. Its push carries the old
    // baseRev, so PUT /api/data answers 409 with the stored copy (server.js); the phone merges that
    // and pushes again.
    const phone = change(start, S => { S.restSec = 60 }, T + 30)
    expect(on(phone)).not.toBeNull()
    for (const merged of both(phone, stored)) {
      expect(on(merged)).toBeNull()
      expect(merged.restSec).toBe(60)
      const next = change(merged, S => { S.lang = 'de' }, T + 40)
      // No add-back: the phone never brought the day in again, it only still held it.
      expect(next.deleted.measurements[DAY]).toBe(T)
      const after = put(stored, next, T + 41)
      expect(on(after)).toBeNull()
      expect(after.deleted.measurements[DAY]).toBe(T)
    }
  })

  it('a day logged again after the delete, on either device, is kept in both merge orders', () => {
    const relogged = change(start, S => { S.measurements = S.measurements.filter(e => e.d !== DAY).concat(day(T + 20, 82)) }, T + 20)
    for (const m of both(relogged, deleted)) expect(on(m)).toMatchObject({ waist: 82, t: T + 20 })
  })

  it('an Undo brings back the exact readings everywhere, over a stale copy of the day', () => {
    const undone = change(deleted, S => { S.measurements.push(day(T + 8, 84)) }, T + 8)
    expect(undone.deleted.measurements[DAY]).toBe(-(T + 8))
    // A third device still holding the day as it was before the delete, with another reading.
    const stale = base([day(T - 100, 85, '2026-10-04'), day(T - 200, 90)], { _ts: T + 60 })
    for (const m of both(undone, deleted)) expect(on(m)).toMatchObject({ waist: 84, chest: 101.5 })
    for (const m of both(undone, stale)) expect(on(m)).toMatchObject({ waist: 84, t: T + 8 })
    const stored = put(put(start, deleted, T + 1), undone, T + 9)
    expect(on(stored)).toMatchObject({ waist: 84 })
    expect(stored.deleted.measurements[DAY]).toBe(-(T + 8))
  })

  it('a later delete of the restored day wins over the Undo, in both merge orders', () => {
    const undone = change(deleted, S => { S.measurements.push(day(T + 8, 84)) }, T + 8)
    const again = change(undone, S => { S.measurements = S.measurements.filter(e => e.d !== DAY) }, T + 100)
    for (const m of both(again, undone)) {
      expect(on(m)).toBeNull()
      expect(m.deleted.measurements[DAY]).toBe(T + 100)
    }
  })
})
