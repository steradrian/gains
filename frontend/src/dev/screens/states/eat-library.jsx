import { useState } from 'react'
import { mealDetailSheet } from '../../../components/MealDetailSheet.jsx'
import { fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import MyFoods from '../../../views/MyFoods.jsx'
import { registerScreens } from '../registry.js'

// My foods (PR-04 library-m1, boards Ea4MyFoods, Ea4Online, Ea4Saved, Ea4MealDetail, Ea4Recipes,
// Ea4Servings, Ea4Empty and the "Open Food Facts off" and offline edge rows): the real page and
// drawers over mocked NutriTrace answers, in memory only. The gallery's mock answers by path, so
// the saved meals and the recipes come from one list and the page keeps each tab's own kind.
const ALEX = { id: 'u1', name: 'Alex' }
const macros = (calories, proteins, carbohydrates, fat) => ({ calories, proteins, carbohydrates, fat })

const food = (id, name, brand, portion, unit, nutrition, favorite = 0) => ({
  id, user_id: 3, name, brand, portion, unit, nutrition, img_url: null, barcode: null, nutrition_basis: unit === 'ml' ? 'ml' : 'g',
  alt_units: null, density_g_ml: null, usage_count: 0, last_used_at: null, visibility: 'private', favorite, deleted_at: null,
})
const FOODS = [
  food(1, 'Greek yogurt 2%', 'Olympus', 170, 'g', macros(120, 17, 7, 2), 1),
  food(2, 'Chicken rice bowl', '', 420, 'g', macros(540, 38, 62, 14), 1),
  food(3, 'Oats', '', 60, 'g', macros(228, 8, 36, 4), 1),
  food(4, 'Banana', '', 120, 'g', macros(105, 1, 27, 0)),
  food(5, 'Homemade granola', '', 50, 'g', macros(230, 5, 30, 10)),
  food(6, 'Milk 1.5%', '', 250, 'ml', macros(118, 8, 12, 4)),
  food(7, 'Protein bar', 'Myprotein', 60, 'g', macros(210, 20, 20, 7)),
  food(8, 'Whey shake', '', 30, 'g', macros(120, 24, 3, 1)),
]

const line = (name, portion, unit, nutrition) => ({ name, brand: '', portion, unit, quantity: 1, nutrition, nutrition_basis: unit === 'ml' ? 'ml' : 'g', alt_units: null, density_g_ml: null })
const meal = (id, name, items, total) => ({
  id, user_id: 3, name, is_recipe: false, notes: null, portion: 100, unit: 'g', servings: null, visibility: 'private', img_url: null,
  favorite: 0, usage_count: 0, last_used_at: null, deleted_at: null, nutrition: total, items,
})
const recipe = (id, name, servings, portion, perServing) => ({
  id, user_id: 3, name, is_recipe: true, notes: null, portion, unit: 'g', servings, visibility: 'private', img_url: null,
  favorite: 0, usage_count: 0, last_used_at: null, deleted_at: null, nutrition: perServing, items: [line('Ingredients', portion, 'g', perServing)],
})
const BREAKFAST = [line('Oats', 60, 'g', macros(228, 10, 37, 5)), line('Milk 1.5%', 250, 'ml', macros(118, 9, 12, 4)), line('Banana', 120, 'g', macros(105, 2, 30, 1))]
const MEALS = [
  meal(21, 'Usual breakfast', BREAKFAST, macros(451, 21, 79, 10)),
  meal(22, 'Post-workout', [line('Whey shake', 30, 'g', macros(120, 24, 3, 1)), line('Banana', 120, 'g', macros(105, 2, 30, 1))], macros(225, 26, 33, 2)),
  meal(23, 'Sunday brunch', [line('Eggs', 120, 'g', macros(180, 15, 1, 12)), line('Toast', 70, 'g', macros(190, 7, 36, 2)), line('Avocado', 100, 'g', macros(160, 2, 9, 15)), line('Coffee', 200, 'ml', macros(110, 3, 10, 5))], macros(640, 27, 56, 34)),
  meal(24, 'Office lunch', [line('Chicken rice bowl', 420, 'g', macros(540, 38, 62, 14)), line('Apple', 150, 'g', macros(75, 0, 20, 0))], macros(615, 38, 82, 14)),
]
const RECIPES = [
  recipe(31, 'Homemade granola', 10, 500, macros(230, 5, 30, 10)),
  recipe(32, 'Chili con carne', 6, 1800, macros(520, 32, 48, 22)),
  recipe(33, 'Overnight oats', 2, 600, macros(390, 18, 55, 12)),
]

const product = (code, name, brands, kcal, country) => ({
  code, product_name: name, brands, lang: 'ro', nutrition_data_per: '100g', countries_tags: [country],
  nutriments: { 'energy-kcal_100g': kcal, energy_100g: Math.round(kcal * 4.184), proteins_100g: 10, carbohydrates_100g: 4, fat_100g: 0.3 },
})
const OFF = {
  count: 4, page: 1, page_size: 20,
  products: [
    product('5941234000011', 'Skyr natur', 'Milbona', 63, 'en:romania'),
    product('5941234000028', 'Skyr vanilie', 'Olympus', 77, 'en:romania'),
    product('5694230000035', 'Icelandic skyr', 'Arla', 64, 'en:denmark'),
    product('5941234000042', 'Skyr cu afine', 'Lidl Pilos', 84, 'en:romania'),
  ],
}

const nt = ({ foods = FOODS, meals = [...MEALS, ...RECIPES], settings = {} } = {}) => ({
  user: ALEX,
  api: {
    'GET /api/foods': foods,
    'GET /api/meals': meals,
    'GET /api/settings': { ...fixtureSettings(), offSearchCountry: 'Romania', diaryPromptQuantity: true, ...settings },
    'GET /api/proxy': OFF,
  },
})

// Each state starts on an empty store, so what the last one loaded is not on show.
function Fresh({ children }) {
  useState(() => { useNutrition.getState().reset() })
  return children
}
const page = () => <Fresh><MyFoods /></Fresh>
const drawer = props => async t => {
  await t.wait(400)
  mealDetailSheet(props)
  await t.wait(300)
}
const search = async t => {
  await t.type('Search Open Food Facts', 'skyr')
  await t.wait(900)
}

registerScreens('Eat: My foods', [
  { id: 'E4.0', title: 'My foods, Foods', note: 'Yours: Favourites, then All foods with how many; the chips, search and +.', render: page, path: '/food/my-foods?tab=foods', mock: nt() },
  { id: 'E4.1', title: 'My foods, Open Food Facts', note: 'Skyr typed: Romanian products first, each tagged Online, and the footnote.', render: page,
    path: '/food/my-foods?tab=foods&source=off', mock: nt(), play: search },
  { id: 'E4.1o', title: 'Open Food Facts, no connection', note: 'The offline line in place of results; Yours still works.', render: page,
    path: '/food/my-foods?tab=foods&source=off', mock: { ...nt(), online: false }, play: search },
  { id: 'E4.1x', title: 'Open Food Facts turned off', note: 'Settings > Food sources off: the chip is gone and the tab opens on Yours.', render: page,
    path: '/food/my-foods?tab=foods&source=off', mock: nt({ settings: { offEnabled: false } }) },
  { id: 'E4.2', title: 'My foods, Saved meals', note: 'Name, first foods and energy; the footnote.', render: page, path: '/food/my-foods?tab=meals', mock: nt() },
  { id: 'E4.3', title: 'Saved meal drawer', note: 'Foods with amounts, total and macros; Edit and Log to <meal>.', render: page, path: '/food/my-foods?tab=meals', mock: nt(),
    play: drawer({ id: 21, recipe: false }) },
  { id: 'E4.4', title: 'My foods, Recipes', note: 'Servings and energy each; the footnote.', render: page, path: '/food/my-foods?tab=recipes', mock: nt() },
  { id: 'E4.5', title: 'Servings drawer', note: 'Half servings, energy and protein for that amount; Edit and Log to <meal>.', render: page, path: '/food/my-foods?tab=recipes', mock: nt(),
    play: drawer({ id: 32, recipe: true }) },
  { id: 'E4.6f', title: 'No foods yet', note: 'One button: New food.', render: page, path: '/food/my-foods?tab=foods', mock: nt({ foods: [] }) },
  { id: 'E4.6m', title: 'No saved meals yet', note: 'How to save one, and New saved meal.', render: page, path: '/food/my-foods?tab=meals', mock: nt({ meals: [] }) },
  { id: 'E4.6r', title: 'No recipes yet', note: 'One button: New recipe.', render: page, path: '/food/my-foods?tab=recipes', mock: nt({ meals: [] }) },
])
