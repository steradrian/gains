// @vitest-environment happy-dom
// The chooser is where a starter plan can quietly do the wrong thing: load the wrong week, or
// leave an Undo that does not put the old week back (lib/starter-load.js has the edge cases).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { loadStarterPlan, starterPlanSheet } from './sheets.jsx'

const mounted = []

const S = () => useStore.getState().S
// S.week[day] is a routine-id list now; the starter plan writes a one-element list per day.
const nameOn = day => S().routines.find(r => r.id === [].concat(S().week[day] ?? [])[0])?.name

// Renders whatever sheet is on top and returns its host element.
function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

const rowFor = (host, name) => [...host.querySelectorAll('.item')].find(el => el.querySelector('.tt')?.textContent === name)

// Opens the chooser and taps one of its rows.
function choose(name) {
  starterPlanSheet()
  const host = renderTop()
  act(() => { rowFor(host, name).click() })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  useStore.setState(s => ({
    S: { ...s.S, routines: [{ id: 'mine', name: 'My routine', emoji: 'star', ex: [] }], week: {}, dayPlan: {}, active: null, queue: null, scheduleMode: null },
  }))
  document.body.innerHTML = ''
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('starter plan chooser', () => {
  it('lists every plan with its day count', () => {
    starterPlanSheet()
    const host = renderTop()
    expect([...host.querySelectorAll('.item .tt')].map(el => el.textContent))
      .toEqual(['Push / Pull / Legs', 'Upper / Lower', 'Full Body', '5×5'])
    expect(rowFor(host, 'Upper / Lower').querySelector('.ss').textContent).toContain('4 days per week')
  })

  it('loads straight away over the whole week, without asking, and offers Undo', () => {
    useStore.setState(s => ({ S: { ...s.S, week: { 0: ['mine'], 6: ['mine'] } } }))
    choose('Upper / Lower')

    expect(useUI.getState().sheets).toHaveLength(0)   // no confirmation was raised
    expect(nameOn(1)).toBe('Upper A')
    expect(nameOn(2)).toBe('Lower A')
    expect(nameOn(4)).toBe('Upper B')
    expect(nameOn(5)).toBe('Lower B')
    expect(S().week[0]).toBeUndefined()               // every other weekday becomes rest
    expect(S().week[6]).toBeUndefined()
    expect(S().routines[0].name).toBe('My routine')   // and no routine is deleted
    expect(useUI.getState().toastMsg).toBe('Upper / Lower loaded')
    expect(useUI.getState().toastAction?.label).toBe('Undo')
  })

  it('loading the same plan twice reuses its routines instead of duplicating them', () => {
    expect(loadStarterPlan('upper-lower')).toBe(true)
    const ids = S().routines.map(r => r.id)
    const week = structuredClone(S().week)
    expect(loadStarterPlan('upper-lower')).toBe(true)
    expect(S().routines.map(r => r.id)).toEqual(ids)
    expect(S().routines.filter(r => r.name === 'Upper A')).toHaveLength(1)
    expect(S().week).toEqual(week)
  })

  it('does not ask even when a weekday the plan wants is taken: it loads over it', () => {
    useStore.setState(s => ({ S: { ...s.S, week: { 3: ['mine'] } } }))
    choose('Full Body')

    expect(useUI.getState().sheets).toHaveLength(0)
    expect(nameOn(1)).toBe('Full Body A')
    expect(nameOn(3)).toBe('Full Body B')
    expect(nameOn(5)).toBe('Full Body C')
  })

  it('Undo in the toast puts the week back and takes away only the routines it added', () => {
    useStore.setState(s => ({ S: { ...s.S, week: { 1: ['mine'], 2: ['mine'] } } }))
    choose('5×5')
    expect(S().routines).toHaveLength(4)

    act(() => { useUI.getState().runToastAction() })
    expect(S().routines.map(r => r.id)).toEqual(['mine'])
    expect(S().week).toEqual({ 1: ['mine'], 2: ['mine'] })
  })
})

describe('starter plan chooser, fitted to equipment', () => {
  const home = { id: 'home', name: 'Home', equipment: ['dumbbell'] }
  const chip = (host, label) => [...host.querySelectorAll('.chip')].find(b => b.textContent === label)
  const exIds = () => S().routines.slice(1).flatMap(r => r.ex.map(e => e.id))

  it('points to Settings when there is no profile, and offers no chips', () => {
    starterPlanSheet()
    const host = renderTop()
    expect(host.querySelector('.chip')).toBeNull()
    expect(host.textContent).toContain('Add an equipment profile in Settings')
  })

  it('loads the plan as written unless a profile is picked', () => {
    useStore.setState(s => ({ S: { ...s.S, equipProfiles: [home], activeEquipId: 'home', equipFilterOn: false } }))
    starterPlanSheet()
    const host = renderTop()
    expect(chip(host, 'As written').className).toContain('on')
    act(() => { rowFor(host, 'Push / Pull / Legs').click() })
    expect(exIds()).toContain('0025')   // the barbell bench press
  })

  it('starts on the profile the library is filtered by, and fits the plan to it', () => {
    useStore.setState(s => ({ S: { ...s.S, equipProfiles: [home], activeEquipId: 'home', equipFilterOn: true } }))
    starterPlanSheet()
    const host = renderTop()
    expect(chip(host, 'Home').className).toContain('on')
    act(() => { rowFor(host, 'Push / Pull / Legs').click() })
    expect(exIds()).not.toContain('0025')
    expect(useUI.getState().toastMsg).toMatch(/^Push \/ Pull \/ Legs loaded, fitted to "Home": \d+ swapped, 0 dropped$/)
  })

  it('lets you pick a profile by hand', () => {
    useStore.setState(s => ({ S: { ...s.S, equipProfiles: [home], activeEquipId: '', equipFilterOn: false } }))
    starterPlanSheet()
    const host = renderTop()
    act(() => { chip(host, 'Home').click() })
    act(() => { rowFor(host, '5×5').click() })
    expect(exIds()).not.toContain('0043')   // no barbell squat on a dumbbell-only profile
  })

  it('adds a fitted plan beside a same-named routine with other exercises, instead of reusing it', () => {
    loadStarterPlan('ppl')
    loadStarterPlan('ppl', { id: 'home', name: 'Home', equipment: ['dumbbell'] })
    const pushes = S().routines.filter(r => r.name === 'Push Day')
    expect(pushes).toHaveLength(2)
    expect(pushes[0].ex.map(e => e.id)).not.toEqual(pushes[1].ex.map(e => e.id))
    expect(S().week[1]).toEqual([pushes[1].id])
  })

  it('still reuses the routines when the same fitted plan is loaded twice', () => {
    const home = { id: 'home', name: 'Home', equipment: ['dumbbell'] }
    loadStarterPlan('ppl', home)
    loadStarterPlan('ppl', home)
    expect(S().routines.filter(r => r.name === 'Push Day')).toHaveLength(1)
  })
})

describe('loadStarterPlan', () => {
  it('two different plans add independent routines', () => {
    loadStarterPlan('ppl')
    const first = S().routines.slice(1).map(r => r.id)
    loadStarterPlan('full-body')
    const second = S().routines.slice(4).map(r => r.id)
    expect(S().routines).toHaveLength(7)
    expect(new Set([...first, ...second]).size).toBe(6)
  })

  it('refuses a plan it does not know and changes nothing', () => {
    const before = structuredClone(S())
    expect(loadStarterPlan('nope')).toBe(false)
    expect(loadStarterPlan(undefined)).toBe(false)
    expect(S()).toEqual(before)
    expect(useUI.getState().toastMsg).toBe('')
  })
})
