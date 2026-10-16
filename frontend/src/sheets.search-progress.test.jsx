// @vitest-environment happy-dom
// The "Progress" link on an exercise opened from Search (ux-search.md §4): it goes to that
// exercise's strength chart, takes the sheet's place in history and steps the overlay aside.
// It is only there for a search-opened sheet and only when there is a log to chart.
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
const progressBtn = host => [...host.querySelectorAll('button')].find(b => b.textContent === 'Progress')
const navigate = vi.fn()

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

describe('exercise sheet: Progress link', () => {
  it('opens that exercise on the strength chart, closes the sheet and steps the overlay aside', () => {
    act(() => { openSearch('home') })
    exerciseDetailSheet(EXIDX[EX], { progress: true })
    const btn = progressBtn(renderTop())
    expect(btn).toBeTruthy()
    act(() => { btn.click() })
    expect(navigate).toHaveBeenCalledTimes(1)
    const [to, opts] = navigate.mock.calls[0]
    expect(to).toBe('/progress/strength?ex=' + encodeURIComponent(EX))
    expect(opts.state.searchVisit).toBe(useSearch.getState().id)
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(useSearch.getState()).toMatchObject({ live: true, open: false })
  })

  it('is not on a sheet opened anywhere else', () => {
    exerciseDetailSheet(EXIDX[EX])
    expect(progressBtn(renderTop())).toBeUndefined()
  })

  it('is not offered for an exercise with no log (Strength would show another lift)', () => {
    useStore.setState(s => ({ S: { ...s.S, workouts: [] } }))
    exerciseDetailSheet(EXIDX[EX], { progress: true })
    expect(progressBtn(renderTop())).toBeUndefined()
  })
})
