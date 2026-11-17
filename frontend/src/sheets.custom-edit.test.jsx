// @vitest-environment happy-dom
// #378 / #358: a custom exercise stored without `custom: true` — what a plan import (a shared
// plan file, a plan from the AI coach) wrote before 1.3.8 — showed no Edit and no Delete, in the
// exercise sheet or in the routine's exercise settings, and its thumbnail went through the
// built-in renderer. Every one of those now asks where the exercise lives, not for the flag.
// The drawer (T6.1) keeps Edit and Delete in its ⋯ menu; Edit opens the Create exercise page.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'

import { EXIDX, registerCustom } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { topSurface } from './lib/sheet-nav.js'
import { _setLangState } from './lib/i18n-core.js'
import { setNav } from './lib/nav.js'
import { bindUI } from './components/ui.jsx'
import { Thumb } from './components/Media.jsx'
import { customExSheet, exerciseDetailSheet, exConfigSheet } from './sheets.jsx'

bindUI(useUI)

const mounted = []
const S = () => useStore.getState().S
const navigate = vi.fn()

function render(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(el))
  return host
}
const renderTop = () => {
  const sheet = topSurface(useUI.getState().sheets)
  return render(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
}
const buttons = host => [...host.querySelectorAll('button')].map(b => b.textContent.trim())
const click = (host, sel, text) => {
  const el = [...host.querySelectorAll(sel)].find(e => e.textContent.trim() === text)
  if (!el) throw new Error(`nothing with text "${text}"`)
  act(() => el.click())
}
const menuOf = host => host.querySelector('button[aria-label="Exercise options"]')
const pressed = host => [...host.querySelectorAll('button[aria-pressed="true"]')].map(c => c.textContent.trim())
const nameInput = form => form.querySelector('.g-tfield input')

// Exactly what a pre-1.3.8 plan import stored: no flag, no equipment.
const legacy = () => ({ id: 'cx1', n: 'My row', bp: 'back' })
function seed(ex, extra = {}) {
  useStore.setState(s => ({ S: { ...s.S, customEx: [ex], ...extra } }))
  registerCustom([ex])
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: structuredClone(DEF), user: null, config: null })
  registerCustom([])
  _setLangState('en', null, null, null)
  document.body.innerHTML = ''
  navigate.mockClear()
  setNav(navigate)
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  registerCustom([])
})

describe('a custom exercise stored without the flag', () => {
  it('its drawer offers Edit and Delete behind ⋯; a built-in one has no ⋯', () => {
    const ex = legacy()
    seed(ex)
    exerciseDetailSheet(ex)
    const host = renderTop()
    act(() => menuOf(host).click())
    expect(buttons(renderTop())).toEqual(expect.arrayContaining(['Edit', 'Delete']))
    useUI.setState({ sheets: [] })
    exerciseDetailSheet(EXIDX['0025'])
    expect(menuOf(renderTop())).toBeNull()
  })

  it('Edit opens the Create exercise page for it, in the drawer\'s place', () => {
    const ex = legacy()
    seed(ex)
    exerciseDetailSheet(ex)
    // Rendered outside the click's act: a render nested in it would not flush before the query.
    const menu = menuOf(renderTop())
    act(() => menu.click())
    click(renderTop(), 'button', 'Edit')
    expect(navigate).toHaveBeenCalledWith('/train/exercises/new?edit=cx1')
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('inside a running workout Edit opens the form in a drawer, filled in with it', () => {
    const ex = legacy()
    seed(ex)
    const hash = location.hash
    location.hash = '#/train/workout'
    try {
      exerciseDetailSheet(ex)
      const menu = menuOf(renderTop())
      act(() => menu.click())
      click(renderTop(), 'button', 'Edit')
      expect(navigate).not.toHaveBeenCalled()
      const form = renderTop()
      expect(form.textContent).toContain('Edit custom exercise')
      expect(nameInput(form).value).toBe('My row')
      expect(pressed(form)).toContain('Back')
    } finally { location.hash = hash }
  })

  it('Delete takes it out of the routines and keeps the name in history', () => {
    const ex = legacy()
    seed(ex, {
      routines: [{ id: 'r1', name: 'A', ex: [{ id: 'cx1', sets: 3, reps: 8, w: 40 }, { id: '0027', sets: 3, reps: 8, w: 40 }] }],
      workouts: [{ d: '2026-09-01', entries: [{ id: 'cx1', sets: [{ r: 8, w: 40, done: true }] }] }],
    })
    exerciseDetailSheet(ex)
    const menu = menuOf(renderTop())
    act(() => menu.click())
    click(renderTop(), 'button', 'Delete')
    click(renderTop(), 'button', 'Delete')   // the confirmation
    expect(S().customEx).toEqual([])
    expect(S().routines[0].ex.map(e => e.id)).toEqual(['0027'])
    expect(S().workouts[0].entries[0].n).toBe('My row')
    expect(useUI.getState().sheets).toHaveLength(0)   // the drawer went with it
  })

  it('the routine exercise settings offer "Edit or delete this exercise"', () => {
    const ex = legacy()
    seed(ex)
    exConfigSheet(ex, { id: 'cx1', sets: 3, reps: 8, w: 40 }, () => {})
    expect(buttons(renderTop())).toContain('Edit or delete this exercise')
  })

  it('its thumbnail is the custom one, never a dataset image', () => {
    const ex = { ...legacy(), img: 'stray.jpg' }
    seed(ex)
    const host = render(<Thumb ex={ex} />)
    expect(host.querySelector('img')).toBeNull()
    expect(host.querySelector('.thumb-x')).toBeTruthy()
  })

  it('equipment from an import that the list lacks counts as picked, so Save works', () => {
    const ex = { ...legacy(), eq: 'custom', custom: true }
    seed(ex)
    customExSheet(ex)
    const form = renderTop()
    expect(pressed(form)).toContain('custom')
    act(() => {
      const el = nameInput(form)
      Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, 'My cable row')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    click(form, 'button', 'Save')
    expect(S().customEx[0]).toMatchObject({ id: 'cx1', n: 'My cable row', eq: 'custom' })
  })
})

describe('the store heals it', () => {
  it('a copy that enters the store gets the flag back, without a new stamp on the entry', () => {
    useStore.getState().replaceState({ ...structuredClone(DEF), customEx: [{ ...legacy(), _ts: 7 }] })
    expect(S().customEx[0]).toMatchObject({ id: 'cx1', custom: true, eq: '', _ts: 7 })
    const healed = S().customEx
    useStore.getState().update(s => { s.restDefault = 90 })
    expect(S().customEx[0]._ts).toBe(7)   // healing twice changes nothing
    expect(S().customEx[0]).toEqual(healed[0])
  })
})
