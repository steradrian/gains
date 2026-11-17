// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXDB } from './lib/exercises.js'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { topSurface } from './lib/sheet-nav.js'
import { exConfigSheet } from './sheets.jsx'

// A team or racket sport plans an effort level where cardio plans a speed; a distance sport keeps speed.
const football = EXDB.find(e => e.id === '12107')
const running = EXDB.find(e => e.id === '12101')
const mounted = []

function render(sheet) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const effortBtn = host => host.querySelector('.g-sett button[aria-label^="Effort"]')
const save = host => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Done').click()

describe('exercise settings: sports', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    useUI.setState({ sheets: [] })
    useStore.setState(s => ({ S: { ...s.S, unit: 'kg', restSec: 120 } }))
    document.body.innerHTML = ''
  })
  afterEach(() => { act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) }) })

  it('an effort sport shows its effort level in place of speed, and saves eff without speed', () => {
    const onSave = vi.fn()
    exConfigSheet(football, { sets: 1, min: 60, eff: 2 }, onSave)
    const host = render(topSurface(useUI.getState().sheets))
    expect(host.textContent).not.toMatch(/Speed/)
    expect(effortBtn(host).textContent).toBe('Moderate')
    act(() => effortBtn(host).click())
    expect(effortBtn(host).textContent).toBe('Intense')
    act(() => save(host))
    const out = onSave.mock.calls[0][0]
    expect(out.eff).toBe(3)
    expect(out.min).toBe(60)
    expect(out).not.toHaveProperty('speed')
  })

  it('steps round from intense to easy', () => {
    const onSave = vi.fn()
    exConfigSheet(football, { sets: 1, min: 60, eff: 3 }, onSave)
    const host = render(topSurface(useUI.getState().sheets))
    act(() => effortBtn(host).click())
    expect(effortBtn(host).textContent).toBe('Easy')
    act(() => save(host))
    expect(onSave.mock.calls[0][0].eff).toBe(1)
  })

  it('a distance sport keeps its speed and has no effort column', () => {
    const onSave = vi.fn()
    exConfigSheet(running, { sets: 1, min: 30, speed: 9 }, onSave)
    const host = render(topSurface(useUI.getState().sheets))
    expect(host.textContent).toMatch(/Speed/)
    expect(effortBtn(host)).toBeNull()
    act(() => save(host))
    const out = onSave.mock.calls[0][0]
    expect(out.speed).toBe(9)
    expect(out).not.toHaveProperty('eff')
  })
})
