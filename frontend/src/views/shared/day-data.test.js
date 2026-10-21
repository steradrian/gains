// @vitest-environment happy-dom
// The Day page's data (PR07 D1.0 to D1.4, D1.6): the state of each kind of past day, the summary
// line, the rail, a workout's rows, the food against the day's target or tracking off, water, the
// weigh-in and measurements, and the Add past workout choices. Nothing is made up: what is not
// there is null.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEF } from '../../store/useStore.js'
import { dayOf, dayRailOf, foodOf, measurementsOf, pastWorkoutChoicesOf, waterOf, weighInOf, workoutOf } from './day-data.js'

// Sun 18 Oct 2026 is today, as on the boards. Push A on Mondays, Legs on Fridays.
const TODAY = '2026-10-18'
const clone = o => JSON.parse(JSON.stringify(o))
const at = (d, h, m = 0) => new Date(`${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime()
const routine = (id, name, n = 1) => ({ id, name, ex: Array.from({ length: n }, () => ({ id: '0025', sets: 3, reps: 8, weight: 60 })) })
const bench = () => ({ id: '0025', sets: [{ w: 40, r: 10, done: true, warmup: true, type: 'warmup' }, { w: 80, r: 6, done: true }, { w: 80, r: 6, done: true }, { w: 75, r: 8, done: false }] })
const pushA = { id: 'w1', d: '2026-10-12', name: 'Push A', start: at('2026-10-12', 18, 30), end: at('2026-10-12', 19, 22), routineIds: ['push'], entries: [bench()], prs: ['0025'] }
const S = over => ({
  ...clone(DEF),
  routines: [routine('push', 'Push A', 2), routine('pull', 'Pull A'), routine('legs', 'Legs', 5)],
  week: { 1: ['push'], 5: ['legs'] },
  workouts: [{ ...pushA, id: 'w0', d: '2026-10-05', start: at('2026-10-05', 18), end: at('2026-10-05', 19) }, pushA],
  ...over,
})
const item = (uuid, name, meal, calories, proteins = 0) => ({ uuid, name, meal, quantity: 1, calories, proteins, carbohydrates: 0, fat: 0 })
const diary = (items = [], water = [], over = {}) => {
  const totals = items.reduce((s, i) => ({ ...s, calories: s.calories + i.calories, proteins: s.proteins + i.proteins }), { calories: 0, proteins: 0, carbohydrates: 0, fat: 0 })
  return {
    on: true, status: 'ready', dayReady: true, settings: { waterContainers: [] },
    entry: { items, water }, totals, target: { target: 2100, base: 2100 },
    macros: { proteins: 150, carbohydrates: 230, fat: 70 },
    water: { total: water.reduce((s, l) => s + l.amount, 0), goal: 2500 }, activityRows: [], reload: () => {},
    ...over,
  }
}
const eaten = () => diary([item('a', 'Oats with milk', 0, 485, 20), item('b', 'Chicken rice bowl', 1, 540, 40), item('c', 'Salmon', 2, 720, 50), item('d', 'Greek yogurt', 3, 330, 22)],
  [{ uuid: 'w1', amount: 1000, time: '12:00' }, { uuid: 'w2', amount: 1250, time: '21:10' }])
const day = (iso, s = S(), d = eaten()) => dayOf({ S: s, iso, today: TODAY, first: '2026-10-01', diary: d })

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(TODAY + 'T09:00:00')) })
afterAll(() => vi.useRealTimers())

describe('the state of a past day', () => {
  it('logged: a workout on the day, with the summary naming it, the food and how long ago', () => {
    const d = day('2026-10-12')
    expect(d.state).toBe('logged')
    expect(d.summary).toBe('Push A done · on target · 6 days ago')
    expect(d.planned).toBeNull()
  })

  it('lists every workout of a day with two, an unnamed one still labelled (was Train’s See workouts list)', () => {
    const second = { ...pushA, id: 'w2', name: '', start: at('2026-10-12', 7), end: at('2026-10-12', 8) }
    const d = day('2026-10-12', S({ workouts: [...S().workouts, second] }))
    expect(d.workouts.map(w => w.name)).toEqual(['Push A', 'Workout'])
    expect(d.summary).toMatch(/^Push A \+ Workout done/)
  })

  it('missed: the plan had Legs and nothing was logged; the summary gives the kcal when off target', () => {
    const d = day('2026-10-16', S(), diary([item('a', 'Oats', 0, 1600)]))
    expect(d.state).toBe('missed')
    expect(d.planned).toMatchObject({ ids: ['legs'], name: 'Legs' })
    expect(d.planned.routines).toEqual([expect.objectContaining({ id: 'legs', name: 'Legs', sub: '5 exercises' })])
    expect(d.planned.routines[0].images).toHaveLength(5)
    expect(d.summary).toBe('Legs missed · 1600 kcal · 2 days ago')
  })

  it('skipped: a missed day marked seen reads Skipped', () => {
    const d = day('2026-10-16', S({ missedSeen: { '2026-10-16': { seen: true, _ts: 1 } } }))
    expect(d.state).toBe('skipped')
    expect(d.summary).toMatch(/^Legs skipped/)
  })

  it('rest: nothing planned, something else logged', () => {
    const d = day('2026-10-13', S({ bodyweight: [{ d: '2026-10-13', w: 81.4, t: 1 }] }), diary())
    expect(d.state).toBe('rest')
    expect(d.weighIn).toEqual({ w: 81.4, unit: 'kg' })
  })

  it('rest: names what the plan had next, within the week after', () => {
    const d = day('2026-10-13', S({ bodyweight: [{ d: '2026-10-13', w: 81.4, t: 1 }] }), diary())
    expect(d.next).toEqual({ name: 'Legs', iso: '2026-10-16', date: 'Fri 16 Oct' })
    expect(day('2026-10-13', S({ week: {}, bodyweight: [{ d: '2026-10-13', w: 81.4, t: 1 }] }), diary()).next).toBeNull()
    expect(day('2026-10-12').next).toBeNull()
  })

  it('empty: nothing planned and nothing at all logged', () => {
    expect(day('2026-10-15', S(), diary()).state).toBe('empty')
  })

  it('empty: a rest day in the Plan says so, only when the plan has training days', () => {
    expect(day('2026-10-15', S(), diary()).summary).toBe('Rest day in your Plan · 3 days ago')
    expect(day('2026-10-15', S({ week: {} }), diary()).summary).toBe('3 days ago')
    expect(day('2026-10-02', S(), diary()).summary).not.toContain('Rest day')
  })

  it('never empty while the food is still loading', () => {
    expect(day('2026-10-15', S(), { on: true, status: 'loading' }).state).toBe('rest')
  })

  it('a planned day before the first workout is not missed', () => {
    expect(day('2026-10-02', S(), diary()).state).toBe('empty')
  })
})

describe('the rail', () => {
  it('shows the day’s week and the two before it, oldest first, with today flagged and the day selected', () => {
    const rail = dayRailOf(S(), '2026-10-12', TODAY, '2026-10-01')
    expect(rail.weeks.map(w => w.start)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
    expect(rail.weeks.map(w => w.isoWeek)).toEqual(['2026-W40', '2026-W41', '2026-W42'])
    expect(rail.index).toBe(2)
    expect(rail.week).toBe('2026-W42')
    const days = rail.weeks[2].days
    expect(days.find(x => x.selected).iso).toBe('2026-10-12')
    expect(days.find(x => x.today).iso).toBe(TODAY)
  })

  it('dims and disables the days before the first log', () => {
    const rail = dayRailOf(S(), '2026-10-12', TODAY, '2026-10-01')
    const first = rail.weeks[0].days
    expect(first.filter(x => x.disabled).map(x => x.iso)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30'])
    expect(first.find(x => x.iso === '2026-10-01').disabled).toBe(false)
  })
})

describe('a workout', () => {
  it('lists each exercise’s work sets ticked off, warm-ups left out, with its new best', () => {
    const w = workoutOf(S(), pushA)
    expect(w.name).toBe('Push A')
    expect(w.exercises).toHaveLength(1)
    expect(w.exercises[0].sets).toHaveLength(2)
    expect(w.exercises[0].best).toBe(true)
    expect(w.bests).toBe(1)
    expect(w.durationMs).toBe(52 * 60000)
    expect(w.start).toMatch(/18.30/)
    expect(w.volume).toBe(960)
    expect(w.levels.chest).toBeGreaterThan(0)
  })

  it('leaves out what a workout does not have: no start, no length, no volume', () => {
    const w = workoutOf(S(), { id: 'x', d: '2026-10-12', entries: [{ id: '0025', sets: [{ r: 10, done: false }] }] })
    expect(w).toMatchObject({ start: null, durationMs: null, volume: null, exercises: [] })
  })
})

describe('the food', () => {
  it('is tracking off with nutrition off', () => {
    expect(foodOf({ on: false })).toEqual({ tracking: 'off' })
    expect(day('2026-10-12', S(), { on: false }).food).toEqual({ tracking: 'off' })
  })

  it('adds the day up against its target, by meal, within 150 kcal on target', () => {
    const f = foodOf(eaten())
    expect(f).toMatchObject({ tracking: 'on', status: 'ready', kcal: 2075, target: 2100, diff: -25, band: 'on', logged: true })
    expect(f.macros[0]).toEqual({ id: 'proteins', value: 132, target: 150 })
    expect(f.meals.map(m => m.kcal)).toEqual([485, 540, 720, 330])
    expect(f.meals[0].items).toEqual([{ uuid: 'a', name: 'Oats with milk', kcal: 485 }])
  })

  it('says under and over beyond 150 kcal', () => {
    expect(foodOf(diary([item('a', 'x', 0, 1600)])).band).toBe('under')
    expect(foodOf(diary([item('a', 'x', 0, 2400)])).band).toBe('over')
  })

  it('waits while loading and offers a retry when the day failed', () => {
    expect(foodOf({ on: true, status: 'loading' })).toEqual({ tracking: 'on', status: 'loading' })
    expect(foodOf({ on: true, status: 'error', reload: 'r' })).toEqual({ tracking: 'on', status: 'error', retry: 'r' })
  })
})

describe('water and body', () => {
  it('water: the amount, the glasses and the last one’s time; null with none logged or food off', () => {
    expect(waterOf(eaten())).toEqual({ ml: 2250, goalMl: 2500, glassMl: 250, glasses: 9, last: '21:10' })
    expect(waterOf(diary())).toBeNull()
    expect(waterOf({ on: false })).toBeNull()
  })

  it('weigh-in: that day’s or null', () => {
    expect(weighInOf(S(), '2026-10-12')).toBeNull()
  })

  it('measurements: the latest on or before the day, in the profile’s units', () => {
    const s = S({ measurements: [{ d: '2026-10-04', waist: 84 }, { d: '2026-10-14', waist: 83 }] })
    expect(measurementsOf(s, '2026-10-12')).toEqual({ date: '2026-10-04', items: [{ key: 'waist', label: 'Waist', value: 84, unit: 'cm' }] })
    expect(measurementsOf(s, '2026-10-01')).toBeNull()
  })
})

describe('Add past workout (D1.6)', () => {
  it('offers the planned routine first, then the others, then an empty workout', () => {
    const choices = pastWorkoutChoicesOf(S(), '2026-10-16', TODAY)
    expect(choices.map(c => c.key)).toEqual(['legs', 'push', 'pull', 'freestyle'])
    expect(choices[0]).toMatchObject({ planned: true, routineIds: ['legs'] })
    expect(choices.at(-1).routineIds).toEqual([])
  })

  it('offers a combined planned day as one choice', () => {
    const choices = pastWorkoutChoicesOf(S({ week: { 5: ['legs', 'pull'] } }), '2026-10-16', TODAY)
    expect(choices[0]).toMatchObject({ key: 'planned', name: 'Legs + Pull A', routineIds: ['legs', 'pull'], planned: true })
  })

  it('without a plan for the day, lists the routines', () => {
    expect(pastWorkoutChoicesOf(S(), '2026-10-13', TODAY).map(c => c.key)).toEqual(['push', 'pull', 'legs', 'freestyle'])
  })
})
