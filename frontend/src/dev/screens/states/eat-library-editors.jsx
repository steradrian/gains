import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { useUI } from '../../../store/useUI.js'
import MyFoods from '../../../views/MyFoods.jsx'
import FoodEditor from '../../../views/my-foods/FoodEditor.jsx'
import MealEditor from '../../../views/my-foods/MealEditor.jsx'
import { registerScreens } from '../registry.js'

// The food and saved meal editors (PR-04 library-m2, boards Ea5Food, Ea5Deleted, Ea5Meal,
// Ea5MealDeleted and the new, empty food editor): the real pages over mocked NutriTrace answers,
// in memory only. The mock answers GETs and refuses every write, so nothing a state is tapped into
// can persist. The deleted states are My foods without the record, with the app's real toast held
// open (Undo is a no-op here).
const ALEX = { id: 'u1', name: 'Alex' }
const NOOP = () => {}
const macros = (calories, proteins, carbohydrates, fat, fiber) => ({ calories, proteins, carbohydrates, fat, ...(fiber ? { fiber } : null) })

const food = (id, name, brand, portion, unit, nutrition, extra = {}) => ({
  id, user_id: 3, name, brand, portion, unit, nutrition, img_url: null, barcode: null, nutrition_basis: unit === 'ml' ? 'ml' : 'g',
  alt_units: null, density_g_ml: null, usage_count: 0, last_used_at: null, visibility: 'private', favorite: 0, deleted_at: null, ...extra,
})
const YOGURT = food(1, 'Greek yogurt 2%', 'Olympus', 170, 'g', macros(120, 17, 7, 2, 0), { barcode: '5201054017135', category: 'Dairy', favorite: 1 })
const FOODS = [
  YOGURT,
  food(3, 'Oats', '', 60, 'g', macros(228, 8, 36, 4, 6), { favorite: 1 }),
  food(4, 'Banana', '', 120, 'g', macros(105, 1, 27, 0, 3)),
  food(6, 'Milk 1.5%', '', 250, 'ml', macros(118, 8, 12, 4)),
  food(7, 'Protein bar', 'Myprotein', 60, 'g', macros(210, 20, 20, 7)),
]

const line = (name, portion, unit, nutrition) => ({ name, brand: '', portion, unit, quantity: 1, nutrition, nutrition_basis: unit === 'ml' ? 'ml' : 'g', alt_units: null, density_g_ml: null })
const meal = (id, name, items, total) => ({
  id, user_id: 3, name, is_recipe: false, notes: null, portion: 100, unit: 'g', servings: null, visibility: 'private', img_url: null,
  favorite: 0, usage_count: 0, last_used_at: null, deleted_at: null, nutrition: total, items,
})
const BREAKFAST = meal(21, 'Usual breakfast', [
  line('Oats', 60, 'g', macros(228, 10, 37, 5)),
  line('Milk 1.5%', 250, 'ml', macros(118, 9, 12, 4)),
  line('Banana', 120, 'g', macros(105, 2, 30, 1)),
], macros(451, 21, 79, 10))
const MEALS = [
  BREAKFAST,
  meal(22, 'Post-workout', [line('Whey shake', 30, 'g', macros(120, 24, 3, 1)), line('Banana', 120, 'g', macros(105, 2, 30, 1))], macros(225, 26, 33, 2)),
  meal(24, 'Office lunch', [line('Chicken rice bowl', 420, 'g', macros(540, 38, 62, 14)), line('Apple', 150, 'g', macros(75, 0, 20, 0))], macros(615, 38, 82, 14)),
]

// The targets the Ea5Meal board shows against: protein 150 g, carbs 230 g, fat 70 g.
const GOALS = { calories: { min: 2200, max: 2200, sharedGoal: true }, proteins: { max: 150 }, carbohydrates: { max: 230 }, fat: { max: 70 } }

const nt = ({ foods = FOODS, meals = MEALS } = {}) => ({
  user: ALEX,
  api: {
    'GET /api/foods': foods,
    'GET /api/meals': meals,
    'GET /api/settings': { ...fixtureSettings(), goals: GOALS, foodCategories: ['Dairy', 'Pantry', 'Bakery'] },
  },
})

// Each state starts on an empty store, so what the last one loaded is not on show.
function Fresh({ children }) {
  useState(() => { useNutrition.getState().reset() })
  return children
}
const foodPage = () => (
  <Fresh><Routes><Route path="/food/my-foods/foods/:id" element={<FoodEditor />} /></Routes></Fresh>
)
const mealPage = () => (
  <Fresh><Routes><Route path="/food/my-foods/meals/:id" element={<MealEditor />} /></Routes></Fresh>
)
const list = () => <Fresh><MyFoods /></Fresh>

const moreNutrients = async t => {
  await t.wait(500)
  await t.click('More nutrients')
}
// The toast held open, as a finger resting on it would hold it.
const held = text => async t => {
  await t.wait(400)
  useUI.getState().toast(text, { action: 'Undo', onAction: NOOP })
  useUI.getState().pauseToast()
  await t.wait(60)
}

registerScreens('Eat: editors', [
  { id: 'E5.0', title: 'Food editor', note: 'Saved indicator and "Changes save as you type."; fields, per serving, details and Delete food.',
    render: foodPage, path: '/food/my-foods/foods/1', mock: nt() },
  { id: 'E5.0m', title: 'Food editor, More nutrients', note: 'More nutrients open: every nutrient the editor knows, per serving.',
    render: foodPage, path: '/food/my-foods/foods/1', mock: nt(), play: moreNutrients },
  { id: 'E5.0n', title: 'New food, nothing typed', note: 'No Delete food yet, and nothing is written until it has a name.',
    render: foodPage, path: '/food/my-foods/foods/new', mock: nt() },
  { id: 'E5.1', title: 'Food deleted', note: 'My foods without it; the toast names what went and offers Undo for 8 s.',
    render: list, path: '/food/my-foods?tab=foods', mock: nt({ foods: FOODS.slice(1) }), play: held('Deleted Greek yogurt 2% from My foods') },
  { id: 'E5.2', title: 'Saved meal editor', note: 'Foods with amounts, the total against the day\'s targets and the share line; Log to Today.',
    render: mealPage, path: '/food/my-foods/meals/21', mock: nt() },
  { id: 'E5.3', title: 'Saved meal deleted', note: 'Saved meals without it; the toast says the meals logged with it stay.',
    render: list, path: '/food/my-foods?tab=meals', mock: nt({ meals: MEALS.slice(1) }), play: held('Deleted Usual breakfast. Meals you logged with it stay') },
])
