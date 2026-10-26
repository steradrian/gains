import { describe, expect, it } from 'vitest'
import { CATALOGUE, EXIDX, byCategory, isCardio, searchExercises } from './exercises.js'
import { buildSets, defaultConfig, exLine, modeOf, setLabel } from './history.js'
import { buildCompletedWorkout } from './finish-workout.js'
import {
  SPORTS_CATEGORY, effortLabel, fmtSetDistance, isDistanceSport, isEffortSport, isSport, setDistanceKm, sportKcal, sportMet, stampSportMet,
} from './sports.js'

const SPORT_IDS = Array.from({ length: 16 }, (_, i) => String(12101 + i))
const DISTANCE_IDS = ['12101', '12102', '12103', '12104', '12105', '12106']

describe('sports in the catalogue', () => {
  it('has every sport under the category, as cardio, with a stable id', () => {
    for (const id of SPORT_IDS) {
      const ex = EXIDX[id]
      expect(ex, id).toBeTruthy()
      expect(ex.cat).toBe(SPORTS_CATEGORY)
      expect(ex.bp).toBe('cardio')
      expect(isSport(id)).toBe(true)
    }
    expect(CATALOGUE.filter(e => e.cat === SPORTS_CATEGORY)).toHaveLength(16)
  })

  it('is found by name, and by the cardio body part and the category the picker filters on', () => {
    expect(searchExercises(CATALOGUE, 'football').map(e => e.id)).toContain('12107')
    expect(searchExercises(CATALOGUE, 'padel')[0].id).toBe('12110')
    expect(searchExercises(CATALOGUE, 'swimming session').map(e => e.id)).toContain('12103')
    const cardio = CATALOGUE.filter(e => e.bp === 'cardio')
    expect(SPORT_IDS.every(id => cardio.some(e => e.id === id))).toBe(true)
    const { opts, list } = byCategory(cardio, SPORTS_CATEGORY)
    expect(opts).toContain(SPORTS_CATEGORY)
    expect(list.map(e => e.id).sort()).toEqual(SPORT_IDS)
  })

  it('splits into distance and effort sports', () => {
    expect(DISTANCE_IDS.every(isDistanceSport)).toBe(true)
    expect(SPORT_IDS.filter(isEffortSport)).toHaveLength(10)
    expect(isSport('2259')).toBe(false)
  })
})

describe('logging a sport in a workout', () => {
  const S = { workouts: [], exWeights: {} }

  it('opens a distance sport on minutes and speed, and says how far', () => {
    const cfg = defaultConfig('12101')
    expect(modeOf({ id: '12101', ...cfg })).toBe('cardio')
    expect(cfg).toEqual({ sets: 1, min: 30, speed: 9 })
    const [set] = buildSets(S, { id: '12101', ...cfg })
    expect(set).toEqual({ min: 30, speed: 9, done: false })
    expect(setDistanceKm({ min: 40, speed: 9 })).toBe(6)
    expect(setLabel('12101', { min: 40, speed: 9 }, { id: '12101', mode: 'cardio' }, 'kmh')).toBe('40 min @ 9 km/h · 6 km')
    expect(fmtSetDistance({ min: 60, speed: 8.04672 }, 'mph')).toBe('5 mi')
  })

  it('opens an effort sport on minutes and an effort level, with no speed', () => {
    const cfg = defaultConfig('12107')
    expect(cfg).toEqual({ sets: 1, min: 60, eff: 2 })
    const [set] = buildSets(S, { id: '12107', ...cfg })
    expect(set).toEqual({ min: 60, eff: 2, done: false })
    expect(setLabel('12107', { min: 90, eff: 3 }, { id: '12107', mode: 'cardio' }, 'kmh')).toBe('90 min · ' + effortLabel(3))
    expect(exLine({ id: '12107', ...cfg }, 'kg', 'kmh')).toBe('1 × 60 min')
  })

  it('writes the MET on a done sports set when the session finishes, and nowhere else', () => {
    const active = {
      id: 'w1', d: '2026-10-10', start: 1, bw: 80, name: 'Mixed',
      entries: [
        { id: '12107', sets: [{ min: 60, eff: 3, done: true }, { min: 10, eff: 1, done: false }] },
        { id: '12101', sets: [{ min: 30, speed: 10, done: true }] },
        { id: '2259', sets: [{ min: 20, speed: 5, done: true }] },
        { id: '0025', sets: [{ w: 60, r: 8, done: true }] },
      ],
    }
    const w = buildCompletedWorkout(active, { end: 2 })
    expect(w.entries[0].sets).toEqual([{ min: 60, eff: 3, done: true, met: 10 }, { min: 10, eff: 1, done: false }])
    expect(w.entries[1].sets[0].met).toBe(9.8)
    expect(w.entries[2].sets[0]).toBe(active.entries[2].sets[0])
    expect(w.entries[3].sets[0]).toBe(active.entries[3].sets[0])
  })
})

describe('sports calories', () => {
  it('is MET x kg x hours to the nearest 5', () => {
    // football, hard: 10 MET x 80 kg x 1.5 h = 1200
    expect(sportKcal('12107', { min: 90, eff: 3 }, 80)).toBe(1200)
    // yoga, easy: 2 x 60 x 0.5 = 60
    expect(sportKcal('12112', { min: 30, eff: 1 }, 60)).toBe(60)
    // swimming, 45 min at 70 kg: 6 x 70 x 0.75 = 315
    expect(sportKcal('12103', { min: 45, speed: 2 }, 70)).toBe(315)
  })

  it('moves with effort and, for run, ride and walk, with speed', () => {
    expect(['12108', '12108', '12108'].map((id, i) => sportMet(id, { eff: i + 1 }))).toEqual([6, 7.3, 8])
    expect(sportMet('12101', { speed: 8 })).toBe(8.3)
    expect(sportMet('12101', { speed: 12 })).toBe(11)
    expect(sportMet('12102', { speed: 15 })).toBe(4)
    expect(sportMet('12102', { speed: 25 })).toBe(10)
    expect(sportMet('12105', { speed: 5 })).toBe(3.5)
    expect(sportMet('12101', {})).toBe(9.8)
    expect(sportMet('2259', { speed: 5 })).toBeNull()
  })

  it('falls back to 70 kg without a weight, and gives nothing without minutes', () => {
    expect(sportKcal('12107', { min: 60, eff: 2 })).toBe(Math.round((7 * 70) / 5) * 5)
    expect(sportKcal('12107', { min: 0, eff: 2 }, 80)).toBeNull()
    expect(sportKcal('2259', { min: 20, speed: 5 }, 80)).toBeNull()
  })

  it('stamps only a done sports set, and keeps the same object otherwise', () => {
    const undone = { min: 30, eff: 2, done: false }
    expect(stampSportMet('12107', undone)).toBe(undone)
    const done = { min: 30, eff: 2, done: true, met: 7 }
    expect(stampSportMet('12107', done)).toBe(done)
    expect(stampSportMet('12107', { min: 30, eff: 2, done: true })).toEqual({ min: 30, eff: 2, done: true, met: 7 })
  })
})

describe('existing cardio is unchanged', () => {
  it('still reads and opens as minutes at a speed', () => {
    expect(isCardio('2259')).toBe(true)
    expect(defaultConfig('2259')).toEqual({ sets: 1, min: 20, speed: 8 })
    expect(setLabel('2259', { min: 20, speed: 5 }, { id: '2259', mode: 'cardio' }, 'kmh')).toBe('20 min @ 5 km/h')
    expect(setLabel('2259', { min: 20, speed: 5, incline: 4 }, { id: '2259', mode: 'cardio' }, 'kmh')).toContain('4% incline')
    expect(exLine({ id: '2259', sets: 1, min: 20, speed: 5 }, 'kg', 'kmh')).toBe('1 × 20 min @ 5 km/h')
  })
})
