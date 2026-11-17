import { describe, expect, it } from 'vitest'
import * as Server from '../../../api/sync-stamps.js'
import { mergeStates, mergeBodyPhotos, mergeDeletions, stampChange, stampRestore, stampReplace, localExtras, resetIdsOf, sinceReset, highestStamp } from './sync-merge.js'

// Me photos M1: S.bodyPhotos (progress photos) is a list merged by id, a removal is a tombstone in
// S.deleted.bodyPhotos, and S.photoBackup is an ordinary stamped setting.
const T = 1_800_000_000_000
const clone = v => JSON.parse(JSON.stringify(v))
const ref = c => ({ kind: 'image', hash: c.repeat(64), mime: 'image/jpeg', size: 1, width: 1, height: 1, at: 1 })
const photo = (id, addedAt, c = 'a') => ({ id, d: '2026-10-20', ref: ref(c), addedAt })
const base = (bodyPhotos, over = {}) => ({
  unit: 'kg', restSec: 90, lang: 'en', week: {}, dayPlan: {},
  workouts: [], routines: [], bodyweight: [], customEx: [], favEx: [], exWeights: {}, exNotes: {}, barWeights: {},
  equipProfiles: [], gymCards: [], _ts: 0, ...(bodyPhotos ? { bodyPhotos } : {}), ...over,
})
const both = (a, b, opts) => [mergeStates(a, b, opts), mergeStates(b, a, opts)]
const ids = S => (S.bodyPhotos || []).map(p => p.id).sort()
const change = (prev, mut, wall) => { const n = clone(prev); mut(n); n._ts = stampChange(prev, n, wall); return n }

describe('mergeBodyPhotos', () => {
  it('is the union by id, the later addedAt of an id both hold, the first on a tie', () => {
    const a = [photo('p1', 10, 'a'), photo('p2', 10, 'b')]
    const b = [photo('p2', 20, 'c'), photo('p3', 5)]
    expect(mergeBodyPhotos(a, b)).toEqual([photo('p1', 10, 'a'), photo('p2', 20, 'c'), photo('p3', 5)])
    expect(mergeBodyPhotos([photo('p1', 10, 'a')], [photo('p1', 10, 'b')])).toEqual([photo('p1', 10, 'a')])
  })

  it('keeps an entry without an id once, and drops what is not an entry at all', () => {
    const odd = { d: '2026-10-20', ref: ref('d') }
    expect(mergeBodyPhotos([null, 3, odd], [clone(odd)])).toEqual([odd])
  })
})

describe('mergeStates: progress photos', () => {
  it('keeps the photos each device added, in either order and with a sign-in too', () => {
    const phone = base([photo('p1', T)])
    const desk = base([photo('p2', T + 1, 'b')], { _ts: 9 })
    for (const m of both(phone, desk)) expect(ids(m)).toEqual(['p1', 'p2'])
    for (const m of [mergeStates(phone, desk, { prefer: 'a' }), mergeStates(phone, desk, { prefer: 'b' })]) expect(ids(m)).toEqual(['p1', 'p2'])
  })

  it('a photo deleted on one device stays deleted against a device that still holds it', () => {
    const held = base([photo('p1', T), photo('p2', T)], { _ts: T + 50 })
    const deleted = base([photo('p2', T)], { deleted: { bodyPhotos: { p1: T + 10 } } })
    for (const m of both(held, deleted)) {
      expect(ids(m)).toEqual(['p2'])
      expect(m.deleted.bodyPhotos).toEqual({ p1: T + 10 })
    }
  })

  it('the tombstone wins a tie with when the photo was added', () => {
    const held = base([photo('p1', T)])
    const deleted = base([], { deleted: { bodyPhotos: { p1: T } } })
    for (const m of both(held, deleted)) expect(ids(m)).toEqual([])
  })

  it('an add-back (Undo) recorded after the removal brings the photo back everywhere', () => {
    const deleted = base([], { deleted: { bodyPhotos: { p1: T + 10 } } })
    const undone = base([photo('p1', T)], { deleted: { bodyPhotos: { p1: -(T + 20) } } })
    for (const m of both(deleted, undone)) expect(ids(m)).toEqual(['p1'])
  })

  it('the store\'s own change records the tombstone, and the server keeps it on the way through', () => {
    const before = base([photo('p1', T - 100), photo('p2', T - 100, 'b')], { _ts: T - 50 })
    const after = change(before, S => { S.bodyPhotos = S.bodyPhotos.filter(p => p.id !== 'p1') }, T)
    expect(after.deleted.bodyPhotos).toEqual({ p1: T })
    expect(highestStamp(after)).toBe(T)
    // PUT /api/data joins the records of removals with the stored ones (api/sync-stamps.js).
    const stored = Server.stampPut(clone(before), clone(after), { stamped: true, overRead: true, now: T + 1 })
    expect(stored.deleted.bodyPhotos).toEqual({ p1: T })
    expect(ids(stored)).toEqual(['p2'])
    expect(Server.mergeDeletions(before.deleted, after.deleted)).toEqual(mergeDeletions(before.deleted, after.deleted))
  })

  it('an older app that does not know the field never removes the photos, and no tombstone is made for them', () => {
    const stored = base([photo('p1', T - 100)], { _ts: T - 50, photoBackup: false })
    const old = clone(stored)
    delete old.bodyPhotos
    delete old.photoBackup
    old.restSec = 120
    const out = Server.stampPut(clone(stored), old, { stamped: false, overRead: true, now: T })
    expect(ids(out)).toEqual(['p1'])
    expect(out.photoBackup).toBe(false)
    expect(out.deleted?.bodyPhotos).toBeUndefined()
    expect(out.edited?.bodyPhotos).toBeUndefined()
  })

  it('Back up photos merges as a setting: the later choice wins, whichever copy is newer', () => {
    const start = base([photo('p1', T - 100)], { _ts: T - 50 })
    const phone = change(start, S => { S.photoBackup = true }, T + 10)
    const desk = change(start, S => { S.restSec = 60 }, T + 20)
    for (const m of both(phone, desk)) {
      expect(m.photoBackup).toBe(true)
      expect(m.restSec).toBe(60)
    }
    expect(phone.edited.bodyPhotos).toBeUndefined()
  })

  it('a restored backup brings back a photo whose removal is on record', () => {
    const backup = base([photo('p1', T - 100)])
    const now = base([], { deleted: { bodyPhotos: { p1: T } } })
    const restored = stampRestore(clone(backup), [now], T + 5)
    expect(restored.deleted.bodyPhotos.p1).toBe(-(T + 5))
    for (const m of both(restored, now)) expect(ids(m)).toEqual(['p1'])
  })

  it('a backup that replaces the profile records the photos it lacks as removed', () => {
    const cur = base([photo('p1', T - 100), photo('p2', T - 100, 'b')])
    const next = stampReplace(base([photo('p2', T - 100, 'b')]), [cur], T)
    expect(next.deleted.bodyPhotos).toEqual({ p1: T })
  })
})

describe('sign-in and reset', () => {
  it('a sign-in asks about the photos taken signed out, as it does about measurements', () => {
    const local = base([photo('p1', T), photo('p2', T)])
    const server = base([photo('p2', T)])
    expect(localExtras(local, server).setup).toBe(1)
    expect(localExtras(base([photo('p2', T)]), server).setup).toBeUndefined()
  })

  it('a reset names the photos it wiped, and a copy that missed it loses exactly those', () => {
    const before = base([photo('p1', T - 100)])
    const ids0 = resetIdsOf(before)
    expect(ids0.bodyPhotos).toEqual(['p1'])
    const stale = base([photo('p1', T - 100), photo('p9', T + 100)])
    expect(ids(sinceReset(stale, T, ids0))).toEqual(['p9'])
    // A reset from before names were kept judges by time.
    expect(ids(sinceReset(stale, T, null))).toEqual(['p9'])
  })
})
