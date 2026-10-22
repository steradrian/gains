import { describe, expect, it, vi } from 'vitest'
import { burnedWeekOf, noteOf, rowLine, sourcesLine, viewOf } from './burned-data.js'

const TODAY = '2026-10-18'
const DAYS = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', TODAY]
const energy = kcal => kcal.toLocaleString('en') + ' kcal'

const PUSH = { id: 1, name: 'Push A', kcal: 320, duration_min: 52, source: 'opengym', covered_by: null }
const RUN = { id: 2, name: 'Run', kcal: 410, duration_min: 31, distance: 5.2, source: 'manual', covered_by: null }
const LEGS = { id: 3, name: 'Legs', kcal: 0, duration_min: 61, source: 'opengym', covered_by: null }

const record = (rows, effective = rows.reduce((sum, r) => sum + r.kcal, 0)) => ({ status: 'ready', rows, sum: { effective }, error: null })
const activity = byDay => Object.fromEntries(DAYS.map(d => [d, record(byDay[d] || [])]))
const WEEK = { [TODAY]: [PUSH], '2026-10-17': [RUN], '2026-10-15': [LEGS] }
const weekOf = byDay => burnedWeekOf({ days: DAYS, today: TODAY, activity: activity(byDay) })

const GOAL = { diaryShowActivity: true, calorieGoalMode: 'fixed', goals: { calories: { min: 2100, max: 2100, sharedGoal: true } } }
const NO_GOAL = { diaryShowActivity: true, calorieGoalMode: 'fixed', goals: {} }

describe('burnedWeekOf', () => {
  it('groups the week into Today and earlier days, newest first, and adds the numbers', () => {
    const w = weekOf(WEEK)
    expect(w.groups.map(g => [g.id, g.rows.map(r => r.name)])).toEqual([['today', ['Push A']], ['earlier', ['Run', 'Legs']]])
    expect(w.total).toBe(730)
    expect(w.workouts).toBe(1)
    expect(w.activities).toBe(1)
    expect(w.loaded).toBe(true)
  })

  it('lists a workout with no number apart, and counts it nowhere', () => {
    const w = weekOf(WEEK)
    expect(w.missing.map(r => r.name)).toEqual(['Legs'])
    expect(w.missing[0]).toMatchObject({ kcal: 0, minutes: 61, workout: true })
  })

  it('is not loaded until every day has its record', () => {
    const partial = activity(WEEK)
    delete partial['2026-10-14']
    expect(burnedWeekOf({ days: DAYS, today: TODAY, activity: partial }).loaded).toBe(false)
    expect(burnedWeekOf({ days: DAYS, today: TODAY, activity: {} }).groups).toEqual([])
  })

  it('drops templates, reads a wearable day by its effective total and does not count a covered row', () => {
    const covered = { ...PUSH, covered_by: 'garmin' }
    const w = weekOf({ [TODAY]: [covered, { ...RUN, id: 9, is_template: 1 }] })
    expect(w.groups[0].rows.map(r => r.name)).toEqual(['Push A'])
    expect(w.workouts).toBe(0)
    const wearable = burnedWeekOf({ days: DAYS, today: TODAY, activity: { ...activity({}), [TODAY]: record([covered], 540) } })
    expect(wearable.total).toBe(540)
  })

  it('keeps the other days when one failed, and says it failed', () => {
    const failed = { ...activity(WEEK), '2026-10-14': { status: 'error', rows: [], sum: null, error: new Error('x') } }
    expect(burnedWeekOf({ days: DAYS, today: TODAY, activity: failed })).toMatchObject({ failed: true, loaded: true, total: 730 })
  })

  it('has no groups and no figure for a week with nothing logged', () => {
    expect(weekOf({})).toMatchObject({ groups: [], total: 0, missing: [] })
  })
})

describe('the lines', () => {
  it('names where the figure comes from, or nothing when no row has a number', () => {
    expect(sourcesLine({ workouts: 2, activities: 1 })).toBe('Burned this week, from 2 workouts and 1 activity')
    expect(sourcesLine({ workouts: 1, activities: 0 })).toBe('Burned this week, from 1 workout')
    expect(sourcesLine({ workouts: 0, activities: 0 })).toBeNull()
  })

  it('reads a row as its kind, distance, minutes and where the number is from', () => {
    const w = weekOf(WEEK)
    const [push] = w.groups[0].rows
    const [run, legs] = w.groups[1].rows
    expect(rowLine(push, TODAY)).toBe('Workout · 52 min · from your sets')
    expect(rowLine(run, TODAY)).toMatch(/^.+ · 5\.2 km · 31 min$/)
    expect(rowLine(legs, TODAY)).toMatch(/^.+ · Workout · 61 min$/)
    expect(rowLine({ ...push, coveredBy: 'garmin' }, TODAY)).toBe('Workout · 52 min · Covered by Garmin')
  })
})

describe('noteOf', () => {
  it('quotes the real target, never a stand-in, and says Burned is never added', () => {
    const note = noteOf({ settings: GOAL, today: TODAY, energy })
    expect(note.title).toBe('Never added to your target')
    expect(note.body).toBe('Burned is shown next to what you ate. Your target stays 2,100 kcal a day.')
  })

  it('drops the target line without a goal', () => {
    const note = noteOf({ settings: NO_GOAL, today: TODAY, energy })
    expect(note.title).toBe('Never added to your target')
    expect(note.body).toBe('Burned is shown next to what you ate.')
  })

  it('adds the Adaptive wording only in Adaptive mode', () => {
    const adaptive = { ...GOAL, calorieGoalMode: 'adaptive' }
    expect(noteOf({ settings: adaptive, today: TODAY, goalInputs: { adaptive: 2400 }, energy }).body).toContain('Adaptive targets already count your activity.')
    expect(noteOf({ settings: GOAL, today: TODAY, energy }).body).not.toContain('Adaptive')
  })

  it('does not say never when Adjust goal from activity adds Burned to a fixed target', () => {
    const adjusting = { ...GOAL, calorieAdjustFromActivity: true }
    expect(noteOf({ settings: adjusting, today: TODAY, energy }).title).toBe('Counted in your target')
    // a target that already counts the burn is not added to
    const adaptive = { ...adjusting, calorieGoalMode: 'adaptive' }
    expect(noteOf({ settings: adaptive, today: TODAY, goalInputs: { adaptive: 2400 }, energy }).title).toBe('Never added to your target')
  })
})

describe('viewOf', () => {
  const view = (byDay, handlers = {}) => viewOf({
    week: weekOf(byDay), today: TODAY, settings: GOAL, goalInputs: {}, energy, onAdd: vi.fn(), onOpen: vi.fn(), ...handlers,
  })

  it('draws the figure, its line, the groups and one line for the row with no number', () => {
    const v = view(WEEK)
    expect(v.title).toBe('730 kcal')
    expect(v.sub).toBe('Burned this week, from 1 workout and 1 activity')
    expect(v.groups.map(g => [g.title, g.items.map(i => [i.title, i.value])])).toEqual([
      ['Today', [['Push A', '320 kcal']]],
      ['Earlier this week', [['Run', '410 kcal'], ['Legs', '0 kcal']]],
    ])
    expect(v.missing).toEqual([{ key: 3, text: 'Legs has no Burned number: it was logged before Burned was turned on. Tap it to add one.' }])
    expect(v.empty).toBe(false)
  })

  it('opens the add drawer for a row with no number and the day for the others', () => {
    const onAdd = vi.fn()
    const onOpen = vi.fn()
    const v = view(WEEK, { onAdd, onOpen })
    const [run, legs] = v.groups[1].items
    run.onClick()
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ name: 'Run', date: '2026-10-17' }))
    expect(onAdd).not.toHaveBeenCalled()
    legs.onClick()
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Legs', date: '2026-10-15' }))
  })

  it('leaves the figure out of an empty week', () => {
    expect(view({})).toMatchObject({ title: null, sub: null, empty: true, groups: [] })
  })

  it('leaves the figure out when every row lacks a number, and still lists them', () => {
    const v = view({ '2026-10-15': [LEGS] })
    expect(v.title).toBeNull()
    expect(v.groups).toHaveLength(1)
    expect(v.empty).toBe(false)
  })
})
