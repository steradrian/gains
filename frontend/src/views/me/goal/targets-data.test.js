import { describe, expect, it } from 'vitest'
import { writesFor } from '../../../lib/nutrition/goals.js'
import { canSave, draftFor, fixCarbsLabel, initialOf, isDirty, modeNote, parseField, warningText, warningsOf } from './targets-data.js'

const clone = v => JSON.parse(JSON.stringify(v))
const settings = (over = {}) => ({
  calorieGoalMode: 'fixed', calorieGoalFactor: 0.8, waterGoalMl: 2500,
  goals: {
    calories: { max: 2100, sharedGoal: true },
    proteins: { max: 150, sharedGoal: true },
    carbohydrates: { max: 230, sharedGoal: true },
    fat: { max: 70, sharedGoal: true },
  },
  ...over,
})
const energy = kcal => `${kcal} kcal`
const keysOf = writes => writes.map(([k]) => k)

describe('parseField', () => {
  it('reads a positive number, a comma too; blank, zero and words are null', () => {
    expect(parseField('2100')).toBe(2100)
    expect(parseField(' 1,5 ')).toBe(1.5)
    expect(parseField('')).toBeNull()
    expect(parseField('0')).toBeNull()
    expect(parseField('-3')).toBeNull()
    expect(parseField('abc')).toBeNull()
  })
})

describe('initialOf', () => {
  it('starts the fields from the stored targets, in the stored units', () => {
    const i = initialOf(settings())
    expect(i.fields).toEqual({ kcal: '2100', proteins: '150', carbohydrates: '230', fat: '70', water: '2500' })
    expect(i.units).toEqual({ kcal: 'kcal', water: 'ml' })
    expect(i.draft.mode).toBe('fixed')
    expect(i.weekday).toEqual({ kcal: false, proteins: false, carbohydrates: false, fat: false })
  })

  it('shows energy in kJ and water in fl oz for a person who reads them that way', () => {
    const i = initialOf(settings({ energyUnit: 'kJ', waterUnit: 'oz' }))
    expect(i.fields.kcal).toBe('8786')
    expect(i.fields.water).toBe('85')
    expect(i.units).toEqual({ kcal: 'kJ', water: 'fl oz' })
  })

  it('shows a macro stored as a percent as its grams', () => {
    const s = settings()
    s.goals.proteins = { max: 30, isPercent: true, sharedGoal: true }
    expect(initialOf(s).fields.proteins).toBe('158')
  })

  it('leaves a weekday-specific calorie target or macro out of the fields', () => {
    const s = settings()
    s.goals.calories = { sharedGoal: false, days: [2000, 2000, 2000, 2000, 2000, 2400, 2400] }
    s.goals.fat = { sharedGoal: false, days: [60, 60, 60, 60, 60, 80, 80] }
    const i = initialOf(s)
    expect(i.weekday).toMatchObject({ kcal: true, fat: true, proteins: false })
    expect(i.fields.kcal).toBe('')
    expect(i.fields.fat).toBe('')
    expect(canSave(i, i.fields)).toBe(true)
  })
})

describe('draftFor and the writes', () => {
  it('an untouched drawer makes no writes', () => {
    const s = settings()
    const i = initialOf(s)
    expect(isDirty(i, i.fields, 'fixed')).toBe(false)
    expect(writesFor(s, draftFor(i, i.fields, 'fixed'), s)).toEqual([])
  })

  it('a changed mode and calorie target write the mode and the goals', () => {
    const s = settings()
    const i = initialOf(s)
    const fields = { ...i.fields, kcal: '2300' }
    expect(isDirty(i, fields, 'adaptive')).toBe(true)
    const writes = writesFor(s, draftFor(i, fields, 'adaptive'), s)
    expect(keysOf(writes)).toEqual(['calorieGoalMode', 'goals'])
    expect(writes[0][1]).toBe('adaptive')
    expect(writes[1][1].calories.max).toBe(2300)
    expect(writes[1][1].proteins.max).toBe(150)
  })

  it('a kJ target is converted back to kcal, and a kJ target left alone keeps its kcal', () => {
    const s = settings({ energyUnit: 'kJ' })
    const i = initialOf(s)
    expect(draftFor(i, i.fields, 'fixed').kcal).toBe(2100)
    expect(draftFor(i, { ...i.fields, kcal: '8000' }, 'fixed').kcal).toBe(1912)
  })

  it('an edited macro becomes grams; one left alone stays a percent', () => {
    const s = settings()
    s.goals.proteins = { max: 30, isPercent: true, sharedGoal: true }
    s.goals.calories = { max: 2000, sharedGoal: true }
    const i = initialOf(s)
    expect(draftFor(i, i.fields, 'fixed').macros.proteins).toMatchObject({ value: 30, percent: true })
    const edited = draftFor(i, { ...i.fields, proteins: '160' }, 'fixed')
    expect(edited.macros.proteins).toMatchObject({ value: 160, percent: false })
  })

  it('a cleared macro is removed; a cleared water goal is left as it was', () => {
    const s = settings()
    const i = initialOf(s)
    const draft = draftFor(i, { ...i.fields, fat: '', water: '' }, 'fixed')
    expect(draft.macros.fat.value).toBeNull()
    expect(draft.waterMl).toBe(2500)
    const writes = writesFor(s, draft, s)
    expect(writes.find(([k]) => k === 'goals')[1].fat).toBeUndefined()
    expect(keysOf(writes)).not.toContain('waterGoalMl')
  })

  it('water is written in ml from the person’s unit', () => {
    const s = settings({ waterUnit: 'L' })
    const i = initialOf(s)
    expect(i.fields.water).toBe('2.5')
    expect(writesFor(s, draftFor(i, { ...i.fields, water: '3' }, 'fixed'), s)).toEqual([['waterGoalMl', 3000]])
  })

  it('a weekday-specific entry is never touched', () => {
    const s = settings()
    s.goals.fat = { sharedGoal: false, days: [60, 60, 60, 60, 60, 80, 80] }
    const i = initialOf(s)
    const writes = writesFor(s, draftFor(i, { ...i.fields, fat: '99', kcal: '2200' }, 'fixed'), s)
    expect(writes[0][1].fat).toEqual(s.goals.fat)
  })

  it('needs a calorie target to save, unless it is the weekday one', () => {
    const i = initialOf(settings())
    expect(canSave(i, i.fields)).toBe(true)
    expect(canSave(i, { ...i.fields, kcal: '' })).toBe(false)
    expect(canSave(i, { ...i.fields, kcal: 'x' })).toBe(false)
  })
})

describe('warnings', () => {
  it('macros that add up fine have none', () => {
    const i = initialOf(settings())
    expect(warningsOf(i, i.fields, 'fixed')).toEqual([])
  })

  it('macros that do not add up name both numbers and offer the carbs that fix it', () => {
    const i = initialOf(settings())
    const fields = { ...i.fields, carbohydrates: '100' }
    const [n] = warningsOf(i, fields, 'fixed')
    expect(n).toEqual({ code: 'mismatch', kcal: 2100, sum: 1630, carbsG: 218 })
    expect(warningText(n, energy)).toBe('The macros add up to 1630 kcal, the calorie target is 2100 kcal.')
    expect(fixCarbsLabel(n.carbsG)).toBe('Set carbs to 218 g')
    expect(warningsOf(i, { ...fields, carbohydrates: String(n.carbsG) }, 'fixed')).toEqual([])
  })

  it('offers no fix when the carbs would be nothing, or when carbs differ by weekday', () => {
    const i = initialOf(settings())
    const [n] = warningsOf(i, { ...i.fields, proteins: '400', carbohydrates: '10' }, 'fixed')
    expect(n.code).toBe('mismatch')
    expect(n.carbsG).toBeUndefined()
    const s = settings()
    s.goals.carbohydrates = { sharedGoal: false, days: [200, 200, 200, 200, 200, 250, 250] }
    const w = initialOf(s)
    expect(warningsOf(w, { ...w.fields, proteins: '300' }, 'fixed')).toEqual([])
  })

  it('a macro that differs by weekday silences the add-up note', () => {
    const s = settings()
    s.goals.fat = { sharedGoal: false, days: [60, 60, 60, 60, 60, 80, 80] }
    const i = initialOf(s)
    expect(warningsOf(i, { ...i.fields, proteins: '20' }, 'fixed')).toEqual([])
  })

  it('under 1,200 kcal says so, and Save is still possible', () => {
    const i = initialOf(settings())
    const fields = { ...i.fields, kcal: '1100', proteins: '100', carbohydrates: '100', fat: '30' }
    const notes = warningsOf(i, fields, 'fixed')
    expect(notes.map(n => n.code)).toContain('low')
    expect(warningText(notes.find(n => n.code === 'low'), energy)).toBe('Most guidelines suggest at least 1200 kcal.')
    expect(canSave(i, fields)).toBe(true)
  })

  it('over 5,000 kcal asks to check it', () => {
    const i = initialOf(settings())
    const notes = warningsOf(i, { ...i.fields, kcal: '5200' }, 'fixed')
    expect(warningText(notes.find(n => n.code === 'high'), energy)).toBe('The calorie target is very high (5200 kcal). Check that this is intended.')
  })

  it('a kJ person reads the numbers in kJ and the maths stays in kcal', () => {
    const i = initialOf(settings({ energyUnit: 'kJ' }))
    expect(warningsOf(i, i.fields, 'fixed')).toEqual([])
    const [n] = warningsOf(i, { ...i.fields, carbohydrates: '100' }, 'fixed')
    expect(n).toMatchObject({ code: 'mismatch', kcal: 2100, sum: 1630, carbsG: 218 })
  })
})

describe('modeNote', () => {
  it('describes each mode in one line', () => {
    expect(modeNote('fixed')).toBe('The same calorie target every day.')
    expect(modeNote('adaptive')).toMatch(/^Learns your real daily burn/)
    expect(modeNote('dynamic')).toMatch(/^Uses yesterday/)
  })
})

describe('the wearable', () => {
  it('is read from the settings (Dynamic needs one)', () => {
    expect(initialOf(settings()).wearable).toBe(false)
    expect(initialOf(settings({ fitbitEnabled: true })).wearable).toBe(true)
  })
})

describe('the draft is not mutated', () => {
  it('draftFor leaves the initial one as it was', () => {
    const i = initialOf(settings())
    const before = clone(i.draft)
    draftFor(i, { ...i.fields, kcal: '1', proteins: '1' }, 'dynamic')
    expect(i.draft).toEqual(before)
  })
})
