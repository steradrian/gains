// @vitest-environment happy-dom
/* A bottom sheet rises with its scrim and goes back down with it (spec-motion-enter-exit.md §2.1).
 * The store is the truth and changes at once; only the sheet's DOM outlives the close, by its way
 * out, and while it plays the sheet is closed in every way that matters: focus is back on the
 * opener, the page behind is live and takes taps, the sheet is out of reach. Every way out that is
 * not one of the sheet's own buttons behaves like its Cancel.
 *
 * The real Modals on the real store; the Web Animations API is the fake driver. */
import React, { act, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals, { scrollRestorePending } from './Modals.jsx'
import { useUI } from '../store/useUI.js'
import { confirmSheet } from '../sheets.jsx'
import { MS, PRESETS, setMotionDriver } from '../lib/motion.js'
import { fakeMotionDriver } from '../lib/motion.test-util.js'
import { useDialogFocus } from '../lib/use-dialog-focus.js'

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
// Content that runs its own focus trap, the way the + sheet does (PlusSheet.jsx): one row closes
// it, the other closes it and opens the next sheet in the same tap.
function OwnFocus({ close, next }) {
  const ref = useRef(null)
  useDialogFocus(ref)
  return <div ref={ref} role="dialog" aria-modal="true" aria-label="Add" data-own-dialog-focus>
    <button onClick={close}>Weigh in</button>
    <button onClick={() => { close(); next() }}>New routine</button>
  </div>
}
const button = text => all('button').find(b => b.textContent === text)
const goBack = () => act(async () => { window.dispatchEvent(new PopStateEvent('popstate')) })
const drag = (el, dy) => act(async () => {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }))
  el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 100 + dy }))
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 100, clientY: 100 + dy }))
})

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
    const go = vi.spyOn(history, 'go').mockImplementation(() => {})
    open(close => <Plain close={close} />)
    const sheet = q('.sheet')
    expect(document.activeElement).toBe(sheet)
    expect(document.getElementById('app').hasAttribute('inert')).toBe(true)

    await click(sheet.querySelector('button'))
    await flushMicrotasks()
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(go).toHaveBeenCalledWith(-1)
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

  it('closes every sheet at once on closeAll, each history entry walked back, each leaving where it stands', async () => {
    const go = vi.spyOn(history, 'go').mockImplementation(() => {})
    open(c => <Plain title="First" close={c} />)
    open(c => <Plain title="Second" close={c} />)
    const sheets = all('.sheet')
    expect(sheets).toHaveLength(2)

    await act(async () => { useUI.getState().closeAll() })
    await flushMicrotasks()
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(go).toHaveBeenCalledWith(-2)
    expect(all('.sheet')).toEqual(sheets)
    for (const sheet of sheets) expect(sheet.parentElement.hasAttribute('inert')).toBe(true)
    expect(document.activeElement).toBe(document.getElementById('opener'))
    expect(document.getElementById('app').hasAttribute('inert')).toBe(false)

    await finishAll()
    expect(q('#modal-root')).toBeNull()
  })

  it('a sheet with its own focus trap (the + sheet) lets go the moment it is closed, not when its way out ends', async () => {
    open(close => <OwnFocus close={close} next={() => {}} />)
    const sheet = q('.sheet')
    expect(document.activeElement).toBe(button('Weigh in'))
    expect(document.getElementById('app').hasAttribute('inert')).toBe(true)

    await click(button('Weigh in'))
    await flushMicrotasks()
    expect(q('.sheet')).toBe(sheet)
    expect(document.getElementById('app').hasAttribute('inert')).toBe(false)
    expect(document.getElementById('tabbar').hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(document.getElementById('opener'))
  })

  it('a sheet with its own focus trap swapped for the next one hands that one its opener', async () => {
    open(close => <OwnFocus close={close} next={() => useUI.getState().openSheet(c => <Plain title="New routine" close={c} />)} />)
    const own = q('.sheet')
    await click(button('New routine'))
    await flushMicrotasks()
    const next = all('.sheet').find(s => s !== own)
    expect(document.activeElement).toBe(next)
    expect(document.getElementById('app').hasAttribute('inert')).toBe(true)

    // closed while the first is still fading out: back on what opened the first
    await click(next.querySelector('button'))
    await flushMicrotasks()
    expect(q('.sheet')).not.toBeNull()
    expect(document.activeElement).toBe(document.getElementById('opener'))
    expect(document.getElementById('app').hasAttribute('inert')).toBe(false)
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

  it('runs onDismiss on the backdrop, on Escape and on a drag, and not on the sheet\'s own close', async () => {
    const onDismiss = vi.fn()
    open(c => <Plain close={c} />, { onDismiss })
    await click(q('.mback'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(useUI.getState().sheets).toHaveLength(0)

    open(c => <Plain close={c} />, { onDismiss })
    await escape()
    expect(onDismiss).toHaveBeenCalledTimes(2)

    open(c => <Plain close={c} />, { onDismiss })
    await drag(q('.sheet'), 200)
    expect(onDismiss).toHaveBeenCalledTimes(3)
    expect(useUI.getState().sheets).toHaveLength(0)

    open(c => <Plain close={c} />, { onDismiss })
    await click(q('.sheet button'))
    expect(onDismiss).toHaveBeenCalledTimes(3)
  })

  it('runs onDismiss on back', async () => {
    const onDismiss = vi.fn()
    open(c => <Plain close={c} />, { onDismiss })
    await goBack()
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('a locked sheet stays on back and on a drag, and nothing is cancelled', async () => {
    const onDismiss = vi.fn()
    open(c => <Plain close={c} />, { onDismiss, locked: true })
    await goBack()
    await drag(q('.sheet'), 200)
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(onDismiss).not.toHaveBeenCalled()
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
    await click(all('.sheet button').find(b => b.textContent === 'Cancel'))
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
