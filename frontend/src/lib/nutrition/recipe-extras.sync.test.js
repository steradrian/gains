// @vitest-environment happy-dom
// A recipe's steps and photo in the synced state (S.recipeExtras): written under the recipe's id
// with an `updatedAt`, batched while typing, a tombstone when the recipe is really deleted or
// cleared, its photo counted as referenced and pending, and the old localStorage copy moved in once.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { referencedHashes } from '../media-refs.js'
import { dropExtras, extrasOf, flushExtras, migrateLocalExtras, saveExtras } from './recipe-extras.js'

const { put, get } = vi.hoisted(() => ({ put: vi.fn(async () => {}), get: vi.fn() }))
vi.mock('../media-store.js', () => ({ mediaStore: { put, get } }))

const HASH = 'a'.repeat(64)
const POSTER = 'b'.repeat(64)
const photo = { kind: 'image', hash: HASH, mime: 'image/jpeg', size: 1200, width: 800, height: 600, poster: { hash: POSTER, mime: 'image/jpeg', size: 300, width: 200, height: 150 } }
const steps = [{ id: 's1', text: 'Stir' }, { id: 's2', text: 'Chill' }]
const LEGACY = 'gains_recipe_extras_v1'
const all = () => useStore.getState().S.recipeExtras

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.removeItem(LEGACY)
  useStore.setState(s => ({ S: { ...s.S, recipeExtras: undefined } }))
})
afterEach(() => {
  flushExtras()
  vi.useRealTimers()
})

describe('saving', () => {
  it('writes steps, photo and the typed flag under the recipe id, stamped', () => {
    vi.setSystemTime(1_800_000_000_000)
    saveExtras(31, { steps, photo, makesTyped: true })
    flushExtras()
    expect(all()['31']).toMatchObject({ steps, makesTyped: true, updatedAt: 1_800_000_000_000, photo: { hash: HASH, poster: { hash: POSTER } } })
    expect(extrasOf(31).steps).toEqual(steps)
  })

  it('reads its own write before the state has it, and writes once after the typing pauses', () => {
    const update = vi.spyOn(useStore.getState(), 'update')
    for (const text of ['S', 'St', 'Sti', 'Stir']) saveExtras(31, { steps: [{ id: 's1', text }] })
    expect(extrasOf(31).steps[0].text).toBe('Stir')
    expect(update).not.toHaveBeenCalled()
    vi.advanceTimersByTime(700)
    expect(update).toHaveBeenCalledTimes(1)
    expect(all()['31'].steps[0].text).toBe('Stir')
    update.mockRestore()
  })

  it('writes nothing when the content did not change', () => {
    saveExtras(31, { steps })
    flushExtras()
    const stamp = all()['31'].updatedAt
    vi.setSystemTime(Date.now() + 5000)
    saveExtras(31, { steps })
    flushExtras()
    expect(all()['31'].updatedAt).toBe(stamp)
  })

  it('moves its stamp forward on every real change, even with a clock that stands still', () => {
    saveExtras(31, { steps })
    flushExtras()
    const first = all()['31'].updatedAt
    saveExtras(31, { steps: [...steps, { id: 's3', text: 'Serve' }] })
    flushExtras()
    expect(all()['31'].updatedAt).toBeGreaterThan(first)
  })
})

describe('deleting', () => {
  it('a deleted recipe leaves a tombstone, not a missing key', () => {
    saveExtras(31, { steps, photo })
    flushExtras()
    dropExtras(31)
    expect(all()['31']).toMatchObject({ deleted: true, updatedAt: expect.any(Number) })
    expect(all()['31'].steps).toBeUndefined()
    expect(extrasOf(31)).toBeNull()
    // and its photo is no longer referenced
    expect(referencedHashes(useStore.getState().S).has(HASH)).toBe(false)
  })

  it('clearing every step and the photo is a tombstone too, so it syncs', () => {
    saveExtras(31, { steps })
    flushExtras()
    saveExtras(31, { steps: [], photo: null })
    flushExtras()
    expect(all()['31'].deleted).toBe(true)
    expect(extrasOf(31)).toBeNull()
  })

  it('a recipe with no extras gets no tombstone entry from a drop', () => {
    dropExtras(99)
    expect(all()?.['99']).toBeUndefined()
  })
})

describe('the photo', () => {
  it('is referenced by the state, poster included, so media sync keeps and uploads it', () => {
    saveExtras(31, { photo })
    flushExtras()
    expect([...referencedHashes(useStore.getState().S)].sort()).toEqual([HASH, POSTER])
  })
})

describe('moving the old device copy in', () => {
  beforeEach(() => { vi.useRealTimers() })

  it('puts the extras in the state once, stamped 1, and removes the old copy', async () => {
    localStorage.setItem(LEGACY, JSON.stringify({ 31: { steps, makesTyped: true }, 32: { steps: [] } }))
    await migrateLocalExtras()
    expect(all()['31']).toMatchObject({ steps, makesTyped: true, updatedAt: 1 })
    expect(all()['32']).toBeUndefined()
    expect(localStorage.getItem(LEGACY)).toBeNull()
    const after = JSON.stringify(all())
    await migrateLocalExtras()
    expect(JSON.stringify(all())).toBe(after)
  })

  it('leaves a recipe the state already has an entry for, tombstone included', async () => {
    useStore.getState().update(S => { S.recipeExtras = { 31: { steps: [{ id: 'x', text: 'New' }], photo: null, makesTyped: false, updatedAt: 500 }, 32: { deleted: true, updatedAt: 600 } } })
    localStorage.setItem(LEGACY, JSON.stringify({ 31: { steps }, 32: { steps }, 33: { steps } }))
    await migrateLocalExtras()
    expect(all()['31'].steps[0].text).toBe('New')
    expect(all()['32'].deleted).toBe(true)
    expect(all()['33'].steps).toEqual(steps)
  })

  it('makes the photo\'s files pending, so media sync uploads them', async () => {
    get.mockImplementation(async hash => ({ blob: new Blob(['x']), mime: 'image/jpeg', size: 1, pending: false, rejected: false, hash }))
    localStorage.setItem(LEGACY, JSON.stringify({ 31: { photo } }))
    await migrateLocalExtras()
    expect(put).toHaveBeenCalledWith(HASH, expect.anything(), { mime: 'image/jpeg', pending: true })
    expect(put).toHaveBeenCalledWith(POSTER, expect.anything(), { mime: 'image/jpeg', pending: true })
    expect(all()['31'].photo.hash).toBe(HASH)
  })

  it('does nothing without an old copy', async () => {
    await migrateLocalExtras()
    expect(all()).toBeUndefined()
  })
})
