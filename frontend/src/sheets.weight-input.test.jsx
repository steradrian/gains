// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bwSheet, goalSheet } from './sheets.jsx'
import { fmtDate, todayISO } from './lib/format.js'
import { applySheetKeyboard } from './lib/sheet-keyboard.js'

// The big weight read-out (the weigh-in drawer, board T1.7, and the goal sheet) used to be text:
// the only ways to a number were the slider, ±0.1 and the ±0.5/±1 chips, so 72.3 → 85.7 was a
// drag you then corrected tap by tap. It is a field now. These pin the two things that make
// typing into it usable — a half-typed value is not clamped back at you, and the controls
// around it carry on from what you typed — plus the ceiling: no person past 700 kg.
const mounted = []

function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  const button = label => [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent.trim()) === label)
  return { host, button }
}

function renderBw(opts) {
  bwSheet(opts)
  const view = renderTop()
  return { ...view, input: view.host.querySelector('.g-wi-read input') }
}

const DAY_MS = 864e5
const daysAgo = n => new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10)

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', bodyweight: [], targetW: null } }))
  document.body.innerHTML = ''
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('the weigh-in drawer', () => {
  it('is the design system drawer for today, a decimal field with the unit beside it', () => {
    const { input, host } = renderBw()
    expect(useUI.getState().sheets[0].variant).toBe('ds')
    expect(host.querySelector('.g-bs h2').textContent).toBe('Weigh-in')
    expect(host.querySelector('.g-bs-chip').textContent).toBe('Today')
    expect(input.value).toBe('70')
    expect(input.getAttribute('inputmode')).toBe('decimal')
    expect(input.getAttribute('aria-label')).toBe('Weight (kg)')
    expect(host.querySelector('.g-wi-u').textContent).toBe('kg')
    expect(host.querySelector('.g-wi-last')).toBeNull()
  })

  it('keeps a half-typed value on screen instead of clamping it', () => {
    const { input } = renderBw()
    act(() => type(input, ''))
    expect(input.value).toBe('')
    act(() => type(input, '8'))
    expect(input.value).toBe('8')
    act(() => type(input, '82,5'))
    expect(input.value).toBe('82.5')
  })

  it('steps on from the typed value and saves what ends up on screen, with Undo', () => {
    const toast = vi.fn()
    useUI.setState({ toast })
    const { input, button } = renderBw()
    act(() => type(input, '82.5'))
    act(() => button('Increase by 0.1').click())
    expect(input.value).toBe('82.6')

    act(() => button('Save weigh-in').click())
    const bw = useStore.getState().S.bodyweight
    expect(bw).toHaveLength(1)
    expect(bw[0].w).toBe(82.6)
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(toast).toHaveBeenCalledWith('Saved 82.6 kg to Today', expect.objectContaining({ action: 'Undo' }))
    act(() => toast.mock.calls[0][1].onAction())
    expect(useStore.getState().S.bodyweight).toEqual([])
  })

  it('Undo of a re-weigh gives the day back the weight it had', () => {
    const toast = vi.fn()
    useUI.setState({ toast })
    useStore.setState(s => ({ S: { ...s.S, bodyweight: [{ d: todayISO(), w: 80, t: 1 }] } }))
    const { input, button } = renderBw()
    expect(input.value).toBe('80')
    act(() => type(input, '79.4'))
    act(() => button('Save weigh-in').click())
    expect(useStore.getState().S.bodyweight.map(b => b.w)).toEqual([79.4])
    act(() => toast.mock.calls[0][1].onAction())
    const back = useStore.getState().S.bodyweight
    expect(back.map(b => [b.d, b.w])).toEqual([[todayISO(), 80]])
    expect(back[0].t).toBeGreaterThan(1)
  })

  it('lets a typed weight sit past what a slider would hold', () => {
    const { input, button } = renderBw()
    act(() => type(input, '320'))
    act(() => button('Increase by 0.1').click())
    expect(input.value).toBe('320.1')
    act(() => button('Save weigh-in').click())
    expect(useStore.getState().S.bodyweight[0].w).toBe(320.1)
  })

  // 9999 typed into the field saved, and the chart and goal lines read like it was real.
  it('refuses a typed weight no person has, says the limit, and keeps the drawer open', () => {
    const toast = vi.fn()
    useUI.setState({ toast })
    const { input, button } = renderBw()
    act(() => type(input, '9999'))
    act(() => button('Save weigh-in').click())
    expect(useStore.getState().S.bodyweight).toHaveLength(0)
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(toast).toHaveBeenCalledWith('That looks too heavy. Keep it at 700 kg or less.')
  })

  it('still refuses to save an empty field', () => {
    const { input, button } = renderBw()
    act(() => type(input, ''))
    act(() => button('Save weigh-in').click())
    expect(useStore.getState().S.bodyweight).toHaveLength(0)
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  // Edge table: a weight more than 3 kg from the last says so under the number; saving still works.
  it('names the last weigh-in, and says so under the number when the weight is more than 3 kg from it', () => {
    const last = daysAgo(2)
    useStore.setState(s => ({ S: { ...s.S, bodyweight: [{ d: last, w: 81.7, t: 1 }] } }))
    const { input, button, host } = renderBw()
    expect(host.querySelector('.g-wi-last').textContent).toBe(`Last weigh-in: 81.7 kg on ${fmtDate(last, true)}`)
    act(() => type(input, '84.7'))
    // The status is there and empty before it has anything to say, so a screen reader announces
    // the text when it lands in it.
    const status = host.querySelector('.g-wi-far[role="status"]')
    expect(status.textContent).toBe('')
    act(() => type(input, '84.8'))
    expect(host.querySelector('.g-wi-far')).toBe(status)
    expect(status.textContent).toBe('3.1 kg from your last weigh-in. Check it before you save.')
    act(() => type(input, '18.4'))
    expect(host.querySelector('.g-wi-far').textContent).toContain('63.3 kg')
    act(() => button('Save weigh-in').click())
    expect(useStore.getState().S.bodyweight.at(-1).w).toBe(18.4)
  })

  it('stands on the keyboard the read-out raises without being resized by it, Save in reach', () => {
    const before = Object.getOwnPropertyDescriptor(window, 'visualViewport')
    const height = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: { height: 600, offsetTop: 0, addEventListener() {}, removeEventListener() {} } })
    try {
      const { host } = renderBw()
      const drawer = host.querySelector('.g-bs')
      // The lift is the page's (lib/sheet-keyboard.js, on <html>), not a variable on the drawer.
      applySheetKeyboard(window)
      expect(document.documentElement.style.getPropertyValue('--kb')).toBe('300px')
      expect(document.documentElement.style.getPropertyValue('--vvh')).toBe('600px')
      expect(drawer.getAttribute('style')).toBeNull()
    } finally {
      if (before) Object.defineProperty(window, 'visualViewport', before); else delete window.visualViewport
      if (height) Object.defineProperty(window, 'innerHeight', height); else delete window.innerHeight
      applySheetKeyboard(window)
    }
  })

  it('reads the 3 kg in pounds for a pound profile', () => {
    useStore.setState(s => ({ S: { ...s.S, unit: 'lb', bodyweight: [{ d: daysAgo(1), w: 180, t: 1 }] } }))
    const { input, host } = renderBw()
    act(() => type(input, '186'))
    expect(host.querySelector('.g-wi-far').textContent).toBe('')
    act(() => type(input, '187'))
    expect(host.querySelector('.g-wi-far').textContent).toContain('7 lb')
  })

  it('names a past day in its chip and reads against the weigh-in before it', () => {
    const day = daysAgo(3)
    useStore.setState(s => ({ S: { ...s.S, bodyweight: [{ d: daysAgo(5), w: 80, t: 1 }, { d: daysAgo(1), w: 90, t: 2 }] } }))
    const { host } = renderBw({ date: day })
    expect(host.querySelector('.g-bs-chip').textContent).toBe(fmtDate(day, true))
    expect(host.querySelector('.g-wi-last').textContent).toContain('80 kg')
  })

  it('before a workout: locked, its own copy, and the three ways on', () => {
    const onDone = vi.fn()
    const { host, button } = renderBw({ required: true, onDone })
    expect(useUI.getState().sheets[0].locked).toBe(true)
    expect(host.querySelector('.g-bs h2').textContent).toBe('Quick check-in')
    expect(button('Start without weighing in')).toBeTruthy()
    expect(button('Choose a different workout')).toBeTruthy()
    act(() => button('Save & start workout').click())
    expect(onDone).toHaveBeenCalledWith(70)
    expect(useStore.getState().S.bodyweight).toHaveLength(1)
  })
})

describe('the goal sheet', () => {
  it('moves the slider with what is typed, and holds it at its ceiling past it', () => {
    goalSheet()
    const { host } = renderTop()
    const input = host.querySelector('.bw-read input')
    const slider = host.querySelector('.sld')
    act(() => type(input, '82,5'))
    expect(input.value).toBe('82.5')
    expect(slider.getAttribute('aria-valuenow')).toBe('82.5')
    act(() => type(input, '320'))
    expect(input.value).toBe('320')
    expect(slider.getAttribute('aria-valuenow')).toBe('300')
  })

  it('refuses a weight no person has', () => {
    const toast = vi.fn()
    useUI.setState({ toast })
    goalSheet()
    const { host, button } = renderTop()
    act(() => type(host.querySelector('.bw-read input'), '9999'))
    act(() => button('Save goal').click())
    expect(useStore.getState().S.targetW ?? null).toBe(null)
    expect(toast).toHaveBeenCalledWith('That looks too heavy. Keep it at 700 kg or less.')
  })
})
