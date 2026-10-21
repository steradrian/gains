// @vitest-environment happy-dom
// T5.5 exercise settings as a drawer: the sets table (one summary row, a row a set for a pyramid),
// Add set, and the opt-in superset row the routine editor passes.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXIDX } from './lib/exercises.js'
import { exerciseNameFor } from './lib/i18n.js'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exConfigSheet } from './sheets.jsx'

const ex = EXIDX['0025']
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
function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const field = (host, label) => host.querySelector(`.g-sett input[aria-label="${label}"]`)
const headers = host => [...host.querySelectorAll('.g-sett [role="columnheader"]')].map(h => h.textContent)
const bodyRows = host => [...host.querySelectorAll('.g-sett [role="row"]')].slice(1)
const done = host => act(() => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Done').click())

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', restSec: 90 } }))
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('exercise settings: the sets table', () => {
  it('a mode with one value for its sets is one summary row, headed Sets, Reps, Weight, Rest', () => {
    exConfigSheet(ex, { sets: 4, reps: 8, weight: 80, mode: 'reps' }, vi.fn(), null, { id: 'r1', name: 'Push A', ex: [] })
    const host = renderTop()
    expect(headers(host)).toEqual(['Sets', 'Reps', 'Weight (kg)', 'Rest'])
    expect(bodyRows(host)).toHaveLength(1)
    expect(field(host, 'Sets').value).toBe('4')
    expect(field(host, 'Reps').value).toBe('8')
    expect(field(host, 'Weight (kg)').value).toBe('80')
    expect(host.querySelector('h2').textContent).toBe(exerciseNameFor(ex))
    expect(host.querySelector('.g-bs-chip').textContent).toBe('Push A')
  })

  it('what is typed in a cell is what is saved, and Add set adds one', () => {
    const onSave = vi.fn()
    exConfigSheet(ex, { sets: 4, reps: 8, weight: 80, mode: 'reps' }, onSave)
    const host = renderTop()
    act(() => type(field(host, 'Reps'), '6'))
    act(() => type(field(host, 'Weight (kg)'), '82.5'))
    act(() => host.querySelector('.g-sett-add').click())
    expect(field(host, 'Sets').value).toBe('5')
    done(host)
    expect(onSave.mock.calls[0][0]).toMatchObject({ sets: 5, reps: 6, weight: 82.5, mode: 'reps' })
  })

  it('a double-progression range is shown in the table and edited under Progression', () => {
    exConfigSheet(ex, { sets: 3, reps: 8, weight: 60, mode: 'reps', prog: 'double', repsMin: 6 }, vi.fn())
    const host = renderTop()
    expect(field(host, 'Reps')).toBeNull()
    expect(bodyRows(host)[0].textContent).toContain('6–8')
    expect([...host.querySelectorAll('.stp-l')].map(l => l.textContent)).toEqual(expect.arrayContaining(['Reps from', 'Reps up to']))
  })

  it('a pyramid is a row a set: reps, weight and rest in each, Max, remove and Add set', () => {
    const onSave = vi.fn()
    exConfigSheet(ex, { sets: 3, reps: 10, weight: 0, mode: 'reps', pyramid: [12, 10, 8] }, onSave)
    const host = renderTop()
    expect(headers(host)).toEqual(['Sets', 'Reps', 'Weight (kg)', 'Rest (s)'])
    expect(bodyRows(host)).toHaveLength(3)
    expect(field(host, 'Set 2 reps').value).toBe('10')
    act(() => host.querySelector('button[aria-label="Set 3 max"]').click())
    expect(host.querySelector('button[aria-label="Set 3 max"]').getAttribute('aria-pressed')).toBe('true')
    expect(field(host, 'Set 3 reps')).toBeNull()
    act(() => host.querySelector('button[aria-label="Remove set 1"]').click())
    expect(bodyRows(host)).toHaveLength(2)
    act(() => host.querySelector('.g-sett-add').click())
    expect(bodyRows(host)).toHaveLength(3)
    act(() => type(field(host, 'Set 1 rest (s)'), '90'))
    done(host)
    expect(onSave.mock.calls[0][0].pyramid).toHaveLength(3)
    expect(onSave.mock.calls[0][0].pyramidRest[0]).toBe(90)
  })

  it('a timed hold and a cardio interval name their own columns', () => {
    exConfigSheet(ex, { sets: 3, mode: 'time', sec: 45, weight: 0 }, vi.fn())
    expect(headers(renderTop())).toEqual(['Sets', 'Seconds', 'Weight (kg)', 'Rest'])
    exConfigSheet(EXIDX['2138'], { sets: 1, min: 20, speed: 8 }, vi.fn())
    expect(headers(renderTop())).toEqual(['Intervals', 'Minutes', 'Speed (km/h)', 'Rest'])
  })
})

describe('exercise settings: superset with the exercise above (opt-in)', () => {
  const label = host => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === 'Superset with the exercise above')

  it('is not offered unless the caller passes a handler', () => {
    exConfigSheet(ex, { sets: 3, reps: 8, weight: 60, mode: 'reps' }, vi.fn(), null, null, null, null, null, { superset: true })
    expect(label(renderTop())).toBeUndefined()
    exConfigSheet(ex, { sets: 3, reps: 8, weight: 60, mode: 'reps' }, vi.fn())
    expect(label(renderTop())).toBeUndefined()
  })

  it('shows the current link and tells the caller as the switch moves, saving nothing itself', () => {
    const onSupersetChange = vi.fn(), onSave = vi.fn()
    exConfigSheet(ex, { sets: 3, reps: 8, weight: 60, mode: 'reps' }, onSave, null, null, null, null, null, { superset: false, onSupersetChange })
    const host = renderTop()
    const sw = label(host).querySelector('[role="switch"]')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    act(() => sw.click())
    expect(onSupersetChange).toHaveBeenLastCalledWith(true)
    expect(label(host).querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('true')
    act(() => label(host).querySelector('[role="switch"]').click())
    expect(onSupersetChange).toHaveBeenLastCalledWith(false)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('opens on when the exercise is already linked', () => {
    exConfigSheet(ex, { sets: 3, reps: 8, weight: 60, mode: 'reps' }, vi.fn(), null, null, null, null, null, { superset: true, onSupersetChange: vi.fn() })
    expect(label(renderTop()).querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('true')
  })
})
