// @vitest-environment happy-dom
// The saved-meal drawer (Ea4MealDetail) and the servings drawer (Ea4Servings), opened from My foods:
// what they show, what Log to <meal> writes (once, all or none, to the day and meal the diary had
// when they opened, and never moving the diary's selection), and Undo.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { nutritionOf } from '../lib/nutrition/diary.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { useHubSync } from '../lib/nutrition/sync.js'
import { createFakeNutriTrace } from '../lib/nutrition/fake-nutritrace.js'
import { mealDetailSheet } from './MealDetailSheet.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const DAY = '2026-10-13'
let nt
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
const buttonSaying = (host, text) => [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === text)
const dayItems = () => nt.state.days[DAY]?.items || []
const toastText = () => useUI.getState().toastMsg

// Opens the drawer the way My foods does and draws it the way Modals would.
async function open(props) {
  await act(async () => { await Promise.all([useNutrition.getState().loadSettings(), useNutrition.getState().loadMeals({ recipes: false }), useNutrition.getState().loadMeals({ recipes: true })]) })
  act(() => mealDetailSheet(props))
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

beforeEach(() => {
  nt = createFakeNutriTrace()
  vi.stubGlobal('fetch', nt.fetch)
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
  useDiarySelection.getState().reset()
  useHubSync.getState().reset()
  useDiarySelection.getState().setDate(DAY)
  useDiarySelection.getState().setMeal(2)
  useUI.setState({ sheets: [], toastMsg: '' })
})
afterEach(() => {
  mounted.forEach(r => { try { act(() => r.unmount()) } catch { /* already unmounted */ } })
  mounted.length = 0
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('a saved meal', () => {
  it('shows its foods with amounts and energy, the total and the macros, and the meal it logs to', async () => {
    const sheet = await open({ id: 21, recipe: false })
    expect(sheet.querySelector('h2').textContent).toBe('Oats and bread')
    expect(sheet.textContent).toContain('Rolled oats')
    expect(sheet.textContent).toContain('60 g')
    expect(sheet.textContent).toContain('354 kcal')
    expect(sheet.querySelector('.g-bs-chip').textContent).toContain('Dinner')
    expect(buttonSaying(sheet, 'Edit')).toBeTruthy()
  })

  it('Log to <meal> adds each food at its saved amount, to the chip\'s day and meal, in one write', async () => {
    const sheet = await open({ id: 21, recipe: false })
    tap(buttonSaying(sheet, 'Log to Dinner'))
    await settle(() => expect(dayItems()).toHaveLength(2))
    expect(dayItems().map(i => [i.name, i.meal, i.food_server_id])).toEqual([['Rolled oats', 2, 11], ['Wholemeal bread', 2, 12]])
    expect(dayItems().reduce((s, i) => s + nutritionOf(i).calories, 0)).toBeCloseTo(354)
    expect(nt.writes().filter(r => r.path === `/nt/api/diary/${DAY}`)).toHaveLength(1)
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(toastText()).toMatch(/^Added Oats and bread to .+, Dinner$/)
  })

  it('keeps the day and meal it opened with, and does not move the diary\'s selection', async () => {
    const sheet = await open({ id: 21, recipe: false })
    act(() => { useDiarySelection.getState().setDate('2026-10-01'); useDiarySelection.getState().setMeal(0) })
    const before = { date: useDiarySelection.getState().date, meal: useDiarySelection.getState().meal }
    tap(buttonSaying(sheet, 'Log to Dinner'))
    await settle(() => expect(dayItems()).toHaveLength(2))
    expect(nt.state.days['2026-10-01']).toBeUndefined()
    expect(useDiarySelection.getState().date).toBe(before.date)
    expect(useDiarySelection.getState().meal).toEqual(before.meal)
  })

  it('logs once when the answer to the first try was lost, and keeps the drawer when it was refused', async () => {
    const sheet = await open({ id: 21, recipe: false })
    nt.failNext('PUT', '/nt/api/diary/', { lost: true, status: 504 })
    tap(buttonSaying(sheet, 'Log to Dinner'))
    await settle(() => expect(toastText()).toBe('Not saved. Try again.'))
    expect(dayItems()).toHaveLength(2)
    expect(useUI.getState().sheets).toHaveLength(1)
    tap(buttonSaying(sheet, 'Log to Dinner'))
    await settle(() => expect(useUI.getState().sheets).toHaveLength(0))
    expect(dayItems()).toHaveLength(2)
  })

  it('takes the logged meal back with Undo', async () => {
    const sheet = await open({ id: 21, recipe: false })
    tap(buttonSaying(sheet, 'Log to Dinner'))
    await settle(() => expect(dayItems()).toHaveLength(2))
    act(() => useUI.getState().runToastAction())
    await settle(() => expect(dayItems()).toHaveLength(0))
  })
})

describe('a recipe', () => {
  it('steps in half servings and says the energy and protein of that amount', async () => {
    const sheet = await open({ id: 22, recipe: true })
    expect(sheet.querySelector('h2').textContent).toBe('Lentil soup')
    expect(sheet.textContent).toContain('4 servings · 210 kcal each')
    expect(sheet.querySelector('.g-mf-amount').textContent).toBe('210 kcal · P 12 g')
    tap(buttonSaying(sheet, 'More servings'))
    expect(sheet.querySelector('.g-mf-amount').textContent).toBe('315 kcal · P 18 g')
    tap(buttonSaying(sheet, 'Fewer servings'))
    tap(buttonSaying(sheet, 'Fewer servings'))
    expect(sheet.querySelector('.g-mf-amount').textContent).toBe('105 kcal · P 6 g')
    tap(buttonSaying(sheet, 'Fewer servings'))
    expect(sheet.querySelector('.g-mf-amount').textContent).toBe('105 kcal · P 6 g')
  })

  it('logs one entry for the servings chosen at the per-serving nutrition', async () => {
    const sheet = await open({ id: 22, recipe: true })
    tap(buttonSaying(sheet, 'More servings'))
    tap(buttonSaying(sheet, 'Log to Dinner'))
    await settle(() => expect(dayItems()).toHaveLength(1))
    expect(dayItems()[0]).toMatchObject({ id: 22, is_recipe: true, name: 'Lentil soup', meal: 2, quantity: 1.5, portion: 300, unit: 'g' })
    expect(nutritionOf(dayItems()[0]).calories).toBeCloseTo(315)
    expect(nt.writes().some(r => r.path.startsWith('/nt/api/foods/'))).toBe(false)
  })
})
