// @vitest-environment happy-dom
// T6.4 Create exercise, the page host of the form: /train/exercises/new creates, ?edit=<id> edits,
// the duplicate-name check stays, a create goes back and opens the new exercise's drawer, and a
// delete goes back. StagePage (slice 2) is stood in for, so this tests the page's own work.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({ detail: vi.fn() }))
vi.mock('../../../ds/StagePage.jsx', () => ({
  default: ({ largeTitle, sub, children }) => <div className="stage-page"><h1>{largeTitle}</h1><p>{sub}</p>{children}</div>,
}))
vi.mock('../../../sheets.jsx', async orig => ({ ...(await orig()), exerciseDetailSheet: h.detail }))

import { registerCustom } from '../../../lib/exercises.js'
import { _setLangState } from '../../../lib/i18n-core.js'
import { setNav } from '../../../lib/nav.js'
import { bindUI } from '../../../components/ui.jsx'
import { DEF, useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import CreateExercise from './CreateExercise.jsx'

bindUI(useUI)

const mounted = []
const S = () => useStore.getState().S
const navigate = vi.fn()
function render(path) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(<MemoryRouter initialEntries={[path]}><CreateExercise /></MemoryRouter>))
  return host
}
function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const click = (host, sel, text) => {
  const el = [...host.querySelectorAll(sel)].find(e => e.textContent.trim() === text)
  if (!el) throw new Error(`nothing with text "${text}"`)
  act(() => el.click())
}
const type = (el, value) => act(() => {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
const own = (over = {}) => ({ id: 'cpage1', n: 'QA sandbag carry', bp: 'back', eq: 'barbell', custom: true, desc: '', mode: 'reps', ...over })
function seed(ex) {
  useStore.setState(s => ({ S: { ...s.S, customEx: [ex] } }))
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
  h.detail.mockClear()
  setNav(navigate)
  history.replaceState({ idx: 1 }, '')
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  registerCustom([])
  vi.useRealTimers()
})

describe('Create exercise (T6.4)', () => {
  it('draws the board\'s page: New exercise, its line, and the form on the stage', () => {
    const page = render('/train/exercises/new')
    expect(page.querySelector('h1').textContent).toBe('New exercise')
    expect(page.textContent).toContain('Works just like any other exercise')
    expect(page.querySelector('.g-cxf-stage')).not.toBeNull()
    expect(page.textContent).toContain('How you log it')
    expect(page.textContent).toContain('Picture or video')
  })

  it('creates the exercise, goes back, and opens its drawer once back', () => {
    vi.useFakeTimers()
    const page = render('/train/exercises/new')
    type(page.querySelector('.g-tfield input'), 'QA landmine push')
    click(page, 'button[aria-pressed]', 'Shoulders')
    click(page, 'button[aria-pressed]', 'barbell')
    click(page, 'button', 'Create exercise')
    const c = S().customEx.find(x => x.n === 'QA landmine push')
    expect(c).toMatchObject({ bp: 'shoulders', eq: 'barbell', mode: 'reps', custom: true })
    expect(navigate).toHaveBeenCalledWith(-1)
    expect(h.detail).not.toHaveBeenCalled()
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(h.detail).toHaveBeenCalledWith(expect.objectContaining({ id: c.id }))
  })

  it('opened as a deep link, a create goes to Exercises in its place', () => {
    history.replaceState({ idx: 0 }, '')
    const page = render('/train/exercises/new')
    type(page.querySelector('.g-tfield input'), 'QA landmine push')
    click(page, 'button[aria-pressed]', 'Shoulders')
    click(page, 'button[aria-pressed]', 'barbell')
    click(page, 'button', 'Create exercise')
    expect(navigate).toHaveBeenCalledWith('/train/exercises', { replace: true })
    expect(h.detail).toHaveBeenCalledTimes(1)
  })

  it('keeps the duplicate-name check: a name the catalogue has stops the create', () => {
    const page = render('/train/exercises/new')
    type(page.querySelector('.g-tfield input'), 'Barbell Bench Press')
    click(page, 'button[aria-pressed]', 'Chest')
    click(page, 'button[aria-pressed]', 'barbell')
    click(page, 'button', 'Create exercise')
    expect(useUI.getState().toastMsg).toMatch(/already exists/)
    expect(S().customEx || []).toHaveLength(0)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('?edit= opens the exercise filled in; Save writes it and goes back without a drawer', () => {
    seed(own())
    const page = render('/train/exercises/new?edit=cpage1')
    expect(page.querySelector('h1').textContent).toBe('Edit exercise')
    const name = page.querySelector('.g-tfield input')
    expect(name.value).toBe('QA sandbag carry')
    expect([...page.querySelectorAll('button[aria-pressed="true"]')].map(b => b.textContent.trim())).toEqual(['Back', 'barbell'])
    type(name, 'QA sandbag carry, heavy')
    click(page, 'button', 'Save')
    expect(S().customEx[0].n).toBe('QA sandbag carry, heavy')
    expect(useUI.getState().toastMsg).toBe('Saved')
    expect(navigate).toHaveBeenCalledWith(-1)
    expect(h.detail).not.toHaveBeenCalled()
  })

  it('an edit offers Delete exercise, which confirms, deletes and goes back', () => {
    seed(own())
    const page = render('/train/exercises/new?edit=cpage1')
    click(page, 'button', 'Delete exercise')
    click(renderTop(), 'button', 'Delete')
    expect(S().customEx).toEqual([])
    expect(navigate).toHaveBeenCalledWith(-1)
    expect(page.querySelector('.g-cxf')).not.toBeNull()   // the page does not swap under the person
  })

  it('an id that is not there says so instead of a blank form', () => {
    const page = render('/train/exercises/new?edit=nope')
    expect(page.textContent).toContain('This exercise is no longer here.')
    expect(page.querySelector('.g-cxf')).toBeNull()
  })
})
