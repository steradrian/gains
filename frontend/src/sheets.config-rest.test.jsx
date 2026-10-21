// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXDB } from './lib/exercises.js'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { topSurface } from './lib/sheet-nav.js'
import { exConfigSheet } from './sheets.jsx'

// v1.3.11: an exercise's own rest is set on the same wheel as the default rest timer, where 0:00
// means "no rest of its own" and the row says which default applies then.
const ex = EXDB.find(e => e.id === '0009')
const mounted = []

function render(sheet) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
// The exercise's rest is the last cell of the sets table: a button that opens the wheel, showing the
// time (muted while it is the default) and naming, for a screen reader, which default it is.
const restCell = host => host.querySelector('.g-sett button[aria-label^="Rest for this exercise"]')
const save = host => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Done').click()

describe('exercise settings: rest on the wheel', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    useUI.setState({ sheets: [] })
    useStore.setState(s => ({ S: { ...s.S, unit: 'kg', restSec: 120 } }))
    document.body.innerHTML = ''
  })
  afterEach(() => { act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) }) })

  it('reads Default with the default rest when the exercise has none, and saves what the wheel picks', () => {
    const onSave = vi.fn()
    exConfigSheet(ex, { sets: 3, reps: 10, weight: 40, mode: 'reps', restSec: 0 }, onSave)
    const host = render(topSurface(useUI.getState().sheets))
    expect(restCell(host).textContent).toBe('2:00')
    expect(restCell(host).classList.contains('g-sett-muted')).toBe(true)
    expect(restCell(host).getAttribute('aria-label')).toBe('Rest for this exercise: Default (2:00)')
    act(() => restCell(host).click())
    const wheel = render(topSurface(useUI.getState().sheets))
    expect(wheel.querySelector('h3').textContent).toBe('Rest for this exercise')
    expect(wheel.querySelector('.dw-read').textContent).toBe('Default (2:00)')
    // The copy names the wheel's 0:00, not a "0" the row never shows (QA 10-05).
    expect(host.textContent).toContain('0:00 means your default rest.')
    expect(host.textContent).not.toMatch(/Leave at 0/)
    // Done keeps 0:00, the default; the value shown stays the default's.
    act(() => [...wheel.querySelectorAll('button')].find(b => b.textContent === 'Done').click())
    act(() => save(host))
    expect(onSave.mock.calls[0][0].restSec || 0).toBe(0)
  })

  it('shows an exercise’s own rest as a time, and the wheel opens on it', () => {
    const onSave = vi.fn()
    exConfigSheet(ex, { sets: 3, reps: 10, weight: 40, mode: 'reps', restSec: 75 }, onSave)
    const host = render(topSurface(useUI.getState().sheets))
    expect(restCell(host).textContent).toBe('1:15')
    expect(restCell(host).classList.contains('g-sett-muted')).toBe(false)
    act(() => restCell(host).click())
    const wheel = render(topSurface(useUI.getState().sheets))
    expect(wheel.querySelector('.dw-read').textContent).toBe('1:15')
    act(() => [...wheel.querySelectorAll('button')].find(b => b.textContent === 'Done').click())
    act(() => save(host))
    expect(onSave.mock.calls[0][0].restSec).toBe(75)
  })
})
