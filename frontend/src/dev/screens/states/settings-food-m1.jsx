import { useState } from 'react'
import { fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { MEAL_NAMES_MAX } from '../../../lib/nutrition/settings-lists.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import DiaryPage from '../../../views/settings/pages/DiaryPage.jsx'
import FoodsPage from '../../../views/settings/pages/FoodsPage.jsx'
import SourcesPage from '../../../views/settings/pages/SourcesPage.jsx'
import WaterPage from '../../../views/settings/pages/WaterPage.jsx'
import { openContainerSheet } from '../../../views/settings/pages/container-sheet.jsx'
import { openMealSheet } from '../../../views/settings/pages/meal-sheet.jsx'
import { registerScreens } from '../registry.js'

// Settings, Food: Diary and meals with its meal drawer, Water with its container drawer, Foods and
// scanning, Food sources (boards St1Diary to St1Sources). The real pages over NutriTrace's settings
// answered from memory; a tap that writes meets no route and says so, nothing is kept (mock-env.js).
const settings = {
  ...fixtureSettings(),
  mealNames: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
  diaryShowActivity: true,
  fastingEnabled: true,
  fastingDefaultHours: 16,
  waterContainers: [{ id: '1', name: 'Glass', volumeMl: 250 }, { id: '2', name: 'Bottle', volumeMl: 500 }, { id: '3', name: 'Shaker', volumeMl: 700 }],
}
const FULL_DAY = ['Breakfast', 'Mid-morning', 'Lunch', 'Afternoon', 'Pre-workout', 'Post-workout', 'Dinner', 'Supper', 'Brunch', 'Tea', 'Late snack', 'Midnight']
const mock = (over = {}) => ({
  user: { id: 'u1', name: 'Alex' },
  api: { 'GET /api/settings': { ...settings, ...over } },
})

// A state starts from an empty hub store, so the page asks for these settings and not the last
// state's. The initializer runs before the page below mounts.
function Fresh({ children }) {
  useState(() => { useNutrition.getState().reset() })
  return children
}
const page = Page => () => <Fresh><Page /></Fresh>

registerScreens('Settings', [
  { id: 'A1.18', title: 'Diary and meals', note: 'Meals, what a meal shows, adding food, quick calories and the default fasting plan.',
    path: '/me/diary', render: page(DiaryPage), mock: mock() },
  { id: 'A1.19', title: 'Meal (drawer)', note: 'Rename, move up or down, delete. Delete asks nothing: the toast has Undo.',
    path: '/me/diary', render: page(DiaryPage), mock: mock(),
    play: async t => { await t.wait(400); openMealSheet(1); await t.wait(300) } },
  { id: 'A1.18.six', title: 'Diary and meals, most meals', note: 'As many meals as there can be: Add a meal is gone.',
    path: '/me/diary', render: page(DiaryPage),
    mock: mock({ mealNames: FULL_DAY.slice(0, MEAL_NAMES_MAX) }) },
  { id: 'A1.20', title: 'Water', note: 'Unit, where water shows, and the containers with their volumes.',
    path: '/me/water', render: page(WaterPage), mock: mock() },
  { id: 'A1.21', title: 'Container (drawer)', note: 'Name and volume with the unit; an existing container also has Remove, with Undo.',
    path: '/me/water', render: page(WaterPage), mock: mock(),
    play: async t => { await t.wait(400); openContainerSheet({ id: '2', name: 'Bottle', volumeMl: 500 }); await t.wait(300) } },
  { id: 'A1.22', title: 'Foods and scanning', note: 'Row details, where Log food searches first, the order of each list, the scanner beep.',
    path: '/me/foods', render: page(FoodsPage), mock: mock() },
  { id: 'A1.23', title: 'Food sources', note: 'Open Food Facts on, with its language and country.',
    path: '/me/sources', render: page(SourcesPage), mock: mock() },
])
