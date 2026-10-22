// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { journalMediaHashes, listChanges, restoreChange } from '../../../lib/recent-changes.js'
import { _setMediaStore, createMediaStore, memoryBackend } from '../../../lib/media-store.js'
import { allPhotos } from '../../../lib/me/photos.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { photosOf } from './photos-data.js'
import { deletePhoto } from './photo-delete.js'
import '../../../lib/recent-changes-kinds.js'

vi.mock('../../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../../../lib/nutrition/sync.js', () => ({ syncNow: vi.fn(() => Promise.resolve()) }))
vi.mock('../../../lib/media-sync.js', async orig => ({ ...(await orig()), syncMedia: vi.fn() }))

const hex = c => c.repeat(64)
const img = c => ({ kind: 'image', hash: hex(c), mime: 'image/jpeg', size: 4, width: 800, height: 600, at: 1 })
const own = (id, d, c) => ({ id, d, ref: img(c), addedAt: 10 })
const S = () => useStore.getState().S
const setS = over => useStore.setState(s => ({ S: { ...s.S, unit: 'kg', bodyweight: [], bodyPhotos: [], workouts: [], deleted: {}, photoBackup: false, ...over } }))
const photo = key => allPhotos(S()).find(p => p.key === key)
const put = (store, c) => store.put(hex(c), new Blob(['abcd'], { type: 'image/jpeg' }), { mime: 'image/jpeg', pending: false })

let media
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  localStorage.clear()
  media = createMediaStore(memoryBackend())
  _setMediaStore(media)
  await put(media, 'a')
  await put(media, 'b')
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
})
afterEach(() => { vi.useRealTimers(); _setMediaStore(null) })

describe('deleting an own photo', () => {
  beforeEach(() => setS({ bodyPhotos: [own('p1', '2026-10-18', 'a'), own('p2', '2026-10-04', 'b')] }))

  it('removes it with its tombstone, journals it with its files, holds them and offers Undo', async () => {
    expect(await deletePhoto(photo('own:p1'))).toBe(true)
    expect(S().bodyPhotos.map(p => p.id)).toEqual(['p2'])
    expect(typeof S().deleted.bodyPhotos.p1).toBe('number')
    expect(useUI.getState().toastMsg).toBe('Photo deleted')
    expect(useUI.getState().toastAction.label).toBe('Undo')
    expect(media.isHeld(hex('a'))).toBe(true)
    expect(media.isHeld(hex('b'))).toBe(false)
    const [entry] = listChanges()
    expect(entry).toMatchObject({ kind: 'photo-delete', day: '2026-10-18', state: 'open' })
    expect(journalMediaHashes().has(hex('a'))).toBe(true)
  })

  it('Undo puts back the same entry (id and ref), the files stay, and the hold is released', async () => {
    await deletePhoto(photo('own:p1'))
    useUI.getState().runToastAction()
    await vi.waitFor(() => expect(S().bodyPhotos.map(p => p.id).sort()).toEqual(['p1', 'p2']))
    expect(S().bodyPhotos.find(p => p.id === 'p1')).toMatchObject({ d: '2026-10-18', ref: img('a') })
    expect(await media.has(hex('a'))).toBe(true)
    expect(media.isHeld(hex('a'))).toBe(false)
  })

  it('keeps the files held for the whole Undo window: Undo still works at 7.9 s', async () => {
    await deletePhoto(photo('own:p1'))
    vi.advanceTimersByTime(7900)
    expect(media.isHeld(hex('a'))).toBe(true)
    expect(useUI.getState().toastAction).not.toBeNull()
    useUI.getState().runToastAction()
    await vi.waitFor(() => expect(S().bodyPhotos).toHaveLength(2))
  })

  it('at 9 s the window is closed: the hold is released, Undo does nothing, and the journal still has the files', async () => {
    await deletePhoto(photo('own:p1'))
    vi.advanceTimersByTime(9000)
    expect(useUI.getState().toastAction).toBeNull()
    expect(media.isHeld(hex('a'))).toBe(false)
    useUI.getState().runToastAction()
    expect(S().bodyPhotos.map(p => p.id)).toEqual(['p2'])
    // The local clean-up at 10 s keeps whatever the journal lists.
    expect(journalMediaHashes().has(hex('a'))).toBe(true)
  })

  it('after the window Recent changes restores it while the file is there, and says so honestly when it is not', async () => {
    await deletePhoto(photo('own:p1'))
    await deletePhoto(photo('own:p2'))
    vi.advanceTimersByTime(9000)
    const [second, first] = listChanges()
    expect(await restoreChange(first.id)).toMatchObject({ ok: true, where: { day: '2026-10-18' } })
    expect(S().bodyPhotos.map(p => p.id)).toEqual(['p1'])
    await media.remove(hex('b'))
    expect(await restoreChange(second.id)).toEqual({ ok: false, reason: 'gone' })
    expect(S().bodyPhotos.map(p => p.id)).toEqual(['p1'])
  })

  it('Undo with the file lost says "Couldn’t restore that photo" and brings back nothing', async () => {
    await deletePhoto(photo('own:p1'))
    await media.remove(hex('a'))
    useUI.getState().runToastAction()
    await vi.waitFor(() => expect(useUI.getState().toastMsg).toBe('Couldn’t restore that photo'))
    expect(S().bodyPhotos.map(p => p.id)).toEqual(['p2'])
  })

  it('a photo whose file was never on this phone still comes back on Undo', async () => {
    setS({ bodyPhotos: [own('p3', '2026-10-01', 'c')] })
    await deletePhoto(photo('own:p3'))
    useUI.getState().runToastAction()
    await vi.waitFor(() => expect(S().bodyPhotos.map(p => p.id)).toEqual(['p3']))
  })

  it('does nothing for a photo that is already gone', async () => {
    const gone = photo('own:p1')
    await deletePhoto(gone)
    useUI.setState({ toastMsg: '', toastAction: null })
    expect(await deletePhoto(gone)).toBe(false)
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('deleting the last photo leaves the tab on its empty state', async () => {
    setS({ bodyPhotos: [own('p1', '2026-10-18', 'a')] })
    await deletePhoto(photo('own:p1'))
    expect(photosOf(S()).empty).toBe(true)
  })
})

describe('deleting a photo from a workout', () => {
  const w = { id: 'w1', d: '2026-10-11', start: 1000, end: 2000, entries: [], media: [img('a'), img('b')] }
  beforeEach(() => setS({ workouts: [w] }))

  it('takes it off the workout and Undo puts the same file back on it', async () => {
    expect(await deletePhoto(photo('workout:w1:' + hex('a')))).toBe(true)
    expect(S().workouts[0].media.map(m => m.hash)).toEqual([hex('b')])
    expect(media.isHeld(hex('a'))).toBe(true)
    expect(listChanges()[0]).toMatchObject({ kind: 'photo-delete', facts: { source: 'workout' } })
    useUI.getState().runToastAction()
    await vi.waitFor(() => expect(S().workouts[0].media.map(m => m.hash).sort()).toEqual([hex('a'), hex('b')]))
    expect(S().workouts[0].media.find(m => m.hash === hex('a'))).toMatchObject(img('a'))
  })

  it('after the window the journal puts it back, and answers gone when the workout has been deleted', async () => {
    await deletePhoto(photo('workout:w1:' + hex('a')))
    vi.advanceTimersByTime(9000)
    const [entry] = listChanges()
    useStore.getState().update(s => { s.workouts = [] })
    expect(await restoreChange(entry.id)).toEqual({ ok: false, reason: 'gone' })
    setS({ workouts: [{ ...w, media: [img('b')] }] })
    expect(await restoreChange(entry.id)).toMatchObject({ ok: true })
    expect(S().workouts[0].media).toHaveLength(2)
  })
})
