import { describe, expect, it } from 'vitest'
import { actionsOf, changeLine, daysSlide, goalCardOf, ringsOf, weightOf, weightSlide } from './me-data.js'

const FULL = { unit: 'kg', targetW: 78, bodyweight: [{ d: '2026-09-01', w: 84.8 }, { d: '2026-10-10', w: 81.7 }, { d: '2026-10-17', w: 81.4 }] }
const energy = k => k + ' kcal'

describe('weightOf', () => {
  it('reads progress from the first weigh-in to the target, and the 7-day change', () => {
    const w = weightOf(FULL)
    expect(w.kind).toBe('toward')
    expect(w.change).toBe(-0.3)
    expect(w.toGo).toBeCloseTo(3.4, 5)
    expect(w.progress).toBeCloseTo(0.5, 5)
  })

  it('has no 7-day change without a weigh-in a week back', () => {
    const w = weightOf({ unit: 'kg', targetW: 78, bodyweight: [{ d: '2026-10-14', w: 82 }, { d: '2026-10-17', w: 81.4 }] })
    expect(w.change).toBeNull()
    expect(changeLine(w)).toBeNull()
  })

  it('is none without weigh-ins and untargeted without a target', () => {
    expect(weightOf({ unit: 'kg', bodyweight: [] }).kind).toBe('none')
    expect(weightOf({ ...FULL, targetW: null }).kind).toBe('untargeted')
  })

  it('reaches the target in either direction', () => {
    expect(weightOf({ unit: 'kg', targetW: 78, bodyweight: [{ d: '2026-09-01', w: 84 }, { d: '2026-10-17', w: 77.9 }] }).kind).toBe('reached')
    expect(weightOf({ unit: 'kg', targetW: 80, bodyweight: [{ d: '2026-09-01', w: 74 }, { d: '2026-10-17', w: 80.2 }] }).kind).toBe('reached')
    expect(weightOf({ unit: 'kg', targetW: 80, bodyweight: [{ d: '2026-09-01', w: 74 }, { d: '2026-10-17', w: 76 }] }).kind).toBe('toward')
  })

  it('never lets progress go below zero when the weight moved away', () => {
    expect(weightOf({ unit: 'kg', targetW: 78, bodyweight: [{ d: '2026-09-01', w: 82 }, { d: '2026-10-17', w: 83 }] }).progress).toBe(0)
  })
})

describe('weightSlide', () => {
  it('shows the weight, the change and the distance to the target', () => {
    expect(weightSlide(weightOf(FULL))).toMatchObject({ big: '81.4', unit: '−0.3 kg in 7 days', pill: '3.4 kg to 78', to: '/me/body' })
  })

  it('asks for a first weigh-in, opening the drawer', () => {
    expect(weightSlide(weightOf({ unit: 'kg', bodyweight: [] }))).toMatchObject({ unit: 'No weigh-ins yet', pill: 'Log your first weigh-in', log: true, value: 0 })
  })

  it('with no target shows an empty arc and Set a target weight', () => {
    expect(weightSlide(weightOf({ ...FULL, targetW: null }))).toMatchObject({ big: '81.4', value: 0, pill: 'Set a target weight', to: '/me/goal' })
  })

  it('closes the ring and reads Target reached', () => {
    const s = weightSlide(weightOf({ unit: 'kg', targetW: 78, bodyweight: [{ d: '2026-09-01', w: 84 }, { d: '2026-10-17', w: 77.9 }] }))
    expect(s).toMatchObject({ unit: 'Target reached', value: 1, max: 1 })
  })
})

describe('ringsOf', () => {
  const S = { ...FULL, workouts: [] }
  it('has Weight, Days on target and Streak, the last two opening the week', () => {
    const rings = ringsOf({ S, hero: { onTarget: { days: 4, of: 6 } }, foodOn: true, kcal: '2,100 kcal', weekTo: '/me/week/2026-W42' })
    expect(rings.map(r => r.key)).toEqual(['weight', 'days', 'streak'])
    expect(rings[1]).toMatchObject({ big: '4 of 6', pill: 'Daily targets · 2,100 kcal', to: '/me/week/2026-W42' })
    expect(rings[2].to).toBe('/me/week/2026-W42')
  })

  it('leaves out Days on target with food tracking off', () => {
    expect(ringsOf({ S, hero: null, foodOn: false, kcal: null, weekTo: '/w' }).map(r => r.key)).toEqual(['weight', 'streak'])
  })

  it('says 0 days when no day was judged', () => {
    expect(daysSlide({ onTarget: null })).toMatchObject({ big: '0', value: 0, max: 7, pill: null })
  })
})

describe('actionsOf', () => {
  it('drops Invite where no invite can be made', () => {
    expect(actionsOf({ canInvite: true }).map(a => a.key)).toEqual(['weight', 'measure', 'photo', 'invite'])
    expect(actionsOf({ canInvite: false }).map(a => a.key)).toEqual(['weight', 'measure', 'photo'])
  })
})

describe('goalCardOf', () => {
  const ready = { status: 'ready', goal: 'lose', targets: { weeklyChangeKg: -0.4 }, profile: { calories: 2100 } }

  it('says the goal, the pace, the target, the distance and the daily calories', () => {
    expect(goalCardOf({ goal: ready, weight: weightOf(FULL), energy })).toEqual({
      title: 'Lose weight · about 0.4 kg a week', lines: ['78 kg target', '3.4 kg to go · 2100 kcal a day'], keep: false,
    })
  })

  it('asks for a target when there is none', () => {
    const c = goalCardOf({ goal: ready, weight: weightOf({ unit: 'kg', bodyweight: [] }), energy })
    expect(c.lines[0]).toBe('Set your target weight')
  })

  it('offers Keep my weight once the target is reached, unless the goal is already keep', () => {
    const reached = weightOf({ unit: 'kg', targetW: 78, bodyweight: [{ d: '2026-09-01', w: 84 }, { d: '2026-10-17', w: 77.9 }] })
    expect(goalCardOf({ goal: ready, weight: reached, energy }).keep).toBe(true)
    expect(goalCardOf({ goal: { ...ready, goal: 'keep' }, weight: reached, energy }).keep).toBe(false)
  })

  it('without NutriTrace says only the target weight', () => {
    const c = goalCardOf({ goal: { status: 'no-nutrition', profile: {} }, weight: weightOf(FULL), energy })
    expect(c).toEqual({ title: '78 kg target', lines: ['3.4 kg to go'], keep: false })
    expect(goalCardOf({ goal: { status: 'no-nutrition', profile: {} }, weight: weightOf({ unit: 'kg', bodyweight: [] }), energy }).title).toBe('Set your target weight')
  })

  it('is loading while the settings load', () => {
    expect(goalCardOf({ goal: { status: 'loading' }, weight: weightOf(FULL), energy })).toEqual({ loading: true })
  })
})
