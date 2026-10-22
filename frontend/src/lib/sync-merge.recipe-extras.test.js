import { describe, expect, it } from 'vitest'
import { mergeStates } from './sync-merge.js'

// Eat library m3: S.recipeExtras (a recipe's steps and photo) is merged per recipe id by each
// entry's own `updatedAt`, a deleted recipe is a tombstone, and a sign-in (`prefer`) keeps the
// preferred side's entry.
const base = (recipeExtras, over = {}) => ({
  unit: 'kg', restSec: 90, lang: 'en', week: {}, dayPlan: {},
  workouts: [], routines: [], bodyweight: [], customEx: [], favEx: [], exWeights: {}, exNotes: {}, barWeights: {},
  equipProfiles: [], gymCards: [], _ts: 0, ...(recipeExtras ? { recipeExtras } : {}), ...over,
})
const entry = (text, updatedAt) => ({ steps: [{ id: 's', text }], photo: null, makesTyped: false, updatedAt })
const gone = updatedAt => ({ deleted: true, updatedAt })
const both = (a, b, opts) => [mergeStates(a, b, opts), mergeStates(b, a, opts)]

describe('mergeStates: recipe extras', () => {
  it('keeps the recipes each device wrote', () => {
    const phone = base({ 31: entry('Stir', 10) })
    const desk = base({ 32: entry('Chill', 20) })
    for (const m of both(phone, desk)) expect(Object.keys(m.recipeExtras).sort()).toEqual(['31', '32'])
  })

  it('takes the later write of a recipe both have, whichever copy is newer as a whole', () => {
    const phone = base({ 31: entry('Old', 10) }, { _ts: 99 })
    const desk = base({ 31: entry('New', 20) }, { _ts: 1 })
    for (const m of both(phone, desk)) expect(m.recipeExtras['31'].steps[0].text).toBe('New')
  })

  it('a tombstone newer than the steps wins, so a stale device cannot bring them back', () => {
    const deleted = base({ 31: gone(30) })
    const stale = base({ 31: entry('Stir', 10) })
    for (const m of both(deleted, stale)) expect(m.recipeExtras['31']).toEqual(gone(30))
  })

  it('steps written after the tombstone win (the recipe was re-made)', () => {
    const deleted = base({ 31: gone(30) })
    const again = base({ 31: entry('Fresh', 40) })
    for (const m of both(deleted, again)) expect(m.recipeExtras['31'].steps[0].text).toBe('Fresh')
  })

  it('on a tie the tombstone wins, the same from either side', () => {
    const deleted = base({ 31: gone(30) })
    const same = base({ 31: entry('Stir', 30) })
    for (const m of both(deleted, same)) expect(m.recipeExtras['31'].deleted).toBe(true)
  })

  it('is left alone when neither copy has any', () => {
    expect(mergeStates(base(), base()).recipeExtras).toBeUndefined()
  })

  it('does not change either input', () => {
    const a = base({ 31: entry('A', 10) }), b = base({ 31: entry('B', 20), 32: entry('C', 5) })
    const before = JSON.stringify([a, b])
    mergeStates(a, b)
    expect(JSON.stringify([a, b])).toBe(before)
  })

  describe('with prefer (signing in)', () => {
    it('keeps the preferred side\'s entry even when the other is later, and adds the other\'s own recipes', () => {
      const server = base({ 31: entry('Server', 10) })
      const guest = base({ 31: entry('Guest', 50), 32: entry('Only guest', 5) })
      const m = mergeStates(server, guest, { prefer: 'a' })
      expect(m.recipeExtras['31'].steps[0].text).toBe('Server')
      expect(m.recipeExtras['32'].steps[0].text).toBe('Only guest')
      const flipped = mergeStates(guest, server, { prefer: 'b' })
      expect(flipped.recipeExtras['31'].steps[0].text).toBe('Server')
    })

    it('keeps the preferred side\'s tombstone', () => {
      const server = base({ 31: gone(10) })
      const guest = base({ 31: entry('Guest', 50) })
      expect(mergeStates(server, guest, { prefer: 'a' }).recipeExtras['31'].deleted).toBe(true)
    })
  })
})
