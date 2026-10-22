import { describe, expect, it } from 'vitest'
import { fmtDate } from '../../../lib/format.js'
import { backupSub, photosFooter, photosOf, photosSub, tileText } from './photos-data.js'

const hex = c => c.repeat(64)
const img = c => ({ kind: 'image', hash: hex(c), mime: 'image/jpeg', size: 1000, width: 800, height: 600, at: 1 })
const own = (id, d, c) => ({ id, d, ref: img(c), addedAt: 10 })
const workout = (id, d, c) => ({ id, d, start: 100, end: 101, entries: [], media: [img(c)] })

const SIX = {
  unit: 'kg', photoBackup: false,
  bodyweight: [{ d: '2026-10-18', w: 81.4, t: 1 }],
  bodyPhotos: [
    own('p1', '2026-10-18', 'a'), own('p2', '2026-10-04', 'b'), own('p3', '2026-09-20', 'c'),
    own('p4', '2026-09-06', 'd'), own('p5', '2026-08-23', 'e'), own('p6', '2026-08-02', 'f'),
  ],
  workouts: [],
}

describe('photosOf', () => {
  it('is empty with no photos', () => {
    expect(photosOf({ unit: 'kg', bodyPhotos: [], workouts: [] })).toMatchObject({ empty: true, count: 0, since: null, canCompare: false })
  })

  it('counts the photos newest first, from the oldest day, with Back up photos off', () => {
    const data = photosOf(SIX)
    expect(data).toMatchObject({ empty: false, count: 6, since: '2026-08-02', backupOn: false, localOnly: 6, allLocal: true, header: 'phone', canCompare: true })
    expect(data.photos.map(p => p.d)[0]).toBe('2026-10-18')
    expect(data.photos[0].weight).toBe(81.4)
  })

  it('reads "In your account" once nothing is held on the phone', () => {
    expect(photosOf({ ...SIX, photoBackup: true })).toMatchObject({ backupOn: true, localOnly: 0, allLocal: false, header: 'account' })
  })

  it('a mix of workout photos and local ones is not "only on this phone"', () => {
    const data = photosOf({ ...SIX, bodyPhotos: SIX.bodyPhotos.slice(0, 2), workouts: [workout('w1', '2026-10-10', '9')] })
    expect(data).toMatchObject({ count: 3, localOnly: 2, allLocal: false, header: 'phone' })
  })

  it('one photo cannot be compared', () => {
    expect(photosOf({ ...SIX, bodyPhotos: SIX.bodyPhotos.slice(0, 1) })).toMatchObject({ count: 1, canCompare: false })
  })
})

describe('the copy', () => {
  it('the page line says how many are on the phone and since when', () => {
    expect(photosSub(photosOf(SIX))).toBe('6 photos on this phone · since ' + fmtDate('2026-08-02', true))
    expect(photosSub(photosOf({ ...SIX, bodyPhotos: SIX.bodyPhotos.slice(0, 1) }))).toBe('1 photo on this phone · since ' + fmtDate('2026-10-18', true))
  })

  it('says backed up only when nothing is held on the phone, and nothing with no photos', () => {
    expect(photosSub(photosOf({ ...SIX, photoBackup: true }))).toBe('6 photos · backed up')
    expect(photosSub(photosOf({ bodyPhotos: [] }))).toBeUndefined()
  })

  it('the backup row states what the switch does, in both states', () => {
    expect(backupSub(false)).toBe('Off · turn on to keep them across devices')
    expect(backupSub(true)).toBe('On · kept across your devices')
  })

  it('the footer claims storage only as the data allows', () => {
    expect(photosFooter(photosOf(SIX))).toBe('Stored on this phone only. Only you see them; Friends never do.')
    expect(photosFooter(photosOf({ ...SIX, photoBackup: true }))).toBe('Backed up to your account. Only you see them; Friends never do.')
    const mixed = photosOf({ ...SIX, bodyPhotos: SIX.bodyPhotos.slice(0, 2), workouts: [workout('w1', '2026-10-10', '9')] })
    expect(photosFooter(mixed)).toBe('Only you see them; Friends never do.')
  })

  it('never says encrypted or a cadence', () => {
    const all = [photosSub(photosOf(SIX)), backupSub(true), backupSub(false), photosFooter(photosOf(SIX)), photosFooter(photosOf({ ...SIX, photoBackup: true }))].join(' ')
    expect(all).not.toMatch(/encrypt|every 2 weeks/i)
  })
})

describe('tileText', () => {
  it('names the day and that day\'s weight in the profile\'s unit', () => {
    const [first] = photosOf(SIX).photos
    expect(tileText(first, 'kg')).toEqual({ date: fmtDate('2026-10-18', true), weight: '81.4 kg', label: fmtDate('2026-10-18', true) + ' · 81.4 kg' })
  })

  it('leaves the weight out when there was no weigh-in', () => {
    const second = photosOf(SIX).photos[1]
    expect(tileText(second, 'kg')).toEqual({ date: fmtDate('2026-10-04', true), weight: null, label: fmtDate('2026-10-04', true) })
  })
})
