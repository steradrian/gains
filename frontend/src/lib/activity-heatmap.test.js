import { describe, expect, it } from 'vitest'
import { activityGrid, levelOf, levelThresholds, normalizeMetric, totalsByDay } from './activity-heatmap.js'
import { isoOf } from './format.js'

// Wednesday 21 October 2026, mid-afternoon local time
const NOW = new Date(2026, 9, 21, 15, 0, 0)
const MIN = 60000
const at = (iso, minutes, extra) => {
  const start = +new Date(iso + 'T08:00:00')
  return { d: iso, start, end: start + minutes * MIN, ...extra }
}

describe('totalsByDay', () => {
  it('adds a day\'s workouts up: how many, their volume and their minutes', () => {
    const totals = totalsByDay([at('2026-10-20', 30, { vol: 100 }), at('2026-10-20', 15, { vol: 50 }), at('2026-10-19', 10, { vol: 5 })])
    expect(totals['2026-10-20']).toEqual({ n: 2, vol: 150, min: 45 })
    expect(totals['2026-10-19']).toEqual({ n: 1, vol: 5, min: 10 })
  })

  it('recomputes volume from completed sets, leaving out warm-ups, and counts each side at its own load', () => {
    const w = at('2026-10-20', 15, {
      vol: 999,
      entries: [{ sets: [
        { w: 100, r: 10, done: true, phase: 'warmup' },
        { w: 14, r: 16, done: true, sides: { L: { w: 14, r: 10, done: true }, R: { w: 12.5, r: 6, done: true } } },
      ] }],
    })
    expect(totalsByDay([w])['2026-10-20']).toEqual({ n: 1, vol: 215, min: 15 })
  })

  it('takes the day from the saved date, then from the start time, and leaves out a record with neither', () => {
    const start = +new Date(2026, 9, 19, 23, 30)
    const totals = totalsByDay([
      { d: 'not-a-day', start, end: start + MIN, vol: 1 },
      { d: '2026-10-18', start: start + 86400000 * 5, vol: 1 },
      { d: 'nope', start: NaN, end: NaN, vol: 1 },
    ])
    expect(Object.keys(totals).sort()).toEqual(['2026-10-18', '2026-10-19'])
  })

  it('has nothing for no workouts', () => {
    expect(totalsByDay(undefined)).toEqual({})
    expect(totalsByDay([])).toEqual({})
  })
})

describe('levels', () => {
  const four = [1, 2, 3, 4].map(n => at('2026-10-0' + n, n, { vol: (5 - n) * 100 }))

  it('shades days by the quartiles of the days that have any: 2 to 4 above a floor of 1, 0 for none', () => {
    const totals = totalsByDay(four)
    const thresholds = levelThresholds(totals, 'time')
    expect(thresholds).toEqual([2, 3, 4])
    expect(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map(d => levelOf(totals[d], 'time', thresholds))).toEqual([1, 2, 3, 4])
    expect(levelOf(undefined, 'time', thresholds)).toBe(0)
  })

  it('shades by volume when asked, and an unknown metric means time', () => {
    const totals = totalsByDay(four)
    const thresholds = levelThresholds(totals, 'vol')
    expect(levelOf(totals['2026-10-01'], 'vol', thresholds)).toBe(4)
    expect(levelOf(totals['2026-10-04'], 'vol', thresholds)).toBe(1)
    expect(normalizeMetric('vol')).toBe('vol')
    expect(normalizeMetric('anything')).toBe('time')
    expect(normalizeMetric(undefined)).toBe('time')
  })

  it('a workout with none of the metric is still level 1, not 0', () => {
    const totals = totalsByDay([{ d: '2026-10-20', start: +new Date(2026, 9, 20, 8) }])
    expect(levelOf(totals['2026-10-20'], 'time', levelThresholds(totals, 'time'))).toBe(1)
  })

  it('has zero thresholds with no data', () => {
    expect(levelThresholds({}, 'time')).toEqual([0, 0, 0])
  })
})

describe('activityGrid', () => {
  it('lays out 53 weeks of 7, the last starting on the week-start day and holding today', () => {
    for (const weekStart of [1, 0]) {
      const { cells } = activityGrid({ workouts: [], weekStart, now: NOW })
      expect(cells).toHaveLength(53 * 7)
      const last = cells.slice(-7)
      expect(new Date(last[0].iso + 'T12:00:00').getDay()).toBe(weekStart)
      expect(last.map(c => c.iso)).toContain('2026-10-21')
      expect(new Date(cells[0].iso + 'T12:00:00').getDay()).toBe(weekStart)
    }
  })

  it('a Monday-first year runs from Monday 20 Oct 2025 to Sunday 25 Oct 2026', () => {
    const { cells } = activityGrid({ workouts: [], weekStart: 1, now: NOW })
    expect(cells[0].iso).toBe('2025-10-20')
    expect(cells.at(-1).iso).toBe('2026-10-25')
  })

  it('marks today, the days after it, and a note on a day with no workout', () => {
    const { cells } = activityGrid({
      workouts: [at('2026-10-20', 30)], weekStart: 1, now: NOW, hasNote: iso => iso === '2026-10-20' || iso === '2026-10-17',
    })
    const by = iso => cells.find(c => c.iso === iso)
    expect(by('2026-10-21').today).toBe(true)
    expect(cells.filter(c => c.today)).toHaveLength(1)
    expect(by('2026-10-21').future).toBe(false)
    expect(by('2026-10-22').future).toBe(true)
    expect(by('2026-10-25').future).toBe(true)
    expect(by('2026-10-20').noted).toBe(false)
    expect(by('2026-10-17').noted).toBe(true)
    expect(by('2026-10-16').noted).toBe(false)
  })

  it('carries each day\'s totals and level', () => {
    const { cells, totals } = activityGrid({ workouts: [at('2026-10-20', 30, { vol: 100 })], weekStart: 1, now: NOW, metric: 'vol' })
    const day = cells.find(c => c.iso === '2026-10-20')
    expect(day).toMatchObject({ n: 1, vol: 100, min: 30, level: 4 })
    expect(cells.find(c => c.iso === '2026-10-19')).toMatchObject({ n: 0, vol: 0, min: 0, level: 0 })
    expect(totals['2026-10-20'].n).toBe(1)
  })

  it('puts a month\'s label over the week its first days fall in, never in the last two columns', () => {
    const { months } = activityGrid({ workouts: [], weekStart: 1, now: NOW })
    expect(months[0]).toEqual({ week: 2, month: 10 })
    expect(months.map(m => m.month)).toEqual([10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(months.at(-1)).toEqual({ week: 50, month: 9 })
    expect(months.every(m => m.week < 51)).toBe(true)
  })

  it('reads the local day, so the late evening of one day is not the next', () => {
    const late = new Date(2026, 9, 21, 23, 59)
    const { cells } = activityGrid({ workouts: [], weekStart: 1, now: late })
    expect(cells.find(c => c.today).iso).toBe(isoOf(late))
  })
})
