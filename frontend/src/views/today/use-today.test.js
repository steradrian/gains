// @vitest-environment happy-dom
// useToday's pure parts: the profile, the rings a day gives, the meal tiles and the water glass.
// The screen itself, against a faked NutriTrace, is in views/Home.*.test.jsx.
import { describe, expect, it } from 'vitest'
import { foodRings, glassOf, mealsOf, todayProfile } from './use-today.js'

const units = {
  energyUnit: 'kcal',
  energy: v => `${v} kcal`,
  energyValue: v => String(v),
}
const day = over => ({
  totals: { calories: 500, proteins: 40, carbohydrates: 10, fat: 90 },
  target: { target: 2000 },
  left: 1500,
  macros: { proteins: 150, carbohydrates: null, fat: 70 },
  activitySum: null,
  ...over,
})

describe('todayProfile', () => {
  it('is both with food and training, food alone, or training alone', () => {
    expect(todayProfile(true)).toBe('both')
    expect(todayProfile(true, false)).toBe('food')
    expect(todayProfile(false)).toBe('training')
  })
})

describe('foodRings', () => {
  it('energy first, burned before eaten on its pill only when there is some', () => {
    expect(foodRings(day(), units)[0]).toMatchObject({ top: 'Left today', big: '1500', unit: 'of 2000 kcal', pill: '500 eaten', over: 0 })
    expect(foodRings(day({ activitySum: { effective: 320 } }), units)[0].pill).toBe('320 burned · 500 eaten')
  })

  it('a macro without a target shows what was eaten, an empty ring; one past it is over in amber', () => {
    const [, protein, carbs, fat] = foodRings(day(), units)
    expect(protein).toMatchObject({ name: 'Protein', top: 'Protein left', big: '110', unit: 'g of 150 g', over: 0 })
    expect(carbs).toMatchObject({ top: 'Carbs', big: '10', unit: 'g', value: 0, max: 1 })
    expect(fat).toMatchObject({ top: 'Over today', big: '20', unit: 'g over 70 g', value: 90, max: 70 })
    expect(fat.over).toBeCloseTo(20 / 70)
  })
})

describe('mealsOf', () => {
  it('logged meals carry their energy, the meal of the hour is to add now, the rest are empty', () => {
    const entry = { items: [{ meal: 0, nutrition: { calories: 300 } }] }
    const tiles = mealsOf({ dayReady: true, entry, settings: null }, 2, units)
    expect(tiles.map(m => [m.name, m.state, m.sub, m.icon])).toEqual([
      ['Breakfast', 'done', '300 kcal', 'sunrise'],
      ['Lunch', 'empty', 'Nothing yet', 'sun'],
      ['Dinner', 'now', 'Add now', 'moon'],
      ['Snacks', 'empty', 'Nothing yet', 'apple'],
    ])
  })
})

describe('glassOf', () => {
  it('the first container, or a bigger one where the first would draw more than twelve glasses', () => {
    const settings = { waterContainers: [{ id: 'a', name: 'Glass', volumeMl: 250 }, { id: 'b', name: 'Bottle', volumeMl: 500 }] }
    expect(glassOf(null, 2500).ml).toBe(250)
    expect(glassOf(settings, 2500).ml).toBe(250)
    expect(glassOf(settings, 4000).ml).toBe(500)
    expect(glassOf(settings, 9000).ml).toBe(500)
  })
})
