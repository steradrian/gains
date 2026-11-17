// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXDB } from './lib/exercises.js'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exConfigSheet } from './sheets.jsx'

// Workout drawers-M2 (owner question 2): "Part of the workout" (Warm-up · Workout · Cool-down) in the
// exercise settings, shown only when the caller passes `onPartChange`, and saving nothing itself.
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
const group = host => host.querySelector('.g-seg[aria-label="Part of the workout"]')
const choice = (host, label) => [...group(host).querySelectorAll('button')].find(b => b.textContent === label)
const cfg = { sets: 3, reps: 10, weight: 40, mode: 'reps' }

describe('exercise settings: Part of the workout', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    useUI.setState({ sheets: [] })
    useStore.setState(s => ({ S: { ...s.S, unit: 'kg', restSec: 120 } }))
    document.body.innerHTML = ''
  })
  afterEach(() => { act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) }) })

  it('is not there without onPartChange', () => {
    exConfigSheet(ex, cfg, vi.fn())
    expect(group(render(useUI.getState().sheets.at(-1)))).toBeNull()
  })

  it('shows the three parts with the given one chosen', () => {
    exConfigSheet(ex, cfg, vi.fn(), null, null, null, null, undefined, { part: 'cooldown', onPartChange: vi.fn() })
    const host = render(useUI.getState().sheets.at(-1))
    expect([...group(host).querySelectorAll('button')].map(b => b.textContent)).toEqual(['Warm-up', 'Workout', 'Cool-down'])
    expect(choice(host, 'Cool-down').getAttribute('aria-pressed')).toBe('true')
  })

  it('defaults to Workout and calls the handler as it moves, without saving', () => {
    const onPartChange = vi.fn()
    const onSave = vi.fn()
    exConfigSheet(ex, cfg, onSave, null, null, null, null, undefined, { onPartChange })
    const host = render(useUI.getState().sheets.at(-1))
    expect(choice(host, 'Workout').getAttribute('aria-pressed')).toBe('true')
    act(() => choice(host, 'Warm-up').click())
    expect(onPartChange).toHaveBeenCalledWith('warmup')
    expect(choice(host, 'Warm-up').getAttribute('aria-pressed')).toBe('true')
    expect(onSave).not.toHaveBeenCalled()
  })
})
