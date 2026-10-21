// Training load's and the muscle page's derivations (use-training-load.js), ported from the old
// MuscleBalance, TrainingLoad and Heatmap tests where the behaviour is the same.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF } from '../../../store/useStore.js'
import { fmtDate } from '../../../lib/format.js'
import { MUSCLES } from '../../../lib/muscles.js'
import {
  activityOf, balanceOf, fatigueRows, loadSub, muscleOf, readyLine, readyWhen, rowValue, strengthMuscles, tabOf, toSchedule,
  trainedBy, tryNextFor, viewOf,
} from './use-training-load.js'

const DAY = 86400000
const NOW = new Date(2026, 8, 30, 12).getTime()   // Wednesday 30 Sep 2026
const TODAY = '2026-09-30'
const press = { id: 'press', n: 'Press', primaries: ['chest'], secondaries: ['triceps'], custom: true }

const completed = (d, muscle, sets, extra = {}) => ({
  id: `${d}-${muscle}`, d, start: new Date(`${d}T12:00:00`).getTime(),
  entries: [{ id: `custom-${muscle}`, exercise: { primaries: [muscle], secondaries: [] }, sets: Array.from({ length: sets }, () => ({ done: true, ...extra })) }],
})
const state = over => ({
  ...structuredClone(DEF), unit: 'kg', body: 'male', effort: 'rir', bodyweight: [],
  routines: [{ id: 'push', name: 'Push', ex: [{ id: 'press', sets: 2 }] }],
  customEx: [press], week: { 1: ['push'] }, weekStart: 1, workouts: [], dayNotes: {}, ...over,
})
const plan12 = { routines: [{ id: 'push', name: 'Push', ex: [{ id: 'press', sets: 12 }] }] }
const week = (S, opts = {}) => balanceOf(S, { win: 7, now: NOW, today: TODAY, ...opts })
const slugs = b => b.rows.map(r => r.slug)
const valueOf = (b, slug) => rowValue(b.rows.find(r => r.slug === slug), b.vsPlan)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('the line under the title', () => {
  it('counts the workouts and their time since the first one’s month', () => {
    const w = (id, d) => ({ id, d, start: new Date(d + 'T10:00:00').getTime(), end: new Date(d + 'T10:52:00').getTime(), entries: [] })
    expect(loadSub(state({ workouts: [w('a', '2026-05-12'), w('b', '2026-09-28')] }), TODAY)).toBe('2 workouts · 1h 44m since May')
  })

  it('leaves the time out when none was recorded, and says nothing without workouts', () => {
    expect(loadSub(state({ workouts: [{ id: 'a', d: '2026-05-12', entries: [] }] }), TODAY)).toBe('1 workout since May')
    expect(loadSub(state(), TODAY)).toBeNull()
  })
})

describe('?view= and the redirects', () => {
  it('opens Balance for activity, muscles, nothing or anything unknown', () => {
    for (const view of ['activity', 'muscles', null, 'nonsense']) expect(tabOf(view, true)).toBe('balance')
    expect(tabOf('fatigue', false)).toBe('fatigue')
    expect(tabOf('strength', false)).toBe('strength')
  })

  it('opens Effort only while it is offered', () => {
    expect(tabOf('effort', true)).toBe('effort')
    expect(tabOf('effort', false)).toBe('balance')
  })

  it('writes Balance as the old muscles link', () => {
    expect(viewOf('balance')).toBe('muscles')
    expect(viewOf('fatigue')).toBe('fatigue')
  })

  it('sends the Plan segment and its old focus link to the schedule', () => {
    expect(toSchedule('?view=plan')).toBe(true)
    expect(toSchedule('?focus=weekly-volume&x=1')).toBe(true)
    expect(toSchedule('?view=muscles')).toBe(false)
    expect(toSchedule('')).toBe(false)
  })
})

describe('Activity', () => {
  const w = (id, d, min, vol) => ({ id, d, start: new Date(d + 'T10:00:00').getTime(), end: new Date(d + 'T10:00:00').getTime() + min * 60000, vol })

  it('says each day by time, and makes only days with a workout or a note tappable', () => {
    const S = state({ workouts: [w('a', '2026-09-28', 52)], dayNotes: { '2026-09-21': { tag: 'sick', text: 'Flu', _ts: 1 } } })
    const grid = activityOf(S, 'time', new Date(NOW))
    expect(grid.values).toHaveLength(grid.days.length)
    expect(grid.days.length % 7).toBe(0)
    const trained = grid.days.find(d => d.iso === '2026-09-28')
    expect(trained.label).toBe(fmtDate('2026-09-28', true) + ', 52 min')
    expect(grid.days.find(d => d.iso === '2026-09-21')).toMatchObject({ noted: true, label: fmtDate('2026-09-21', true) + ', Sick · Flu' })
    expect(grid.days.filter(d => d.iso).map(d => d.iso).sort()).toEqual(['2026-09-21', '2026-09-28'])
    expect(grid.days.filter(d => d.today)).toHaveLength(1)
    expect(grid.months.every(m => typeof m.label === 'string' && m.label.length > 0)).toBe(true)
  })

  it('says the volume by volume, and counts several workouts on a day', () => {
    const S = state({ workouts: [w('a', '2026-09-28', 30, 4000), w('b', '2026-09-28', 20, 5600)] })
    const day = activityOf(S, 'vol', new Date(NOW)).days.find(d => d.iso === '2026-09-28')
    expect(day.label).toContain('2 workouts')
    expect(day.label).toContain('kg')
    expect(day.label).not.toContain('min')
  })
})

describe('Balance, this week against the plan', () => {
  it('reads completed against planned, completed first, and a muscle the plan does not program by its sets alone', () => {
    const b = week(state({ ...plan12, workouts: [completed('2026-09-30', 'chest', 8), completed('2026-09-30', 'biceps', 3)] }))
    expect(b.vsPlan).toBe(true)
    expect(b.week).toBe('2026-09-28')
    expect(b.load).toEqual({ chest: 8, biceps: 3 })
    expect(slugs(b)).toEqual(['chest', 'biceps', 'triceps'])
    expect(valueOf(b, 'chest')).toEqual({ value: '8/12 · 67%', spoken: 'Completed 8 sets · Planned 12 sets' })
    expect(valueOf(b, 'triceps').value).toBe('0/4.8 · 0%')
    expect(valueOf(b, 'biceps')).toEqual({ value: '3 sets' })
  })

  it('orders by completed then planned, planned-only rows last', () => {
    const b = week(state({ ...plan12, workouts: [
      completed('2026-09-30', 'biceps', 8), completed('2026-09-30', 'upper-back', 6), completed('2026-09-30', 'chest', 4),
      completed('2026-09-30', 'calves', 4), completed('2026-09-30', 'deltoids', 2),
    ] }))
    expect(slugs(b)).toEqual(['biceps', 'upper-back', 'chest', 'calves', 'deltoids', 'triceps'])
    expect(b.missed).toContain('triceps')
  })

  it('shows the real percentage over the plan', () => {
    expect(valueOf(week(state({ ...plan12, workouts: [completed('2026-09-30', 'chest', 14)] })), 'chest').value).toBe('14/12 · 117%')
  })

  it('says one set in the singular', () => {
    expect(valueOf(week(state({ workouts: [completed('2026-09-30', 'biceps', 1)] })), 'biceps').value).toBe('1 set')
  })

  it('leaves out 0/0 muscles and keeps planned muscles not trained yet', () => {
    const zeroPress = { id: 'zero-press', n: 'Zero press', muscleWeights: { chest: 1, biceps: 0 }, custom: true }
    const plannedOnly = { id: 'planned-only', n: 'Planned only', muscleWeights: { triceps: 1 }, custom: true }
    const b = week(state({
      customEx: [zeroPress, plannedOnly],
      routines: [{ id: 'zero-plan', name: 'Zero plan', ex: [{ id: zeroPress.id, sets: 2 }, { id: plannedOnly.id, sets: 1 }] }],
      week: { 1: ['zero-plan'] },
      workouts: [{ id: 'z', d: '2026-09-30', start: new Date('2026-09-30T12:00:00').getTime(), entries: [{ id: zeroPress.id, exercise: zeroPress, sets: [{ done: true }, { done: true }] }] }],
    }))
    expect(b.load).toEqual({ chest: 2 })
    expect(valueOf(b, 'chest').value).toBe('2/2 · 100%')
    expect(valueOf(b, 'triceps').value).toBe('0/1 · 0%')
    expect(slugs(b)).not.toContain('biceps')
  })

  it('has every muscle worked when every one got a set', () => {
    const b = week(state({ workouts: MUSCLES.map(m => completed('2026-09-30', m, 1)) }))
    expect(b.missed).toEqual([])
    expect(b.worked).toHaveLength(MUSCLES.length)
  })
})

describe('Balance, an earlier week', () => {
  it('steps back by the profile’s first weekday and reads what was done, not the plan', () => {
    const S = state({ weekStart: 0, workouts: [completed('2026-09-27', 'biceps', 1), completed('2026-09-20', 'quadriceps', 4)] })
    expect(week(S).week).toBe('2026-09-27')
    const before = week(S, { weekOffset: -1 })
    expect(before.week).toBe('2026-09-20')
    expect(before.vsPlan).toBe(false)
    expect(before.load).toEqual({ quadriceps: 4 })
    expect(valueOf(before, 'quadriceps')).toEqual({ value: '4 sets' })
    expect(before.missed).toContain('chest')
  })

  it('is empty for a week with nothing logged', () => {
    const b = week(state({ workouts: [completed('2026-09-30', 'biceps', 3)] }), { weekOffset: -1 })
    expect(b.empty).toBe(true)
    expect(b.load).toEqual({})
  })
})

describe('Balance, a window and Hard sets', () => {
  const rated = (d, muscle, sets, rir) => completed(d, muscle, sets, { rir })
  const S = () => state({ workouts: [rated('2026-09-20', 'chest', 3, 0), rated('2026-09-20', 'biceps', 2, 5)] })

  it('offers Hard sets on a window with sets rated hard, never on a week', () => {
    expect(week(S()).rated).toBe(false)
    const all = balanceOf(S(), { win: 30, now: NOW, today: TODAY })
    expect(all.rated).toBe(true)
    expect(all.hard).toBe(false)
    expect(all.load).toEqual({ chest: 3, biceps: 2 })
    expect(slugs(all)).toEqual(['chest', 'biceps'])
  })

  it('counts only the hard sets once on', () => {
    const hard = balanceOf(S(), { win: 30, hard: true, now: NOW, today: TODAY })
    expect(hard.hard).toBe(true)
    expect(hard.load).toEqual({ chest: 3 })
    expect(hard.missed).toContain('biceps')
  })

  it('does not offer it when no set is rated hard', () => {
    const b = balanceOf(state({ workouts: [rated('2026-09-20', 'biceps', 2, 5)] }), { win: 90, hard: true, now: NOW, today: TODAY })
    expect(b.rated).toBe(false)
    expect(b.hard).toBe(false)
  })

  it('All reaches back past 90 days', () => {
    const old = state({ workouts: [completed('2025-01-10', 'calves', 2)] })
    expect(balanceOf(old, { win: 90, now: NOW, today: TODAY }).empty).toBe(true)
    expect(balanceOf(old, { win: 0, now: NOW, today: TODAY }).load).toEqual({ calves: 2 })
  })
})

describe('Fatigue', () => {
  it('lists the muscles carrying any, most first, with their state', () => {
    expect(fatigueRows({ chest: 0.88, deltoids: 0.3, biceps: 0.004 })).toEqual([
      { slug: 'chest', pct: 88, state: 'fatigued' },
      { slug: 'deltoids', pct: 30, state: 'recovering' },
    ])
  })

  const legs = over => state({
    routines: [{ id: 'legs', name: 'Legs', ex: [{ id: '0043', sets: 3 }] }],
    week: { 1: ['legs'] }, ...over,
  })

  it('says when the next planned session fits, by its weekday', () => {
    const line = readyLine(legs(), {}, { now: NOW, today: TODAY })
    expect(line).toMatch(/Legs/)
    expect(line).toContain('Monday’s Legs session fits.')
  })

  it('says nothing when the muscles it trains will still be resting', () => {
    expect(readyLine(legs(), { quadriceps: 0.99 }, { now: NOW, today: TODAY })).toBeNull()
  })

  it('says nothing without a session planned in the next 7 days', () => {
    expect(readyLine(legs({ week: {} }), {}, { now: NOW, today: TODAY })).toBeNull()
  })

  it('names today’s session when it is today’s and nothing is logged yet', () => {
    const line = readyLine(legs({ week: { 3: ['legs'] } }), {}, { now: NOW, today: TODAY })
    expect(line).toContain('Today’s Legs session fits.')
  })
})

describe('Strength', () => {
  const set = w => ({ done: true, w, r: 8, unit: 'kg' })
  const bench = ago => ({ id: 'b' + ago, d: new Date(NOW - ago * DAY).toISOString().slice(0, 10), start: NOW - ago * DAY, unit: 'kg', entries: [{ id: '0025', sets: [set(80)] }] })

  it('lists the muscles losing strength with their sets in 90 days and the weeks since', () => {
    const { strength, losing } = strengthMuscles(state({ workouts: [bench(20)] }), NOW)
    expect(strength.chest).toBeLessThan(1)
    const chest = losing.find(m => m.slug === 'chest')
    expect(chest).toMatchObject({ sets90: 1, weeks: 2 })
    expect(losing.find(m => m.slug === 'biceps')).toMatchObject({ sets90: 0, weeks: null })
  })

  it('leaves out a muscle trained in the last two weeks', () => {
    expect(strengthMuscles(state({ workouts: [bench(3)] }), NOW).losing.map(m => m.slug)).not.toContain('chest')
  })
})

describe('the muscle page', () => {
  const at = d => new Date(d + 'T12:00:00').getTime()
  const benchWeek = state({ workouts: [
    { id: 'm', d: '2026-09-28', start: at('2026-09-28'), entries: [
      { id: '0025', sets: [{ done: true, w: 80, r: 8 }, { done: true, w: 80, r: 8 }, { done: true, w: 80, r: 8 }, { done: true, w: 80, r: 8 }] },
      { id: 'dips', exercise: { n: 'Dips', muscleWeights: { triceps: 1, chest: 0.4 } }, sets: [{ done: true }, { done: true }, { done: true }] },
    ] },
    { id: 'old', d: '2026-09-15', start: at('2026-09-15'), entries: [{ id: '0025', sets: [{ done: true, w: 80, r: 8 }, { done: true, w: 80, r: 8 }] }] },
  ] })

  it('lists this week’s exercises, main movers first, a secondary counted in part', () => {
    const rows = trainedBy(benchWeek.workouts.slice(0, 1), 'chest')
    expect(rows.map(r => [r.id, r.sets, r.counted, r.primary, r.day])).toEqual([
      ['0025', 4, 4, true, '2026-09-28'],
      ['dips', 3, 1.2, false, '2026-09-28'],
    ])
  })

  it('suggests catalogue exercises for it you have not done, three of them', () => {
    const next = tryNextFor(benchWeek, 'chest')
    expect(next).toHaveLength(3)
    expect(next.map(ex => ex.id)).not.toContain('0025')
    expect(next.every(ex => ex.cat === 'strength' || ex.cat === 'calisthenics')).toBe(true)
  })

  it('sums this week, the last 4 weeks and a week on average', () => {
    const m = muscleOf(benchWeek, 'chest', { now: NOW, today: TODAY })
    expect(m.week).toBe(5.2)
    expect(m.four).toBe(7.2)
    expect(m.perWeek).toBe(1.8)
    expect(m.exercises).toHaveLength(2)
    expect(m.tryNext).toHaveLength(3)
  })

  it('has no ready time for a muscle that is ready', () => {
    const m = muscleOf(benchWeek, 'calves', { now: NOW, today: TODAY })
    expect(m).toMatchObject({ week: 0, four: 0, state: 'ready', readyAt: null, exercises: [] })
  })

  it('projects when a fatigued muscle is ready, and says it as a weekday or a time today', () => {
    const fresh = state({ workouts: [{ id: 'f', d: TODAY, start: NOW - 3600000, entries: [{ id: '0025', sets: Array.from({ length: 10 }, () => ({ done: true, w: 80, r: 8, rir: 0 })) }] }] })
    const m = muscleOf(fresh, 'chest', { now: NOW, today: TODAY })
    expect(m.state).not.toBe('ready')
    expect(m.readyAt).toBeGreaterThan(NOW)
    expect(readyWhen(null, NOW)).toBeNull()
    expect(readyWhen(NOW + 3 * DAY, NOW)).not.toMatch(/\d/)
    expect(readyWhen(NOW + 3600000, NOW)).toMatch(/\d/)
  })
})
