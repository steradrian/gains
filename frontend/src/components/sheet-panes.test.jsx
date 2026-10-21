// @vitest-environment happy-dom
/* A drawer is never opened on top of a drawer: what an open drawer opens next slides in as a
 * sub-panel inside the same drawer (store/useUI.js openSheet, components/sheet-panes.jsx). Each
 * panel holds a history entry, so the hardware Back takes a panel off before the drawer; the
 * chevron, Escape and Back go back one panel, the ×, the backdrop and a swipe close the lot, and
 * closing leaves no entry behind. Focus goes to the panel's heading and returns to the control
 * that opened it. Reduced motion crossfades.
 *
 * The real Modals on the real store; the Web Animations API is the fake driver where motion is
 * looked at. */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals, { scrollRestorePending } from './Modals.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import { drawerFlow, useUI } from '../store/useUI.js'
import { closeThenNav, setNav, sheetEntriesLive } from '../lib/nav.js'
import { backSheet, dismissSheet, sheetEntryCount } from '../lib/sheet-nav.js'
import { PANEL_MS, PANEL_RM_MS, setMotionDriver } from '../lib/motion.js'
import { fakeMotionDriver } from '../lib/motion.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, host, go, push
const q = s => document.querySelector(s)
const all = s => [...document.querySelectorAll(s)]
const ui = () => useUI.getState()
const open = (render, opts) => { let handle; act(() => { handle = ui().openSheet(render, opts) }); return handle }
const click = el => act(async () => { el.click() })
const escape = () => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
const hardwareBack = () => act(async () => { window.dispatchEvent(new PopStateEvent('popstate')) })
const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) }) }
const panelsOf = () => ui().sheets.map(s => (s.panels || []).length)

// A drawer the way an older sheet is written (a heading, rows), and one the way the design system's
// is (ds/BottomSheet). Both open another from a row.
const Menu = ({ close, next, id = 'to-next', title = 'Add' }) => <>
  <h3>{title}</h3>
  <button id={id} onClick={next}>Open next</button>
  <button id="done" onClick={close}>Done</button>
</>
const DsMenu = ({ next, title = 'Add to Today' }) => (
  <BottomSheet title={title}><button id="to-next" onClick={next}>Log food</button></BottomSheet>
)
const DsStep = ({ title = 'Log food', next, close }) => (
  <BottomSheet title={title} footer={<button id="step-done" onClick={close}>Save</button>}>
    {next && <button id="to-deeper" onClick={next}>Deeper</button>}
  </BottomSheet>
)

beforeEach(async () => {
  document.body.innerHTML = '<div id="app"><button id="opener">Open</button></div><nav id="tabbar"></nav><div id="timer"></div><div id="root"></div>'
  host = document.getElementById('root')
  useUI.setState({ sheets: [] })
  go = vi.spyOn(history, 'go').mockImplementation(() => {})
  push = vi.spyOn(history, 'pushState')
  root = createRoot(host)
  await act(async () => { root.render(<Modals />) })
  document.getElementById('opener').focus()
})
afterEach(async () => {
  setMotionDriver(null)
  delete document.documentElement.dataset.motion
  await act(async () => { ui().closeAll(); root.unmount() })
  await settle()
  while (scrollRestorePending()) await act(async () => { await new Promise(r => setTimeout(r, 25)) })
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('opening a sheet from inside an open one', () => {
  it('pushes it as a sub-panel of that drawer instead of stacking a second drawer', async () => {
    let next
    open(close => <Menu close={close} next={() => { next = ui().openSheet(c => <Menu title="Next" close={c} id="x" />) }} />)
    await click(q('#to-next'))
    expect(ui().sheets).toHaveLength(1)
    expect(ui().sheets[0].panels.map(p => p.id)).toEqual([next.id])
    expect(all('.sheet')).toHaveLength(1)
    expect(all('.g-bs-pane')).toHaveLength(2)
    expect(sheetEntryCount(ui().sheets)).toBe(2)
  })

  it('leaves a centred dialog to stack, over a drawer and its panels alike', async () => {
    open(close => <Menu close={close} next={() => {}} />)
    open(() => <h3>Panel</h3>)
    open(c => <Menu title="Sure?" close={c} />, { kind: 'center' })
    expect(ui().sheets.map(s => s.kind)).toEqual(['sheet', 'center'])
    expect(panelsOf()).toEqual([1, 0])
  })

  it('with no drawer open, is a drawer', async () => {
    open(close => <Menu close={close} next={() => {}} />)
    expect(ui().sheets).toHaveLength(1)
    expect(ui().sheets[0].panels).toEqual([])
  })

  it('takes the panel for a ds drawer inside a ds drawer, with the drawer chrome drawn once', async () => {
    open(() => <DsMenu next={() => ui().openSheet(c => <DsStep close={c} />, { variant: 'ds' })} />, { variant: 'ds' })
    await click(q('#to-next'))
    expect(all('.g-bs')).toHaveLength(1)
    expect(all('.g-bs-grab')).toHaveLength(1)
    expect(all('.g-bs-scrim')).toHaveLength(1)
    const heads = all('.g-bs-head h2').map(h => h.textContent)
    expect(heads).toEqual(['Add to Today', 'Log food'])
    // the panel's header carries the back chevron, the drawer's first panel does not
    expect(all('.g-bs-head .g-bs-back')).toHaveLength(1)
    expect(q('.g-bs-pane-sub .g-bs-head .g-bs-back').getAttribute('aria-label')).toBe('Back')
  })

  it('gives an older sheet in the panel a bar with the chevron', async () => {
    open(close => <Menu close={close} next={() => ui().openSheet(c => <Menu title="Next" close={c} id="x" />)} />)
    await click(q('#to-next'))
    expect(q('.g-bs-pane-sub .g-bs-bar .g-bs-back')).not.toBeNull()
  })
})

describe('history', () => {
  it('holds one entry for the drawer and one for each panel', async () => {
    open(close => <Menu close={close} next={() => ui().openSheet(c => <DsStep title="Two" close={c} next={() => ui().openSheet(d => <DsStep title="Three" close={d} />, { variant: 'ds' })} />, { variant: 'ds' })} />)
    expect(push).toHaveBeenCalledTimes(1)
    await click(q('#to-next'))
    expect(push).toHaveBeenCalledTimes(2)
    await click(q('#to-deeper'))
    expect(push).toHaveBeenCalledTimes(3)
    expect(history.state.gainsSheet).toBe(true)
    expect(sheetEntriesLive()).toBe(3)
  })

  it('takes a panel off with the hardware Back, then the drawer, spending the entries it already walked', async () => {
    open(close => <Menu close={close} next={() => ui().openSheet(c => <Menu title="Next" close={c} id="x" />)} />)
    await click(q('#to-next'))
    await hardwareBack()
    expect(panelsOf()).toEqual([0])
    expect(sheetEntriesLive()).toBe(1)
    await hardwareBack()
    expect(ui().sheets).toHaveLength(0)
    expect(sheetEntriesLive()).toBe(0)
    // the browser has taken both entries itself: nothing is walked a second time
    expect(go).not.toHaveBeenCalled()
  })

  it('walks one entry back when a panel goes by its chevron', async () => {
    open(close => <Menu close={close} next={() => ui().openSheet(c => <Menu title="Next" close={c} id="x" />)} />)
    await click(q('#to-next'))
    await click(q('.g-bs-pane-sub .g-bs-back'))
    expect(panelsOf()).toEqual([0])
    expect(go).toHaveBeenCalledTimes(1)
    expect(go).toHaveBeenCalledWith(-1)
  })

  it('leaves no entry behind when the whole drawer closes with panels pushed', async () => {
    const drawer = open(() => <DsMenu next={() => ui().openSheet(c => <DsStep close={c} next={() => ui().openSheet(d => <DsStep title="Three" close={d} />, { variant: 'ds' })} />, { variant: 'ds' })} />, { variant: 'ds' })
    await click(q('#to-next'))
    await click(q('#to-deeper'))
    expect(sheetEntryCount(ui().sheets)).toBe(3)
    await click(q('.g-bs-pane[data-pos="active"] .g-bs-x'))
    expect(ui().sheets).toHaveLength(0)
    expect(drawer.id).toBeTruthy()
    // all three entries walked off in one go
    expect(go).toHaveBeenCalledTimes(1)
    expect(go).toHaveBeenCalledWith(-3)
  })

  it('Escape goes back a panel before it closes the drawer', async () => {
    open(close => <Menu close={close} next={() => ui().openSheet(c => <Menu title="Next" close={c} id="x" />)} />)
    await click(q('#to-next'))
    await escape()
    expect(ui().sheets).toHaveLength(1)
    expect(panelsOf()).toEqual([0])
    await escape()
    expect(ui().sheets).toHaveLength(0)
  })

  it('runs the onDismiss of every panel and the drawer when the backdrop sends it all off', async () => {
    const calls = []
    open(close => <Menu close={close} next={() => ui().openSheet(c => <Menu title="Next" close={c} id="x" />, { onDismiss: () => calls.push('panel') })} />, { onDismiss: () => calls.push('drawer') })
    await click(q('#to-next'))
    await click(q('.mback'))
    expect(ui().sheets).toHaveLength(0)
    expect(calls).toEqual(['panel', 'drawer'])
  })

  it('stays on a locked panel: back does nothing, and the drawer under it does not move either', async () => {
    open(close => <Menu close={close} next={() => ui().openSheet(c => <Menu title="Next" close={c} id="x" />, { locked: true })} />)
    await click(q('#to-next'))
    await escape()
    expect(panelsOf()).toEqual([1])
    expect(q('.g-bs-pane-sub .g-bs-back')).toBeNull()
  })

  it('has pure steps for back and dismiss (what Android back uses)', () => {
    const closed = []
    const ui2 = { sheets: [{ id: 'a', panels: [{ id: 'p', onDismiss: () => closed.push('p') }], onDismiss: () => closed.push('a') }], closeSheet: id => closed.push('close ' + id) }
    expect(backSheet(ui2, 'a')).toBe(true)
    expect(closed).toEqual(['close p', 'p'])
    expect(dismissSheet({ ...ui2, sheets: [{ id: 'a', locked: true }] }, 'a')).toBe(false)
  })
})

describe('closing', () => {
  it('lets a panel close itself with the close it is handed, leaving the drawer', async () => {
    open(close => <Menu close={close} next={() => ui().openSheet(c => <Menu title="Next" close={c} id="x" />)} />)
    await click(q('#to-next'))
    await click(q('.g-bs-pane-sub #done'))
    expect(ui().sheets).toHaveLength(1)
    expect(panelsOf()).toEqual([0])
  })

  it('lets a step of a flow the drawer launched end it: its close is the drawer’s', async () => {
    open(close => <Menu close={close} next={() => drawerFlow(() => ui().openSheet(c => <Menu title="Next" close={c} id="x" />))} />)
    await click(q('#to-next'))
    expect(panelsOf()).toEqual([1])
    await click(q('.g-bs-pane-sub #done'))
    expect(ui().sheets).toHaveLength(0)
  })

  it('still lets the chevron take a flow step back to the menu', async () => {
    open(close => <Menu close={close} next={() => drawerFlow(() => ui().openSheet(c => <Menu title="Next" close={c} id="x" />))} />)
    await click(q('#to-next'))
    await click(q('.g-bs-pane-sub .g-bs-back'))
    expect(ui().sheets).toHaveLength(1)
    expect(panelsOf()).toEqual([0])
  })

  it('takes the whole drawer when a panel navigates away (closeThenNav), after every entry is walked off', async () => {
    const to = vi.fn()
    setNav(to)
    let panelClose
    open(close => <Menu close={close} next={() => ui().openSheet(c => { panelClose = c; return <Menu title="Next" close={c} id="x" /> })} />)
    await click(q('#to-next'))
    await act(async () => { closeThenNav(panelClose, '/train/workout') })
    expect(ui().sheets).toHaveLength(0)
    // two entries: a replace could only take one of them, so the page waits for the walk-off
    expect(to).not.toHaveBeenCalled()
    expect(go).toHaveBeenCalledWith(-2)
    await hardwareBack()
    expect(to).toHaveBeenCalledWith('/train/workout')
    setNav(() => {})
  })

  it('replaces the sheet’s entry when a drawer with no panel navigates away', async () => {
    const to = vi.fn()
    setNav(to)
    let drawerClose
    open(close => { drawerClose = close; return <Menu close={close} next={() => {}} /> })
    await act(async () => { closeThenNav(drawerClose, '/train/workout') })
    expect(to).toHaveBeenCalledWith('/train/workout', { replace: true })
    setNav(() => {})
  })
})

describe('focus and the hidden panel', () => {
  it('moves focus to the panel’s heading and gives it back to the control that opened it', async () => {
    open(close => <Menu close={close} next={() => ui().openSheet(c => <Menu title="Next panel" close={c} id="x" />)} />)
    q('#to-next').focus()
    await click(q('#to-next'))
    expect(document.activeElement.textContent).toBe('Next panel')
    expect(document.activeElement.closest('.g-bs-pane-sub')).not.toBeNull()
    await click(q('.g-bs-pane-sub .g-bs-back'))
    await settle()
    expect(document.activeElement).toBe(q('#to-next'))
  })

  it('makes the panels under the active one inert and hidden from screen readers, and the drawer is named by the active panel', async () => {
    open(close => <Menu close={close} next={() => ui().openSheet(c => <Menu title="Next panel" close={c} id="x" />)} />)
    const dialog = q('.sheet')
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent).toBe('Add')
    await click(q('#to-next'))
    const [rootPane, sub] = all('.g-bs-pane')
    expect(rootPane.hasAttribute('inert')).toBe(true)
    expect(rootPane.getAttribute('aria-hidden')).toBe('true')
    expect(rootPane.dataset.pos).toBe('under')
    expect(sub.hasAttribute('inert')).toBe(false)
    expect(sub.dataset.pos).toBe('active')
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent).toBe('Next panel')
    await click(sub.querySelector('.g-bs-back'))
    await settle()
    expect(rootPane.hasAttribute('inert')).toBe(false)
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent).toBe('Add')
  })

  it('keeps Tab inside the active panel', async () => {
    open(close => <Menu close={close} next={() => ui().openSheet(c => <Menu title="Next panel" close={c} id="x" />)} />)
    await click(q('#to-next'))
    const sub = q('.g-bs-pane-sub')
    const last = [...sub.querySelectorAll('button')].at(-1)
    last.focus()
    await act(async () => { q('.sheet').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })) })
    expect(sub.contains(document.activeElement)).toBe(true)
  })
})

describe('motion', () => {
  it('slides the panel in from the right over 260 ms and moves the one under it back 30%', async () => {
    const driver = fakeMotionDriver()
    setMotionDriver(driver)
    open(close => <Menu close={close} next={() => ui().openSheet(c => <Menu title="Next" close={c} id="x" />)} />)
    const before = driver.calls.length
    await click(q('#to-next'))
    const [rootPane, sub] = all('.g-bs-pane')
    const slide = driver.on(sub)[0]
    expect(slide.keyframes).toEqual([{ transform: 'translateX(100%)' }, { transform: 'none' }])
    expect(slide.options.duration).toBe(PANEL_MS)
    const under = driver.on(rootPane).at(-1)
    expect(under.keyframes).toEqual([{ transform: 'none' }, { transform: 'translateX(-30%)' }])
    expect(under.options.duration).toBe(PANEL_MS)
    expect(driver.calls.length).toBeGreaterThan(before)
  })

  it('slides it out the same way on back, and the one under comes back from -30%', async () => {
    const driver = fakeMotionDriver()
    setMotionDriver(driver)
    open(close => <Menu close={close} next={() => ui().openSheet(c => <Menu title="Next" close={c} id="x" />)} />)
    await click(q('#to-next'))
    const [rootPane, sub] = all('.g-bs-pane')
    await click(sub.querySelector('.g-bs-back'))
    const out = driver.on(sub).at(-1)
    expect(out.keyframes).toEqual([{ transform: 'translateX(100%)' }])
    expect(out.options.duration).toBe(PANEL_MS)
    expect(driver.on(rootPane).at(-1).keyframes).toEqual([{ transform: 'translateX(-30%)' }, { transform: 'none' }])
    await act(async () => { driver.running().forEach(a => a.finish()) })
    await settle()
    expect(all('.g-bs-pane')).toHaveLength(1)
  })

  it('crossfades over 150 ms, and moves nothing, when the app keeps still', async () => {
    document.documentElement.dataset.motion = 'reduce'
    const driver = fakeMotionDriver()
    setMotionDriver(driver)
    open(close => <Menu close={close} next={() => ui().openSheet(c => <Menu title="Next" close={c} id="x" />)} />)
    driver.calls.length = 0
    await click(q('#to-next'))
    const [rootPane, sub] = all('.g-bs-pane')
    for (const anim of [...driver.on(sub), ...driver.on(rootPane)]) {
      expect(anim.keyframes.every(k => Object.keys(k).every(p => p === 'opacity'))).toBe(true)
      expect(anim.options.duration).toBe(PANEL_RM_MS)
    }
    expect(driver.on(sub).length).toBeGreaterThan(0)
  })
})
