// The onboarding's answers and what each action does to them.
import { describe, expect, it } from 'vitest'
import { initialState, loadSaved, reduce, save } from './state.js'

const units = { weight: 'kg', height: 'cm', source: 'locale' }
const memory = () => {
  const m = new Map()
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }
}

describe('onboarding state', () => {
  it('starts with no answers, a seated day by default and the locale units', () => {
    const s = initialState(units)
    expect(s.answers.goal).toBeNull()
    expect(s.answers.activity).toEqual({ value: 'sitting', source: 'default' })
    expect(s.answers.units).toBe(units)
    expect(s.answers.trainingDays).toBeUndefined()
  })

  it('marks a unit picked by hand as the person\'s', () => {
    const s = reduce(initialState(units), { type: 'unit', kind: 'weight', unit: 'lb' })
    expect(s.answers.units).toEqual({ weight: 'lb', height: 'cm', source: 'user' })
  })

  it('drops the plan when the number of training days changes, and keeps it when it does not', () => {
    let s = reduce(initialState(units), { type: 'training', days: 3 })
    s = reduce(s, { type: 'plan', plan: { kind: 'none' } })
    expect(reduce(s, { type: 'training', days: 3 }).answers.plan).toEqual({ kind: 'none' })
    const changed = reduce(s, { type: 'training', days: 4 })
    expect(changed.answers.plan).toBeNull()
    expect(changed.pick).toBeNull()
  })

  it('skips Training as null, with no plan', () => {
    const s = reduce(reduce(initialState(units), { type: 'training', days: 2 }), { type: 'skipTraining' })
    expect(s.answers.trainingDays).toBeNull()
    expect(s.answers.plan).toBeNull()
  })

  it('keeps the steps whose save failed until one succeeds', () => {
    let s = reduce(initialState(units), { type: 'saved', step: 'body', ok: false })
    s = reduce(s, { type: 'saved', step: 'body', ok: false })
    expect(s.unsaved).toEqual(['body'])
    expect(reduce(s, { type: 'saved', step: 'body', ok: true }).unsaved).toEqual([])
  })

  it('fills in from the hub only what this tab does not know', () => {
    let s = reduce(initialState(units), { type: 'body', field: 'sex', value: 'male' })
    s = reduce(s, { type: 'hub', answers: { goal: 'build', body: { sex: 'female', weightKg: 80 }, trainingDays: 3 }, coachAvailable: true })
    expect(s.answers.goal).toBe('build')
    expect(s.answers.body.sex).toBe('male')
    expect(s.answers.body.weightKg).toBe(80)
    expect(s.answers.trainingDays).toBe(3)
    expect(s.coachAvailable).toBe(true)
  })

  it('survives a reload of the tab, an unasked training step included', () => {
    const store = memory()
    const s = reduce(initialState(units), { type: 'goal', goal: 'lose' })
    save(s, store)
    const back = loadSaved(store)
    expect(back.answers.goal).toBe('lose')
    expect(back.answers.trainingDays).toBeUndefined()
    expect(loadSaved(memory())).toBeNull()
  })
})
