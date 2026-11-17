// @vitest-environment happy-dom
// A cardio exercise's settings in mph (Discord "miles per hour"): the speed cell of the sets table
// reads and takes the profile's unit, and the routine keeps km/h.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXIDX } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exConfigSheet } from './sheets.jsx'

const mounted = []
function open(settings, existing) {
  useStore.setState({ S: { ...structuredClone(DEF), ...settings }, user: null })
  const onSave = vi.fn()
  exConfigSheet(EXIDX['2138'], existing, onSave, null, null)
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  const speed = host.querySelector('input[aria-label^="Speed"]')
  const header = [...host.querySelectorAll('[role="columnheader"]')].find(h => h.textContent.startsWith('Speed'))
  const save = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Done')
  return { speed, header, save, onSave }
}
function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('cardio settings speed', () => {
  it('reads and takes mph for a profile in pounds, and saves km/h', () => {
    const { speed, header, save, onSave } = open({ unit: 'lb' }, { sets: 1, min: 20, speed: 8 })
    expect(header.textContent).toBe('Speed (mph)')
    expect(speed.getAttribute('aria-label')).toBe('Speed (mph)')
    expect(speed.value).toBe('4.97')
    act(() => type(speed, '5.47'))
    expect(speed.value).toBe('5.47')
    act(() => save.click())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ min: 20, speed: 8.8 }))
  })

  it('is unchanged in km/h', () => {
    const { speed, header, save, onSave } = open({ unit: 'kg' }, { sets: 1, min: 20, speed: 8 })
    expect(header.textContent).toBe('Speed (km/h)')
    expect(speed.value).toBe('8')
    act(() => type(speed, '8.5'))
    act(() => save.click())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ speed: 8.5 }))
  })
})
