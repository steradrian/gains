// @vitest-environment happy-dom
// Categories (boards St1Categories, St1Category): colour dots, counts from the foods list, the
// drawer's add / edit / delete with Undo, against the fake hub, which holds every write to the
// rules of fitness-hub src/nt-body-checks.ts.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { createFakeNutriTrace, fixtureFoods } from '../../../lib/nutrition/fake-nutritrace.js'
import { CATEGORY_COLORS, categoryColor } from '../../../lib/nutrition/category-colors.js'
import CategoriesPage, { tallyCategories } from './CategoriesPage.jsx'

vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const dot = id => CATEGORY_COLORS.find(c => c.id === id).dot
const food = (id, category) => ({ ...fixtureFoods()[0], id, category })

let host, root, nt, sheets, sheetRoots
const toast = vi.fn()
const settle = () => act(async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0)) })
const puts = () => nt.requests.filter(r => r.method === 'PUT' && r.path === '/nt/api/settings').map(r => r.body)
const rows = () => [...host.querySelectorAll('.g-glist-row')]
const rowTitled = title => rows().find(r => r.querySelector('b')?.textContent === title)
const subOf = title => rowTitled(title).querySelector('.g-glist-body span')?.textContent
const click = async el => { await act(async () => { el.click() }); await settle() }
const type = async (el, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

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
const button = (box, label) => [...box.querySelectorAll('button')].find(b => b.textContent === label)
const swatch = (box, label) => box.querySelector(`[role="radio"][aria-label="${label}"]`)

async function mount({ settings = {}, foods = [] } = {}) {
  useNutrition.getState().reset()
  nt = createFakeNutriTrace({ settings: { timeFormat: '24h', ...settings }, foods })
  vi.stubGlobal('fetch', nt.fetch)
  act(() => root.render(<CategoriesPage />))
  await settle()
}

beforeEach(() => {
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  sheets = []
  sheetRoots = []
  toast.mockClear()
  useUI.setState({ toast, openSheet: render => { sheets.push(render); return { close: vi.fn() } } })
  useNutrition.getState().reset()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  for (const [r, box] of sheetRoots) { act(() => r.unmount()); box.remove() }
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

describe('tallyCategories', () => {
  it('counts the foods under each listed category and ignores the rest', () => {
    expect(tallyCategories(['Dairy', { name: 'Fruit', label: '' }], [food(1, 'Dairy'), food(2, 'Dairy'), food(3, 'Fruit'), food(4, 'Gone'), food(5, '')]))
      .toEqual({ by: { Dairy: 2, Fruit: 1 }, total: 3 })
  })
})

describe('Categories page', () => {
  it('lists each category with its colour dot and how many foods are filed under it', async () => {
    await mount({
      settings: { foodCategories: [{ name: 'Dairy', label: dot('blue') }, 'Fruit'] },
      foods: [food(1, 'Dairy'), food(2, 'Dairy'), food(3, 'Fruit')],
    })
    expect(host.querySelector('h1').textContent).toBe('Categories')
    expect(host.querySelector('.g-sptitle p').textContent).toBe('2 categories · used by 3 foods')
    expect(subOf('Dairy')).toBe('2 foods')
    expect(subOf('Fruit')).toBe('1 food')
    expect(rowTitled('Dairy').querySelector('.set-dot').className).toContain('set-dot-blue')
  })

  it('draws a category stored with an old emoji in a colour, and the same one each time', async () => {
    await mount({ settings: { foodCategories: [{ name: 'Meat', label: '\u{1F969}' }, 'Plain'] } })
    const colour = categoryColor({ name: 'Meat', label: '\u{1F969}' })
    expect(rowTitled('Meat').querySelector('.set-dot').className).toContain('set-dot-' + colour)
    expect(rowTitled('Plain').querySelector('.set-dot').className).toMatch(/set-dot-(red|orange|yellow|green|blue|purple|brown|black)/)
    expect(host.textContent).not.toContain('\u{1F969}')
  })

  it('says there are none yet, and still offers Add a category', async () => {
    await mount({ settings: { foodCategories: [] } })
    expect(host.textContent).toContain('No categories yet')
    expect(rowTitled('Add a category')).toBeTruthy()
  })

  it('adds a category: the first colour nobody wears is chosen, a tap picks another, Save writes name and dot', async () => {
    await mount({ settings: { foodCategories: [{ name: 'Dairy', label: dot('red') }] } })
    await click(rowTitled('Add a category'))
    const { box, close } = openedSheet()
    expect(swatch(box, 'Orange').getAttribute('aria-checked')).toBe('true')
    await type(box.querySelector('input'), 'Fruit')
    await click(swatch(box, 'Blue'))
    await click(button(box, 'Save category'))
    expect(puts()).toEqual([{ key: 'foodCategories', value: [{ name: 'Dairy', label: dot('red') }, { name: 'Fruit', label: dot('blue') }] }])
    expect(close).toHaveBeenCalled()
    expect(rowTitled('Fruit').querySelector('.set-dot').className).toContain('set-dot-blue')
  })

  it('refuses a repeated name with the reason, no write, and keeps the drawer', async () => {
    await mount({ settings: { foodCategories: ['Dairy'] } })
    await click(rowTitled('Add a category'))
    const { box, close } = openedSheet()
    await type(box.querySelector('input'), 'Dairy')
    await click(button(box, 'Save category'))
    expect(box.querySelector('[role="alert"]').textContent).toBe('You already have a category with that name.')
    expect(puts()).toEqual([])
    expect(close).not.toHaveBeenCalled()
  })

  it('edits the colour in place and keeps a name that foods are filed under as it is', async () => {
    await mount({ settings: { foodCategories: ['Dairy', 'Fruit'] }, foods: [food(1, 'Dairy')] })
    await click(rowTitled('Dairy'))
    const { box } = openedSheet()
    expect(box.querySelector('input').disabled).toBe(true)
    await click(swatch(box, 'Purple'))
    await click(button(box, 'Save category'))
    expect(puts()).toEqual([{ key: 'foodCategories', value: [{ name: 'Dairy', label: dot('purple') }, 'Fruit'] }])
  })

  it('renames a category no food uses', async () => {
    await mount({ settings: { foodCategories: ['Dairy', 'Fruit'] }, foods: [food(1, 'Dairy')] })
    await click(rowTitled('Fruit'))
    const { box } = openedSheet()
    expect(box.querySelector('input').disabled).toBe(false)
    await type(box.querySelector('input'), 'Fresh fruit')
    await click(button(box, 'Save category'))
    expect(puts().at(-1).value.map(c => (typeof c === 'string' ? c : c.name))).toEqual(['Dairy', 'Fresh fruit'])
  })

  it('saving without choosing a colour keeps an emoji from before the dots', async () => {
    await mount({ settings: { foodCategories: [{ name: 'Meat', label: '\u{1F969}' }] } })
    await click(rowTitled('Meat'))
    const { box } = openedSheet()
    await click(button(box, 'Save category'))
    expect(puts()).toEqual([{ key: 'foodCategories', value: [{ name: 'Meat', label: '\u{1F969}' }] }])
  })

  it('deletes with an Undo toast, not a confirm, and Undo puts it back where it was', async () => {
    await mount({ settings: { foodCategories: ['Dairy', { name: 'Fruit', label: dot('green') }, 'Veg'] } })
    await click(rowTitled('Fruit'))
    const { box, close } = openedSheet()
    await click(button(box, 'Delete category'))
    expect(puts()).toEqual([{ key: 'foodCategories', value: ['Dairy', 'Veg'] }])
    expect(close).toHaveBeenCalled()
    expect(sheets).toHaveLength(1)
    expect(toast).toHaveBeenCalledWith('Deleted Fruit', expect.objectContaining({ action: 'Undo' }))
    await act(async () => { await toast.mock.calls.at(-1)[1].onAction() })
    await settle()
    expect(puts().at(-1)).toEqual({ key: 'foodCategories', value: ['Dairy', { name: 'Fruit', label: dot('green') }, 'Veg'] })
  })

  it('an add is made over what the server has now: a category added elsewhere survives', async () => {
    await mount({ settings: { foodCategories: ['Dairy'] } })
    nt.state.settings.foodCategories = ['Dairy', 'Fish']
    await click(rowTitled('Add a category'))
    const { box } = openedSheet()
    await type(box.querySelector('input'), 'Fruit')
    await click(button(box, 'Save category'))
    expect(puts().at(-1).value.map(c => (typeof c === 'string' ? c : c.name))).toEqual(['Dairy', 'Fish', 'Fruit'])
  })

  it('a failed re-read saves nothing and says so', async () => {
    await mount({ settings: { foodCategories: ['Dairy'] } })
    await click(rowTitled('Add a category'))
    const { box, close } = openedSheet()
    await type(box.querySelector('input'), 'Fruit')
    nt.failNext('GET', '/nt/api/settings', 'offline')
    await click(button(box, 'Save category'))
    expect(puts()).toEqual([])
    expect(box.querySelector('[role="alert"]').textContent).toBe('Not saved: no connection. Try again when you are back online.')
    expect(close).not.toHaveBeenCalled()
  })

  it('deletes whichever shape the category is stored in and writes the rest in the shapes NutriTrace uses', async () => {
    await mount({ settings: { foodCategories: ['Dairy', { name: 'Fruit', label: '\u{1F34E}' }, { name: 'Veg', label: '' }] } })
    await click(rowTitled('Dairy'))
    const { box } = openedSheet()
    await click(button(box, 'Delete category'))
    expect(puts()).toEqual([{ key: 'foodCategories', value: [{ name: 'Fruit', label: '\u{1F34E}' }, 'Veg'] }])
  })

  it('a refused delete keeps the drawer and offers no Undo', async () => {
    await mount({ settings: { foodCategories: ['Dairy'] } })
    await click(rowTitled('Dairy'))
    const { box, close } = openedSheet()
    nt.failNext('PUT', '/nt/api/settings', { status: 400 })
    await click(button(box, 'Delete category'))
    expect(close).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    expect(box.querySelector('[role="alert"]')).toBeTruthy()
  })
})
