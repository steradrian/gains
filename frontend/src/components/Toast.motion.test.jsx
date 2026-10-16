// @vitest-environment happy-dom
/* The toast fades out with the message it was showing. The store clears the text on the same render
 * that hides the toast, and the pill used to fade out empty and shrinking to its padding. The pill
 * now comes and goes through the kit's presence, which holds its content until the way out is over,
 * while #toast, the live region, stays in the page throughout. */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Toast from './Toast.jsx'
import { useUI } from '../store/useUI.js'
import { MS, PRESETS, setMotionDriver } from '../lib/motion.js'
import { fakeMotionDriver } from '../lib/motion.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, driver
const pill = () => document.querySelector('#toast .toast-pill')
const set = state => act(async () => { useUI.setState(state) })

beforeEach(async () => {
  document.body.innerHTML = '<div id="root"></div>'
  useUI.setState({ toastMsg: '', toastAction: null })
  driver = fakeMotionDriver()
  setMotionDriver(driver)
  root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(<Toast />) })
})
afterEach(async () => {
  setMotionDriver(null)
  await act(async () => { root.unmount() })
  delete document.documentElement.dataset.motion
  document.body.innerHTML = ''
})

describe('the toast\'s way in and out', () => {
  it('keeps its message, and its action, until its way out is over', async () => {
    await set({ toastMsg: 'Set removed', toastAction: { label: 'Undo', run: () => {}, id: 1, icon: 'undo' } })
    const el = pill()
    expect(driver.on(el)[0].keyframes).toEqual(PRESETS.toast.enter.keyframes)

    await set({ toastMsg: '', toastAction: null })
    expect(pill()).toBe(el)
    expect(el.textContent).toContain('Set removed')
    expect(el.textContent).toContain('Undo')
    expect(el.hasAttribute('inert')).toBe(true)
    const exit = driver.on(el).at(-1)
    expect(exit.keyframes).toEqual(PRESETS.toast.exit.keyframes)
    expect(exit.options).toMatchObject({ duration: MS.exit, easing: PRESETS.toast.exit.easing })

    await act(async () => { exit.finish() })
    expect(pill()).toBeNull()
    expect(document.getElementById('toast').getAttribute('role')).toBe('status')
  })

  it('takes a new message over a showing one in place, with a nudge, not a second entrance', async () => {
    await set({ toastMsg: 'Saved' })
    const el = pill()
    await set({ toastMsg: 'Saved again' })
    expect(pill()).toBe(el)
    expect(el.textContent).toBe('Saved again')
    const [enter, nudge] = driver.on(el)
    expect(enter.keyframes).toEqual(PRESETS.toast.enter.keyframes)
    expect(nudge.keyframes).toEqual(PRESETS.nudge.enter.keyframes)
  })

  it('comes back whole when a new message arrives while it leaves, after a way in cut short', async () => {
    await set({ toastMsg: 'Saved' })
    const el = pill()
    await set({ toastMsg: '' })
    const exit = driver.on(el).at(-1)
    await set({ toastMsg: 'Set restored' })
    expect(pill()).toBe(el)
    expect(el.textContent).toBe('Set restored')
    expect(exit.playState).toBe('idle')
    // not resting on the half-faded, lowered frame the cut-short way in was stopped on
    expect(el.style.opacity).toBe('')
    expect(el.style.transform).toBe('')
    const after = driver.on(el).slice(driver.on(el).indexOf(exit) + 1)
    expect(after.map(a => a.keyframes)).toEqual([PRESETS.toast.enter.keyframes])
  })

  it('only fades, and does not nudge, when the app keeps still', async () => {
    document.documentElement.dataset.motion = 'reduce'
    await set({ toastMsg: 'Saved' })
    await set({ toastMsg: 'Saved again' })
    await set({ toastMsg: '' })
    expect(driver.calls).toHaveLength(2)
    for (const anim of driver.calls) {
      expect(anim.keyframes.every(k => Object.keys(k).every(p => p === 'opacity'))).toBe(true)
      expect(anim.options.duration).toBe(MS.rm)
    }
  })
})

describe('the toast\'s action from the keyboard', () => {
  const undoToast = run => set({ toastMsg: 'Set removed', toastAction: { label: 'Undo', run, id: 1, icon: 'undo' } })
  const undo = () => document.querySelector('#toast .toast-act')

  it('gives the focus back to where it was before the Undo, not to the page body', async () => {
    const field = document.createElement('button')
    document.body.appendChild(field)
    field.focus()
    const run = vi.fn()
    await undoToast(run)
    undo().focus()
    await act(async () => { undo().click() })
    expect(run).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(field)
  })

  it('does not hand the focus back after a tap, which would open the soft keyboard of the field it returns to', async () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    field.focus()
    const run = vi.fn()
    await undoToast(run)
    // A finger focuses the button, and its click carries a pointer's detail (a keyboard's is 0).
    undo().focus()
    await act(async () => { undo().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })) })
    expect(run).toHaveBeenCalledTimes(1)
    expect(document.activeElement).not.toBe(field)
    expect(pill().contains(document.activeElement)).toBe(false)
  })

  it('leaves nothing focused inside the leaving pill when there is nowhere to go back to', async () => {
    await undoToast(() => {})
    undo().focus()
    await act(async () => { undo().click() })
    expect(pill().hasAttribute('inert')).toBe(true)
    expect(pill().contains(document.activeElement)).toBe(false)
  })
})
