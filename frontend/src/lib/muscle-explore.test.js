import { describe, expect, it } from 'vitest'
import { CATALOGUE } from './exercises.js'
import { newProfile } from './equipment.js'
import { exercisesForMuscle, muscleCatalog } from './muscle-explore.js'
import { musclesOf } from './muscles.js'

const custom = { id: 'c1', n: 'my move', bp: 'chest', eq: '', custom: true, tg: 'pectorals', sm: [] }

describe('muscleCatalog', () => {
  it('is the whole catalogue with your own exercises in front when no profile filters', () => {
    const cat = muscleCatalog({ customEx: [custom] })
    expect(cat).toHaveLength(CATALOGUE.length + 1)
    expect(cat[0].id).toBe('c1')
  })

  it('is what the active profile can do, unless showAll', () => {
    const profile = { ...newProfile('Home'), id: 'p1', equipment: ['dumbbell'] }
    const S = { customEx: [], equipProfiles: [profile], activeEquipId: 'p1', equipFilterOn: true }
    const within = muscleCatalog(S)
    expect(within.length).toBeLessThan(CATALOGUE.length)
    expect(within.some(e => e.eq === 'dumbbell')).toBe(true)
    expect(within.some(e => e.eq === 'barbell')).toBe(false)
    expect(muscleCatalog(S, true)).toHaveLength(CATALOGUE.length)
  })
})

describe('exercisesForMuscle', () => {
  it('keeps the exercises that train the muscle, primary or helper', () => {
    const chest = exercisesForMuscle(CATALOGUE, 'chest')
    expect(chest.length).toBeGreaterThan(0)
    expect(chest.every(e => musclesOf(e).chest > 0)).toBe(true)
  })
})
