// @vitest-environment happy-dom
// The Plan page's data (use-plan.js): who owns the loop, the loop card, the two weeks (the rail's
// days, from the person's week start), Also on fixed days, the weekly volume and the large title's
// line, in a loop and in a fixed week.
import { describe, expect, it, vi } from 'vitest'
import { fmtDate, isoOf, todayISO } from '../../lib/format.js'
import { railDay } from '../train/use-train.js'
import { alsoFixedOf, isEmpty, loopOf, loopState, planWeeks, subOf, volumeOf, weekRoutinesOf, VOLUME_TARGET } from './use-plan.js'

vi.mock('../../sheets.jsx', () => ({
  confirmSheet: vi.fn(), menuSheet: vi.fn(), dayOverrideSheet: vi.fn(), planToolsSheet: vi.fn(), starterPlanSheet: vi.fn(),
  workoutDetailSheet: vi.fn(), dayNoteSheet: vi.fn(), dayOptionsSheet: vi.fn(), startChooserSheet: vi.fn(), startFlow: vi.fn(),
  logPastWorkoutSheet: vi.fn(), importPlanFile: vi.fn(),
}))

// Sunday 18 October 2026, the boards' day.
const TODAY = '2026-10-18'
const r = (id, name) => ({ id, name, emoji: null, ex: [{ id: '0025', sets: 3 }] })
const routines = [r('push', 'Push A'), r('pull', 'Pull A'), r('legs', 'Legs')]
const base = (over = {}) => ({
  routines, week: {}, dayPlan: {}, dayNotes: {}, missedSeen: {}, workouts: [], active: null,
  queue: null, rotation: null, scheduleMode: null, weekStart: 1, customEx: [], ...over,
})
const pass = (over = {}) => ({ ids: ['push', 'pull', 'legs'], since: Date.parse(TODAY + 'T06:00:00'), startsOn: TODAY, label: '', ...over })
const workout = (d, id) => ({ id: 'w-' + d, d, start: Date.parse(d + 'T10:00:00'), end: Date.parse(d + 'T11:00:00'), routineIds: [id], name: routines.find(x => x.id === id).name, entries: [] })

describe('loopState', () => {
  it('a pass of the saved loop is managed; one someone else wrote is external; an unreadable one needs recovery', () => {
    const own = loopState(base({ rotation: { id: 'r1', sequence: ['push', 'pull', 'legs'] }, queue: pass({ rotationId: 'r1' }) }), TODAY)
    expect(own).toMatchObject({ managed: true, external: false, recovery: false, seq: ['push', 'pull', 'legs'] })
    expect(own.qv.items.map(i => i.state)).toEqual(['next', 'later', 'later'])
    const theirs = loopState(base({ queue: pass({ label: 'US W1' }) }), TODAY)
    expect(theirs).toMatchObject({ managed: false, external: true, seqLabel: 'US W1' })
    const broken = loopState(base({ queue: { ids: ['gone'], since: 1 } }), TODAY)
    expect(broken).toMatchObject({ recovery: true, external: false, qv: null })
  })

  it('with no pass running, the saved sequence is the loop', () => {
    const ls = loopState(base({ rotation: { id: 'r1', sequence: ['legs', 'push', 'gone'] }, scheduleMode: 'rotation' }), TODAY)
    expect(ls).toMatchObject({ liveQ: null, seq: ['legs', 'push'], qv: null })
  })
})

describe('loopOf', () => {
  it('numbers the routines, says each one\'s state, and counts the workouts', () => {
    const S = base({ rotation: { id: 'r1', sequence: ['push', 'pull', 'legs'] }, queue: pass({ rotationId: 'r1' }), workouts: [workout(TODAY, 'push')] })
    const loop = loopOf(S, loopState(S, TODAY))
    expect(loop.line).toBe('3 workouts, then repeat')
    expect(loop.items.map(i => [i.n, i.name, i.state, i.label])).toEqual([
      [1, 'Push A', 'done', '1. Push A, Done'], [2, 'Pull A', 'next', '2. Pull A, Up next'], [3, 'Legs', 'later', '3. Legs, Later'],
    ])
  })

  it('a pinned session carries its date', () => {
    const S = base({ rotation: { id: 'r1', sequence: ['push', 'pull', 'legs'] }, queue: pass({ rotationId: 'r1' }), dayPlan: { '2026-10-21': 'legs' } })
    const legs = loopOf(S, loopState(S, TODAY)).items[2]
    expect(legs).toMatchObject({ state: 'pinned', on: '2026-10-21', sub: fmtDate('2026-10-21', true) })
  })

  it('an empty loop has no line', () => {
    expect(loopOf(base(), { seq: [], seqLabel: '', qv: null })).toMatchObject({ items: [], line: null })
  })
})

describe('planWeeks', () => {
  const S = base({ week: { 1: ['push'], 3: ['pull'], 5: ['legs'], 0: ['push'] }, workouts: [workout('2026-10-12', 'push'), workout('2026-10-14', 'pull')] })

  it('this week and next from the week\'s first day, Monday or Sunday', () => {
    const weeks = planWeeks(S, TODAY)
    expect(weeks.map(w => [w.title, w.start])).toEqual([['This week', '2026-10-12'], ['Next week', '2026-10-19']])
    expect(weeks.flatMap(w => w.days)).toHaveLength(14)
    const sunday = planWeeks({ ...S, weekStart: 0 }, TODAY)
    expect(sunday.map(w => w.start)).toEqual(['2026-10-18', '2026-10-25'])
  })

  it('each day is the rail\'s for the same date: what it holds, done, missed, rest or planned', () => {
    const days = planWeeks(S, TODAY).flatMap(w => w.days)
    for (const d of days) {
      const rail = railDay(S, d.iso, TODAY, '2026-10-12')
      expect(d.short, d.iso).toBe(rail.name || 'Rest')
      expect([d.dow, d.date]).toEqual([rail.dow, rail.date])
    }
    const by = iso => days.find(d => d.iso === iso)
    const on = (iso, ...what) => [fmtDate(iso, true), ...what].join(', ')
    expect(by('2026-10-12')).toMatchObject({ state: 'done', past: true, label: on('2026-10-12', 'Push A', 'Done') })
    expect(by('2026-10-13')).toMatchObject({ state: 'rest', label: on('2026-10-13', 'Rest day') })
    expect(by('2026-10-16')).toMatchObject({ state: 'missed', label: on('2026-10-16', 'Legs', 'Planned, not logged') })
    expect(by('2026-10-18')).toMatchObject({ state: 'planned', today: true, past: false, label: on('2026-10-18', 'Push A', 'Today') })
    expect(by('2026-10-22')).toMatchObject({ state: 'rest', short: 'Rest' })
    expect(by('2026-10-21')).toMatchObject({ state: 'planned', short: 'Pull A', label: on('2026-10-21', 'Pull A') })
  })

  it('a day changed on its own and a combined day read as the rail does; a noted day says so', () => {
    const S2 = { ...S, week: { ...S.week, 2: ['push', 'legs'] }, dayPlan: { '2026-10-23': 'rest' }, dayNotes: { '2026-10-16': { tag: 'injured', text: '', _ts: 1 } } }
    const days = planWeeks(S2, TODAY).flatMap(w => w.days)
    const by = iso => days.find(d => d.iso === iso)
    expect(by('2026-10-20')).toMatchObject({ state: 'planned', short: 'Push A + Legs', label: fmtDate('2026-10-20', true) + ', Push A + Legs, 2 routines' })
    expect(by('2026-10-23')).toMatchObject({ state: 'rest' })
    expect(by('2026-10-16')).toMatchObject({ state: 'noted', label: fmtDate('2026-10-16', true) + ', Legs, Day note' })
  })

  it('a loop\'s days come from the pass, as on the rail', () => {
    const S3 = base({ rotation: { id: 'r1', sequence: ['push', 'pull', 'legs'] }, queue: pass({ rotationId: 'r1' }), scheduleMode: 'rotation' })
    const days = planWeeks(S3, TODAY).flatMap(w => w.days)
    for (const d of days) expect(d.short, d.iso).toBe(railDay(S3, d.iso, TODAY, null).name || 'Rest')
    expect(days.find(d => d.iso === TODAY).short).toBe('Push A')
  })
})

describe('alsoFixedOf', () => {
  it('the weekdays that add a routine the loop does not hold, each with its next date', () => {
    const S = base({ week: { 1: ['push', 'legs'], 3: ['pull'], 6: ['legs'] } })
    expect(alsoFixedOf(S, TODAY, ['push', 'pull'])).toEqual([
      { dow: 1, title: 'Monday', sub: 'Legs', iso: '2026-10-19' },
      { dow: 6, title: 'Saturday', sub: 'Legs', iso: '2026-10-24' },
    ])
    expect(alsoFixedOf(S, TODAY, ['push', 'pull', 'legs'])).toEqual([])
  })
})

describe('volumeOf and isEmpty', () => {
  it('planned sets a muscle, hardest-worked first, with the 10 to 12 band', () => {
    const v = volumeOf(base({ week: { 1: ['push'], 4: ['push'] } }))
    expect(v.target).toEqual(VOLUME_TARGET)
    expect(VOLUME_TARGET).toEqual([10, 12])
    expect(v.rows.length).toBeGreaterThan(0)
    expect(v.rows[0].value).toBe(v.rows[0].sets + ' sets')
    expect(v.rows.map(x => x.sets)).toEqual([...v.rows.map(x => x.sets)].sort((a, b) => b - a))
  })

  it('nothing planned: no volume, and the page is empty (T3.3)', () => {
    expect(volumeOf(base())).toBeNull()
    expect(isEmpty(base(), [])).toBe(true)
    expect(isEmpty(base({ week: { 1: ['gone'] } }), [])).toBe(true)
    expect(isEmpty(base({ week: { 1: ['push'] } }), [])).toBe(false)
    expect(isEmpty(base(), ['push'])).toBe(false)
  })
})

describe('subOf', () => {
  it('a fixed week names its routines in week order and counts the days that hold one', () => {
    const S = base({ week: { 0: ['legs'], 1: ['push'], 3: ['pull', 'push'] } })
    expect(weekRoutinesOf(S).map(x => x.name)).toEqual(['Push A', 'Pull A', 'Legs'])
    expect(subOf(S, { mode: 'week', seq: [], empty: false })).toBe('Push A, Pull A, Legs · 3 days a week')
    expect(subOf({ ...S, week: { 2: ['push'] } }, { mode: 'week', seq: [], empty: false })).toBe('Push A · 1 day a week')
  })

  it('a loop names its routines and no days a week: there is no stored target to say', () => {
    expect(subOf(base(), { mode: 'rotation', seq: ['push', 'pull', 'legs'], empty: false })).toBe('Push A, Pull A, Legs')
    expect(subOf(base(), { mode: 'rotation', seq: [], empty: false })).toBeNull()
  })

  it('nothing planned says so', () => {
    expect(subOf(base(), { mode: 'week', seq: [], empty: true })).toBe('Nothing planned this week')
  })
})

describe('the real date', () => {
  it('today is in this week, ringed', () => {
    const today = todayISO()
    const days = planWeeks(base(), today)[0].days
    expect(days.filter(d => d.today).map(d => d.iso)).toEqual([today])
    expect(isoOf(new Date(days[0].iso + 'T12:00:00'))).toBe(days[0].iso)
  })
})
