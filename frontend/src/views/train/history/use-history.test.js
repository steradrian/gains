import { describe, expect, it } from 'vitest'
import { activitiesOf, historyRows, historySub, historyWeeks, monthOf, muscleSentence, workoutLine, workoutThumbs } from './use-history.js'

const at = (iso, h = 17) => new Date(iso + 'T' + String(h).padStart(2, '0') + ':00:00').getTime()
const session = (id, d, more = {}) => ({ id, d, name: id, start: at(d), end: at(d) + 52 * 60000, vol: 9600, prs: [], entries: [], ...more })
const TODAY = '2026-10-21'   // a Wednesday
const state = (over = {}) => ({ unit: 'kg', weekStart: 1, workouts: [], dayNotes: {}, ...over })

describe('historyRows', () => {
  it('newest first, the later of two on one day first, with day notes between and none on a trained day', () => {
    const S = state({
      workouts: [session('a', '2026-10-05'), session('b', '2026-10-12'), session('c', '2026-10-12', { start: at('2026-10-12', 19) })],
      dayNotes: { '2026-10-08': { tag: 'sick', _ts: 1 }, '2026-10-12': { tag: 'rest', _ts: 1 } },
    })
    expect(historyRows(S).map(r => (r.w ? r.w.id : 'note ' + r.d))).toEqual(['c', 'b', 'note 2026-10-08', 'a'])
  })
})

describe('historyWeeks', () => {
  it('groups by the profile\'s week: This week, Last week, then Week of its first day, newest first', () => {
    const S = state({ workouts: [session('old', '2026-08-04'), session('last', '2026-10-13'), session('now1', '2026-10-19'), session('now2', '2026-10-21')] })
    const weeks = historyWeeks(S, TODAY)
    expect(weeks.map(w => w.title)).toEqual(['This week', 'Last week', 'Week of 3 Aug'])
    expect(weeks.map(w => w.key)).toEqual(['2026-10-19', '2026-10-12', '2026-08-03'])
    expect(weeks.map(w => w.rows.map(r => r.w.id))).toEqual([['now2', 'now1'], ['last'], ['old']])
  })

  it('counts workouts only: a day note keeps its place in its week without counting', () => {
    const S = state({ workouts: [session('w', '2026-10-13')], dayNotes: { '2026-10-16': { text: 'Flu', _ts: 1 }, '2026-10-01': { tag: 'travel', _ts: 1 } } })
    const weeks = historyWeeks(S, TODAY)
    expect(weeks.map(w => [w.title, w.workouts, w.rows.length])).toEqual([['Last week', 1, 2], ['Week of 28 Sep', 0, 1]])
  })

  it('follows a week that starts on Sunday', () => {
    const S = state({ weekStart: 0, workouts: [session('sun', '2026-10-18'), session('sat', '2026-10-17')] })
    expect(historyWeeks(S, TODAY).map(w => [w.title, w.rows.length])).toEqual([['This week', 1], ['Last week', 1]])
  })

  it('is empty with nothing logged', () => {
    expect(historyWeeks(state(), TODAY)).toEqual([])
  })
})

describe('historySub', () => {
  it('counts every workout since the month of the first, naming the year when it was another', () => {
    expect(historySub(state({ workouts: [session('a', '2026-08-04'), session('b', '2026-10-13')] }), TODAY)).toBe('2 workouts since August')
    expect(historySub(state({ workouts: [session('a', '2025-12-30')] }), TODAY)).toBe('1 workout since December 2025')
    expect(historySub(state(), TODAY)).toBeNull()
  })
})

describe('workoutLine', () => {
  it('says the day, the length, the volume by Train\'s rule and the new bests the data has', () => {
    expect(workoutLine(session('a', '2026-10-12', { prs: ['x', 'y'] }), 'kg')).toBe('Mon 12 Oct · 52 min · 9,600 kg · 2 new bests')
    expect(workoutLine(session('a', '2026-10-10', { vol: 12400, prs: ['x'] }), 'kg')).toBe('Sat 10 Oct · 52 min · 12.4 t · 1 new best')
  })

  it('leaves out an unknown length, and counts the photos and videos it carries', () => {
    const imported = { ...session('a', '2026-10-12'), start: undefined, end: undefined }
    expect(workoutLine(imported, 'lb')).toBe('Mon 12 Oct · 9,600 lb')
    const ref = n => ({
      kind: 'image', hash: String(n).repeat(64), mime: 'image/webp', size: 200000, width: 1600, height: 1200,
      poster: { hash: String(n + 4).repeat(64), mime: 'image/webp', size: 2000, width: 480, height: 360 }, at: 1727000000000,
    })
    const withMedia = session('a', '2026-10-12', { media: [ref(1), ref(2)] })
    expect(workoutLine(withMedia, 'kg')).toBe('Mon 12 Oct · 52 min · 9,600 kg · 2 photos or videos')
  })
})

describe('workoutThumbs', () => {
  it('the first three exercises\' stills, null for one without a picture', () => {
    const w = session('a', '2026-10-12', { entries: [{ id: '0025' }, { id: 'custom-x' }, { id: '0025' }, { id: '0025' }] })
    const thumbs = workoutThumbs(state(), w)
    expect(thumbs).toHaveLength(3)
    expect(thumbs[0]).toMatch(/\.(webp|gif|png|jpg)$/)
    expect(thumbs[1]).toBeNull()
  })
})

describe('monthOf', () => {
  it('lays out the month for the calendar: title, blanks before the 1st, letters, today', () => {
    const m = monthOf(state(), 2026, 9, TODAY)
    expect(m.title).toBe('October 2026')
    expect(m.offset).toBe(3)   // 1 Oct 2026 is a Thursday, the week starts Monday
    expect(m.weekdays).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
    expect(m.days).toHaveLength(31)
    expect(m.today).toBe(21)
    expect(monthOf(state(), 2026, 8, TODAY).today).toBeUndefined()
    expect(monthOf(state({ weekStart: 0 }), 2026, 9, TODAY).offset).toBe(4)
  })

  it('rings the trained days and names every day for a screen reader, with its count', () => {
    const S = state({ workouts: [session('a', '2026-10-12'), session('b', '2026-10-14'), session('c', '2026-10-14', { start: at('2026-10-14', 19) })] })
    const { days } = monthOf(S, 2026, 9, TODAY)
    const day = n => days[n - 1]
    expect(day(12)).toMatchObject({ iso: '2026-10-12', value: 1, workouts: 1, label: 'Mon 12 Oct, 1 workout' })
    expect(day(14)).toMatchObject({ value: 1, workouts: 2, label: 'Wed 14 Oct, 2 workouts' })
    expect(day(13)).toMatchObject({ iso: '2026-10-13', value: null, workouts: 0, label: 'Tue 13 Oct' })
  })
})

describe('the activities switch', () => {
  it('has no source yet, so History shows workouts and notes only', () => {
    expect(activitiesOf(state())).toEqual([])
  })
})

describe('muscleSentence', () => {
  it('names the three muscles the workout loaded most, in that order', () => {
    const w = session('a', '2026-10-12', { entries: [{ id: '0025', target: { mode: 'reps' }, sets: [{ w: 60, r: 8, done: true }, { w: 60, r: 8, done: true }] }] })
    const s = muscleSentence(w)
    expect(s).toMatch(/^Chest, .+ and .+ did most of the work\.$/)
  })

  it('is null when nothing loaded a muscle: no sets, or none done', () => {
    expect(muscleSentence(session('a', '2026-10-12'))).toBeNull()
    expect(muscleSentence(session('a', '2026-10-12', { entries: [{ id: '0025', target: { mode: 'reps' }, sets: [{ w: 60, r: 8, done: false }] }] }))).toBeNull()
  })
})
