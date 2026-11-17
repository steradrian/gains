// @vitest-environment happy-dom
// Settings › Diary and meals, Water, Foods and scanning, Food sources (boards St1Diary to
// St1Sources) against the fake hub, which holds every write to the rules of fitness-hub
// src/nt-body-checks.ts. Each save is one { key, value } the hub takes; a refused one keeps what was
// typed and says so; a delete is undone from the toast.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { settingOf } from '../../../lib/nutrition/use-nt-settings.js'
import { createFakeNutriTrace, fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { MEAL_NAMES_MAX } from '../../../lib/nutrition/settings-lists.js'
import { featuresFor, SEARCH } from '../../settings-pages.js'
import { _setLangState } from '../../../lib/i18n-core.js'
import DiaryPage from './DiaryPage.jsx'
import FoodsPage from './FoodsPage.jsx'
import SourcesPage from './SourcesPage.jsx'
import WaterPage from './WaterPage.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const PAGES = { diary: DiaryPage, water: WaterPage, foods: FoodsPage, sources: SourcesPage }

let host, root, nt, sheets, sheetRoots
const toast = vi.fn()
const settle = () => act(async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0)) })
const puts = () => nt.requests.filter(r => r.method === 'PUT' && r.path === '/nt/api/settings').map(r => r.body)
const rows = () => [...host.querySelectorAll('.set-row')]
const titleOf = row => row.querySelector('b')?.textContent
const rowTitled = title => rows().find(r => titleOf(r) === title)
const titles = () => rows().map(titleOf)
const valueOf = title => rowTitled(title).querySelector('.g-gvr-val').textContent
const switchOf = title => rowTitled(title).querySelector('[role="switch"]')
const optionOf = (title, label) => [...rowTitled(title).querySelectorAll('[role="radio"]')].find(b => b.textContent === label)
const click = async el => { await act(async () => { el.click() }); await settle() }
const pickSegment = async (title, label) => click(optionOf(title, label))

// The sheet the last tap opened, mounted next to the page. `close` is what the sheet was given.
function openedSheet() {
  const render = sheets.at(-1)
  const box = document.createElement('div')
  document.body.appendChild(box)
  const sheetRoot = createRoot(box)
  const close = vi.fn()
  act(() => sheetRoot.render(render(close)))
  sheetRoots.push([sheetRoot, box])
  return { box, close }
}
const fieldOf = (box, label) => [...box.querySelectorAll('.g-tfield')].find(f => f.querySelector('.g-tfield-label').textContent === label).querySelector('input')
const buttonOf = (box, label) => [...box.querySelectorAll('button')].find(b => b.textContent === label)
const type = async (el, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

// A fresh page over a fresh hub; a second mount in one test starts from nothing, as a new visit.
async function mount(page, settings = {}) {
  act(() => root.render(null))
  useNutrition.getState().reset()
  nt = createFakeNutriTrace({ settings: { timeFormat: '24h', ...settings } })
  vi.stubGlobal('fetch', nt.fetch)
  const Page = PAGES[page]
  act(() => root.render(<MemoryRouter><Page /></MemoryRouter>))
  await settle()
}

beforeEach(() => {
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  sheets = []
  sheetRoots = []
  useUI.setState({ toast, openSheet: render => { sheets.push(render); return { close: vi.fn() } } })
  useNutrition.getState().reset()
  toast.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  for (const [r, box] of sheetRoots) { act(() => r.unmount()); box.remove() }
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
  _setLangState('en', {})
})

describe('Diary and meals', () => {
  it('shows NutriTrace\'s defaults and writes each switch as one key', async () => {
    await mount('diary')
    expect(switchOf('Show brand names').getAttribute('aria-checked')).toBe('true')
    expect(switchOf('Show time logged').getAttribute('aria-checked')).toBe('false')
    await click(switchOf('Show time logged'))
    await click(switchOf('Show macro summary'))
    await click(switchOf('Ask for quantity when adding'))
    expect(puts()).toEqual([
      { key: 'diaryShowTimestamps', value: true }, { key: 'diaryShowMacroSummary', value: false }, { key: 'diaryPromptQuantity', value: false },
    ])
  })

  it('has none of NutriTrace\'s options Gains has no screen for', async () => {
    await mount('diary')
    expect(titles().join('|')).not.toMatch(/photos|every nutrient|nutrition units|portion size|day notes|completion|unit details|conversions/)
  })

  it('says how many meals there are and whether quantity is asked', async () => {
    await mount('diary')
    expect(host.textContent).toContain('4 meals · quantity asked')
  })

  it('the default field is one of the two the hub takes', async () => {
    await mount('diary')
    expect(optionOf('Quantity starts in', 'Servings').getAttribute('aria-checked')).toBe('true')
    await pickSegment('Quantity starts in', 'Serving size')
    expect(puts()).toEqual([{ key: 'diaryDefaultField', value: 'portion' }])
  })

  it('writes how quick calories show and whether they are offered', async () => {
    await mount('diary')
    await pickSegment('Quick calories shown', 'One row each')
    await click(switchOf('Show quick calories'))
    expect(puts()).toEqual([{ key: 'quickCaloriesDisplay', value: 'separate' }, { key: 'showQuickCalories', value: false }])
  })

  it('asks which wins, wearable or manual, only when activity counts toward the target', async () => {
    await mount('diary', { diaryShowActivity: true, calorieAdjustFromActivity: false })
    expect(titles()).not.toContain('Wearable and manual entries')
    await mount('diary', { diaryShowActivity: true, calorieAdjustFromActivity: true })
    await pickSegment('Wearable and manual entries', 'Add them')
    expect(puts()).toEqual([{ key: 'manualActivityPolicy', value: 'additive' }])
  })

  it('offers the default fasting plan only while fasting is on, and writes the hours', async () => {
    await mount('diary', { fastingEnabled: false })
    expect(titles()).not.toContain('Default fasting plan')
    await mount('diary', { fastingEnabled: true, fastingDefaultHours: 16 })
    expect(optionOf('Default fasting plan', '16:8').getAttribute('aria-checked')).toBe('true')
    await pickSegment('Default fasting plan', '20:4')
    expect(puts()).toEqual([{ key: 'fastingDefaultHours', value: 20 }])
  })

  it('a refused save keeps the old value and says so', async () => {
    await mount('diary', { diaryShowActivity: false })
    nt.failNext('PUT', '/nt/api/settings', { status: 400 })
    await click(switchOf('Show activity under meals'))
    expect(toast).toHaveBeenCalledWith('Not saved. Try again.')
    expect(switchOf('Show activity under meals').getAttribute('aria-checked')).toBe('false')
  })

  it('a tap on a meal renames it: the list is written whole', async () => {
    await mount('diary', { mealNames: ['Breakfast', 'Lunch', 'Dinner'] })
    await click(rowTitled('Lunch'))
    const { box, close } = openedSheet()
    expect(fieldOf(box, 'Name').value).toBe('Lunch')
    await type(fieldOf(box, 'Name'), 'Brunch')
    await click(buttonOf(box, 'Save meal name'))
    expect(puts()).toEqual([{ key: 'mealNames', value: ['Breakfast', 'Brunch', 'Dinner'] }])
    expect(close).toHaveBeenCalled()
    expect(titles()).toEqual(expect.arrayContaining(['Breakfast', 'Brunch', 'Dinner']))
  })

  it('adds a meal at the end', async () => {
    await mount('diary', { mealNames: ['Breakfast', 'Lunch', 'Dinner'] })
    await click(rowTitled('Add a meal'))
    const { box } = openedSheet()
    await type(fieldOf(box, 'Name'), 'Supper')
    await click(buttonOf(box, 'Add meal'))
    expect(puts()).toEqual([{ key: 'mealNames', value: ['Breakfast', 'Lunch', 'Dinner', 'Supper'] }])
  })

  it('moving a meal persists the new order', async () => {
    await mount('diary', { mealNames: ['Breakfast', 'Lunch', 'Dinner'] })
    await click(rowTitled('Dinner'))
    const { box } = openedSheet()
    expect(buttonOf(box, 'Move down').disabled).toBe(true)
    await click(buttonOf(box, 'Move up'))
    expect(puts()).toEqual([{ key: 'mealNames', value: ['Breakfast', 'Dinner', 'Lunch'] }])
    expect(titles().slice(0, 3)).toEqual(['Breakfast', 'Dinner', 'Lunch'])
  })

  it('Add a meal is gone once there are as many meals as there can be', async () => {
    const names = Array.from({ length: MEAL_NAMES_MAX }, (_, i) => 'Meal ' + (i + 1))
    await mount('diary', { mealNames: names })
    expect(titles()).not.toContain('Add a meal')
    expect(titles()).toContain('Meal 12')
    await mount('diary', { mealNames: names.slice(0, MEAL_NAMES_MAX - 1) })
    expect(titles()).toContain('Add a meal')
  })

  it('deleting a meal asks nothing, writes the shorter list and offers Undo, which puts it back', async () => {
    await mount('diary', { mealNames: ['Breakfast', 'Lunch', 'Dinner'] })
    await click(rowTitled('Lunch'))
    const { box, close } = openedSheet()
    await click(buttonOf(box, 'Delete meal'))
    expect(puts()).toEqual([{ key: 'mealNames', value: ['Breakfast', 'Dinner'] }])
    expect(close).toHaveBeenCalled()
    expect(titles()).not.toContain('Lunch')
    expect(toast).toHaveBeenCalledWith('Deleted Lunch', expect.objectContaining({ action: 'Undo' }))
    await act(async () => { toast.mock.calls.at(-1)[1].onAction() })
    await settle()
    expect(puts().at(-1)).toEqual({ key: 'mealNames', value: ['Breakfast', 'Lunch', 'Dinner'] })
    expect(titles()).toEqual(expect.arrayContaining(['Breakfast', 'Lunch', 'Dinner']))
  })

  it('with other meals left, the last meal can be deleted (and undone), with no reason shown', async () => {
    await mount('diary', { mealNames: ['Breakfast', 'Lunch', 'Snacks'] })
    await click(rowTitled('Snacks'))
    const { box } = openedSheet()
    expect(buttonOf(box, 'Delete meal').disabled).toBe(false)
    expect(box.textContent).not.toContain('A day needs at least one meal.')
    await click(buttonOf(box, 'Delete meal'))
    expect(puts()).toEqual([{ key: 'mealNames', value: ['Breakfast', 'Lunch'] }])
    expect(toast).toHaveBeenCalledWith('Deleted Snacks', expect.objectContaining({ action: 'Undo' }))
  })

  it('Undo does not overwrite a list that changed after the delete', async () => {
    await mount('diary', { mealNames: ['Breakfast', 'Lunch', 'Dinner'] })
    await click(rowTitled('Lunch'))
    await click(buttonOf(openedSheet().box, 'Delete meal'))
    nt.state.settings.mealNames = ['Breakfast', 'Dinner', 'Supper']
    await act(async () => { toast.mock.calls.at(-1)[1].onAction() })
    await settle()
    expect(puts()).toHaveLength(1)
    expect(toast).toHaveBeenLastCalledWith('This changed since, so Undo did not restore it.')
  })

  it('keeps one meal, and a refused save keeps the sheet and the name', async () => {
    await mount('diary', { mealNames: ['Only'] })
    await click(rowTitled('Only'))
    const { box, close } = openedSheet()
    expect(buttonOf(box, 'Delete meal').disabled).toBe(true)
    expect(box.textContent).toContain('A day needs at least one meal.')
    await type(fieldOf(box, 'Name'), 'Everything')
    nt.failNext('PUT', '/nt/api/settings', { status: 400 })
    await click(buttonOf(box, 'Save meal name'))
    expect(box.querySelector('[role="alert"]').textContent).toContain('Not saved. Try again.')
    expect(fieldOf(box, 'Name').value).toBe('Everything')
    expect(close).not.toHaveBeenCalled()
  })

  it('a meal added in NutriTrace after the page loaded survives a rename here', async () => {
    await mount('diary', { mealNames: ['Breakfast', 'Lunch', 'Dinner'] })
    nt.state.settings.mealNames = ['Breakfast', 'Lunch', 'Dinner', 'Supper']
    await click(rowTitled('Lunch'))
    const { box } = openedSheet()
    await type(fieldOf(box, 'Name'), 'Brunch')
    await click(buttonOf(box, 'Save meal name'))
    expect(puts()).toEqual([{ key: 'mealNames', value: ['Breakfast', 'Brunch', 'Dinner', 'Supper'] }])
  })

  it('a meal that is no longer where it was is not renamed over another one', async () => {
    await mount('diary', { mealNames: ['Breakfast', 'Lunch', 'Dinner'] })
    nt.state.settings.mealNames = ['Breakfast', 'Dinner', 'Lunch']
    await click(rowTitled('Lunch'))
    const { box, close } = openedSheet()
    await type(fieldOf(box, 'Name'), 'Brunch')
    await click(buttonOf(box, 'Save meal name'))
    expect(puts()).toEqual([])
    expect(box.querySelector('[role="alert"]').textContent).toContain('The meals changed somewhere else. Close this and open it again.')
    expect(close).not.toHaveBeenCalled()
  })

  describe('meal names only save what was typed', () => {
    const FR = { Breakfast: 'Petit-déjeuner', Lunch: 'Déjeuner', Dinner: 'Dîner', Snacks: 'Collations' }

    it('the default names show translated and stay NutriTrace\'s own when another meal is renamed', async () => {
      _setLangState('fr', FR)
      await mount('diary', { mealNames: undefined })
      expect(titles()).toEqual(expect.arrayContaining(['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Collations']))
      await click(rowTitled('Collations'))
      const { box } = openedSheet()
      await type(fieldOf(box, 'Name'), 'Soir')
      await click(buttonOf(box, 'Save meal name'))
      expect(puts()).toEqual([{ key: 'mealNames', value: ['Breakfast', 'Lunch', 'Dinner', 'Soir'] }])
    })

    it('saving a default name without changing it does not make the translation the saved name', async () => {
      _setLangState('fr', FR)
      await mount('diary', { mealNames: undefined })
      await click(rowTitled('Déjeuner'))
      await click(buttonOf(openedSheet().box, 'Save meal name'))
      expect(puts()).toEqual([{ key: 'mealNames', value: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] }])
    })
  })
})

describe('Water', () => {
  it('shows NutriTrace\'s defaults until something is saved (no containers), and the unit one write', async () => {
    await mount('water')
    expect(titles()).toEqual(['Water unit', 'Show water in the diary', 'Show water in statistics', 'Add a container'])
    await mount('water', { waterContainers: [{ id: '2', name: 'Standard Bottle', volumeMl: 500 }] })
    expect(valueOf('Standard Bottle')).toBe('500 ml')
    expect(optionOf('Water unit', 'ml').getAttribute('aria-checked')).toBe('true')
    expect(switchOf('Show water in the diary').getAttribute('aria-checked')).toBe('true')
    expect(host.textContent).toContain('ml · Standard Bottle 500 ml first')
    await pickSegment('Water unit', 'fl oz')
    expect(puts()).toEqual([{ key: 'waterUnit', value: 'oz' }])
    expect(valueOf('Standard Bottle')).toBe('17 fl oz')
  })

  it('switches write waterShowInDiary and waterShowInStats', async () => {
    await mount('water')
    await click(switchOf('Show water in the diary'))
    await click(switchOf('Show water in statistics'))
    expect(puts()).toEqual([{ key: 'waterShowInDiary', value: false }, { key: 'waterShowInStats', value: false }])
  })

  it('adds a container in the unit typed, as whole ml, beside the ones already there', async () => {
    await mount('water', { waterContainers: [{ id: '7', name: 'Mug', volumeMl: 300 }] })
    await click(rowTitled('Add a container'))
    const { box, close } = openedSheet()
    await type(fieldOf(box, 'Name'), 'Flask')
    await type(fieldOf(box, 'Holds'), '1.5')
    await click(buttonOf(box, 'L'))
    await click(buttonOf(box, 'Add container'))
    const [write] = puts()
    expect(write.key).toBe('waterContainers')
    expect(write.value).toEqual([{ id: '7', name: 'Mug', volumeMl: 300 }, { id: expect.stringMatching(/^\d+$/), name: 'Flask', volumeMl: 1500 }])
    expect(close).toHaveBeenCalled()
    expect(titles()).toContain('Flask')
  })

  it('a refused add keeps the sheet and what was typed, and a retry sends the same list', async () => {
    await mount('water', { waterContainers: [] })
    await click(rowTitled('Add a container'))
    const { box, close } = openedSheet()
    await type(fieldOf(box, 'Name'), 'Flask')
    await type(fieldOf(box, 'Holds'), '750')
    nt.failNext('PUT', '/nt/api/settings', { status: 400 })
    await click(buttonOf(box, 'Add container'))
    expect(close).not.toHaveBeenCalled()
    expect(box.querySelector('[role="alert"]').textContent).toContain('Not saved. Try again.')
    expect(fieldOf(box, 'Name').value).toBe('Flask')
    expect(fieldOf(box, 'Holds').value).toBe('750')
    expect(nt.state.settings.waterContainers).toEqual([])
    await click(buttonOf(box, 'Add container'))
    expect(close).toHaveBeenCalled()
    expect(nt.state.settings.waterContainers).toEqual([expect.objectContaining({ name: 'Flask', volumeMl: 750 })])
  })

  it('says what is wrong with a name or a volume and sends nothing', async () => {
    await mount('water')
    await click(rowTitled('Add a container'))
    const { box, close } = openedSheet()
    await click(buttonOf(box, 'Add container'))
    expect(box.querySelector('[role="alert"]').textContent).toContain('name')
    await type(fieldOf(box, 'Name'), 'Tank')
    await type(fieldOf(box, 'Holds'), '20000')
    await click(buttonOf(box, 'Add container'))
    expect(box.querySelector('[role="alert"]').textContent).toContain('volume')
    expect(puts()).toEqual([])
    expect(close).not.toHaveBeenCalled()
  })

  it('a tap on a container edits it in place: same id, same place in the list', async () => {
    await mount('water', { waterContainers: [{ id: '1', name: 'Mug', volumeMl: 300 }, { id: '2', name: 'Jug', volumeMl: 900 }] })
    await click(rowTitled('Mug'))
    const { box, close } = openedSheet()
    expect(fieldOf(box, 'Name').value).toBe('Mug')
    expect(fieldOf(box, 'Holds').value).toBe('300')
    await type(fieldOf(box, 'Name'), 'Big mug')
    await type(fieldOf(box, 'Holds'), '400')
    await click(buttonOf(box, 'Save container'))
    expect(puts()).toEqual([{ key: 'waterContainers', value: [{ id: '1', name: 'Big mug', volumeMl: 400 }, { id: '2', name: 'Jug', volumeMl: 900 }] }])
    expect(close).toHaveBeenCalled()
    expect(valueOf('Big mug')).toBe('400 ml')
  })

  it('removing a container asks nothing, writes the rest and offers Undo, which puts it back where it was', async () => {
    const list = [{ id: '1', name: 'Mug', volumeMl: 300 }, { id: '2', name: 'Jug', volumeMl: 900 }]
    await mount('water', { waterContainers: list })
    await click(rowTitled('Mug'))
    const { box, close } = openedSheet()
    await click(buttonOf(box, 'Remove container'))
    expect(puts()).toEqual([{ key: 'waterContainers', value: [{ id: '2', name: 'Jug', volumeMl: 900 }] }])
    expect(close).toHaveBeenCalled()
    expect(titles()).not.toContain('Mug')
    expect(toast).toHaveBeenCalledWith('Removed Mug', expect.objectContaining({ action: 'Undo' }))
    await act(async () => { toast.mock.calls.at(-1)[1].onAction() })
    await settle()
    expect(puts().at(-1)).toEqual({ key: 'waterContainers', value: list })
    expect(titles().slice(0, 2)).toEqual(['Water unit', 'Show water in the diary'])
    expect(titles()).toContain('Mug')
  })

  it('a failed removal keeps the sheet and the container, and says so', async () => {
    await mount('water', { waterContainers: [{ id: '1', name: 'Mug', volumeMl: 300 }] })
    await click(rowTitled('Mug'))
    const { box, close } = openedSheet()
    nt.failNext('PUT', '/nt/api/settings', 'offline')
    await click(buttonOf(box, 'Remove container'))
    expect(box.querySelector('[role="alert"]').textContent).toContain('no connection')
    expect(close).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    expect(titles()).toContain('Mug')
  })

  it('a container added elsewhere survives removing another', async () => {
    await mount('water', { waterContainers: [{ id: '1', name: 'Mug', volumeMl: 300 }] })
    nt.state.settings.waterContainers = [{ id: '1', name: 'Mug', volumeMl: 300 }, { id: '2', name: 'Pot', volumeMl: 900 }]
    await click(rowTitled('Mug'))
    await click(buttonOf(openedSheet().box, 'Remove container'))
    expect(puts()).toEqual([{ key: 'waterContainers', value: [{ id: '2', name: 'Pot', volumeMl: 900 }] }])
  })

  it('a page asks again when it opens, so it shows what NutriTrace has now', async () => {
    await mount('water', { waterContainers: [{ id: '1', name: 'Mug', volumeMl: 300 }] })
    nt.state.settings.waterContainers = [{ id: '1', name: 'Mug', volumeMl: 300 }, { id: '2', name: 'Pot', volumeMl: 900 }]
    act(() => root.render(null))
    act(() => root.render(<MemoryRouter><WaterPage /></MemoryRouter>))
    await settle()
    expect(titles()).toContain('Pot')
  })
})

describe('Foods and scanning', () => {
  it('shows NutriTrace\'s defaults and writes each switch as one key', async () => {
    await mount('foods')
    expect(switchOf('Show categories').getAttribute('aria-checked')).toBe('true')
    expect(switchOf('Beep when a barcode scans').getAttribute('aria-checked')).toBe('false')
    await click(switchOf('Show category labels'))
    await click(switchOf('Beep when a barcode scans'))
    expect(puts()).toEqual([{ key: 'foodsShowLabels', value: false }, { key: 'barcodeBeep', value: true }])
  })

  it('has no flashlight, yesterday\'s meals or other key the hub refuses', async () => {
    await mount('foods')
    expect(titles().join('|')).not.toMatch(/flashlight|torch|yesterday/i)
  })

  it('orders each list with the values the hub takes', async () => {
    await mount('foods')
    await pickSegment('Foods order', 'Most used')
    await pickSegment('Meals order', 'Most recent')
    await pickSegment('Recipes order', 'A to Z')
    expect(puts()).toEqual([{ key: 'foodsSort', value: 'most' }, { key: 'mealsSort', value: 'recent' }, { key: 'recipesSort', value: 'alpha' }])
    expect(optionOf('Foods order', 'Most used').getAttribute('aria-checked')).toBe('true')
  })

  it('offers Open Food Facts as a search source only while it is on', async () => {
    await mount('foods', { offEnabled: false })
    expect([...rowTitled('Search in').querySelectorAll('[role="radio"]')].map(b => b.textContent)).toEqual(['Your foods'])
    await mount('foods', { offEnabled: true })
    expect([...rowTitled('Search in').querySelectorAll('[role="radio"]')].map(b => b.textContent)).toEqual(['Your foods', 'Open Food Facts'])
    await pickSegment('Search in', 'Open Food Facts')
    expect(puts()).toEqual([{ key: 'foodsDefaultSource', value: 'off' }])
  })

  it('shows a stored legacy value, marked, while it is the stored one', async () => {
    await mount('foods', { foodsDefaultSource: 'usda' })
    expect(optionOf('Search in', 'USDA (legacy)').getAttribute('aria-checked')).toBe('true')
    await mount('foods', { foodsDefaultSource: 'all' })
    expect(optionOf('Search in', 'All sources (legacy)').getAttribute('aria-checked')).toBe('true')
  })

  it('a refused save leaves the switch as it was', async () => {
    await mount('foods')
    nt.failNext('PUT', '/nt/api/settings', { status: 400 })
    await click(switchOf('Beep when a barcode scans'))
    expect(toast).toHaveBeenCalledWith('Not saved. Try again.')
    expect(switchOf('Beep when a barcode scans').getAttribute('aria-checked')).toBe('false')
  })
})

describe('Food sources', () => {
  it('has the Open Food Facts switch, and its language and country only while it is on', async () => {
    await mount('sources')
    expect(titles()).toEqual(['Search Open Food Facts', 'Search language', 'Search country'])
    await click(switchOf('Search Open Food Facts'))
    expect(puts()).toEqual([{ key: 'offEnabled', value: false }])
    expect(titles()).toEqual(['Search Open Food Facts'])
    expect(host.textContent).toContain('Open Food Facts off')
  })

  it('writes the language as two letters and the country by its English name', async () => {
    await mount('sources')
    // Nothing saved: the device's region (en-US here) names the country (lib/nutrition/search-country.js).
    expect(valueOf('Search country')).toBe('United States')
    await click(rowTitled('Search language'))
    let { box, close } = openedSheet()
    await click([...box.querySelectorAll('[role="radio"]')].find(b => b.textContent === 'German'))
    expect(close).toHaveBeenCalled()
    await click(rowTitled('Search country'))
    ;({ box } = openedSheet())
    await type(box.querySelector('input'), 'germ')
    await click([...box.querySelectorAll('[role="radio"]')].find(b => b.textContent === 'Germany'))
    expect(puts()).toEqual([{ key: 'offSearchLanguage', value: 'de' }, { key: 'offSearchCountry', value: 'Germany' }])
    expect(valueOf('Search language')).toBe('German')
    expect(valueOf('Search country')).toBe('Germany')
  })

  const pickCountry = async label => {
    await click(rowTitled('Search country'))
    const { box } = openedSheet()
    await click([...box.querySelectorAll('[role="radio"]')].find(b => b.textContent === label))
  }

  it('keeps a country an older hub refuses for this session\'s searches and says it cannot be saved yet', async () => {
    await mount('sources')
    nt.failNext('PUT', '/nt/api/settings', { status: 400 })
    await pickCountry('Romania')
    expect(toast).toHaveBeenCalledWith('This country can\'t be saved yet')
    expect(toast).not.toHaveBeenCalledWith('Not saved. Try again.')
    expect(valueOf('Search country')).toBe('Romania')
    expect(settingOf(useNutrition.getState().settings.data, 'offSearchCountry')).toBe('Romania')
    await act(async () => { await useNutrition.getState().loadSettings({ force: true }) })
    expect(settingOf(useNutrition.getState().settings.data, 'offSearchCountry')).toBe('Romania')
    expect(nt.state.settings.offSearchCountry).toBeUndefined()
  })

  it('a country the hub takes is saved as before, and replaces a kept choice', async () => {
    await mount('sources')
    nt.failNext('PUT', '/nt/api/settings', { status: 422 })
    await pickCountry('Romania')
    await pickCountry('Germany')
    await act(async () => { await useNutrition.getState().loadSettings({ force: true }) })
    expect(settingOf(useNutrition.getState().settings.data, 'offSearchCountry')).toBe('Germany')
    expect(nt.state.settings.offSearchCountry).toBe('Germany')
  })

  it('any other refused setting is still the generic message', async () => {
    await mount('sources')
    nt.failNext('PUT', '/nt/api/settings', { status: 400 })
    await click(rowTitled('Search language'))
    const { box } = openedSheet()
    await click([...box.querySelectorAll('[role="radio"]')].find(b => b.textContent === 'German'))
    expect(toast).toHaveBeenCalledWith('Not saved. Try again.')
  })

  it('has no login, key or USDA row: the hub lets none of them through', async () => {
    await mount('sources')
    expect(titles().join('|')).not.toMatch(/usda|password|username|key/i)
  })
})

describe('NtSettingsGate on the new pages', () => {
  it('stands the page up at once, says the settings did not load with Try again, and shows the rows once they do', async () => {
    useNutrition.getState().reset()
    nt = createFakeNutriTrace({ settings: { timeFormat: '24h' } })
    nt.failNext('GET', '/nt/api/settings', { status: 500 })
    vi.stubGlobal('fetch', nt.fetch)
    act(() => root.render(<MemoryRouter><WaterPage /></MemoryRouter>))
    await settle()
    expect(host.querySelector('h1').textContent).toBe('Water')
    expect(host.querySelector('[role="alert"]').textContent).toBe('Your settings did not load.')
    expect(titles()).toEqual([])
    await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Try again'))
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(titles()).toContain('Water unit')
  })
})

describe('search and Features', () => {
  const web = { user: { id: 'u' }, mobile: false, nutrition: true }

  it('every search entry on these pages is a row on the page', async () => {
    const settings = { ...fixtureSettings(), calorieAdjustFromActivity: true, diaryShowActivity: true, fastingEnabled: true, offEnabled: true, showQuickCalories: true }
    for (const page of Object.keys(PAGES)) {
      await mount(page, settings)
      const ctx = { ...web, ntSettings: nt.state.settings, fastingOn: true }
      const want = SEARCH.filter(e => e.page === page && (!e.when || e.when(ctx))).map(e => e.title)
      expect(want.length, page).toBeGreaterThan(0)
      for (const title of want) expect(titles(), `${page}: ${title}`).toContain(title)
    }
  })

  it('every switch these pages show off in a new account is on Features', async () => {
    // A new account has saved nothing: the switches that read off are NutriTrace's defaults.
    const off = new Set()
    for (const page of Object.keys(PAGES)) {
      await mount(page, {})
      for (const row of rows()) {
        if (row.querySelector('[role="switch"][aria-checked="false"]')) off.add(page + ':' + titleOf(row))
      }
    }
    const listed = featuresFor({ ...web, ntSettings: {} }).map(e => e.page + ':' + e.title).filter(k => k.split(':')[0] in PAGES)
    expect(new Set(listed)).toEqual(off)
    expect([...off].sort()).toEqual(['diary:Show activity under meals', 'diary:Show time logged', 'foods:Beep when a barcode scans'])
  })
})
