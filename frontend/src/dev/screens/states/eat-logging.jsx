import { foodPickerSheet } from '../../../components/FoodPickerSheet.jsx'
import { todayISO } from '../../../lib/format.js'
import { fixtureActivity, fixtureActivitySum, fixtureDay, fixtureFoods, fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { useDiarySelection } from '../../../lib/nutrition/selection.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import TodayScreen from '../../../views/today/TodayScreen.jsx'
import { registerScreens } from '../registry.js'
import { both } from './today-fixture.js'

// The Log food drawer, step by step (PR-04 Eat logging, boards Ea8Search to Ea8Offline): the real
// FoodPickerSheet over the Today screen of T1.0, opened the way Today opens it and driven by taps
// and typing to the step each board draws. Everything it reads is mocked in memory: the foods, the
// saved meals (put straight into the in-memory store, as the mock cannot tell Meals from Recipes
// by the query string), the day with Breakfast and Snacks logged, the calorie goal of 2,100 kcal and
// Open Food Facts. Nothing is written: no log is sent from here.
const ALEX = { id: 'u1', name: 'Alex' }
const ISO = todayISO()

const food = (id, name, brand, portion, kcal, extra = {}) => ({
  ...fixtureFoods()[0], id, name, brand, portion, unit: 'g', last_used_at: '2026-10-17', usage_count: 4,
  nutrition: { calories: kcal, proteins: 10, carbohydrates: 6, fat: 3 }, ...extra,
})
const foods = () => [
  food(51, 'Greek yogurt 2%', 'Olympus', 170, 120, { alt_units: [{ abbr: 'pot', grams: 170 }] }),
  food(52, 'Sarmale in foi de varza', '', 200, 260, { last_used_at: null, usage_count: 0 }),
]
const meal = (id, name, kcal, items, extra = {}) => ({
  id, user_id: 3, name, is_recipe: false, notes: null, portion: 100, unit: 'g', servings: null, visibility: 'private', img_url: null,
  favorite: 0, usage_count: 1, last_used_at: null, deleted_at: null, nutrition: { calories: kcal },
  items: items.map((n, i) => ({ id: 70 + i, name: n, brand: '', portion: 100, unit: 'g', quantity: 1, nutrition: { calories: Math.round(kcal / items.length) } })),
  ...extra,
})
const MEALS = [
  meal(61, 'Greek yogurt with honey', 230, ['Greek yogurt', 'Honey']),
  meal(62, 'Office lunch', 615, ['Chicken rice bowl', 'Apple']),
  meal(63, 'Post-workout', 225, ['Whey shake', 'Banana']),
  meal(64, 'Usual breakfast', 451, ['Oats', 'Milk', 'Banana']),
]
const RECIPES = [
  meal(65, 'Chili con carne', 520, ['Beef', 'Beans'], { is_recipe: true, servings: 4 }),
  meal(66, 'Homemade granola', 230, ['Oats', 'Honey'], { is_recipe: true, servings: 1, portion: 50 }),
]
const quick = (uuid, slot, kcal) => ({ uuid, meal: slot, addedAt: `${ISO}T08:00:00.000Z`, type: 'quick_calories', name: 'Quick Calories', nutrition: { calories: kcal }, food_server_id: null })
const diary = () => ({ ...fixtureDay(ISO), items: [quick('g-b', 0, 420), quick('g-s', 3, 440)] })
const settings = () => ({
  ...fixtureSettings(), diaryPromptQuantity: true,
  goals: { calories: { min: 2100, max: 2100, sharedGoal: true }, proteins: { max: 150 }, carbohydrates: { max: 230 }, fat: { max: 70 } },
})
const product = (code, name, brands, kcal100, grams) => ({
  code, product_name: name, brands, lang: 'en', nutrition_data_per: '100g', serving_size: `${grams} g`, serving_quantity: grams,
  nutriments: { 'energy-kcal_100g': kcal100, proteins_100g: 6, carbohydrates_100g: 4, sugars_100g: 4, fat_100g: 10, 'saturated-fat_100g': 6.5, fiber_100g: 0, salt_100g: 0.1 },
})
const off = products => ({ count: products.length, page: 1, page_size: 20, products })
const GREEK = [
  product('5201054012345', 'Greek yogurt 10%', 'Olympus', 126, 150),
  product('5201054012346', 'Total 0% Greek yogurt', 'Fage', 54, 170),
  product('5201054012347', 'Greek style yogurt', 'Lidl Pilos', 98, 150),
]
const nt = (proxy = off(GREEK)) => ({
  user: ALEX,
  api: {
    'GET /api/foods': foods(), 'GET /api/settings': settings(), 'GET /api/meals': [], 'GET /api/proxy': proxy,
    ['GET /api/diary/' + ISO]: diary(),
    ['GET /api/activity/' + ISO]: fixtureActivity(ISO),
    ['GET /api/activity/sum/' + ISO]: fixtureActivitySum(ISO),
  },
})

const today = () => <TodayScreen {...both} />
const wait = ms => new Promise(r => setTimeout(r, ms))
// The pane on screen: the sub-panel on top when a step is open, else the drawer's own content.
const drawer = () => [...document.querySelectorAll('.g-bs-pane:not([inert])')].at(-1) ?? [...document.querySelectorAll('.g-bs')].at(-1)
const press = async match => {
  let el
  for (let waited = 0; !el && waited < 2000; waited += 40) {
    el = [...(drawer()?.querySelectorAll('button') || [])].find(match)
    if (!el) await wait(40)
  }
  if (!el) throw new Error('Screens gallery: nothing to tap in the Log food drawer')
  el.click()
  await wait(150)
}
const rowTitled = title => b => b.classList.contains('g-lf-row') && b.querySelector('.g-lf-title')?.textContent === title
const named = text => b => (b.getAttribute('aria-label') || b.textContent).trim() === text
const search = value => async t => { await t.type('Search foods', value); await t.wait(700) }

// Each state opens Log food for Lunch on today, then taps and types to its step.
const logFood = (...steps) => async t => {
  useNutrition.getState().reset()
  useNutrition.setState({
    meals: { status: 'ready', list: MEALS, error: null },
    recipes: { status: 'ready', list: RECIPES, error: null },
  })
  useDiarySelection.getState().setDate(null)
  useDiarySelection.getState().setMeal(1)
  foodPickerSheet()
  await t.wait(300)
  for (const step of steps) await step(t)
}

registerScreens('Eat: Log food', [
  { id: 'Ea8Search', title: 'Log food, search results', note: 'Recent, your foods and saved meals, Open Food Facts with its tag; + logs one serving.', render: today, mock: nt(),
    play: logFood(search('greek')) },
  { id: 'Ea8FoodDetail', title: 'Log food, amount', note: 'Serving size and servings step, unit chips, kcal and macros, the After this line (a goal is set).', render: today, mock: nt(),
    play: logFood(async () => press(rowTitled('Greek yogurt 2%')), t => t.wait(500)) },
  { id: 'Ea8Food', title: 'A food in full', note: 'An online result: per 100 g and per serving, Save as food and Log.', render: today, mock: nt(),
    play: logFood(search('greek'), async () => press(rowTitled('Greek yogurt 10%')), async () => press(named('See it in full'))) },
  { id: 'Ea8Meal', title: 'Log food, logging to', note: 'The meal chip opens the four meals as they stand on the day, and the day.', render: today, mock: nt(),
    play: logFood(async () => press(b => b.classList.contains('g-bs-chip')), t => t.wait(400)) },
  { id: 'Ea8Saved', title: 'Log food, saved meals and recipes', note: 'A meal logs all its foods in one tap; a recipe asks for servings.', render: today, mock: nt(),
    play: logFood(async () => press(named('Saved meals'))) },
  { id: 'Ea8SavedRecipes', title: 'Log food, recipes', note: 'The Recipes tab.', render: today, mock: nt(),
    play: logFood(async () => press(named('Recipes'))) },
  { id: 'Ea8NoMatch', title: 'Log food, no match', note: 'Did you mean, Create food, Add calories only, Scan its barcode.', render: today, mock: nt(off([])),
    play: logFood(search('sarmalle cu mamaliga')) },
  { id: 'Ea8Quick', title: 'Quick calories', note: 'Calories, macros, a name; it stays out of My foods.', render: today, mock: nt(),
    play: logFood(async () => press(rowTitled('Quick kcal')), t => t.wait(300)) },
  { id: 'Ea8Offline', title: 'Log food, offline', note: 'Your foods and saved meals still search; online results say they need a connection.', render: today,
    mock: { ...nt(), online: false }, play: logFood(search('greek')) },
])
