// @vitest-environment happy-dom
// My foods against the foundation's fake of NutriTrace: the tab and source in the URL, Favourites
// before All foods with how many, the Open Food Facts chip following Settings > Food sources, the
// sort and what a row says following Settings > Foods, and each tab's empty state.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { useHubSync } from '../lib/nutrition/sync.js'
import { createFakeNutriTrace, fixtureFoods, fixtureMeals, fixtureSettings } from '../lib/nutrition/fake-nutritrace.js'
import { resetOnlineSearch } from '../lib/nutrition/use-online-search.js'
import MyFoods from './MyFoods.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let nt
let page
const mounted = []

const settle = async check => {
  const end = Date.now() + 3000
  for (;;) {
    try { check(); return } catch (e) {
      if (Date.now() > end) throw e
      await act(async () => { await new Promise(r => setTimeout(r, 25)) })
    }
  }
}
const tap = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
const buttonSaying = (host, text) => [...host.querySelectorAll('button, a')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === text)
const names = () => [...page.querySelectorAll('.g-mf-row .g-mf-body b')].map(el => el.textContent)
const subOf = name => [...page.querySelectorAll('.g-mf-row')].find(el => el.querySelector('b').textContent === name).querySelector('.g-mf-body > span').textContent
const headings = () => [...page.querySelectorAll('.g-ssec')].map(el => el.textContent)
const where = () => page.querySelector('[data-where]').textContent

function Where() {
  const loc = useLocation()
  return <i data-where="">{loc.pathname + loc.search}</i>
}

async function openPage(url, { settings = {}, foods, meals } = {}) {
  nt = createFakeNutriTrace({ settings: { ...fixtureSettings(), ...settings }, ...(foods ? { foods } : {}), ...(meals ? { meals } : {}) })
  vi.stubGlobal('fetch', nt.fetch)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(<MemoryRouter initialEntries={[url]}><MyFoods /><Where /></MemoryRouter>))
  page = host
  await settle(() => expect(useNutrition.getState().settings.status).toBe('ready'))
}

beforeEach(() => {
  resetOnlineSearch()
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
  useDiarySelection.getState().reset()
  useHubSync.getState().reset()
  useUI.setState({ sheets: [], toastMsg: '' })
})
afterEach(() => {
  mounted.forEach(r => { try { act(() => r.unmount()) } catch { /* already unmounted */ } })
  mounted.length = 0
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const foodsWithFavourite = () => [{ ...fixtureFoods()[0], favorite: 1 }, fixtureFoods()[1], fixtureFoods()[2]]

describe('the tab', () => {
  it('lives in the URL: it opens on the one named, defaults to Foods, and changing it replaces', async () => {
    await openPage('/food/my-foods?tab=recipes')
    await settle(() => expect(names()).toEqual(['Lentil soup']))
    tap(buttonSaying(page, 'Saved meals'))
    await settle(() => expect(names()).toEqual(['Oats and bread']))
    expect(where()).toBe('/food/my-foods?tab=meals')
    tap(buttonSaying(page, 'Foods'))
    expect(where()).toBe('/food/my-foods?tab=foods')
  })

  it('opens on Foods without a tab, or with one it does not know', async () => {
    await openPage('/food/my-foods?tab=nonsense', { foods: foodsWithFavourite() })
    await settle(() => expect(names()).toHaveLength(3))
  })

  it('names the + for the tab on show', async () => {
    await openPage('/food/my-foods?tab=meals')
    expect(buttonSaying(page, 'New saved meal')).toBeTruthy()
    tap(buttonSaying(page, 'Recipes'))
    expect(buttonSaying(page, 'New recipe')).toBeTruthy()
    tap(buttonSaying(page, 'Foods'))
    expect(buttonSaying(page, 'New food')).toBeTruthy()
  })
})

describe('Foods', () => {
  it('lists Favourites first, then All foods with how many are left', async () => {
    await openPage('/food/my-foods', { foods: foodsWithFavourite() })
    await settle(() => expect(names()).toHaveLength(3))
    expect(names()).toEqual(['Rolled oats', 'Crème fraîche', 'Wholemeal bread'])
    expect(headings()).toEqual(['Favourites', 'All foods2'])
  })

  it('says brand, amount and energy under a name', async () => {
    await openPage('/food/my-foods', { foods: foodsWithFavourite() })
    await settle(() => expect(names()).toHaveLength(3))
    expect(subOf('Wholemeal bread')).toContain('Baker · 100 g · 247 kcal')
  })

  it('searches your foods, accents aside', async () => {
    await openPage('/food/my-foods', { foods: foodsWithFavourite() })
    await settle(() => expect(names()).toHaveLength(3))
    const field = page.querySelector('input[type="search"]')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, 'creme')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(names()).toEqual(['Crème fraîche'])
  })

  it('foodsSort: All foods opens in that order', async () => {
    const foods = [{ ...fixtureFoods()[1], usage_count: 1 }, { ...fixtureFoods()[0], usage_count: 9 }, { ...fixtureFoods()[2], usage_count: 5 }]
    await openPage('/food/my-foods', { settings: { foodsSort: 'most' }, foods })
    await settle(() => expect(names()).toEqual(['Rolled oats', 'Crème fraîche', 'Wholemeal bread']))
  })

  it('shows the Open Food Facts chip, and opens on it with ?source=off', async () => {
    await openPage('/food/my-foods?tab=foods&source=off')
    expect(buttonSaying(page, 'Open Food Facts')).toBeTruthy()
    await settle(() => expect(page.textContent).toContain('Type a food to search Open Food Facts.'))
    tap(buttonSaying(page, 'Yours'))
    expect(where()).toBe('/food/my-foods?tab=foods&source=mine')
  })

  it('hides the Open Food Facts chip while Food sources has it off, and opens on Yours', async () => {
    await openPage('/food/my-foods?tab=foods&source=off', { settings: { offEnabled: false }, foods: foodsWithFavourite() })
    await settle(() => expect(names()).toHaveLength(3))
    expect(buttonSaying(page, 'Open Food Facts')).toBeUndefined()
  })

  it('foodsDefaultSource off opens on Open Food Facts when no source is in the URL', async () => {
    await openPage('/food/my-foods', { settings: { foodsDefaultSource: 'off' } })
    await settle(() => expect(page.textContent).toContain('Type a food to search Open Food Facts.'))
  })
})

describe('the empty states, each with one button', () => {
  it('no foods: New food', async () => {
    await openPage('/food/my-foods?tab=foods', { foods: [] })
    await settle(() => expect(page.textContent).toContain('No foods yet'))
    expect([...page.querySelectorAll('.g-sempty-btn')].map(b => b.textContent)).toEqual(['New food'])
  })

  it('no saved meals: New saved meal', async () => {
    await openPage('/food/my-foods?tab=meals', { meals: [] })
    await settle(() => expect(page.textContent).toContain('No saved meals yet'))
    expect([...page.querySelectorAll('.g-sempty-btn')].map(b => b.textContent)).toEqual(['New saved meal'])
  })

  it('no recipes: New recipe, with the line that says what a recipe does', async () => {
    await openPage('/food/my-foods?tab=recipes', { meals: [fixtureMeals()[0]] })
    await settle(() => expect(page.textContent).toContain('No recipes yet'))
    expect(page.textContent).toContain('Add the ingredients once and Gains works out each serving.')
    expect([...page.querySelectorAll('.g-sempty-btn')].map(b => b.textContent)).toEqual(['New recipe'])
  })
})
