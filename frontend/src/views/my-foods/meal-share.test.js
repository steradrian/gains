import { describe, expect, it } from 'vitest'
import { macroRows, shareLine } from './meal-share.js'

const TOTAL = { calories: 451, proteins: 21, carbohydrates: 79, fat: 10 }
const targets = (macro, ready = true) => ({ ready, kcal: 2200, macro: id => macro[id] ?? null })

describe('macroRows', () => {
  it('says each macro in grams against its target, with the share of it', () => {
    const rows = macroRows(TOTAL, targets({ proteins: 150, carbohydrates: 230, fat: 70 }))
    expect(rows.map(r => [r.label, r.grams, r.target, r.percent])).toEqual([['Protein', 21, 150, 14], ['Carbs', 79, 230, 34], ['Fat', 10, 70, 14]])
  })

  it('leaves a macro without a goal with no target and no share', () => {
    const rows = macroRows(TOTAL, targets({ proteins: 150 }))
    expect(rows[1]).toMatchObject({ grams: 79, target: null, percent: null })
  })

  it('shows no target while the targets are still loading, or without any', () => {
    expect(macroRows(TOTAL, targets({ proteins: 150 }, false)).every(r => r.target === null)).toBe(true)
    expect(macroRows(TOTAL, null).every(r => r.target === null)).toBe(true)
  })
})

describe('shareLine', () => {
  it('is the board\'s sentence with the macros that have a target', () => {
    const all = macroRows(TOTAL, targets({ proteins: 150, carbohydrates: 230, fat: 70 }))
    expect(shareLine(all)).toBe('The share of a day’s targets: protein 14%, carbs 34%, fat 14%.')
    expect(shareLine(macroRows(TOTAL, targets({ fat: 70 })))).toBe('The share of a day’s targets: fat 14%.')
  })

  it('is left out when no macro has a target', () => {
    expect(shareLine(macroRows(TOTAL, targets({})))).toBeNull()
  })
})
