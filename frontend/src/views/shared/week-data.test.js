// @vitest-environment happy-dom
// The Week page's data (PR07 D2.0, D2.1): this week and a complete past one, the range and status,
// the ring, the day cells, the muscle note from real data only, the numbers (each null when the
// week cannot back it), Last 4 weeks and ‹ ›. A week with nothing keeps its cells and Last 4 weeks.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fmtDate } from '../../lib/format.js'
import { DEF } from '../../store/useStore.js'
import { dayFoodOf, rangeOf, streakAsOf, weekOf, workoutMarkOf } from './week-data.js'

// Sun 18 Oct 2026 is today. Push A on Mondays, Pull A on Wednesdays, Legs on Fridays.
const TODAY = '2026-10-18'
const clone = o => JSON.parse(JSON.stringify(o))
const at = (d, h) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime()
const routine = (id, name) => ({ id, name, ex: [{ id: '0025', sets: 3, reps: 8, weight: 60 }] })
const bench = () => ({ id: '0025', sets: [{ w: 80, r: 6, done: true }, { w: 80, r: 6, done: true }] })
const workout = (id, d, rid, name) => ({ id, d, name, start: at(d, 18), end: at(d, 19), routineIds: [rid], entries: [bench()], prs: [] })
const S = over => ({
  ...clone(DEF),
  routines: [routine('push', 'Push A'), routine('pull', 'Pull A'), routine('legs', 'Legs')],
  week: { 1: ['push'], 3: ['pull'], 5: ['legs'] },
  workouts: [
    workout('a', '2026-10-05', 'push', 'Push A'), workout('b', '2026-10-07', 'pull', 'Pull A'), workout('c', '2026-10-09', 'legs', 'Legs'),
    workout('d', '2026-10-12', 'push', 'Push A'), workout('e', '2026-10-14', 'pull', 'Pull A'),
  ],
  bodyweight: [{ d: '2026-10-13', w: 81.7, t: 1 }, { d: '2026-10-17', w: 81.4, t: 2 }],
  ...over,
})
const item = (calories, proteins) => ({ uuid: String(calories), name: 'x', meal: 0, quantity: 1, calories, proteins })
const settings = { goals: { calories: { max: 2100 }, proteins: { max: 150 } }, waterGoalMl: 2500 }
const food = (entries = {}) => ({
  on: true, settings, goalInputs: {},
  entries: {
    '2026-10-12': { items: [item(2075, 132)], water: [{ amount: 2250 }] },
    '2026-10-13': { items: [item(1600, 96)], water: [] },
    '2026-10-14': null,
    ...entries,
  },
})
const week = (isoWeek, s = S(), f = food(), today = TODAY) => weekOf({ S: s, isoWeek, today, food: f })

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(TODAY + 'T09:00:00')) })
afterAll(() => vi.useRealTimers())

describe('this week (D2.0)', () => {
  it('names its range and how many days are left', () => {
    const w = week('2026-W42')
    expect(w.range).toBe(`12 to ${fmtDate('2026-10-18')}`)
    expect(w.current).toBe(true)
    expect(w.status).toBe('This week · Last day')
    expect(week('2026-W42', S(), food(), '2026-10-17').status).toBe('This week · 1 day to go')
  })

  it('rings the workouts done of planned, as Today counts them', () => {
    expect(week('2026-W42').ring).toMatchObject({ done: 2, planned: 3, today: null })
    expect(week('2026-W42').ring.missed).toEqual([expect.objectContaining({ iso: '2026-10-16', name: 'Legs', ids: ['legs'] })])
  })

  it('names the routine still to do today', () => {
    const w = week('2026-W42', S({ week: { 0: ['legs'], 1: ['push'], 3: ['pull'] } }))
    expect(w.ring.today).toBe('Legs')
  })

  it('marks each day: done, missed, rest; a day moved shows on its new date', () => {
    expect(week('2026-W42').cells.map(c => c.workout)).toEqual(['done', 'rest', 'done', 'rest', 'missed', 'rest', 'rest'])
    const moved = week('2026-W42', S({ dayPlan: { '2026-10-16': 'rest', '2026-10-17': 'legs' } }))
    expect(moved.cells.map(c => c.workout)).toEqual(['done', 'rest', 'done', 'rest', 'rest', 'missed', 'rest'])
  })

  it('puts each day’s food against its own target, and flags today', () => {
    const cells = week('2026-W42').cells
    expect(cells[0].food).toMatchObject({ logged: true, kcal: 2075, target: 2100, band: 'on' })
    expect(cells[1].food).toMatchObject({ kcal: 1600, band: 'under' })
    expect(cells[2].food).toMatchObject({ logged: false })
    expect(cells[3].food).toBeNull()
    expect(cells.find(c => c.today).iso).toBe(TODAY)
  })

  it('says what the muscles missed only from what happened', () => {
    const note = week('2026-W42').muscleNote
    expect(note).toMatch(/not trained yet/)
    expect(note).toMatch(/Legs was missed on Fri/)
    expect(note).not.toMatch(/Coach/)
  })

  it('adds up the numbers', () => {
    const n = week('2026-W42').numbers
    expect(n.streak).toEqual({ weeks: 2, best: 2 })
    expect(n.onTarget).toEqual({ days: 1, of: 2, within: 150 })
    expect(n.kcal).toEqual({ avg: 1838, target: 2100 })
    expect(n.protein).toEqual({ avg: 114, target: 150 })
    expect(n.weight.from).toBe(81.7)
    expect(n.weight.to).toBe(81.4)
    expect(n.weight.change).toBeCloseTo(-0.3)
    expect(n.activity).toEqual({ ms: 2 * 3600000, count: 2 })
    expect(n.volume).toMatchObject({ now: 1920, last: 2880, unit: 'kg' })
    expect(n.volume.change).toBeCloseTo(-1 / 3)
    expect(n.water).toEqual({ avgMl: 2250, goalMl: 2500 })
  })

  it('has no next week', () => {
    const w = week('2026-W42')
    expect(w.prev).toBe('2026-W41')
    expect(w.next).toBeNull()
  })
})

describe('a complete past week (D2.1)', () => {
  it('reads complete with its week number, and every muscle note from what was done', () => {
    const w = week('2026-W41')
    expect(w.current).toBe(false)
    expect(w.status).toBe('Week 41 · complete')
    expect(w.ring).toMatchObject({ done: 3, planned: 3, today: null, missed: [], skipped: [] })
    expect(w.next).toBe('2026-W42')
    expect(w.numbers.streak).toEqual({ weeks: 1, best: null })
  })

  it('lists a day marked skipped as skipped, not missed', () => {
    const s = S({ workouts: S().workouts.filter(x => x.id !== 'c'), missedSeen: { '2026-10-09': { seen: true, _ts: 1 } } })
    const w = week('2026-W41', s)
    expect(w.ring.skipped.map(d => d.iso)).toEqual(['2026-10-09'])
    expect(w.muscleNote).toMatch(/Legs was missed on Fri/)
  })
})

describe('a week with nothing', () => {
  it('keeps its cells and Last 4 weeks; every number is null and the ring has nothing done', () => {
    const w = week('2026-W38', S(), food({}))
    expect(w.cells).toHaveLength(7)
    expect(w.cells.every(c => c.workout === 'rest')).toBe(true)
    expect(w.ring.done).toBe(0)
    expect(Object.values(w.numbers).every(v => v === null)).toBe(true)
    expect(w.muscleNote).toBeNull()
    expect(w.last4).toHaveLength(4)
  })

  it('leaves the food out with nutrition off', () => {
    const w = week('2026-W42', S(), { on: false })
    expect(w.cells.every(c => c.food === null)).toBe(true)
    expect(w.numbers.onTarget).toBeNull()
    expect(w.numbers.water).toBeNull()
  })
})

describe('Last 4 weeks', () => {
  it('are the four weeks up to this one, each done of planned, the shown one selected', () => {
    const last4 = week('2026-W41').last4
    expect(last4.map(w => w.isoWeek)).toEqual(['2026-W39', '2026-W40', '2026-W41', '2026-W42'])
    expect(last4.map(w => w.selected)).toEqual([false, false, true, false])
    expect(last4.at(-1)).toMatchObject({ current: true, done: 2, planned: 3 })
    expect(last4[2]).toMatchObject({ done: 3, planned: 3 })
  })
})

describe('the parts', () => {
  it('writes a range across a month with both months', () => {
    expect(rangeOf('2026-09-28')).toBe(`${fmtDate('2026-09-28')} to ${fmtDate('2026-10-04')}`)
  })

  it('counts the streak up to a week, this week not breaking it before its first workout', () => {
    expect(streakAsOf(S(), '2026-10-05', TODAY)).toBe(1)
    const s = S({ workouts: S().workouts.filter(x => x.d < '2026-10-12') })
    expect(streakAsOf(s, '2026-10-12', TODAY)).toBe(1)
  })

  it('does not call a planned day before the first workout missed', () => {
    expect(workoutMarkOf(S(), '2026-10-02', TODAY)).toBe('rest')
  })

  it('has no food for a day not loaded, and none with nutrition off', () => {
    expect(dayFoodOf(food(), '2026-10-15')).toBeNull()
    expect(dayFoodOf({ on: false }, '2026-10-12')).toBeNull()
  })

  it('is null for a name that is no week', () => {
    expect(week('2026-W99')).toBeNull()
  })
})
