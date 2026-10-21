import { useState } from 'react'
import { CATEGORY_COLORS } from '../../../lib/nutrition/category-colors.js'
import { fixtureFoods, fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import AboutPage from '../../../views/settings/pages/AboutPage.jsx'
import CategoriesPage from '../../../views/settings/pages/CategoriesPage.jsx'
import CustomUnitsPage from '../../../views/settings/pages/CustomUnitsPage.jsx'
import HelpPage from '../../../views/settings/pages/HelpPage.jsx'
import LicencesPage from '../../../views/settings/pages/LicencesPage.jsx'
import { registerScreens } from '../registry.js'

// Settings, Food (second half): Categories and its drawer, Custom units and its drawer, Help,
// About and Licences (boards St1Categories, St1Category, St1CustomUnits, St1CustomUnit, St1Help,
// St1About), the real pages over a mocked NutriTrace. Writes are not mocked, so a save in the
// gallery is refused and nothing is kept.
const ALEX = { id: 'u1', name: 'Alex' }
const dot = id => CATEGORY_COLORS.find(c => c.id === id).dot
const CATEGORIES = [
  ['Proteins', 'red', 41], ['Dairy', 'blue', 18], ['Grains and bread', 'orange', 22], ['Fruit', 'green', 15],
  ['Vegetables', 'purple', 27], ['Snacks', 'yellow', 12], ['Drinks', 'brown', 9], ['Other', 'black', 6],
]
// 150 foods, filed under the eight categories in the counts the board draws.
const foods = () => {
  const base = fixtureFoods()[0]
  let id = 1000
  return CATEGORIES.flatMap(([category, , n]) => Array.from({ length: n }, () => ({ ...base, id: id++, name: category + ' ' + id, category })))
}
const UNITS = [{ abbr: 'scoop', full: 'Scoop' }, { abbr: 'shot', full: 'Shot' }, { abbr: 'sl', full: 'Slice' }]
const nt = settings => ({
  user: ALEX,
  api: {
    'GET /api/foods': foods(),
    'GET /api/settings': { ...fixtureSettings(), ...settings },
    'GET /api/meals': [],
  },
})
const categories = nt({ foodCategories: CATEGORIES.map(([name, colour]) => ({ name, label: dot(colour) })) })
const units = nt({ customUnits: UNITS })

// The nutrition store caches across states: each starts from nothing.
function Fresh({ children }) {
  useState(() => useNutrition.getState().reset())
  return children
}
const tap = async (t, title) => {
  for (let waited = 0; waited < 2000; waited += 40) {
    const row = document.querySelector(`[data-find="${title}"]`)
    if (row) { row.click(); break }
    await t.wait(40)
  }
  await t.wait(300)
}

registerScreens('Settings', [
  { id: 'A1.24', title: 'Categories', note: 'Eight colour dots, how many foods wear each, and Add a category.',
    path: '/me/categories', render: () => <Fresh><CategoriesPage /></Fresh>, mock: categories },
  { id: 'A1.25', title: 'Category (drawer)', note: 'Name and one of eight colours; Delete closes with an Undo toast.',
    path: '/me/categories', render: () => <Fresh><CategoriesPage /></Fresh>, mock: categories,
    play: async t => { await tap(t, 'Dairy') } },
  { id: 'A1.26', title: 'Custom units', note: 'Name, abbreviation and Add a custom unit. No weight: the hub\'s unit has none.',
    path: '/me/customUnits', render: () => <Fresh><CustomUnitsPage /></Fresh>, mock: units },
  { id: 'A1.27', title: 'New unit (drawer)', note: 'Name and abbreviation; no Weighs field.',
    path: '/me/customUnits', render: () => <Fresh><CustomUnitsPage /></Fresh>, mock: units,
    play: async t => { await tap(t, 'Add a custom unit') } },
  { id: 'A1.35', title: 'Help', note: 'Six short answers, each in a drawer, and Report a problem (opens GitHub).',
    path: '/me/help', render: () => <HelpPage />, mock: nt({}) },
  { id: 'A1.36', title: 'About', note: 'Logo, version and build date, Install, Credits. The Android update row is on the phone build only.',
    path: '/me/about', render: () => <AboutPage />, mock: nt({}) },
  { id: 'A1.36.licences', title: 'Licences', note: 'AGPL notice, source code, third-party notices; every link is a row.',
    path: '/me/licences', render: () => <LicencesPage />, mock: nt({}) },
])
