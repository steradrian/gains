// @vitest-environment happy-dom
// "How you log it" (T6.4, owner question 3): a custom exercise's own mode seeds a new routine entry
// added from its drawer (Add to my plan), and an entry's own cfg.mode still wins. The drawer host
// of the form saves the choice on the exercise.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { registerCustom } from './lib/exercises.js'
import { _setLangState } from './lib/i18n-core.js'
import { setNav } from './lib/nav.js'
import { bindUI } from './components/ui.jsx'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { addToRoutineSheet, customExSheet, exConfigSheet } from './sheets.jsx'

bindUI(useUI)

const mounted = []
const S = () => useStore.getState().S
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
const radios = host => [...host.querySelectorAll('[role="radio"]')]
const checked = host => radios(host).filter(r => r.getAttribute('aria-checked') === 'true').map(r => r.querySelector('b').textContent)

const plank = (over = {}) => ({ id: 'cplank', n: 'Weighted plank', bp: 'waist', eq: 'body weight', custom: true, mode: 'time', ...over })
function seed(ex, extra = {}) {
  useStore.setState(s => ({ S: { ...s.S, customEx: [ex], routines: [{ id: 'r1', name: 'Core', emoji: 'dumbbell', ex: [] }], ...extra } }))
  registerCustom([ex])
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: structuredClone(DEF), user: null, config: null })
  registerCustom([])
  _setLangState('en', null, null, null)
  document.body.innerHTML = ''
  setNav(vi.fn())
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  registerCustom([])
})

describe('a custom exercise\'s mode seeds a new routine entry', () => {
  it('Add to my plan: the entry is timed, as the exercise says', () => {
    seed(plank())
    addToRoutineSheet(plank())
    click(renderTop(), '.item .tt', 'Core')
    const config = renderTop()
    click(config, 'button', 'Add to routine')
    expect(S().routines[0].ex).toHaveLength(1)
    expect(S().routines[0].ex[0]).toMatchObject({ id: 'cplank', mode: 'time' })
  })

  it('Reps only seeds a bodyweight rep entry', () => {
    seed(plank({ n: 'Nordic curl', bp: 'upper legs', eq: 'barbell', mode: 'reps', bodyweight: true }))
    addToRoutineSheet(S().customEx[0])
    click(renderTop(), '.item .tt', 'Core')
    click(renderTop(), 'button', 'Add to routine')
    expect(S().routines[0].ex[0]).toMatchObject({ mode: 'reps', bodyweight: true })
  })

  it('an entry that already has a mode keeps it, and existing entries are never rewritten', () => {
    const entry = { id: 'cplank', sets: 3, reps: 12, weight: 0, mode: 'reps' }
    seed(plank(), { routines: [{ id: 'r1', name: 'Core', emoji: 'dumbbell', ex: [entry] }] })
    const onSave = vi.fn()
    exConfigSheet(plank(), entry, onSave)
    click(renderTop(), 'button', 'Save')
    expect(onSave.mock.calls[0][0].mode).toBe('reps')
    expect(S().routines[0].ex[0]).toEqual(entry)
  })
})

describe('the form saves How you log it on the exercise', () => {
  it('a new exercise: Weight × reps is picked first, and Time is saved as mode time', () => {
    customExSheet(null)
    const form = renderTop()
    expect(checked(form)).toEqual(['Weight × reps'])
    type(form.querySelector('.g-tfield input'), 'QA wall hold')
    click(form, 'button[aria-pressed]', 'Legs')
    click(form, 'button[aria-pressed]', 'body weight')
    act(() => radios(form)[2].click())
    expect(checked(form)).toEqual(['Time'])
    click(form, 'button', 'Create exercise')
    const c = S().customEx.find(x => x.n === 'QA wall hold')
    expect(c).toMatchObject({ mode: 'time', bp: 'upper legs', eq: 'body weight' })
    expect(c).not.toHaveProperty('bodyweight')
  })

  it('picking the Cardio body part picks Cardio until the person picks a way themselves', () => {
    customExSheet(null)
    const form = renderTop()
    click(form, 'button[aria-pressed]', 'Cardio')
    expect(checked(form)).toEqual(['Cardio'])
    act(() => radios(form)[1].click())
    click(form, 'button[aria-pressed]', 'Back')
    expect(checked(form)).toEqual(['Reps only'])
  })

  it('an edit shows the stored choice, and Weight × reps takes the bodyweight flag off', () => {
    const ex = plank({ mode: 'reps', bodyweight: true })
    seed(ex)
    customExSheet(ex)
    const form = renderTop()
    expect(checked(form)).toEqual(['Reps only'])
    act(() => radios(form)[0].click())
    click(form, 'button', 'Save')
    expect(S().customEx[0].mode).toBe('reps')
    expect(S().customEx[0]).not.toHaveProperty('bodyweight')
  })

  it('the choices are a radio group named by its heading, moved through with the arrow keys', () => {
    customExSheet(null)
    const form = renderTop()
    const group = form.querySelector('[role="radiogroup"]')
    expect(document.getElementById(group.getAttribute('aria-labelledby')).textContent).toBe('How you log it')
    expect(radios(form).map(r => r.tabIndex)).toEqual([0, -1, -1, -1])
    act(() => radios(form)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    expect(checked(form)).toEqual(['Reps only'])
    expect(document.activeElement).toBe(radios(form)[1])
  })
})

describe('the drawer host (customExSheet)', () => {
  it('is a full drawer titled New exercise; Create closes it and hands the new exercise on', () => {
    const onDone = vi.fn()
    customExSheet(null, onDone, 'QA landmine push')
    const form = renderTop()
    expect(form.querySelector('.g-bs-full .g-bs-head h2').textContent).toBe('New exercise')
    expect(form.querySelector('.g-tfield input').value).toBe('QA landmine push')
    click(form, 'button[aria-pressed]', 'Shoulders')
    click(form, 'button[aria-pressed]', 'barbell')
    click(form, 'button', 'Create exercise')
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(useUI.getState().toastMsg).toBe('“QA landmine push” created')
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ n: 'QA landmine push', bp: 'shoulders', mode: 'reps' }))
  })

  it('stops on a missing name, body part or equipment and stays open', () => {
    customExSheet(null)
    const form = renderTop()
    click(form, 'button', 'Create exercise')
    expect(useUI.getState().toastMsg).toBe('Give it a name')
    type(form.querySelector('.g-tfield input'), 'QA landmine push')
    click(form, 'button', 'Create exercise')
    expect(useUI.getState().toastMsg).toBe('Pick a body part')
    click(form, 'button[aria-pressed]', 'Shoulders')
    click(form, 'button', 'Create exercise')
    expect(useUI.getState().toastMsg).toBe('Pick equipment')
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(S().customEx || []).toHaveLength(0)
  })

  it('an edit titles it Edit custom exercise and offers Delete exercise', () => {
    const ex = plank()
    seed(ex)
    customExSheet(ex)
    const form = renderTop()
    expect(form.querySelector('.g-bs-head h2').textContent).toBe('Edit custom exercise')
    click(form, 'button', 'Delete exercise')
    expect(useUI.getState().sheets.length).toBeGreaterThan(0)
    expect(renderTop().textContent).toContain('Delete “Weighted plank”?')
  })
})
