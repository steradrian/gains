// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXDB } from './lib/exercises.js'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exConfigSheet } from './sheets.jsx'
import { exLine } from './lib/history.js'

// Back-off sets (lib/backoff.js): a switch under the progression Step, saved as `backoff: true`.
const ex = EXDB.find(e => e.id === '0025')          // barbell bench press
const assisted = EXDB.find(e => e.id === '0009')    // assisted chest dip: less load is harder
const mounted = []

function render(sheet) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
// Back-off sets is one of the Intensifier chips, lit while it is on.
const backoffChip = host => [...host.querySelectorAll('.g-cchip')].find(c => c.textContent.trim() === 'Back-off sets')
const noneChip = host => [...host.querySelectorAll('.g-cchip')].find(c => c.textContent.trim() === 'None')
const isOn = host => backoffChip(host).getAttribute('aria-pressed') === 'true'
const save = host => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Done').click()
const open = (cfg, onSave) => {
  exConfigSheet(ex, { sets: 3, reps: 6, weight: 26, mode: 'reps', inc: 2, ...cfg }, onSave)
  return render(useUI.getState().sheets.at(-1))
}

describe('exercise settings: back-off sets', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    useUI.setState({ sheets: [] })
    useStore.setState(s => ({ S: { ...s.S, unit: 'kg' } }))
    document.body.innerHTML = ''
  })
  afterEach(() => { act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) }) })

  it('is off by default and saves no field, so the plan keeps its shape', () => {
    const onSave = vi.fn()
    const host = open({}, onSave)
    expect(backoffChip(host)).toBeTruthy()
    expect(isOn(host)).toBe(false)
    act(() => save(host))
    expect('backoff' in onSave.mock.calls[0][0]).toBe(false)
  })

  it('chosen, previews the sets and saves the flag', () => {
    const onSave = vi.fn()
    const host = open({}, onSave)
    act(() => backoffChip(host).click())
    expect(isOn(host)).toBe(true)
    expect(host.textContent).toContain('Sets open at 26 → 24 → 22 kg.')
    act(() => save(host))
    const saved = onSave.mock.calls[0][0]
    expect(saved.backoff).toBe(true)
    expect(saved.inc).toBe(2)
    expect(exLine({ id: ex.id, ...saved }, 'kg')).toBe('3 × 6 · 26 → 24 → 22 kg')
  })

  it('chosen and then None, drops the flag', () => {
    const onSave = vi.fn()
    const host = open({ backoff: true }, onSave)
    expect(isOn(host)).toBe(true)
    act(() => noneChip(host).click())
    act(() => save(host))
    expect('backoff' in onSave.mock.calls[0][0]).toBe(false)
  })

  it('is not offered on an assistance machine', () => {
    exConfigSheet(assisted, { sets: 3, reps: 6, weight: 30, mode: 'reps' }, vi.fn())
    expect(backoffChip(render(useUI.getState().sheets.at(-1)))).toBeUndefined()
  })

  it('is not combined with pyramid sets: choosing it leaves the pyramid', () => {
    const onSave = vi.fn()
    const host = open({ pyramid: [12, 10, 8] }, onSave)
    expect(isOn(host)).toBe(false)
    act(() => backoffChip(host).click())
    act(() => save(host))
    const saved = onSave.mock.calls[0][0]
    expect(saved.backoff).toBe(true)
    expect(saved).not.toHaveProperty('pyramid')
  })
})
