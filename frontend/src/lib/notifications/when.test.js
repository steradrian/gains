import { describe, expect, it } from 'vitest'
import { fmtAgo, fmtDate } from '../format.js'
import { whenOf } from './when.js'

// Wednesday 21 Oct 2026, noon.
const NOW = new Date(2026, 9, 21, 12).getTime()
const HOUR = 3600000

describe('whenOf: the meta line', () => {
  it('the kind, then how long ago for something from the last day', () => {
    expect(whenOf({ kind: 'reminder', at: NOW - 2 * HOUR }, NOW)).toBe('Reminder you set · ' + fmtAgo(NOW - 2 * HOUR, NOW))
    expect(whenOf({ kind: 'milestone', at: NOW - 5 * HOUR }, NOW)).toBe('Milestone · ' + fmtAgo(NOW - 5 * HOUR, NOW))
  })

  it('the date for anything older, and a new best keeps its time of day', () => {
    expect(whenOf({ kind: 'milestone', at: new Date(2026, 9, 2, 19).getTime() }, NOW)).toBe('Milestone · ' + fmtDate('2026-10-02', true))
    const best = whenOf({ kind: 'best', at: new Date(2026, 9, 12, 19, 24).getTime() }, NOW)
    expect(best.startsWith('New best · ' + fmtDate('2026-10-12', true) + ', ')).toBe(true)
    expect(best).toMatch(/19.24/)
  })

  it('a week\'s streak and recap always show the date, even the night after', () => {
    const sundayNight = new Date(2026, 9, 18, 23, 59, 59).getTime()
    const monday = new Date(2026, 9, 19, 9).getTime()
    expect(whenOf({ kind: 'streak', at: sundayNight }, monday)).toBe('Streak · ' + fmtDate('2026-10-18', true))
    expect(whenOf({ kind: 'recap', at: sundayNight }, monday)).toBe('Weekly recap · ' + fmtDate('2026-10-18', true))
  })
})
