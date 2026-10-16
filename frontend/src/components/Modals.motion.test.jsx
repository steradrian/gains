// @vitest-environment happy-dom
/* A bottom sheet rises with its scrim and goes back down with it (spec-motion-enter-exit.md §2.1).
 * The store is the truth and changes at once; only the sheet's DOM outlives the close, by its way
 * out, and while it plays the sheet is closed in every way that matters: focus is back on the
 * opener, the page behind is live and takes taps, the sheet is out of reach. Every way out that is
 * not one of the sheet's own buttons behaves like its Cancel.
 *
 * The real Modals on the real store; the Web Animations API is the fake driver. */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals, { scrollRestorePending } from './Modals.jsx'
import { useUI } from '../store/useUI.js'
import { confirmSheet } from '../sheets.jsx'
import { MS, PRESETS, setMotionDriver } from '../lib/motion.js'
import { fakeMotionDriver } from '../lib/motion.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, host, driver
const q = s => document.querySelector(s)
const all = s => [...document.querySelectorAll(s)]
const open = (render, opts) => { let handle; act(() => { handle = useUI.getState().openSheet(render, opts) }); return handle }
const click = el => act(async () => { el.click() })
const escape = () => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
const flushMicrotasks = () => act(async () => { await Promise.resolve() })
const finishAll = () => act(async () => { driver.running().forEach(a => a.finish()) })

const Plain = ({ title = 'Weigh in', close }) => <>
  <h3>{title}</h3>
  <button onClick={close}>Done</button>
</>

beforeEach(async () => {
  document.body.innerHTML = '<div id="app"><button id="opener">Open</button></div><nav id="tabbar"></nav><div id="timer"></div><div id="root"></div>'
  host = document.getElementById('root')
  useUI.setState({ sheets: [] })
  driver = fakeMotionDriver()
  setMotionDriver(driver)
  root = createRoot(host)
  await act(async () => { root.render(<Modals />) })
  document.getElementById('opener').focus()
})
afterEach(async () => {
  setMotionDriver(null)
  await act(async () => { useUI.getState().closeAll(); root.unmount() })
  // Closing a sheet arms the scroll restore's timers; let them run while the page is still ours.
  while (scrollRestorePending()) await act(async () => { await new Promise(r => setTimeout(r, 25)) })
  delete document.documentElement.dataset.motion
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('a bottom sheet\'s way in and out', () => {
  it('rises over --slow with its scrim fading in on the same timing', async () => {
    open(close => <Plain close={close} />)
    const [sheet] = driver.on(q('.sheet'))
    const [back] = driver.on(q('.mback'))
    expect(sheet.keyframes).toEqual(PRESETS.sheet.enter.keyframes)
    expect(sheet.options).toMatchObject({ duration: MS.slow, easing: PRESETS.sheet.enter.easing })
    expect(back.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }])
    expect(back.options.duration).toBe(MS.slow)
  })

  it('is closed the moment it is closed: focus is back, the page is live, the sheet is out of reach while it leaves', async () => {
    open(close => <Plain close={close} />)
    const sheet = q('.sheet')
    expect(document.activeElement).toBe(sheet)
    expect(document.getElementById('app').hasAttribute('inert')).toBe(true)

    await click(sheet.querySelector('button'))
    await flushMicrotasks()
    expect(useUI.getState().sheets).toHaveLength(0)
    // still on screen, playing its way out from where it is...
    expect(q('.sheet')).toBe(sheet)
    const exit = driver.on(sheet).at(-1)
    expect(exit.keyframes).toEqual(PRESETS.sheet.exit.keyframes)
    expect(exit.options).toMatchObject({ duration: MS.exitSlow, fill: 'forwards' })
    // ...but closed in every way that counts
    expect(document.activeElement).toBe(document.getElementById('opener'))
    expect(document.getElementById('app').hasAttribute('inert')).toBe(false)
    const layer = sheet.parentElement
    expect(layer.hasAttribute('inert')).toBe(true)
    expect(layer.getAttribute('aria-hidden')).toBe('true')
    expect(q('#modal-root').classList.contains('live')).toBe(false)

    await finishAll()
    expect(q('.sheet')).toBeNull()
    expect(q('#modal-root')).toBeNull()
  })

  it('swaps for the next sheet in the same tap without a second scrim: the old one fades where it stands', async () => {
    open(close => <Plain title="First" close={() => { close(); useUI.getState().openSheet(c => <Plain title="Second" close={c} />) }} />)
    const [first, firstBack] = [q('.sheet'), q('.mback')]
    await click(first.querySelector('button'))

    expect(firstBack.hidden).toBe(true)
    const out = driver.on(first).at(-1)
    expect(out.keyframes).toEqual(PRESETS.sheetSwap.exit.keyframes)
    expect(out.options.duration).toBe(MS.exitFast)
    const second = all('.sheet').find(s => s !== first)
    const secondBack = all('.mback').find(b => b !== firstBack)
    expect(driver.on(second)).toHaveLength(1)
    expect(driver.on(secondBack)).toHaveLength(0)

    // the chain still ends on what opened the first, though the first is still on screen
    await flushMicrotasks()
    await click(second.querySelector('button'))
    await flushMicrotasks()
    expect(document.activeElement).toBe(document.getElementById('opener'))
  })

  it('fades instead of moving when the app keeps still', async () => {
    document.documentElement.dataset.motion = 'reduce'
    const { close } = open(c => <Plain close={c} />)
    await act(async () => { close() })
    for (const anim of driver.calls) {
      expect(anim.keyframes.every(k => Object.keys(k).every(p => p === 'opacity'))).toBe(true)
      expect(anim.options.duration).toBe(MS.rm)
    }
    expect(driver.calls.length).toBeGreaterThanOrEqual(4)
  })

  it('has no grab bar when it is locked', async () => {
    open(c => <Plain close={c} />, { locked: true })
    expect(q('.sheet .grab')).toBeNull()
  })
})

describe('every way out is a Cancel', () => {
  beforeEach(() => { setMotionDriver(null) })

  it('runs onDismiss on the backdrop, on Escape and on back, and not on the sheet\'s own close', async () => {
    const onDismiss = vi.fn()
    open(c => <Plain close={c} />, { onDismiss })
    await click(q('.mback'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(useUI.getState().sheets).toHaveLength(0)

    open(c => <Plain close={c} />, { onDismiss })
    await escape()
    expect(onDismiss).toHaveBeenCalledTimes(2)

    open(c => <Plain close={c} />, { onDismiss })
    await click(q('.sheet button'))
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })

  it('a confirm\'s backdrop and Escape run the same onCancel as its Cancel button', async () => {
    const onCancel = vi.fn(), onConfirm = vi.fn()
    act(() => { confirmSheet({ title: 'Delete it?', onConfirm, onCancel }) })
    await click(q('.mback'))
    expect(onCancel).toHaveBeenCalledTimes(1)

    act(() => { confirmSheet({ title: 'Delete it?', onConfirm, onCancel }) })
    await escape()
    expect(onCancel).toHaveBeenCalledTimes(2)

    act(() => { confirmSheet({ title: 'Delete it?', onConfirm, onCancel }) })
    await click(all('.center button').find(b => b.textContent === 'Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(3)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('a locked confirm stays, and nothing is cancelled', async () => {
    const onCancel = vi.fn()
    act(() => { confirmSheet({ title: 'Add them?', onConfirm: () => {}, onCancel, locked: true }) })
    await click(q('.mback'))
    await escape()
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(onCancel).not.toHaveBeenCalled()
  })
})
