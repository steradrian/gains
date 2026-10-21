// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { fmtDate, todayISO } from '../format.js'
import { addedText, dayName, waterAddedText } from './log-feedback.js'

// Board T1.5: the toast after a log names the day and the meal it went to.
describe('what a log toast says', () => {
  it('names today as Today and any other day by its date', () => {
    expect(dayName(todayISO())).toBe('Today')
    expect(dayName('2026-10-13')).toBe(fmtDate('2026-10-13', true))
  })

  it('names the thing added, or only where it went', () => {
    expect(addedText(todayISO(), 'Lunch', 'Chicken rice bowl')).toBe('Added Chicken rice bowl to Today, Lunch')
    expect(addedText(todayISO(), 'Dinner')).toBe('Added to Today, Dinner')
    expect(addedText('2026-10-13', 'Lunch')).toBe(`Added to ${fmtDate('2026-10-13', true)}, Lunch`)
  })

  it('names water in the person\'s water unit', () => {
    expect(waterAddedText(todayISO(), 250, {})).toBe('Added 250 ml of water to Today')
    expect(waterAddedText(todayISO(), 1000, { waterUnit: 'L' })).toBe('Added 1 L of water to Today')
  })
})
