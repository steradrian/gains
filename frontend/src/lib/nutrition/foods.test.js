import { describe, expect, it } from 'vitest'
import { categoriesOf, foodOf, formOf, per100Of, per100Unit, sortFoods, visibleFoods } from './foods.js'

const food = (over = {}) => ({ id: 1, name: 'Oats', brand: '', portion: 100, unit: 'g', nutrition: { calories: 380, proteins: 13 }, usage_count: 0, last_used_at: null, ...over })

describe('per 100', () => {
  it('scales a serving of a mass or volume to 100, and says nothing for a count', () => {
    const bar = food({ portion: 40, nutrition: { calories: 160, proteins: 12 } })
    expect(per100Unit(bar)).toBe('g')
    expect(per100Of(bar).nutrition).toEqual({ calories: 400, proteins: 30 })
    const milk = food({ portion: 250, unit: 'ml', nutrition: { calories: 120 } })
    expect(per100Unit(milk)).toBe('ml')
    expect(per100Of(milk).nutrition.calories).toBeCloseTo(48)
    expect(per100Unit(food({ unit: 'piece' }))).toBeNull()
    expect(per100Of(food({ unit: 'piece' }))).toBeNull()
  })
})

describe('the list', () => {
  const list = [
    food({ id: 1, name: 'Bread', usage_count: 3, last_used_at: '2026-10-10' }),
    food({ id: 2, name: 'apple' }),
    food({ id: 3, name: 'Cheese', usage_count: 9, last_used_at: '2026-10-13', favorite: 1, category: 'Dairy' }),
    food({ id: 4, name: 'Butter', category: 'Dairy' }),
  ]
  const ids = fs => fs.map(f => f.id)

  it('sorts as NutriTrace does and does not touch the input', () => {
    const copy = [...list]
    expect(ids(sortFoods(list, 'alpha'))).toEqual([2, 1, 4, 3])
    expect(ids(sortFoods(list, 'recent'))).toEqual([3, 1, 2, 4])
    expect(ids(sortFoods(list, 'most'))).toEqual([3, 1, 2, 4])
    expect(list).toEqual(copy)
  })

  it('puts favourites first unless searching or narrowed to a category', () => {
    expect(ids(visibleFoods(list, {}))).toEqual([3, 2, 1, 4])
    expect(ids(visibleFoods(list, { category: 'Dairy' }))).toEqual([4, 3])
    expect(ids(visibleFoods(list, { query: 'b' }))).toEqual([1, 4])
  })

  it('names the categories in use', () => {
    expect(categoriesOf(list)).toEqual(['Dairy'])
  })
})

describe('the editor', () => {
  it('round-trips a food through the form', () => {
    const f = food({ brand: 'Quaker', category: 'Pantry', notes: 'n', nutrition: { calories: 380, proteins: 13.5, sodium: 20 } })
    const { food: out } = foodOf(formOf(f), { id: 1 })
    expect(out).toMatchObject({ id: 1, name: 'Oats', brand: 'Quaker', portion: 100, unit: 'g', category: 'Pantry', notes: 'n', favorite: false })
    expect(out.nutrition).toMatchObject({ calories: 380, proteins: 13.5, sodium: 20, salt: 0.05 })
  })

  it('refuses what cannot be saved, naming the first field', () => {
    const base = formOf(null)
    expect(foodOf(base)).toEqual({ error: 'name' })
    expect(foodOf({ ...base, name: 'x', portion: '0' })).toEqual({ error: 'portion' })
    expect(foodOf({ ...base, name: 'x', nutrients: { ...base.nutrients, fat: '-1' } })).toEqual({ error: 'nutrient:fat' })
    expect(foodOf({ ...base, name: 'x', nutrients: { ...base.nutrients, fat: 'a lot' } })).toEqual({ error: 'nutrient:fat' })
  })

  it('reads a comma as a decimal point, and gives a new food its key once', () => {
    const base = { ...formOf(null), name: 'Skyr', nutrients: { ...formOf(null).nutrients, proteins: '11,5' } }
    const a = foodOf(base, { clientKey: 'k1' }).food
    expect(a.nutrition.proteins).toBe(11.5)
    expect(a.client_key).toBe('k1')
    expect(a).not.toHaveProperty('id')
    expect(a).not.toHaveProperty('favorite')
  })
})
