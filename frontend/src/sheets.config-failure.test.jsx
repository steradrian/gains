// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXDB } from './lib/exercises.js'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exConfigSheet } from './sheets.jsx'
import { bindUI } from './components/ui.jsx'

// Sets to failure: "Last set to failure" on the exercise's settings, written only when on.
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
const open = (cfg, onSave) => {
  exConfigSheet(ex, { sets: 3, reps: 5, weight: 40, mode: 'reps', ...cfg }, onSave)
  return render(useUI.getState().sheets.at(-1))
}
// "Last set to failure" is one of the Intensifier chips; the chip is lit while the flag is on.
const chip = (host, label) => [...host.querySelectorAll('.g-cchip')].find(c => c.textContent.trim() === label)
const lit = (host, label) => chip(host, label).getAttribute('aria-pressed') === 'true'
const save = host => act(() => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Done').click())

describe('exercise settings: last set to failure', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    bindUI(useUI)
    useUI.setState({ sheets: [] })
    useStore.setState(s => ({ S: { ...s.S, unit: 'kg' } }))
    document.body.innerHTML = ''
  })
  afterEach(() => { act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) }) })

  it('is off by default and saves nothing then', () => {
    const onSave = vi.fn()
    const host = open({}, onSave)
    expect(lit(host, 'Last set to failure')).toBe(false)
    expect(lit(host, 'None')).toBe(true)
    save(host)
    expect('lastToFailure' in onSave.mock.calls[0][0]).toBe(false)
  })

  it('chosen, it saves the flag and says what it does', () => {
    const onSave = vi.fn()
    const host = open({}, onSave)
    act(() => chip(host, 'Last set to failure').click())
    expect(lit(host, 'Last set to failure')).toBe(true)
    expect(host.textContent).toContain('counts as all-out effort unless you rate it')
    save(host)
    expect(onSave.mock.calls[0][0].lastToFailure).toBe(true)
  })

  it('chosen and then None, it saves nothing', () => {
    const onSave = vi.fn()
    const host = open({ lastToFailure: true }, onSave)
    expect(lit(host, 'Last set to failure')).toBe(true)
    act(() => chip(host, 'None').click())
    save(host)
    expect('lastToFailure' in onSave.mock.calls[0][0]).toBe(false)
  })

  it('comes on with Greyskull, whose last set is an AMRAP, unless it was already decided', () => {
    const onSave = vi.fn()
    const host = open({}, onSave)
    act(() => chip(host, 'Greyskull LP').click())
    expect(lit(host, 'Last set to failure')).toBe(true)
    save(host)
    expect(onSave.mock.calls[0][0]).toMatchObject({ prog: 'greyskull', lastToFailure: true })
  })

  it('on a pyramid, which has its own Max set, the pyramid is the lit chip; choosing failure leaves the pyramid', () => {
    const onSave = vi.fn()
    const host = open({ pyramid: [12, 8, 0] }, onSave)
    expect(lit(host, 'Pyramid sets')).toBe(true)
    expect(lit(host, 'Last set to failure')).toBe(false)
    act(() => chip(host, 'Last set to failure').click())
    expect(lit(host, 'Pyramid sets')).toBe(false)
    save(host)
    expect(onSave.mock.calls[0][0]).toMatchObject({ lastToFailure: true })
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('pyramid')
  })

  it('combines with a drop-set, as the data stores them, and None clears both', () => {
    const onSave = vi.fn()
    const host = open({}, onSave)
    act(() => chip(host, 'Last set to failure').click())
    act(() => chip(host, 'Drop-set').click())
    expect(lit(host, 'Last set to failure')).toBe(true)
    expect(lit(host, 'Drop-set')).toBe(true)
    expect(lit(host, 'None')).toBe(false)
    save(host)
    expect(onSave.mock.calls[0][0]).toMatchObject({ lastToFailure: true, intensifier: { type: 'dropset' } })
    act(() => chip(host, 'None').click())
    expect(lit(host, 'Last set to failure')).toBe(false)
    expect(lit(host, 'Drop-set')).toBe(false)
    expect(lit(host, 'None')).toBe(true)
  })

  it('a saved failure plus drop-set opens with both lit; rest-pause takes the drop-set\'s place and keeps failure', () => {
    const host = open({ lastToFailure: true, intensifier: { type: 'dropset', count: 1, pct: 20 } }, vi.fn())
    expect(lit(host, 'Last set to failure')).toBe(true)
    expect(lit(host, 'Drop-set')).toBe(true)
    act(() => chip(host, 'Rest-pause').click())
    expect(lit(host, 'Drop-set')).toBe(false)
    expect(lit(host, 'Rest-pause')).toBe(true)
    expect(lit(host, 'Last set to failure')).toBe(true)
    act(() => chip(host, 'Last set to failure').click())
    expect(lit(host, 'Last set to failure')).toBe(false)
    expect(lit(host, 'Rest-pause')).toBe(true)
  })
})
