import { describe, expect, it } from 'vitest'
import { DEFAULT_METRIC, daysBetween, goalOf, metricFrom, pointsOf, seriesOf, summaryOf, unitOf, valueOf, windowOf } from './trends.js'
import { headlines, mergeSources, presentMetrics, recoverySeries, recoveryWindow } from './wellness.js'
import { fixtureDay, fixtureSettings } from './fake-nutritrace.js'

const day = (date, kcal, protein = 0) => ({
  ...fixtureDay(date),
  items: kcal == null ? [] : [{ uuid: 'i-' + date, meal: 0, name: 'Food', quantity: 1, nutrition: { calories: kcal, proteins: protein } }],
  water: [],
})

describe('the window', () => {
  it('ends yesterday and counts `range` days back', () => {
    expect(windowOf(30, [], '2026-10-15')).toEqual({ from: '2026-09-15', to: '2026-10-14' })
  })

  it('starts at the first logged day for All, and has none without one', () => {
    expect(windowOf(0, [day('2026-10-01', 2000), day('2026-10-14', 1800)], '2026-10-15')).toEqual({ from: '2026-10-01', to: '2026-10-14' })
    expect(windowOf(0, [day('2026-10-15', 2000)], '2026-10-15')).toBeNull()
    expect(windowOf(0, [], '2026-10-15')).toBeNull()
  })

  it('lists every calendar day across a month and a daylight saving change', () => {
    expect(daysBetween('2026-10-24', '2026-10-27')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'])
    expect(daysBetween('2026-03-27', '2026-03-30')).toHaveLength(4)
  })
})

describe('a day, as a value', () => {
  it('is empty without food, and 0 for a nutrient the food does not carry', () => {
    expect(valueOf(day('2026-10-14', null), 'calories')).toBeNull()
    expect(valueOf(undefined, 'calories')).toBeNull()
    expect(valueOf(day('2026-10-14', 500), 'iron')).toBe(0)
    expect(valueOf(day('2026-10-14', 500, 30), 'proteins')).toBe(30)
  })

  it('counts water from its own list', () => {
    expect(valueOf({ items: [], water: [{ amount: 250 }, { amount: 500 }] }, 'water')).toBe(750)
    expect(valueOf({ items: [{ nutrition: { calories: 1 } }], water: [] }, 'water')).toBeNull()
  })
})

describe('a series', () => {
  const days = [day('2026-10-12', 2000, 100), day('2026-10-14', 1000, 50)]
  const win = { from: '2026-10-12', to: '2026-10-14' }

  it('keeps the gap between logged days empty', () => {
    expect(seriesOf(days, 'calories', win, fixtureSettings()).map(p => p.value)).toEqual([2000, null, 1000])
  })

  it('summarises only the days that have a value', () => {
    expect(summaryOf(seriesOf(days, 'calories', win, {}))).toEqual({ avg: 1500, min: 1000, max: 2000, count: 2 })
    expect(summaryOf(seriesOf([], 'calories', win, {}))).toBeNull()
    expect(pointsOf(seriesOf(days, 'calories', win, {})).map(p => [p.d, p.y])).toEqual([['2026-10-12', 2000], ['2026-10-14', 1000]])
  })

  it('shows kcal as kJ and ml in the water unit', () => {
    expect(seriesOf(days, 'calories', win, { energyUnit: 'kJ' })[0].value).toBe(8368)
    expect(unitOf('calories', { energyUnit: 'kJ' })).toBe('kJ')
    expect(unitOf('proteins', {})).toBe('g')
    const wet = [{ date: '2026-10-12', items: [], water: [{ amount: 1500 }] }]
    expect(seriesOf(wet, 'water', { from: '2026-10-12', to: '2026-10-12' }, { waterUnit: 'L' })[0].value).toBe(1.5)
  })
})

describe('the metric in the address', () => {
  it('takes a known nutrient and falls back to calories for anything else', () => {
    expect(metricFrom('fiber')).toBe('fiber')
    expect(metricFrom('water')).toBe('water')
    expect(metricFrom('nope')).toBe(DEFAULT_METRIC)
    expect(metricFrom(null)).toBe(DEFAULT_METRIC)
  })
})

describe('the goal line', () => {
  const win = { from: '2026-10-12', to: '2026-10-14' }

  it('is the fixed calorie target, and the macro in grams', () => {
    expect(goalOf(fixtureSettings(), 'calories', win)).toBe(2200)
    expect(goalOf(fixtureSettings(), 'proteins', win)).toBe(160)
    expect(goalOf(fixtureSettings(), 'fat', win)).toBe(70)
  })

  it('turns a percentage goal into grams against the calorie target', () => {
    // 30 % of 2200 kcal as carbohydrates, 4 kcal a gram
    expect(goalOf(fixtureSettings(), 'carbohydrates', win)).toBe(165)
  })

  it('averages a weekday split over the days shown', () => {
    const settings = { ...fixtureSettings(), goals: { calories: { sharedGoal: false, days: [1000, 2000, 2000, 2000, 2000, 2000, 2000], max: 2000 } } }
    // 2026-10-12 is a Monday (index 1), 13 a Tuesday, 14 a Wednesday
    expect(goalOf(settings, 'calories', win)).toBe(2000)
    expect(goalOf(settings, 'calories', { from: '2026-10-11', to: '2026-10-11' })).toBe(1000)
  })

  it('has none for a target worked out per day, for a nutrient without a goal, or without data', () => {
    expect(goalOf({ ...fixtureSettings(), calorieGoalMode: 'dynamic' }, 'calories', win)).toBeNull()
    expect(goalOf({ ...fixtureSettings(), calorieGoalMode: 'adaptive' }, 'carbohydrates', win)).toBeNull()
    expect(goalOf(fixtureSettings(), 'iron', win)).toBeNull()
    expect(goalOf(null, 'calories', win)).toBeNull()
    expect(goalOf(fixtureSettings(), 'calories', null)).toBeNull()
  })

  it('shows the water goal in the water unit', () => {
    expect(goalOf({ ...fixtureSettings(), waterUnit: 'L' }, 'water', win)).toBe(2.5)
  })
})

describe('wearable data', () => {
  const fitbit = { '2026-10-13': { sleep_duration_min: 420, resting_hr: 55, steps: 8000, weight_kg: 80 }, '2026-10-14': { resting_hr: 'x', hrv_daily_rmssd: 40 } }
  const garmin = { '2026-10-13': { resting_hr: 52 } }

  it('lets Garmin win a metric both report, and drops what is not a number or not shown', () => {
    expect(mergeSources(fitbit, garmin)).toEqual({
      '2026-10-13': { sleep_duration_min: 420, resting_hr: 52, steps: 8000 },
      '2026-10-14': { hrv_daily_rmssd: 40 },
    })
    expect(mergeSources(null, undefined)).toEqual({})
    expect(mergeSources('x', [])).toEqual({})
  })

  it('names the metrics with data, in the page order', () => {
    expect(presentMetrics(mergeSources(fitbit, garmin)).map(m => m.value)).toEqual(['sleep_duration_min', 'resting_hr', 'hrv_daily_rmssd', 'steps'])
    expect(presentMetrics({})).toEqual([])
  })

  it('shows sleep in hours and keeps the days without a reading empty', () => {
    const win = recoveryWindow(3, '2026-10-15')
    expect(win).toEqual({ from: '2026-10-13', to: '2026-10-15' })
    expect(recoverySeries(mergeSources(fitbit, garmin), 'sleep_duration_min', win).map(p => p.value)).toEqual([7, null, null])
  })

  it('caps the window at the year that was fetched', () => {
    expect(daysBetween(recoveryWindow(0, '2026-10-15').from, '2026-10-15')).toHaveLength(365)
  })

  it('picks the headline metrics with data in the window', () => {
    const byDate = mergeSources(fitbit, garmin)
    expect(headlines(byDate, recoveryWindow(30, '2026-10-15')).map(h => [h.value, h.avg])).toEqual([['sleep_duration_min', 7], ['resting_hr', 52]])
    expect(headlines(byDate, recoveryWindow(30, '2027-10-15'))).toEqual([])
  })
})
