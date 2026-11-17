import { useLayoutEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ingredientDrawer } from '../../../components/IngredientDrawer.jsx'
import { fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { holdExtrasInMemory } from '../../../lib/nutrition/recipe-extras.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { useUI } from '../../../store/useUI.js'
import MyFoods from '../../../views/MyFoods.jsx'
import RecipeEditor from '../../../views/my-foods/RecipeEditor.jsx'
import { registerScreens } from '../registry.js'

// The recipe editor and the ingredient drawer (PR-04 library-m3, boards Ea5Recipe, Ea5Ingredient,
// Ea5RecipeDeleted and the new, empty recipe): the real pages over mocked NutriTrace answers, in
// memory only. The mock answers GETs and refuses every write; the recipe's steps, which the app
// keeps on the device (recipe-extras.js), are held in memory for the length of a state, and the
// drawer is opened with handlers that do nothing, so nothing a state is tapped into can persist.
// There is no photo mock: the states show the empty photo row the board draws.
const ALEX = { id: 'u1', name: 'Alex' }
const NOOP = () => {}
const macros = (calories, proteins, carbohydrates, fat) => ({ calories, proteins, carbohydrates, fat })
const line = (name, portion, unit, nutrition) => ({
  id: null, name, brand: '', portion, unit, quantity: 1, nutrition, nutrition_basis: unit === 'ml' ? 'ml' : 'g', alt_units: null, density_g_ml: null,
})

// 240 g of oats, 300 ml of milk and 100 g of banana make 640 g, in four servings.
const OATS = { ...line('Oats', 240, 'g', macros(912, 32, 144, 16)), id: 3 }
const MILK = { ...line('Milk 1.5%', 300, 'ml', macros(142, 10, 14, 5)), id: 6 }
const BANANA = { ...line('Banana', 100, 'g', macros(88, 1, 23, 0)), id: 4 }
const recipe = (id, name, items, { servings = 4, portion = 160, nutrition = macros(285.5, 10.8, 45.3, 5.3) } = {}) => ({
  id, user_id: 3, name, is_recipe: true, notes: null, portion, unit: 'g', servings, visibility: 'private', img_url: null,
  favorite: 0, usage_count: 0, last_used_at: null, deleted_at: null, nutrition, items,
})
const OVERNIGHT = recipe(31, 'Overnight oats', [OATS, MILK, BANANA])
const TYPED = recipe(31, 'Overnight oats', [OATS, MILK, BANANA], { portion: 150 })
const LENTIL = recipe(32, 'Lentil soup', [line('Red lentils', 300, 'g', macros(1020, 72, 180, 6))], { servings: 6, portion: 120, nutrition: macros(170, 12, 30, 1) })

const STEPS = {
  steps: [
    { id: 'step-1', text: 'Stir the oats, milk and banana together in a jar.' },
    { id: 'step-2', text: 'Leave it in the fridge overnight.' },
    { id: 'step-3', text: 'Eat it cold in the morning, or warm it for a minute.' },
  ],
}

const nt = recipes => ({
  user: ALEX,
  api: {
    'GET /api/foods': [],
    'GET /api/meals': recipes,
    'GET /api/settings': fixtureSettings(),
  },
})

// Each state starts on an empty store, and the device's recipe extras are the state's own, held in
// memory and put back with the page's last unmount.
function Fresh({ extras = {}, children }) {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    useNutrition.getState().reset()
    const restore = holdExtrasInMemory(extras)
    setReady(true)
    return restore
    // The state's extras are fixed when it is registered, so this runs once.
  }, [])
  return ready ? children : null
}
const editorPage = extras => () => (
  <Fresh extras={extras}><Routes><Route path="/food/my-foods/recipes/:id" element={<RecipeEditor />} /></Routes></Fresh>
)
const list = () => <Fresh><MyFoods /></Fresh>

// The drawer over the editor, on the first ingredient, as the page opens it.
const drawerOver = item => async t => {
  await t.wait(500)
  ingredientDrawer({ item, index: 0, onAdd: () => 0, onChange: NOOP, onRemove: NOOP })
  await t.wait(300)
}
// The toast held open, as a finger resting on it would hold it.
const held = text => async t => {
  await t.wait(400)
  useUI.getState().toast(text, { action: 'Undo', onAction: NOOP })
  useUI.getState().pauseToast()
  await t.wait(60)
}

registerScreens('Eat: recipe editor', [
  { id: 'E5.4', title: 'Recipe editor', note: 'Photo row, servings, one serving and Makes following the ingredients; ingredients, numbered steps, each serving\'s numbers and Delete recipe.',
    render: editorPage({ 31: STEPS }), path: '/food/my-foods/recipes/31', mock: nt([OVERNIGHT, LENTIL]) },
  { id: 'E5.4m', title: 'Recipe editor, Makes typed', note: 'A cooked weight of 600 g was typed: the note says so, and One serving is Makes / Servings.',
    render: editorPage({ 31: { ...STEPS, makesTyped: true } }), path: '/food/my-foods/recipes/31', mock: nt([TYPED, LENTIL]) },
  { id: 'E5.5', title: 'Ingredient drawer', note: 'Amount and unit (g or ml), energy and protein, carbs and fat for that amount; Take out and Done.',
    render: editorPage({ 31: STEPS }), path: '/food/my-foods/recipes/31', mock: nt([OVERNIGHT, LENTIL]), play: drawerOver(OATS) },
  { id: 'E5.6', title: 'Ingredient taken out', note: 'The recipe without it, Makes and each serving recomputed; the toast offers Undo for 8 s.',
    render: editorPage({ 31: STEPS }), path: '/food/my-foods/recipes/31', mock: nt([recipe(31, 'Overnight oats', [MILK, BANANA], { portion: 100, nutrition: macros(57.5, 2.8, 9.3, 1.3) }), LENTIL]), play: held('Removed Oats') },
  { id: 'E5.7', title: 'Recipe deleted', note: 'Recipes without it; the toast says the days logged with it stay, with Undo for 8 s.',
    render: list, path: '/food/my-foods?tab=recipes', mock: nt([LENTIL]), play: held('Deleted Overnight oats. Days you logged it stay') },
  { id: 'E5.8', title: 'New recipe, nothing typed', note: 'No Delete recipe yet; nothing is written until it has a name and an ingredient.',
    render: editorPage({}), path: '/food/my-foods/recipes/new', mock: nt([OVERNIGHT, LENTIL]) },
])
