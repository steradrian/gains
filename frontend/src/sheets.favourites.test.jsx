// @vitest-environment happy-dom
// Favourites (issue #6): the detail sheet's star writes S.favEx, and the picker floats
// favourites to the top of its list without disturbing the order of everything else.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXDB } from './lib/exercises.js'
import { exerciseNameText } from './lib/format.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exerciseDetailSheet, exercisePicker } from './sheets.jsx'

const mounted = []
const S = () => useStore.getState().S

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

const names = host => [...host.querySelectorAll('.g-pk-item .g-xrow-b b')].map(el => el.textContent)
const starOf = host => host.querySelector('.g-xd-star')
const toast = () => useUI.getState()

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: structuredClone(DEF), user: null })
  document.body.innerHTML = ''
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('exercise detail star (T6.3)', () => {
  it('adds and removes the exercise from favourites, the toast naming it with Undo', () => {
    const ex = EXDB[0]
    exerciseDetailSheet(ex)
    const host = renderTop()
    expect(starOf(host).getAttribute('aria-label')).toBe('Add to favourites')
    expect(starOf(host).getAttribute('aria-pressed')).toBe('false')
    act(() => starOf(host).click())
    expect(S().favEx).toEqual([ex.id])
    expect(toast().toastMsg).toBe(`Added ${exerciseNameText(ex)} to favourites`)
    expect(toast().toastAction).toMatchObject({ label: 'Undo', ms: 8000 })
    expect(starOf(host).getAttribute('aria-label')).toBe('Remove from favourites')
    expect(starOf(host).getAttribute('aria-pressed')).toBe('true')
    act(() => starOf(host).click())
    expect(S().favEx).toEqual([])
    expect(toast().toastMsg).toBe(`Removed ${exerciseNameText(ex)} from favourites`)
    expect(toast().toastAction.label).toBe('Undo')
  })

  it('Undo takes the change back, either way', () => {
    const ex = EXDB[0]
    exerciseDetailSheet(ex)
    const host = renderTop()
    act(() => starOf(host).click())
    act(() => toast().toastAction.run())
    expect(S().favEx).toEqual([])
    expect(starOf(host).getAttribute('aria-pressed')).toBe('false')
    useStore.setState(s => ({ S: { ...s.S, favEx: [ex.id] } }))
    act(() => starOf(host).click())
    expect(S().favEx).toEqual([])
    act(() => toast().toastAction.run())
    expect(S().favEx).toEqual([ex.id])
  })

  it('an Undo after the star was tapped again changes nothing', () => {
    const ex = EXDB[0]
    exerciseDetailSheet(ex)
    const host = renderTop()
    act(() => starOf(host).click())
    const first = toast().toastAction.run
    act(() => starOf(host).click())
    act(() => first())
    expect(S().favEx).toEqual([])
  })

  it('tolerates a profile written before the field existed', () => {
    useStore.setState(s => { const next = { ...s.S }; delete next.favEx; return { S: next } })
    exerciseDetailSheet(EXDB[0])
    const host = renderTop()
    act(() => starOf(host).click())
    expect(S().favEx).toEqual([EXDB[0].id])
  })
})

describe('exercise picker', () => {
  it('lists favourites first and marks them, keeping the rest in catalogue order', () => {
    const plain = names((exercisePicker(vi.fn()), renderTop()))
    useUI.setState({ sheets: [] })
    const fav = [plain[7], plain[3]]
    const favIds = fav.map(n => EXDB.find(e => e.n === n).id)
    useStore.setState(s => ({ S: { ...s.S, favEx: favIds } }))
    exercisePicker(vi.fn())
    const host = renderTop()
    const shown = names(host)
    // Favourites keep the list's own order among themselves — not the order they were starred in.
    expect(shown.slice(0, 2)).toEqual(plain.filter(n => fav.includes(n)))
    expect(shown.slice(2)).toEqual(plain.filter(n => !fav.includes(n)))
    const rows = [...host.querySelectorAll('.g-pk-item')]
    expect(rows.slice(0, 2).every(r => r.querySelector('.g-xrow-b b .g-pk-fav'))).toBe(true)
    expect(rows[2].querySelector('.g-xrow-b b .g-pk-fav')).toBeNull()
  })

  // Favourites is a tab of its own; with none, it says how to get one.
  const favTab = h => [...h.querySelectorAll('.g-seg button')].find(b => b.textContent === 'Favourites')

  it('the Favourites tab lists only the starred exercises, and says so when there are none', () => {
    exercisePicker(vi.fn())
    let host = renderTop()
    act(() => favTab(host).click())
    expect(names(host)).toEqual([])
    expect(host.querySelector('.g-sempty b').textContent).toBe('No favourites yet')
    expect(host.querySelector('.g-sempty-btn').textContent).toBe('Browse all exercises')
    useUI.setState({ sheets: [] })
    useStore.setState(s => ({ S: { ...s.S, favEx: [EXDB[5].id, EXDB[9].id] } }))
    exercisePicker(vi.fn())
    host = renderTop()
    act(() => favTab(host).click())
    expect(names(host)).toEqual([EXDB[5].n, EXDB[9].n])
    expect(host.textContent).not.toContain('No favourites yet')
    // back on All, the whole catalogue again
    act(() => [...host.querySelectorAll('.g-seg button')].find(b => b.textContent === 'All').click())
    expect(names(host).length).toBeGreaterThan(2)
  })
})
