import { describe, it, expect } from 'vitest'
import { allPhotos, addPhoto, removePhoto, restorePhoto, setPhotoBackup, localOnlyCount, photoState } from './photos.js'
import { referencedHashes } from '../media-refs.js'
import { stampChange, mergeStates } from '../sync-merge.js'

const hex = c => c.repeat(64)
const img = (c, over = {}) => ({ kind: 'image', hash: hex(c), mime: 'image/jpeg', size: 1000, width: 800, height: 600, at: 1, ...over })
const own = (id, d, c, addedAt = 1) => ({ id, d, ref: img(c), addedAt })
const workout = (id, d, start, ...refs) => ({ id, d, start, end: start + 1, entries: [], media: refs })
const clone = v => JSON.parse(JSON.stringify(v))
// What useStore's update() does around a mutation: a clone, the change, the stamps.
const update = (S, mut, wall = 1_800_000_000_000) => { const n = clone(S); mut(n); n._ts = stampChange(S, n, wall); return n }

describe('allPhotos', () => {
  it('lists own photos and the stills of workouts, newest day first, with that day\'s weigh-in', () => {
    const S = {
      unit: 'kg', photoBackup: false,
      bodyweight: [{ d: '2026-10-20', w: 81.5, t: 5 }, { d: '2026-10-18', w: 82, t: 1 }],
      bodyPhotos: [own('p1', '2026-10-18', 'a', 10), own('p2', '2026-10-20', 'b', 20)],
      workouts: [workout('w1', '2026-10-19', 100, img('c'), { ...img('d'), kind: 'video', mime: 'video/mp4' })]
    }
    const got = allPhotos(S)
    expect(got.map(p => [p.key, p.d, p.source, p.weight, p.backup])).toEqual([
      ['own:p2', '2026-10-20', 'own', 81.5, false],
      ['workout:w1:' + hex('c'), '2026-10-19', 'workout', null, true],
      ['own:p1', '2026-10-18', 'own', 82, false]
    ])
    expect(got[0].ref).toEqual(img('b'))
  })

  it('on the same day, the latest added or logged comes first', () => {
    const S = { bodyPhotos: [own('p1', '2026-10-20', 'a', 10), own('p2', '2026-10-20', 'b', 300)], workouts: [workout('w1', '2026-10-20', 200, img('c'))] }
    expect(allPhotos(S).map(p => p.key)).toEqual(['own:p2', 'workout:w1:' + hex('c'), 'own:p1'])
  })

  it('an own photo is backed up with the switch on, or when a workout holds the same file', () => {
    const S = { bodyPhotos: [own('p1', '2026-10-20', 'a'), own('p2', '2026-10-20', 'b')], workouts: [workout('w1', '2026-10-01', 1, img('b'))] }
    expect(allPhotos(S).filter(p => p.source === 'own').map(p => [p.id, p.backup])).toEqual([['p1', false], ['p2', true]])
    expect(allPhotos({ ...S, photoBackup: true }).filter(p => p.source === 'own').every(p => p.backup)).toBe(true)
  })

  it('leaves out, and leaves alone, an own entry it cannot read', () => {
    const S = { bodyPhotos: [null, { id: 'x', d: '2026-10-20', ref: { hash: 'nope' } }, { id: 'v', d: '2026-10-20', ref: img('a', { kind: 'video', mime: 'video/mp4' }) }, { id: 'n', d: 'yesterday', ref: img('b') }, own('ok', '2026-10-20', 'c')] }
    const before = clone(S)
    expect(allPhotos(S).map(p => p.key)).toEqual(['own:ok'])
    expect(S).toEqual(before)
    expect(allPhotos(null)).toEqual([])
  })
})

describe('addPhoto', () => {
  it('adds a still with a new id and when it was added', () => {
    const S = { bodyPhotos: [] }
    expect(addPhoto(S, { d: '2026-10-20', ref: img('a') }, 123)).toBe('added')
    expect(S.bodyPhotos).toHaveLength(1)
    expect(S.bodyPhotos[0]).toMatchObject({ d: '2026-10-20', ref: img('a'), addedAt: 123 })
    expect(typeof S.bodyPhotos[0].id).toBe('string')
    expect(referencedHashes(S)).toEqual(new Set([hex('a')]))
  })

  it('works on a profile saved before the field existed', () => {
    const S = {}
    expect(addPhoto(S, { d: '2026-10-20', ref: img('a') })).toBe('added')
    expect(S.bodyPhotos).toHaveLength(1)
  })

  it('refuses the same file twice on one day, own or a workout\'s, but takes it on another day', () => {
    const S = { bodyPhotos: [own('p1', '2026-10-20', 'a')], workouts: [workout('w1', '2026-10-21', 1, img('b'))] }
    expect(addPhoto(S, { d: '2026-10-20', ref: img('a') })).toBe('dup')
    expect(addPhoto(S, { d: '2026-10-21', ref: img('b') })).toBe('dup')
    expect(addPhoto(S, { d: '2026-10-22', ref: img('a') })).toBe('added')
    expect(S.bodyPhotos).toHaveLength(2)
  })

  it('refuses a video, a malformed ref and a day that is not a real one', () => {
    const S = { bodyPhotos: [] }
    expect(addPhoto(S, { d: '2026-10-20', ref: img('a', { kind: 'video', mime: 'video/mp4' }) })).toBe('invalid')
    expect(addPhoto(S, { d: '2026-10-20', ref: { hash: hex('a') } })).toBe('invalid')
    expect(addPhoto(S, { d: '2026-02-30', ref: img('a') })).toBe('invalid')
    expect(addPhoto(S, { d: '20/10/2026', ref: img('a') })).toBe('invalid')
    expect(addPhoto(S, {})).toBe('invalid')
    expect(S.bodyPhotos).toEqual([])
  })
})

describe('removePhoto', () => {
  it('takes an own photo out and leaves its tombstone, never before it was added', () => {
    const S = { bodyPhotos: [own('p1', '2026-10-20', 'a', 500), own('p2', '2026-10-20', 'b', 10)] }
    const gone = removePhoto(S, 'own:p1', 100)
    expect(gone).toEqual({ source: 'own', entry: own('p1', '2026-10-20', 'a', 500) })
    expect(S.bodyPhotos.map(p => p.id)).toEqual(['p2'])
    expect(S.deleted.bodyPhotos).toEqual({ p1: 501 })
    expect(referencedHashes(S)).toEqual(new Set([hex('b')]))
  })

  it('through the store\'s update(), the tombstone is the change\'s own stamp, and a merge with a copy still holding it drops it', () => {
    const T = 1_800_000_000_000
    const base = { _ts: T - 10, bodyPhotos: [own('p1', '2026-10-20', 'a', T - 100)] }
    const after = update(base, S => removePhoto(S, 'own:p1'), T)
    expect(after.deleted.bodyPhotos.p1).toBeGreaterThan(T - 100)
    for (const m of [mergeStates(after, base), mergeStates(base, after)]) {
      expect(m.bodyPhotos).toEqual([])
      expect(m.deleted.bodyPhotos.p1).toBe(after.deleted.bodyPhotos.p1)
    }
  })

  it('takes a workout\'s photo off its workout, and nothing else', () => {
    const S = { workouts: [workout('w1', '2026-10-19', 100, img('c'), img('d'))], bodyPhotos: [own('p1', '2026-10-19', 'c')] }
    const gone = removePhoto(S, 'workout:w1:' + hex('c'))
    expect(gone).toMatchObject({ source: 'workout', ref: img('c') })
    expect(S.workouts[0].media.map(m => m.hash)).toEqual([hex('d')])
    expect(S.bodyPhotos).toHaveLength(1)
    expect(referencedHashes(S).has(hex('c'))).toBe(true)   // the own photo still keeps the file
  })

  it('returns null and changes nothing for a key it does not know', () => {
    const S = { bodyPhotos: [own('p1', '2026-10-20', 'a')], workouts: [] }
    const before = clone(S)
    for (const k of ['own:nope', 'workout:w9:' + hex('a'), 'p1', null]) expect(removePhoto(S, k)).toBe(null)
    expect(S).toEqual(before)
  })
})

describe('restorePhoto', () => {
  it('puts the entry back and the store records the add-back over the tombstone', () => {
    const T = 1_800_000_000_000
    let gone = null
    const base = { _ts: T - 10, bodyPhotos: [own('p1', '2026-10-20', 'a', T - 100)] }
    const removed = update(base, S => { gone = removePhoto(S, 'own:p1') }, T)
    const back = update(removed, S => { expect(restorePhoto(S, gone.entry)).toBe(true) }, T + 5)
    expect(back.bodyPhotos.map(p => p.id)).toEqual(['p1'])
    expect(back.deleted.bodyPhotos.p1).toBeLessThan(0)
    // The other device still has the removal only: the add-back wins there too.
    expect(mergeStates(removed, back).bodyPhotos.map(p => p.id)).toEqual(['p1'])
    expect(mergeStates(back, removed).bodyPhotos.map(p => p.id)).toEqual(['p1'])
  })

  it('does not add a second copy of an id that is there', () => {
    const S = { bodyPhotos: [own('p1', '2026-10-20', 'a')] }
    expect(restorePhoto(S, own('p1', '2026-10-20', 'a'))).toBe(false)
    expect(S.bodyPhotos).toHaveLength(1)
  })
})

describe('setPhotoBackup and localOnlyCount', () => {
  it('counts own photos not uploaded: none with the switch on, none that a workout also holds', () => {
    const S = { bodyPhotos: [own('p1', '2026-10-20', 'a'), own('p2', '2026-10-21', 'b')], workouts: [workout('w1', '2026-10-01', 1, img('b'), img('c'))] }
    expect(localOnlyCount(S)).toBe(1)
    setPhotoBackup(S, true)
    expect(S.photoBackup).toBe(true)
    expect(localOnlyCount(S)).toBe(0)
    setPhotoBackup(S, 'yes')
    expect(S.photoBackup).toBe(false)
    expect(localOnlyCount(S)).toBe(1)
  })
})

describe('photoState', () => {
  it('here when this device has the file; on the server when it is backed up; missing otherwise', () => {
    expect(photoState({ backup: false }, { local: true })).toBe('local')
    expect(photoState({ backup: true })).toBe('remote')
    expect(photoState({ backup: true }, { fetch: 'missing' })).toBe('missing')
    expect(photoState({ backup: false })).toBe('missing')
  })
})
