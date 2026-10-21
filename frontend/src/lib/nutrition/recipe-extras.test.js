// What a recipe keeps on this device (steps, photo, whether Makes was typed): kept under the
// recipe's id, blank steps left out, a photo that is not a MediaRef refused, and the photo's files
// named so the local clean-up keeps them.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { dropExtras, extrasOf, holdExtrasInMemory, recipePhotoHashes, saveExtras } from './recipe-extras.js'

const HASH = 'a'.repeat(64)
const POSTER = 'b'.repeat(64)
const photo = { kind: 'image', hash: HASH, mime: 'image/jpeg', size: 1200, width: 800, height: 600, poster: { hash: POSTER, mime: 'image/jpeg', size: 300, width: 200, height: 150 } }

let restore
beforeEach(() => { restore = holdExtrasInMemory() })
afterEach(() => restore())

describe('recipe extras', () => {
  it('has none for a recipe nothing was kept for', () => {
    expect(extrasOf(31)).toBeNull()
  })

  it('keeps the steps in order, the photo and the typed flag under the recipe\'s id', () => {
    saveExtras(31, { steps: [{ id: 'a', text: 'Stir' }, { id: 'b', text: 'Chill' }], photo, makesTyped: true })
    const kept = extrasOf(31)
    expect(kept.steps).toEqual([{ id: 'a', text: 'Stir' }, { id: 'b', text: 'Chill' }])
    expect(kept.photo).toMatchObject({ hash: HASH, mime: 'image/jpeg', poster: { hash: POSTER } })
    expect(kept.makesTyped).toBe(true)
    expect(extrasOf(32)).toBeNull()
  })

  it('leaves blank steps out and gives a step without an id one', () => {
    saveExtras(31, { steps: [{ id: 'a', text: 'Stir' }, { id: 'b', text: '   ' }, { text: 'Chill' }] })
    const kept = extrasOf(31).steps
    expect(kept.map(s => s.text)).toEqual(['Stir', 'Chill'])
    expect(kept[1].id).toEqual(expect.any(String))
  })

  it('refuses a photo that is not a media reference', () => {
    saveExtras(31, { steps: [{ id: 'a', text: 'Stir' }], photo: { hash: 'nope' } })
    expect(extrasOf(31).photo).toBeNull()
  })

  it('has no entry for a recipe with nothing to keep', () => {
    saveExtras(31, { steps: [{ id: 'a', text: 'Stir' }] })
    saveExtras(31, { steps: [], photo: null, makesTyped: false })
    expect(extrasOf(31)).toBeNull()
  })

  it('drops a deleted recipe\'s extras', () => {
    saveExtras(31, { steps: [{ id: 'a', text: 'Stir' }] })
    dropExtras(31)
    expect(extrasOf(31)).toBeNull()
    expect(() => dropExtras(31)).not.toThrow()
  })

  it('names the files of every recipe photo, poster included', () => {
    saveExtras(31, { photo })
    saveExtras(32, { steps: [{ id: 'a', text: 'Stir' }] })
    expect([...recipePhotoHashes()].sort()).toEqual([HASH, POSTER])
  })

  it('keeps the memory copy off the real storage', () => {
    saveExtras(31, { steps: [{ id: 'a', text: 'Stir' }] })
    expect(globalThis.localStorage?.getItem('gains_recipe_extras_v1') ?? null).toBeNull()
  })
})
