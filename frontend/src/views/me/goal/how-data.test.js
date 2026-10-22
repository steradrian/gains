import { describe, expect, it } from 'vitest'
import { targetsFor } from '../../../lib/me/goal-calc.js'
import { adaptiveBlock, goalSentence, howViewOf, proteinSentence, workoutsSentence } from './how-data.js'

const energy = kcal => `${kcal} kcal`
const NOW = Date.UTC(2026, 9, 22)
const man = goal => targetsFor({ goal, sex: 'male', birthYear: 1994, heightCm: 182, weightKg: 81.4, activity: 'light', now: NOW })
const profile = (over = {}) => ({
  unit: 'kg', goal: 'lose', mode: 'fixed', calories: null, targetKg: 78,
  macros: { proteinG: 150, carbsG: 230, fatG: 70 }, ...over,
})

describe('goalSentence', () => {
  it('lose: the percentage off, the target and the pace from goal-calc', () => {
    const t = man('lose')
    const weekly = (Math.round(Math.abs(t.weeklyChangeKg) * 10) / 10).toFixed(1)
    expect(goalSentence({ goal: 'lose', targets: t, unit: 'kg', energy })).toBe(`Lose weight takes 20% off: ${t.calories} kcal a day, about ${weekly} kg a week.`)
  })

  it('build adds, keep eats what you burn, an unknown goal says nothing', () => {
    const b = man('build')
    expect(goalSentence({ goal: 'build', targets: b, unit: 'kg', energy })).toMatch(/^Build muscle adds 10%: \d+ kcal a day, about \d\.\d kg a week\.$/)
    const k = man('keep')
    expect(goalSentence({ goal: 'keep', targets: k, unit: 'kg', energy })).toBe(`Keep my weight eats about what you burn: ${k.calories} kcal a day.`)
    expect(goalSentence({ goal: null, targets: k, unit: 'kg', energy })).toBeNull()
    expect(goalSentence({ goal: 'lose', targets: null, unit: 'kg', energy })).toBeNull()
  })

  it('the pace is in the person’s weight unit', () => {
    expect(goalSentence({ goal: 'lose', targets: man('lose'), unit: 'lb', energy })).toMatch(/about \d\.\d lb a week\.$/)
  })
})

describe('proteinSentence', () => {
  it('is the stored grams over the target weight, to a tenth', () => {
    expect(proteinSentence({ proteinG: 150, targetKg: 78 })).toBe('Protein is set to about 1.9 g per kg of your target weight.')
  })

  it('is left out without the grams or the target weight', () => {
    expect(proteinSentence({ proteinG: null, targetKg: 78 })).toBeNull()
    expect(proteinSentence({ proteinG: 150, targetKg: null })).toBeNull()
    expect(proteinSentence({ proteinG: 0, targetKg: 78 })).toBeNull()
  })
})

describe('workoutsSentence (owner question 18)', () => {
  const never = 'Workouts and activities are never added to the target. Burned is shown on its own.'
  it('Fixed with the setting off: workouts are never added', () => {
    expect(workoutsSentence({ mode: 'fixed', adjust: false, adaptive: null, adaptiveStatus: 'loading' })).toBe(never)
  })

  it('Fixed with the setting on does not say never', () => {
    const text = workoutsSentence({ mode: 'fixed', adjust: true, adaptive: null, adaptiveStatus: 'loading' })
    expect(text).toBe('Workouts and activities add their calories to the target. Turn this off in More options.')
  })

  it('Dynamic and a ready Adaptive follow the burn', () => {
    const burn = 'Your target follows your burn, workouts included.'
    expect(workoutsSentence({ mode: 'dynamic', adjust: false, adaptive: null, adaptiveStatus: 'loading' })).toBe(burn)
    expect(workoutsSentence({ mode: 'adaptive', adjust: false, adaptive: { ready: true }, adaptiveStatus: 'ready' })).toBe(burn)
  })

  it('Adaptive still learning uses the fixed target, so the Fixed wording', () => {
    expect(workoutsSentence({ mode: 'adaptive', adjust: false, adaptive: { ready: false }, adaptiveStatus: 'ready' })).toBe(never)
  })

  it('Adaptive that has not answered yet says nothing rather than guess', () => {
    expect(workoutsSentence({ mode: 'adaptive', adjust: false, adaptive: null, adaptiveStatus: 'loading' })).toBeNull()
    expect(workoutsSentence({ mode: 'adaptive', adjust: false, adaptive: null, adaptiveStatus: 'failed' })).toBeNull()
  })
})

describe('adaptiveBlock', () => {
  it('only in Adaptive mode, and only once it answered', () => {
    expect(adaptiveBlock({ mode: 'fixed', adaptive: { ready: false }, energy })).toBeNull()
    expect(adaptiveBlock({ mode: 'adaptive', adaptive: null, energy })).toBeNull()
  })

  it('learning: how many days of how many', () => {
    expect(adaptiveBlock({ mode: 'adaptive', adaptive: { ready: false, daysAvailable: 12, daysRequired: 21 }, energy }))
      .toEqual({ ready: false, title: 'Adaptive is learning', value: '12 of 21 so far' })
  })

  it('learning without the numbers reads 0 of 21', () => {
    expect(adaptiveBlock({ mode: 'adaptive', adaptive: { ready: false }, energy }).value).toBe('0 of 21 so far')
  })

  it('ready: the estimate and the confidence, no Early without a 35-day figure', () => {
    const b = adaptiveBlock({ mode: 'adaptive', adaptive: { ready: true, daysAvailable: 24, tdee: 2600, confidence: 0.8 }, energy })
    expect(b).toMatchObject({ ready: true, title: 'Adaptive is ready', value: 'Estimated burn 2600 kcal a day', confidence: '80%', early: false, firmsUp: null })
  })

  it('Early and "firms up" appear when the data carries a 35-day figure and the days are short of it', () => {
    const early = adaptiveBlock({ mode: 'adaptive', adaptive: { ready: true, daysAvailable: 24, daysFull: 35, tdee: 2600 }, energy })
    expect(early).toMatchObject({ early: true, firmsUp: 'Firms up at 35 days' })
    const full = adaptiveBlock({ mode: 'adaptive', adaptive: { ready: true, daysAvailable: 35, daysFull: 35, tdee: 2600 }, energy })
    expect(full).toMatchObject({ early: false, firmsUp: null })
  })

  it('a confidence given as a percent is not multiplied again', () => {
    expect(adaptiveBlock({ mode: 'adaptive', adaptive: { ready: true, confidence: 72 }, energy }).confidence).toBe('72%')
  })
})

describe('howViewOf', () => {
  const base = { settings: {}, adaptive: null, adaptiveStatus: 'loading', fmt: { energy } }

  it('three figures and the sentences, in the order the board has them', () => {
    const targets = man('lose')
    const view = howViewOf({ ...base, profile: profile({ calories: targets.calories }), targets })
    expect(view.figures.map(f => f.label)).toEqual(['Your burn', 'Goal factor', 'Target'])
    expect(view.figures[0].value).toBe(`${targets.burn} kcal`)
    expect(view.figures[1]).toMatchObject({ value: '0.8', sub: 'Lose weight' })
    expect(view.figures[2].value).toBe(`${targets.calories} kcal`)
    expect(view.paragraphs).toHaveLength(4)
    expect(view.paragraphs[0]).toBe(`Your burn comes from your height, age, sex and daily movement: about ${targets.burn} kcal a day before workouts.`)
    expect(view.paragraphs[1]).toMatch(/^Lose weight takes 20% off/)
    expect(view.paragraphs[2]).toMatch(/^Protein is set to about 1\.9 g/)
    expect(view.paragraphs[3]).toMatch(/^Workouts and activities are never added/)
    expect(view.adaptive).toBeNull()
  })

  it('a stored target that is not the goal’s own says what it is set to', () => {
    const targets = man('lose')
    const view = howViewOf({ ...base, profile: profile({ calories: 1800 }), targets })
    expect(view.paragraphs).toContain('Your Daily targets are set to 1800 kcal a day.')
    expect(view.figures[2].value).toBe('1800 kcal')
  })

  it('no target set reads Not set', () => {
    const view = howViewOf({ ...base, profile: profile(), targets: man('lose') })
    expect(view.figures[2].value).toBe('Not set')
  })

  it('leaves the protein sentence out without a target weight', () => {
    const view = howViewOf({ ...base, profile: profile({ targetKg: null }), targets: man('lose') })
    expect(view.paragraphs.some(p => p.startsWith('Protein'))).toBe(false)
  })

  it('without a burn there are no figures or sentences; Adaptive still shows', () => {
    const view = howViewOf({
      ...base, profile: profile({ mode: 'adaptive' }), targets: null,
      adaptive: { ready: false, daysAvailable: 12, daysRequired: 21 }, adaptiveStatus: 'ready',
    })
    expect(view.figures).toBeNull()
    expect(view.paragraphs).toEqual([])
    expect(view.adaptive.value).toBe('12 of 21 so far')
  })
})
