// Saved meals and recipes, ported from NutriTrace (src/routes/MealEditor.svelte, Foods.svelte
// _expandMealToDiary, stores/diary.js addDiaryItem). A recipe is a meal with `is_recipe`.
//
//  - A saved meal is a list of ingredients (foods at the amount used). Logging it adds each
//    ingredient to the diary at that amount; the meal is not a diary entry itself.
//  - A recipe makes N servings. It is stored per serving (nutrition and portion), and logging it
//    adds one entry, the recipe, for the servings eaten.
//
// No React and no network here.
import { t } from '../i18n.js'
import { atPortion, foodItem, invalid, mealsOf, nutritionOf, scaleFactor, sumNutrition } from './diary.js'

const positive = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }
const decimal = v => parseFloat(String(v ?? '').replace(',', '.'))

// MealEditor.svelte toGrams: how a recipe's total weight is guessed from its ingredients.
const GRAMS = { g: 1, ml: 1, oz: 28.35, cup: 240, tbsp: 15, tsp: 5, piece: 100, serving: 100 }
const gramsOf = item => (parseFloat(item.portion) || 0) * (GRAMS[item.unit] || 1) * (parseFloat(item.quantity) || 1)
const gramsOfAll = items => Math.round(items.reduce((s, i) => s + gramsOf(i), 0))

/** The nutrients of a list of ingredients, added up. */
export const totalOf = items => sumNutrition((items || []).map(nutritionOf))

/** kcal of one ingredient list, or of a recipe's one serving. */
export const mealKcal = meal => Math.round((meal.is_recipe ? nutritionOf({ nutrition: meal.nutrition }) : totalOf(meal.items)).calories || 0)

/** A recipe's servings; one for a recipe saved before servings existed. */
export const servingsOf = recipe => Math.max(1, parseInt(recipe?.servings, 10) || 1)

/** The food kept as an ingredient: the food at `amount` `unit` with its nutrients for that amount
 *  (MealEditor.svelte confirmPortion). Throws invalid unless amount is a number above 0. */
export function ingredientOf(food, amount, unit) {
  const total = positive(amount)
  if (total == null) throw invalid('amount must be a number above 0')
  const at = atPortion(food, total, unit || food.unit)
  const { id, name, brand, nutrition_basis, alt_units, density_g_ml } = food
  return { id, name, brand, nutrition_basis, alt_units, density_g_ml, portion: total, unit: at.unit, quantity: 1, nutrition: at.nutrition }
}

/** An ingredient at another amount, its nutrients scaled from what they were. */
export function rescaleIngredient(item, amount, unit) {
  const total = positive(amount)
  if (total == null) throw invalid('amount must be a number above 0')
  const before = (parseFloat(item.portion) || 100) * (parseFloat(item.quantity) || 1)
  const f = scaleFactor(before, item.unit || 'g', total, unit, item)
  const nutrition = Object.fromEntries(Object.entries(nutritionOf(item)).map(([k, v]) => [k, v * f]))
  return { ...item, portion: total, unit, quantity: 1, nutrition }
}

/** What the ingredient reads as: "120 g". */
export const amountOf = item => {
  const n = (parseFloat(item.portion) || 0) * (parseFloat(item.quantity) || 1)
  return `${Math.round(n * 100) / 100} ${item.unit || 'g'}`
}

/* ------------------------------------------------------------------ the editor's form -------- */

/** The editor's fields for a new meal or recipe, or for the saved one being edited. Numbers are
 *  strings, as typed. */
export function formOf(meal, { recipe }) {
  const items = Array.isArray(meal?.items) ? meal.items : []
  const servings = servingsOf(meal)
  return {
    name: meal?.name || '',
    notes: meal?.notes || '',
    items,
    unit: meal?.unit || 'g',
    amount: recipe && meal ? String(Math.round((parseFloat(meal.portion) || 0) * servings * 100) / 100 || gramsOfAll(items) || '') : '',
    servings: String(meal ? servings : 1),
  }
}

/** The form with other ingredients. A recipe's total weight follows them, as in NutriTrace. */
export function withItems(form, items, { recipe }) {
  if (!recipe) return { ...form, items }
  const grams = gramsOfAll(items)
  return { ...form, items, unit: 'g', amount: grams > 0 ? String(grams) : '' }
}

/**
 * The body to save, or why not: `error` is 'name', 'items', 'servings' or 'amount'. A recipe is
 * saved per serving: its total weight and nutrients divided by the servings it makes.
 * @returns {{ error: string } | { meal: object }}
 */
export function mealOf(form, { recipe, clientKey = null }) {
  const name = form.name.trim()
  if (!name) return { error: 'name' }
  if (!form.items.length) return { error: 'items' }
  const total = totalOf(form.items)
  const body = { name, notes: form.notes.trim(), items: form.items, is_recipe: recipe }
  if (clientKey) body.client_key = clientKey
  if (!recipe) return { meal: { ...body, nutrition: total } }
  const servings = Number(form.servings)
  if (!Number.isInteger(servings) || servings < 1) return { error: 'servings' }
  const amount = form.amount === '' ? gramsOfAll(form.items) || 100 : decimal(form.amount)
  if (!(amount > 0)) return { error: 'amount' }
  return {
    meal: {
      ...body,
      portion: amount / servings,
      unit: form.unit || 'g',
      servings,
      nutrition: Object.fromEntries(Object.entries(total).map(([k, v]) => [k, v / servings])),
    },
  }
}

/* ------------------------------------------------------------------ logging ------------------ */

/**
 * What logging a meal or recipe adds to a day, built once: keep it and send the same one on a
 * retry (store.js logMeal), so a save whose answer was lost does not log twice.
 *  - a meal: every ingredient, at its saved amount;
 *  - a recipe: one entry for `servings` servings.
 * Throws invalid for a meal without ingredients, or servings that are not a number above 0.
 * @returns {{ meal: import('./api.js').Meal, items: object[] }}
 */
export function mealDraft(meal, { slot, servings = 1 }) {
  if (meal.is_recipe) {
    const food = { id: meal.id, name: meal.name, brand: '', portion: meal.portion, unit: meal.unit, nutrition: meal.nutrition, is_recipe: true }
    return { meal, items: [foodItem(food, { meal: slot, quantity: servings })] }
  }
  if (!Array.isArray(meal.items) || !meal.items.length) throw invalid('a meal needs ingredients')
  return { meal, items: meal.items.map(i => foodItem(i, { meal: slot, quantity: i.quantity || 1 })) }
}

/* ------------------------------------------------------------------ text --------------------- */

// NutriTrace's default meal names are English; a name the person saved shows as saved
// (diary.js mealsOf). Literal t() calls so the string checks see them.
const DEFAULT_NAMES = {
  Breakfast: () => t('Breakfast'),
  Lunch: () => t('Lunch'),
  Dinner: () => t('Dinner'),
  Snacks: () => t('Snacks'),
}

/** The name of a meal slot as the person reads it. */
export function slotName(settings, slot) {
  const m = mealsOf(settings).find(x => x.slot === slot) || mealsOf(settings)[0]
  return m.isDefault && DEFAULT_NAMES[m.name] ? DEFAULT_NAMES[m.name]() : m.name
}

/** What to tell the person about a failed read or write. Never the error's own message. */
export function mealErrorText(e, { write = false } = {}) {
  if (e?.code === 'offline' || e?.code === 'timeout') return write ? t('Not saved: no connection. Try again when you are back online.') : t('Could not load: no connection.')
  if (e?.code === 'http' && e.status === 401) return write ? t('Not saved: you are signed out. Sign in and try again.') : t('Could not load: you are signed out.')
  return write ? t('Not saved. Try again.') : t('Could not load. Try again.')
}

/** The editor's refusal of a form, as the sentence under it. */
export function problemText(error) {
  if (error === 'name') return t('Give it a name.')
  if (error === 'items') return t('Add at least one ingredient.')
  if (error === 'servings') return t('Servings must be a whole number, 1 or more.')
  return t('The total weight must be above 0.')
}

/** The list in name order, as NutriTrace answers it. */
export const sortedByName = list => [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)))
