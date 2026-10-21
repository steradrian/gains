// @vitest-environment happy-dom
// The Day and Week addresses (PR07 D1, D2): ISO week names both ways for Monday and Sunday weeks,
// the first log, which days and weeks open, and where navToDay / navToWeek send each one.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { SUNDAY } from './format.js'

const nav = vi.fn()
const dayOverrideSheet = vi.fn()
vi.mock('./nav.js', async importOriginal => ({ ...(await importOriginal()), nav: (...a) => nav(...a) }))
vi.mock('../sheets/plan.jsx', async importOriginal => ({ ...(await importOriginal()), dayOverrideSheet: (...a) => dayOverrideSheet(...a) }))

const {
  dayPath, dayTargetOf, firstLogDay, isDate, isoWeekOf, navToDay, navToWeek, weekNumberOf, weekPath, weekStartOfId, weekTargetOf,
} = await import('./day-route.js')
const { parentOf } = await import('./tab-route.js')

const TODAY = '2026-10-18'
const clone = o => JSON.parse(JSON.stringify(o))

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(TODAY + 'T09:00:00')) })
afterAll(() => vi.useRealTimers())
beforeEach(() => {
  nav.mockClear()
  dayOverrideSheet.mockClear()
  useStore.setState({ S: { ...clone(DEF), workouts: [{ id: 'w', d: '2026-10-01', start: 1, end: 2, entries: [] }] } })
})

describe('ISO weeks', () => {
  it('names the board weeks as 2026-W42 and 2026-W41', () => {
    expect(isoWeekOf('2026-10-12')).toBe('2026-W42')
    expect(isoWeekOf('2026-10-18')).toBe('2026-W42')
    expect(isoWeekOf('2026-10-11')).toBe('2026-W41')
  })

  it('reads a week name back to its Monday', () => {
    expect(weekStartOfId('2026-W42')).toBe('2026-10-12')
    expect(weekStartOfId('2026-W41')).toBe('2026-10-05')
  })

  it('puts the days around New Year in the ISO year that owns their week', () => {
    expect(isoWeekOf('2026-01-01')).toBe('2026-W01')
    expect(isoWeekOf('2027-01-01')).toBe('2026-W53')
    expect(weekStartOfId('2026-W01')).toBe('2025-12-29')
    expect(weekStartOfId('2026-W53')).toBe('2026-12-28')
  })

  it('gives a Sunday week the name of the ISO week its Monday is in, both ways', () => {
    // Sun 11 Oct to Sat 17 Oct holds Monday 12 Oct.
    expect(isoWeekOf('2026-10-11', SUNDAY)).toBe('2026-W42')
    expect(isoWeekOf('2026-10-17', SUNDAY)).toBe('2026-W42')
    expect(isoWeekOf('2026-10-18', SUNDAY)).toBe('2026-W43')
    expect(weekStartOfId('2026-W42', SUNDAY)).toBe('2026-10-11')
  })

  it('refuses names that are no week', () => {
    for (const bad of ['2026-W54', '2025-W53', '2026-W00', '2026-42', 'W42', '', null, undefined]) expect(weekStartOfId(bad)).toBeNull()
    expect(weekNumberOf('2026-W41')).toBe(41)
    expect(weekNumberOf('nope')).toBeNull()
  })

  it('checks a date is a real calendar day', () => {
    expect(isDate('2026-10-12')).toBe(true)
    expect(isDate('2026-02-30')).toBe(false)
    expect(isDate('2026-1-1')).toBe(false)
    expect(isDate(20261012)).toBe(false)
  })
})

describe('the first log', () => {
  it('is the earliest of a workout, a weigh-in, a measurement and a food day', () => {
    const S = { workouts: [{ d: '2026-09-10' }], bodyweight: [{ d: '2026-09-05', w: 80 }], measurements: [{ d: '2026-09-20' }] }
    expect(firstLogDay(S)).toBe('2026-09-05')
    expect(firstLogDay(S, [{ date: '2026-10-01' }, { date: '2026-08-30' }])).toBe('2026-08-30')
  })

  it('is null with nothing logged', () => {
    expect(firstLogDay({ workouts: [], bodyweight: [], measurements: [] })).toBeNull()
  })
})

describe('what a day and a week open', () => {
  const first = '2026-10-01'
  it('a past day after the first log opens the Day page', () => {
    expect(dayTargetOf('2026-10-12', { today: TODAY, first })).toBe('day')
    expect(dayTargetOf(first, { today: TODAY, first })).toBe('day')
  })

  it('today opens Today, a day to come the Plan day drawer, a day before the first log nothing', () => {
    expect(dayTargetOf(TODAY, { today: TODAY, first })).toBe('today')
    expect(dayTargetOf('2026-10-19', { today: TODAY, first })).toBe('future')
    expect(dayTargetOf('2026-09-30', { today: TODAY, first })).toBe('before')
    expect(dayTargetOf('2026-10-12', { today: TODAY, first: null })).toBe('before')
    expect(dayTargetOf('2026-13-01', { today: TODAY, first })).toBe('bad')
  })

  it('this week and earlier open; a later week does not', () => {
    expect(weekTargetOf('2026-W42', { today: TODAY })).toBe('week')
    expect(weekTargetOf('2026-W30', { today: TODAY })).toBe('week')
    expect(weekTargetOf('2026-W43', { today: TODAY })).toBe('future')
    expect(weekTargetOf('2026-X1', { today: TODAY })).toBe('bad')
  })

  it('builds the paths under the tab, and a tab that is none falls back to Home', () => {
    expect(dayPath('2026-10-12', 'train')).toBe('/train/day/2026-10-12')
    expect(weekPath('2026-W42', 'me')).toBe('/me/week/2026-W42')
    expect(dayPath('2026-10-12', 'progress')).toBe('/home/day/2026-10-12')
  })

  it('a Day or Week page backs onto its tab root on a cold entry', () => {
    expect(parentOf('/train/day/2026-10-12')).toBe('/train')
    expect(parentOf('/me/week/2026-W42')).toBe('/me')
    expect(parentOf('/food/day/2026-10-12')).toBe('/food')
  })
})

describe('navToDay and navToWeek', () => {
  it('pushes the Day page, or replaces it when asked', () => {
    expect(navToDay('2026-10-12', 'train')).toBe('day')
    expect(nav).toHaveBeenLastCalledWith('/train/day/2026-10-12', undefined)
    navToDay('2026-10-13', 'train', { replace: true })
    expect(nav).toHaveBeenLastCalledWith('/train/day/2026-10-13', { replace: true })
  })

  it('sends today to Home and a day to come to the Plan day drawer, never the Day page', () => {
    expect(navToDay(TODAY, 'food')).toBe('today')
    expect(nav).toHaveBeenLastCalledWith('/home', undefined)
    nav.mockClear()
    expect(navToDay('2026-10-20', 'train')).toBe('future')
    expect(dayOverrideSheet).toHaveBeenCalledWith('2026-10-20')
    expect(nav).not.toHaveBeenCalled()
  })

  it('opens nothing for a day before the first log or a bad date', () => {
    expect(navToDay('2026-09-01', 'train')).toBe('before')
    expect(navToDay('yesterday', 'train')).toBe('bad')
    expect(nav).not.toHaveBeenCalled()
    expect(dayOverrideSheet).not.toHaveBeenCalled()
  })

  it('opens this week and earlier ones, never a later one', () => {
    expect(navToWeek('2026-W42', 'home')).toBe('week')
    expect(nav).toHaveBeenLastCalledWith('/home/week/2026-W42', undefined)
    nav.mockClear()
    expect(navToWeek('2026-W44', 'home')).toBe('future')
    expect(nav).not.toHaveBeenCalled()
  })
})
