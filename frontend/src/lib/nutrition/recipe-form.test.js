// The recipe editor's arithmetic (boards Ea5Recipe, Ea5Ingredient): Makes follows the ingredients
// until a cooked weight is typed, Servings and One serving keep each other in step, and each
// serving's numbers are the ingredients' totals / Servings, in g and in ml.
import { describe, expect, it } from 'vitest'
import { mealOf } from './meals.js'
import { editRecipe, extrasOfForm, perServingOf, recipeFormOf, servingOf } from './recipe-form.js'

const line = (name, portion, unit, calories, proteins = 0) => ({
  name, brand: '', portion, unit, quantity: 1, nutrition: { calories, proteins, carbohydrates: 0, fat: 0 },
  nutrition_basis: unit, alt_units: null, density_g_ml: null,
})
const OATS = line('Oats', 240, 'g', 912, 32)
const MILK = line('Milk', 300, 'ml', 142, 10)
const BANANA = line('Banana', 100, 'g', 88, 1)

const saved = (items, { servings = 4, portion = 160 } = {}) => ({
  id: 31, name: 'Overnight oats', is_recipe: true, notes: null, portion, unit: 'g', servings, items, nutrition: { calories: 285 },
})

describe('Makes follows the ingredients until a weight is typed', () => {
  it('a new recipe from a prefill takes its weight from its ingredients, in one serving', () => {
    const form = recipeFormOf(null, { prefill: { name: 'Oats', items: [OATS, MILK, BANANA] } })
    expect(form).toMatchObject({ amount: '640', servings: '1', serving: '640', amountTyped: false })
  })

  it('adding and changing ingredients moves Makes, and One serving with it', () => {
    let form = recipeFormOf(null, { prefill: { name: 'Oats', items: [OATS] } })
    form = editRecipe(form, { servings: '4' })
    expect(form).toMatchObject({ amount: '240', serving: '60' })
    form = editRecipe(form, { items: [OATS, MILK] })
    expect(form).toMatchObject({ amount: '540', serving: '135', amountTyped: false })
  })

  it('a typed weight stays put when ingredients change', () => {
    let form = recipeFormOf(null, { prefill: { name: 'Oats', items: [OATS, MILK] } })
    form = editRecipe(form, { servings: '4' })
    form = editRecipe(form, { amount: '500' })
    expect(form).toMatchObject({ amount: '500', amountTyped: true, serving: '125' })
    form = editRecipe(form, { items: [OATS, MILK, BANANA] })
    expect(form).toMatchObject({ amount: '500', amountTyped: true, serving: '125' })
  })

  it('clearing the weight follows the ingredients again', () => {
    let form = recipeFormOf(null, { prefill: { name: 'Oats', items: [OATS, MILK, BANANA] } })
    form = editRecipe(form, { amount: '600' })
    form = editRecipe(form, { amount: '' })
    expect(form).toMatchObject({ amount: '640', amountTyped: false })
    expect(editRecipe(form, { items: [OATS] })).toMatchObject({ amount: '240' })
  })

  it('a saved recipe whose weight is not its ingredients\' sum had its weight typed; one that matches follows them', () => {
    expect(recipeFormOf(saved([OATS, MILK, BANANA], { portion: 150 })).amountTyped).toBe(true)
    expect(recipeFormOf(saved([OATS, MILK, BANANA], { portion: 160 })).amountTyped).toBe(false)
  })

  it('the extras say it when they exist, whatever the numbers', () => {
    expect(recipeFormOf(saved([OATS, MILK, BANANA]), { extras: { steps: [], photo: null, makesTyped: true } }).amountTyped).toBe(true)
    expect(recipeFormOf(saved([OATS, MILK, BANANA], { portion: 150 }), { extras: { steps: [], photo: null, makesTyped: false } }).amountTyped).toBe(false)
  })

  it('counts ml as grams (water) and a piece with no size as 100 g, as the editor always has', () => {
    const form = recipeFormOf(null, { prefill: { name: 'Shake', items: [MILK, line('Egg', 1, 'piece', 70)] } })
    expect(form.amount).toBe('400')
  })
})

describe('Servings and One serving keep each other in step', () => {
  const base = () => recipeFormOf(saved([OATS, MILK, BANANA]))

  it('opens with One serving as Makes / Servings', () => {
    expect(base()).toMatchObject({ amount: '640', servings: '4', serving: '160' })
  })

  it('changing Servings recomputes One serving and leaves Makes alone', () => {
    expect(editRecipe(base(), { servings: '8' })).toMatchObject({ amount: '640', servings: '8', serving: '80' })
  })

  it('changing One serving recomputes Servings from Makes, to a whole number of 1 or more', () => {
    expect(editRecipe(base(), { serving: '80' })).toMatchObject({ amount: '640', servings: '8', serving: '80' })
    expect(editRecipe(base(), { serving: '200' }).servings).toBe('3')
    expect(editRecipe(base(), { serving: '5000' }).servings).toBe('1')
  })

  it('the field keeps what was typed while Servings follows it', () => {
    expect(editRecipe(base(), { serving: '150' })).toMatchObject({ servings: '4', serving: '150' })
  })

  it('typing Makes keeps Servings and changes One serving', () => {
    expect(editRecipe(base(), { amount: '800' })).toMatchObject({ servings: '4', serving: '200' })
  })

  it('has no One serving without Servings, or with 0', () => {
    expect(editRecipe(base(), { servings: '' }).serving).toBe('')
    expect(editRecipe(base(), { servings: '0' }).serving).toBe('')
    expect(servingOf({ amount: '640', servings: '0' })).toBeNull()
    expect(servingOf({ amount: '640', servings: '2.5' })).toBeNull()
  })

  it('reads a comma as the decimal mark', () => {
    expect(editRecipe(base(), { amount: '640,5' }).serving).toBe('160.1')
  })
})

describe('per serving', () => {
  it('is the totals over Servings, in g and ml alike', () => {
    const form = recipeFormOf(saved([OATS, MILK, BANANA]))
    const one = perServingOf(form)
    expect(one.calories).toBeCloseTo(285.5)
    expect(one.proteins).toBeCloseTo(10.75)
  })

  it('follows the ingredients that are in', () => {
    const form = editRecipe(recipeFormOf(saved([OATS, MILK, BANANA])), { items: [MILK], servings: '2' })
    expect(perServingOf(form).calories).toBe(71)
  })

  it('is none when Servings is 0, empty or not a whole number', () => {
    const form = recipeFormOf(saved([OATS]))
    expect(perServingOf({ ...form, servings: '0' })).toBeNull()
    expect(perServingOf({ ...form, servings: '' })).toBeNull()
    expect(perServingOf({ ...form, servings: '1.5' })).toBeNull()
  })

  it('a recipe saved before servings existed has none until one is set', () => {
    const old = recipeFormOf({ ...saved([OATS]), servings: null })
    expect(old.servings).toBe('')
    expect(perServingOf(old)).toBeNull()
    expect(perServingOf(editRecipe(old, { servings: '2' })).calories).toBe(456)
  })
})

describe('what is saved', () => {
  it('a new recipe sends the weight and nutrition per serving', () => {
    let form = recipeFormOf(null, { prefill: { name: 'Overnight oats', items: [OATS, MILK, BANANA] } })
    form = editRecipe(form, { servings: '4' })
    const { meal } = mealOf(form, { recipe: true, clientKey: 'k' })
    expect(meal).toMatchObject({ name: 'Overnight oats', is_recipe: true, servings: 4, portion: 160, unit: 'g' })
    expect(meal.nutrition.calories).toBeCloseTo(285.5)
  })

  it('a typed weight is the weight that is divided', () => {
    let form = recipeFormOf(null, { prefill: { name: 'Overnight oats', items: [OATS, MILK, BANANA] } })
    form = editRecipe(editRecipe(form, { servings: '4' }), { amount: '600' })
    expect(mealOf(form, { recipe: true, clientKey: 'k' }).meal.portion).toBe(150)
  })

  it('changing only the weight of a saved recipe sends the portion alone', () => {
    const original = saved([OATS, MILK, BANANA])
    const form = editRecipe(recipeFormOf(original), { amount: '800' })
    expect(mealOf(form, { recipe: true, original }).meal).toEqual({ portion: 200 })
  })

  it('keeps the steps, the photo and the typed flag as the device\'s extras', () => {
    const form = { ...recipeFormOf(saved([OATS])), steps: [{ id: 'a', text: 'Stir' }], photo: null, amountTyped: true }
    expect(extrasOfForm(form)).toEqual({ steps: [{ id: 'a', text: 'Stir' }], photo: null, makesTyped: true })
  })
})
