// The recipe editor's form and its arithmetic (boards Ea5Recipe, Ea5Ingredient). No React, no network.
//
// A recipe is a meal with `is_recipe` (meals.js), kept per serving. The editor shows it as a whole:
//   Makes        the weight of everything it makes, `amount`. It follows the ingredients until the
//                person types the cooked weight (`amountTyped`); clearing it follows them again.
//   Servings     a whole number, 1 or more.
//   One serving  Makes / Servings, `serving`. Servings and One serving keep each other in step:
//                changing one recomputes the other from Makes.
// Per serving values are the ingredients' totals / Servings; with no valid Servings there are none.
import { gramsOfAll, formOf, totalOf, withItems } from './meals.js'

const decimal = v => parseFloat(String(v ?? '').replace(',', '.'))
const show = n => String(Math.round(n * 10) / 10)

/** Makes / Servings in the form's unit, or null while either is not a usable number. */
export function servingOf(form) {
  const makes = decimal(form.amount)
  const servings = Number(form.servings)
  return makes > 0 && Number.isInteger(servings) && servings >= 1 ? makes / servings : null
}

const servingText = form => {
  const one = servingOf(form)
  return one == null ? '' : show(one)
}

/**
 * The editor's fields for the saved recipe (`recipe`), or for a new one (`prefill`: { name, items,
 * notes }, editor-routes.js). `extras` are what recipe-extras.js kept for it. A saved recipe whose
 * weight is not what its ingredients add up to had its weight typed, whatever the extras say.
 */
export function recipeFormOf(recipe, { prefill = null, extras = null } = {}) {
  const base = formOf(recipe || prefill || null, { recipe: true })
  const adds = gramsOfAll(base.items)
  const makes = parseFloat(base.amount)
  const typed = recipe ? (extras ? extras.makesTyped : Number.isFinite(makes) && Math.abs(makes - adds) > 0.5) : false
  // formOf leaves Servings blank for a prefill, as for a recipe saved before servings existed.
  const servings = recipe ? base.servings : String(Math.max(1, parseInt(prefill?.servings, 10) || 1))
  let form = { ...base, servings, amountTyped: typed, steps: extras?.steps || [], photo: extras?.photo || null, serving: '' }
  // A new recipe from a prefill: its weight follows the ingredients it came with.
  if (!recipe && form.items.length) form = withItems(form, form.items, { recipe: true })
  return { ...form, serving: servingText(form) }
}

/**
 * The form after `patch`, the one place the three numbers are kept in step:
 *  - items: Makes follows them (unless typed), then One serving follows Makes;
 *  - amount (Makes typed): it is kept as typed, and clearing it follows the ingredients again;
 *  - servings: One serving is Makes / Servings;
 *  - serving (One serving typed): Servings is Makes / that, rounded to a whole number of 1 or more;
 *    the field keeps what was typed.
 */
export function editRecipe(form, patch) {
  let next = { ...form, ...patch }
  if ('items' in patch) next = withItems(next, patch.items, { recipe: true })
  if ('amount' in patch) {
    next.amountTyped = String(patch.amount).trim() !== ''
    if (!next.amountTyped) next = withItems(next, next.items, { recipe: true })
  }
  if ('serving' in patch) {
    const one = decimal(patch.serving)
    const makes = decimal(next.amount)
    if (one > 0 && makes > 0) next.servings = String(Math.max(1, Math.round(makes / one)))
  } else if ('items' in patch || 'amount' in patch || 'servings' in patch) {
    next.serving = servingText(next)
  }
  return next
}

/** The ingredients' totals for one serving, or null without a valid Servings. */
export function perServingOf(form) {
  const servings = Number(form.servings)
  if (!Number.isInteger(servings) || servings < 1) return null
  return Object.fromEntries(Object.entries(totalOf(form.items)).map(([k, v]) => [k, v / servings]))
}

/** What recipe-extras.js keeps of the form. */
export const extrasOfForm = form => ({ steps: form.steps, photo: form.photo, makesTyped: form.amountTyped })
