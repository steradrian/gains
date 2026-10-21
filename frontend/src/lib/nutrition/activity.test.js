// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { ACTIVITY_TYPES, bodyWeightOf, estimateKcal, parseAmount, saveActivity, setActivityKcal } from './activity.js'
import { createFakeNutriTrace } from './fake-nutritrace.js'
import { useNutrition } from './store.js'

const DATE = '2026-10-17'

describe('estimateKcal', () => {
  it('is MET x kg x hours, to the nearest 5', () => {
    expect(estimateKcal({ type: 'run', kg: 81.4, minutes: 31 })).toBe(410)
    expect(estimateKcal({ type: 'ride', kg: 80, minutes: 60 })).toBe(600)
  })

  it('has no number without a weight, a duration or a known type', () => {
    expect(estimateKcal({ type: 'run', kg: null, minutes: 31 })).toBeNull()
    expect(estimateKcal({ type: 'run', kg: 81.4, minutes: 0 })).toBeNull()
    expect(estimateKcal({ type: 'curling', kg: 81.4, minutes: 31 })).toBeNull()
  })

  it('knows every type the drawer offers', () => {
    expect(ACTIVITY_TYPES.map(x => x.id)).toEqual(['run', 'ride', 'swim', 'football', 'class', 'other'])
    for (const { id } of ACTIVITY_TYPES) expect(estimateKcal({ type: id, kg: 70, minutes: 30 })).toBeGreaterThan(0)
  })
})

describe('bodyWeightOf', () => {
  it('is the latest weigh-in, in kg for the maths and in the person\'s unit for the words', () => {
    expect(bodyWeightOf({ unit: 'kg', bodyweight: [{ d: '2026-10-10', w: 82 }, { d: '2026-10-17', w: 81.4 }] })).toEqual({ kg: 81.4, shown: 81.4, unit: 'kg' })
    const lb = bodyWeightOf({ unit: 'lb', bodyweight: [{ d: '2026-10-17', w: 180 }] })
    expect(lb.unit).toBe('lb')
    expect(lb.shown).toBe(180)
    expect(lb.kg).toBeCloseTo(81.65, 1)
  })

  it('is null without a weigh-in', () => {
    expect(bodyWeightOf({ unit: 'kg', bodyweight: [] })).toBeNull()
    expect(bodyWeightOf({ unit: 'kg' })).toBeNull()
  })
})

describe('parseAmount', () => {
  it('reads a positive number, with a comma too, and nothing else', () => {
    expect(parseAmount('410')).toBe(410)
    expect(parseAmount('5,2')).toBe(5.2)
    for (const bad of ['', '  ', '0', '-3', 'abc']) expect(parseAmount(bad)).toBeNull()
  })
})

describe('writing an activity', () => {
  let nt
  beforeEach(async () => {
    nt = createFakeNutriTrace({
      activity: { [DATE]: [{ id: 7, date: DATE, name: 'Legs', kcal: 0, duration_min: 61, distance: null, source: 'opengym', covered_by: null }] },
    })
    vi.stubGlobal('fetch', nt.fetch)
    useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
    useNutrition.getState().reset()
    await useNutrition.getState().loadSettings()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('saves a run and the store reads it back, with the day\'s sum', async () => {
    await saveActivity({ date: DATE, name: 'Run', kcal: 410, minutes: 31, distance: 5.2 })
    expect(nt.writes()).toHaveLength(1)
    expect(nt.writes()[0]).toMatchObject({
      method: 'POST', path: '/nt/api/activity', body: { date: DATE, name: 'Run', kcal: 410, duration_min: 31, distance: 5.2 },
    })
    const day = useNutrition.getState().activity[DATE]
    expect(day.rows.map(r => [r.name, r.kcal])).toEqual([['Legs', 0], ['Run', 410]])
    expect(day.sum.effective).toBe(410)
  })

  it('leaves the distance out of the write when there is none', async () => {
    await saveActivity({ date: DATE, name: 'Class', kcal: 250, minutes: 45 })
    expect(nt.writes()[0].body).toEqual({ date: DATE, name: 'Class', kcal: 250, duration_min: 45 })
  })

  it('adds a number to a row that had none, and only that', async () => {
    await useNutrition.getState().loadActivity(DATE)
    const [row] = useNutrition.getState().activity[DATE].rows
    await setActivityKcal({ id: row.id, date: DATE }, 300)
    expect(nt.writes()[0]).toMatchObject({ method: 'PUT', path: '/nt/api/activity/7', body: { kcal: 300 } })
    const after = useNutrition.getState().activity[DATE]
    expect(after.rows[0]).toMatchObject({ name: 'Legs', kcal: 300, duration_min: 61 })
    expect(after.sum.effective).toBe(300)
  })
})
