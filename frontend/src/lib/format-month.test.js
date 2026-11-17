import { describe, expect, it } from 'vitest'
import { fmtMonth } from './format.js'

// "since {month}" on Progress (Train review #29): a month over a year back carries its year.
describe('fmtMonth', () => {
  const now = new Date(2026, 9, 21)

  it('reads the month alone by default, however old', () => {
    expect(fmtMonth('2023-07-10', true)).not.toMatch(/2023/)
    expect(fmtMonth('2023-07-10', true, { now })).not.toMatch(/2023/)
  })

  it('adds the year with yearIfOld to a month outside the last twelve', () => {
    expect(fmtMonth('2023-07-10', true, { yearIfOld: true, now })).toMatch(/2023/)
    // October last year would read like this October
    expect(fmtMonth('2025-10-05', true, { yearIfOld: true, now })).toMatch(/2025/)
  })

  it('leaves the year off a month inside the last twelve', () => {
    expect(fmtMonth('2025-11-01', true, { yearIfOld: true, now })).not.toMatch(/2025/)
    expect(fmtMonth('2026-07-10', true, { yearIfOld: true, now })).not.toMatch(/2026/)
  })
})
