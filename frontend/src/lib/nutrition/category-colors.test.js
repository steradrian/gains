import { describe, expect, it } from 'vitest'
import { CATEGORY_COLORS, categoryColor, dotOf, isDot } from './category-colors.js'

describe('category colours', () => {
  it('has eight colours with a distinct dot each', () => {
    expect(CATEGORY_COLORS).toHaveLength(8)
    expect(new Set(CATEGORY_COLORS.map(c => c.dot)).size).toBe(8)
  })

  it('a stored dot is its own colour, and dotOf is its inverse', () => {
    for (const { id, dot } of CATEGORY_COLORS) {
      expect(categoryColor({ name: 'x', label: dot })).toBe(id)
      expect(dotOf(id)).toBe(dot)
      expect(isDot(dot)).toBe(true)
    }
  })

  it('an emoji from before the dots maps to one colour, the same every time', () => {
    const steak = { name: 'Meat', label: '\u{1F969}' }
    const colour = categoryColor(steak)
    expect(CATEGORY_COLORS.map(c => c.id)).toContain(colour)
    expect(categoryColor({ ...steak, name: 'Other name' })).toBe(colour)
    expect(isDot(steak.label)).toBe(false)
  })

  it('a category with no label takes a colour from its name, plain string or object', () => {
    expect(categoryColor('Dairy')).toBe(categoryColor({ name: 'Dairy', label: '' }))
    expect(CATEGORY_COLORS.map(c => c.id)).toContain(categoryColor('Dairy'))
  })
})
