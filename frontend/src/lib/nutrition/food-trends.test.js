import { describe, expect, it } from 'vitest'
import {
  FOOD_RANGES, MIN_TREND_DAYS, dayFiguresOf, fastingBlockOf, foodRangeFrom, foodTrendsOf, foodWindowOf, hoursClock, loggedDatesOf, monthOf,
  weekdayLetters,
} from './trends.js'

// Eat › Food trends and Month, pure: a day judged against its own goal, today shown but never
// counted, the gate on logged days, the fasting block, and the month grid's cells.
const TODAY = '2026-10-18'
const entry = (date, kcal, protein = 0) => ({
  date, water: [], items: [{ uuid: 'i-' + date, meal: 0, name: 'Food', quantity: 1, nutrition: { calories: kcal, proteins: protein } }],
})
const settings = (calories = { sharedGoal: true, max: 2000 }, extra = {}) => ({
  calorieGoalMode: 'fixed', goals: { ...(calories ? { calories } : {}), proteins: { sharedGoal: true, max: 100 } }, ...extra,
})
const trends = (days, over = {}) => foodTrendsOf({ days, settings: settings(), range: 7, today: TODAY, ...over })

describe('the range', () => {
  it('is 7, 30 or 90 from the address, and 7 for anything else', () => {
    expect(FOOD_RANGES).toEqual([7, 30, 90])
    expect(foodRangeFrom('30')).toBe(30)
    expect(foodRangeFrom('90')).toBe(90)
    expect(foodRangeFrom(null)).toBe(7)
    expect(foodRangeFrom('14')).toBe(7)
    expect(foodRangeFrom('abc')).toBe(7)
  })

  it('ends today and counts `range` days back', () => {
    expect(foodWindowOf(7, TODAY)).toEqual({ from: '2026-10-12', to: TODAY })
    expect(foodWindowOf(30, TODAY).from).toBe('2026-09-19')
  })

  it('draws a bar a day for a week and a bar a week, counted back from today, for 30 and 90 days', () => {
    expect(trends([]).bars).toHaveLength(7)
    const month = trends([], { range: 30 }).bars
    expect(month).toHaveLength(5)
    expect(month.at(-1).to).toBe(TODAY)
    expect(month.map(b => b.one)).toEqual([false, false, false, false, false])
    expect(trends([], { range: 90 }).bars).toHaveLength(13)
  })
})

describe('a day, judged', () => {
  it('has nothing until the settings are in', () => {
    expect(dayFiguresOf({ settings: null, entry: entry('2026-10-15', 2000), date: '2026-10-15' })).toBeNull()
  })

  it('waits for a Dynamic day\'s burn, then holds the day to it', () => {
    const dynamic = settings({ sharedGoal: true, max: 2000 }, { calorieGoalMode: 'dynamic', calorieGoalFactor: 1 })
    const args = { settings: dynamic, entry: entry('2026-10-15', 2600), date: '2026-10-15' }
    expect(dayFiguresOf(args)).toBeNull()
    const f = dayFiguresOf({ ...args, goalInputs: { '2026-10-15': 2500 } })
    expect(f).toMatchObject({ kcal: 2600, target: 2500, band: 'on' })
  })

  it('has a band within 150 kcal of the goal, over above and under below', () => {
    const band = kcal => dayFiguresOf({ settings: settings(), entry: entry('2026-10-15', kcal), date: '2026-10-15' }).band
    expect([band(1850), band(2150), band(2151), band(1849)]).toEqual(['on', 'on', 'over', 'under'])
  })

  it('has no target and no band without a goal', () => {
    const f = dayFiguresOf({ settings: settings(null), entry: entry('2026-10-15', 2600), date: '2026-10-15' })
    expect(f).toMatchObject({ logged: true, kcal: 2600, target: null, band: null })
  })

  it('counts a day with an empty entry as not logged', () => {
    expect(dayFiguresOf({ settings: settings(), entry: { date: '2026-10-15', items: [], water: [] }, date: '2026-10-15' }).logged).toBe(false)
    expect(loggedDatesOf([{ date: '2026-10-15', items: [] }, entry('2026-10-16', 1)], '2026-10-12', TODAY)).toEqual(['2026-10-16'])
  })
})

describe('Food trends', () => {
  const week = [entry('2026-10-15', 2000, 100), entry('2026-10-16', 2100, 110), entry('2026-10-17', 1900, 90)]

  it('averages the logged days and leaves today out of the average, the count and the rows', () => {
    const data = trends([...week, entry(TODAY, 5000, 300)])
    expect(data.loggedCount).toBe(3)
    expect(data.avg).toBe(2000)
    expect(data.onTarget).toEqual({ days: 3, of: 3 })
    expect(data.protein).toEqual({ avg: 100, target: 100 })
    expect(data.rows.map(r => r.date)).toEqual(['2026-10-17', '2026-10-16', '2026-10-15'])
  })

  it('still draws today, as the open last bar, with what it has so far', () => {
    const bars = trends([...week, entry(TODAY, 900)]).bars
    expect(bars.at(-1)).toMatchObject({ from: TODAY, value: 900, open: true })
    expect(bars.slice(0, -1).some(b => b.open)).toBe(false)
  })

  it('holds each day to its own goal', () => {
    const split = settings({ sharedGoal: false, days: [2000, 2000, 1500, 2000, 2000, 2000, 2000] })
    const days = [entry('2026-10-12', 2000), entry('2026-10-13', 1500), entry('2026-10-14', 2000)]
    const data = trends(days, { settings: split })
    expect(data.rows.map(r => [r.date, r.target, r.band])).toEqual([['2026-10-14', 2000, 'on'], ['2026-10-13', 1500, 'on'], ['2026-10-12', 2000, 'on']])
    expect(data.onTarget).toEqual({ days: 3, of: 3 })
    expect(data.bars.find(b => b.from === '2026-10-13').target).toBe(1500)
    expect(data.targetLine).toBeNull()
    expect(data.hasTargets).toBe(true)
  })

  it('has one target line when every bar has the same goal', () => {
    const data = trends(week)
    expect(data.targetLine).toBe(2000)
    expect(data.hasTargets).toBe(true)
  })

  it('has no target line, no On target and no band for days without a goal', () => {
    const data = trends(week, { settings: settings(null) })
    expect(data.targetLine).toBeNull()
    expect(data.hasTargets).toBe(false)
    expect(data.onTarget).toBeNull()
    expect(data.bars.every(b => b.target == null)).toBe(true)
    expect(data.rows.every(r => r.band === null)).toBe(true)
    expect(data.avg).toBe(2000)
  })

  it('leaves a macro\'s target out when no day had a goal for it', () => {
    const data = trends(week, { settings: { calorieGoalMode: 'fixed', goals: { calories: { sharedGoal: true, max: 2000 } } } })
    expect(data.macros.find(m => m.id === 'proteins')).toMatchObject({ avg: 100, target: null })
  })

  it('needs 3 logged days, not 3 calendar days, and today does not count', () => {
    expect(MIN_TREND_DAYS).toBe(3)
    const two = trends([week[0], week[2], entry(TODAY, 1000)])
    expect(two.loggedCount).toBe(2)
    expect(two.enough).toBe(false)
    const far = trends([entry('2026-08-01', 2000), entry('2026-09-01', 2000), entry('2026-10-01', 2000)], { range: 90 })
    expect(far.loggedCount).toBe(3)
    expect(far.enough).toBe(true)
    expect(trends(week).enough).toBe(true)
  })

  it('counts only the days inside the range', () => {
    const data = trends([...week, entry('2026-10-01', 2000)])
    expect(data.loggedCount).toBe(3)
    expect(trends([...week, entry('2026-10-01', 2000)], { range: 30 }).loggedCount).toBe(4)
  })

  it('is not ready while a logged day\'s target is still loading', () => {
    const dynamic = settings({ sharedGoal: true, max: 2000 }, { calorieGoalMode: 'dynamic' })
    expect(trends(week, { settings: dynamic }).ready).toBe(false)
    expect(trends(week, { settings: dynamic }).loggedCount).toBe(3)
    const inputs = { '2026-10-15': 2000, '2026-10-16': 2000, '2026-10-17': 2000 }
    expect(trends(week, { settings: dynamic, goalInputs: inputs }).ready).toBe(true)
  })

  it('averages a week per bar for 30 days, today left out of it', () => {
    const data = trends([...week, entry(TODAY, 4000)], { range: 30 })
    expect(data.bars.at(-1)).toMatchObject({ value: 2000, open: true, one: false })
  })
})

describe('the Fasting block', () => {
  const fast = { id: 1, start_at: '2026-10-14T20:00:00.000Z', end_at: '2026-10-15T12:00:00.000Z', goal_hours: 16 }
  const now = Date.parse('2026-10-15T14:00:00.000Z')

  it('is left out with no fasts in range', () => {
    expect(fastingBlockOf({ history: [], since: 0, now })).toBeNull()
    expect(fastingBlockOf({ history: [fast], since: Date.parse('2026-10-16T00:00:00.000Z'), now })).toBeNull()
  })

  it('gives the average, the streak and the longest fast with the day it ended', () => {
    const longer = { id: 2, start_at: '2026-10-12T16:00:00.000Z', end_at: '2026-10-13T12:00:00.000Z', goal_hours: 16 }
    const block = fastingBlockOf({ history: [fast, longer], since: 0, now })
    expect(block).toMatchObject({ avgHours: 18, longestHours: 20 })
    expect(block.longestDay).toMatch(/^2026-10-13$/)
  })

  it('writes hours as a clock', () => {
    expect(hoursClock(15 + 40 / 60)).toBe('15:40')
    expect(hoursClock(18 + 5 / 60)).toBe('18:05')
    expect(hoursClock(16)).toBe('16:00')
  })
})

describe('Month', () => {
  const openOf = iso => (iso === TODAY ? 'today' : iso > TODAY ? 'future' : 'day')
  const month = (days, over = {}) => monthOf({ month: '2026-10', days, settings: settings(), weekStart: 1, openOf, ...over })
  const cell = (data, day) => data.cells[day - 1]
  const days = [entry('2026-10-09', 2400), entry('2026-10-13', 2100), entry('2026-10-14', 1500), entry(TODAY, 900)]

  it('has a cell a day, the blanks before day 1 for the week\'s start, and what each opens', () => {
    const data = month(days)
    expect(data.cells).toHaveLength(31)
    expect(data.offset).toBe(3)
    expect(month(days, { weekStart: 0 }).offset).toBe(4)
    expect([cell(data, 9).open, cell(data, 18).open, cell(data, 19).open]).toEqual(['day', 'today', 'future'])
  })

  it('draws a ring on target full, over past full and under short of it', () => {
    const data = month(days)
    expect(cell(data, 13).ring).toBe(1)
    expect(cell(data, 9).ring).toBeCloseTo(1.2)
    expect(cell(data, 14).ring).toBeCloseTo(0.75)
  })

  it('draws no ring for a day with nothing logged, a day ahead, or a day with no goal', () => {
    const data = month(days)
    expect(cell(data, 10).ring).toBeNull()
    expect(cell(data, 25)).toMatchObject({ ring: null, figures: null })
    expect(cell(month(days, { settings: settings(null) }), 13).ring).toBeNull()
  })

  it('shows today\'s ring but never over', () => {
    expect(cell(month([entry(TODAY, 3000)]), 18).ring).toBe(1)
    expect(cell(month(days), 18).ring).toBeCloseTo(0.45)
  })

  it('counts the days before today only: on target, the average and the over days, newest first', () => {
    const data = month([...days, entry('2026-10-12', 2500)])
    expect(data.tiles.onTarget).toEqual({ days: 1, of: 4 })
    expect(data.tiles.avg).toBe(2125)
    expect(data.tiles.over).toEqual({ days: 2, dates: ['2026-10-12', '2026-10-09'] })
  })

  it('has no tiles for a month with nothing logged, and no On target or Over without a goal', () => {
    expect(month([]).tiles).toEqual({ onTarget: null, avg: null, over: null })
    const none = month(days, { settings: settings(null) }).tiles
    expect(none.onTarget).toBeNull()
    expect(none.over).toBeNull()
    expect(none.avg).toBe(2000)
  })

  it('is not ready while a logged day\'s target is loading', () => {
    const dynamic = settings({ sharedGoal: true, max: 2000 }, { calorieGoalMode: 'dynamic' })
    expect(month(days, { settings: dynamic }).ready).toBe(false)
    expect(month(days).ready).toBe(true)
  })

  it('names the week\'s days from where it starts', () => {
    expect(weekdayLetters(1, 'en').join('')).toBe('MTWTFSS')
    expect(weekdayLetters(0, 'en').join('')).toBe('SMTWTFS')
  })
})
