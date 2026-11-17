// @vitest-environment happy-dom
// What the Member page says: the week cells (a day without a workout is a rest dot, never a missed
// mark), the Consistency bars (a week off is an empty bar, never red), the footer built from the
// person's switches plus the three items that are never shared, and the arithmetic of Remove.
import { describe, expect, it } from 'vitest'
import {
  consistencyBars, footerLine, isoWeekNumber, notShared, removeEffect, serverWeekKey, sharesAnything, sinceLine, weekCells,
} from './member-view.js'

describe('serverWeekKey', () => {
  it('is the Monday of the week, whatever day it is', () => {
    expect(serverWeekKey('2026-10-12')).toBe('2026-10-12')
    expect(serverWeekKey('2026-10-14')).toBe('2026-10-12')
    expect(serverWeekKey('2026-10-18')).toBe('2026-10-12')
    expect(serverWeekKey('2026-10-19')).toBe('2026-10-19')
  })
})

describe('isoWeekNumber', () => {
  it('numbers the weeks the ISO way, across a year boundary too', () => {
    expect(isoWeekNumber('2026-08-17')).toBe(34)
    expect(isoWeekNumber('2025-12-29')).toBe(1)
    expect(isoWeekNumber('2027-01-04')).toBe(1)
    expect(isoWeekNumber('2026-01-05')).toBe(2)
  })
})

describe('weekCells', () => {
  const describeDay = (day, on) => day + (on ? ' on' : ' off')

  it('gives seven days from Monday, done where the flag is true and a quiet rest dot elsewhere', () => {
    const cells = weekCells('2026-10-12', [true, false, true, false, true, false, false], describeDay, '2026-10-14')
    expect(cells).toHaveLength(7)
    expect(cells.map(c => c.date)).toEqual([12, 13, 14, 15, 16, 17, 18])
    expect(cells.map(c => c.training)).toEqual(['done', 'rest', 'done', 'rest', 'done', 'rest', 'rest'])
    expect(cells.filter(c => c.training === 'missed')).toHaveLength(0)
    expect(cells.find(c => c.today).date).toBe(14)
  })

  it('says each day in words through the caller, with the state', () => {
    const [monday, tuesday] = weekCells('2026-10-12', [true, false], describeDay)
    expect(monday.label).toMatch(/12/)
    expect(monday.label.endsWith(' on')).toBe(true)
    expect(tuesday.label.endsWith(' off')).toBe(true)
  })

  it('treats missing flags as nothing done, not as a failure', () => {
    expect(weekCells('2026-10-12', undefined, describeDay).every(c => c.training === 'rest')).toBe(true)
  })
})

describe('consistencyBars', () => {
  const weeks = [
    { week: '2026-08-17', share: 1 },
    { week: '2026-08-24', share: null },
    { week: '2026-08-31', share: 0.5 },
  ]

  it('draws a week off as an empty bar, and says so aloud', () => {
    const bars = consistencyBars(weeks)
    expect(bars.values).toEqual([1, 0, 0.5])
    expect(bars.labels).toEqual(['W34', 'W35', 'W36'])
    expect(bars.barLabels[1]).toBe('W35: week off')
    expect(bars.barLabels[2]).toBe('W36: 50% of planned workouts done')
    expect(bars.highlight).toBe(2)
  })

  it('keeps a share inside 0..1 and survives no data', () => {
    expect(consistencyBars([{ week: '2026-08-17', share: 1.4 }, { week: '2026-08-24', share: -1 }]).values).toEqual([1, 0])
    expect(consistencyBars(undefined)).toMatchObject({ values: [], labels: [], barLabels: [] })
  })
})

describe('the footer', () => {
  it('lists weight, foods and photos for someone who shares everything', () => {
    expect(notShared({ training: true, consistency: true, targets: true, bests: true })).toEqual(['weight', 'foods', 'photos'])
    expect(footerLine('Mara', { training: true, consistency: true, targets: true, bests: true })).toMatch(/^Mara doesn't share: .*weight.*foods.*photos.*You can't ask to see them\.$/)
  })

  it('adds what the person switched off, before the three that are never shared', () => {
    expect(notShared({ training: true, consistency: false, targets: false, bests: false }))
      .toEqual(['consistency', 'food targets', 'new bests', 'weight', 'foods', 'photos'])
    expect(footerLine('Radu', { training: true, consistency: false, targets: false, bests: false }))
      .toMatch(/consistency.*food targets.*new bests.*weight.*foods.*photos/)
  })

  it('claims nothing is shared when the payload has no switches at all', () => {
    expect(notShared(undefined)).toEqual(['training', 'consistency', 'food targets', 'new bests', 'weight', 'foods', 'photos'])
    expect(sharesAnything(undefined)).toBe(false)
  })

  it('knows when at least one switch is on', () => {
    expect(sharesAnything({ training: false, consistency: false, targets: false, bests: false })).toBe(false)
    expect(sharesAnything({ training: false, consistency: false, targets: true, bests: false })).toBe(true)
  })
})

describe('sinceLine', () => {
  it('says since when the payload has a date, and leaves it out otherwise', () => {
    expect(sinceLine('Iron Sunday', '2026-08-30')).toMatch(/^In Iron Sunday since /)
    expect(sinceLine('Iron Sunday', undefined)).toBe('In Iron Sunday')
    expect(sinceLine('Iron Sunday', 'August')).toBe('In Iron Sunday')
  })
})

describe('removeEffect', () => {
  const group = { week: { done: 17, planned: 22 } }

  it('computes what the goal drops to: 22 becomes 18', () => {
    expect(removeEffect({ week: { done: 3, planned: 4 } }, group)).toEqual({ mine: 4, before: 22, after: 18 })
  })

  it('is null when either figure is unknown or the person had nothing planned', () => {
    expect(removeEffect({ week: { noPlan: true } }, group)).toBeNull()
    expect(removeEffect({}, group)).toBeNull()
    expect(removeEffect({ week: { planned: 4 } }, {})).toBeNull()
    expect(removeEffect({ week: { planned: 0 } }, group)).toBeNull()
    expect(removeEffect({ week: { planned: 30 } }, group)).toBeNull()
  })
})
