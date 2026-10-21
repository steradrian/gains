// @vitest-environment happy-dom
// The exercise drawer's Progress and History tabs (T6.1): they open the exercise's strength page
// (T7.0, and T7.1 with view=sets) in the drawer's place, taking its history entry, and from a
// Search result they step the overlay aside (ux-search.md §4). Before the exercise is logged they
// say so in the drawer and go nowhere (Strength would show another lift).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exerciseDetailSheet } from './sheets.jsx'
import { EXIDX } from './lib/exercises.js'
import { setNav } from './lib/nav.js'
import { openSearch, useSearch } from './lib/search/session.js'

const mounted = []

function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

const EX = Object.keys(EXIDX).find(id => (EXIDX[id].bp || '') !== 'cardio' && !EXIDX[id].custom)
const T0 = Date.UTC(2026, 2, 2, 9)
const logged = { id: 'w1', d: '2026-03-02', start: T0, end: T0 + 3600000, name: 'Push', vol: 0, entries: [{ id: EX, target: { mode: 'reps', bodyweight: false }, sets: [{ w: 60, r: 5, done: true }] }] }
const tab = (host, text) => [...host.querySelectorAll('[role="tab"]')].find(b => b.textContent === text)
const navigate = vi.fn()
const STRENGTH = '/progress/strength?ex=' + encodeURIComponent(EX)

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', workouts: [logged], active: null } }))
  document.body.innerHTML = ''
  navigate.mockClear()
  setNav(navigate)
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('exercise drawer: Progress and History', () => {
  it('Progress opens that exercise on the strength chart, closes the drawer and steps the overlay aside', () => {
    act(() => { openSearch('home') })
    exerciseDetailSheet(EXIDX[EX], { progress: true })
    // Rendered outside the click's act: a render nested in it would not flush before the query.
    const progress = tab(renderTop(), 'Progress')
    act(() => { progress.click() })
    expect(navigate).toHaveBeenCalledTimes(1)
    const [to, opts] = navigate.mock.calls[0]
    expect(to).toBe(STRENGTH)
    expect(opts.state.searchVisit).toBe(useSearch.getState().id)
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(useSearch.getState()).toMatchObject({ live: true, open: false })
  })

  it('takes the drawer\'s history entry (replace) when the drawer sits on one', () => {
    act(() => { openSearch('home') })
    history.replaceState({ ...(history.state || {}), gainsSheet: 'x' }, '')
    exerciseDetailSheet(EXIDX[EX], { progress: true })
    const progress = tab(renderTop(), 'Progress')
    act(() => { progress.click() })
    expect(navigate.mock.calls[0][1].replace).toBe(true)
  })

  it('is offered for an exercise logged only in a deload, which Strength still charts', () => {
    useStore.setState(s => ({ S: { ...s.S, workouts: [{ ...logged, excludeFromProgression: true }] } }))
    exerciseDetailSheet(EXIDX[EX])
    const progress = tab(renderTop(), 'Progress')
    act(() => { progress.click() })
    expect(navigate.mock.calls[0][0]).toBe(STRENGTH)
  })

  it('sits with How to and History in one tab strip; History opens the past sets', () => {
    exerciseDetailSheet(EXIDX[EX])
    const host = renderTop()
    const strip = host.querySelector('[role="tablist"]')
    expect(strip.getAttribute('aria-label')).toBe('Exercise views')
    expect([...strip.querySelectorAll('[role="tab"]')].map(b => b.textContent)).toEqual(['How to', 'Progress', 'History'])
    act(() => { tab(host, 'History').click() })
    expect(navigate.mock.calls[0][0]).toBe(STRENGTH + '&view=sets')
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('is on a drawer opened anywhere, not only from Search', () => {
    exerciseDetailSheet(EXIDX[EX])
    const progress = tab(renderTop(), 'Progress')
    act(() => { progress.click() })
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate.mock.calls[0][0]).toBe(STRENGTH)
  })

  it('for an exercise with no log, says so and goes nowhere; How to still shows', () => {
    useStore.setState(s => ({ S: { ...s.S, workouts: [] } }))
    exerciseDetailSheet(EXIDX[EX])
    const host = renderTop()
    expect(host.textContent).not.toContain('No sessions logged yet')
    expect(host.textContent).toContain('Add to my plan')
    for (const name of ['Progress', 'History']) {
      act(() => { tab(host, name).click() })
      expect(tab(host, name).getAttribute('aria-selected')).toBe('true')
      expect(host.querySelector('[role="tabpanel"]').textContent).toBe('No sessions logged yet')
    }
    expect(navigate).not.toHaveBeenCalled()
    expect(useUI.getState().sheets).toHaveLength(1)
    act(() => { tab(host, 'How to').click() })
    expect(host.textContent).toContain('Add to my plan')
  })
})
