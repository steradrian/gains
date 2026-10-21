// @vitest-environment happy-dom
// BottomSheet (boards T1.3, T1.4, T1.7, T1.8): the design system's light drawer. Drawn alone it is
// still and open (the catalogue). Opened through the app's sheet frame (openSheet with
// variant 'ds', components/Modals.jsx) it behaves as every sheet does: a modal dialog named by its
// title, focus in and back on the opener, Escape, the scrim and a pull down dismiss it, a locked one
// stays, and it rises and leaves with its scrim through the kit.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals, { scrollRestorePending } from '../components/Modals.jsx'
import { useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'
import { PRESETS, setMotionDriver } from '../lib/motion.js'
import { fakeMotionDriver } from '../lib/motion.test-util.js'
import BottomSheet from './BottomSheet.jsx'
import { click, useView } from './render.test-util.js'

describe('BottomSheet, drawn alone', () => {
  const view = useView()
  const q = s => view.host.querySelector(s)

  it('is a named dialog with a grab bar, title, close, a body that scrolls and a footer', () => {
    const onClose = vi.fn()
    view.render(<BottomSheet title="Weigh-in" chip="Today" onClose={onClose} footer={<button>Save weigh-in</button>}><p>81.4 kg</p></BottomSheet>)
    const panel = q('.g-bs')
    expect(panel.classList.contains('g-bs-auto')).toBe(true)
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(panel.getAttribute('aria-labelledby')).textContent).toBe('Weigh-in')
    expect(q('.g-bs-grab')).not.toBeNull()
    expect(q('span.g-bs-chip').textContent).toBe('Today')
    expect(q('.g-bs-body').textContent).toBe('81.4 kg')
    expect(q('.g-bs-foot').textContent).toBe('Save weigh-in')
    click(q('.g-bs-x'))
    click(q('.g-bs-scrim'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  // Eat logging m1: a drawer that is a stack of steps (Log food) goes back with the ‹ before its title.
  it('shows a back button before the title only when it has somewhere to go back to', () => {
    const onBack = vi.fn()
    view.render(<BottomSheet title="Log food" onBack={onBack} backLabel="Back to results" onClose={vi.fn()} />)
    const back = q('.g-bs-head > button.g-bs-back')
    expect(back.getAttribute('aria-label')).toBe('Back to results')
    expect(back.nextElementSibling.tagName).toBe('H2')
    click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
    view.render(<BottomSheet title="Log food" onClose={vi.fn()} />)
    expect(q('.g-bs-back')).toBeNull()
  })

  it('the chip wears the calendar unless told another glyph (the routine in the exercise picker)', () => {
    view.render(<BottomSheet title="Add exercise" chip="Push A" chipIcon="clipboard" />)
    const clipboard = q('span.g-bs-chip svg').innerHTML
    view.render(<BottomSheet title="Weigh-in" chip="Today" />)
    expect(q('span.g-bs-chip svg').innerHTML).not.toBe(clipboard)
  })

  it('takes a type, a tappable chip, a close link and no scrim', () => {
    const onChip = vi.fn()
    view.render(<BottomSheet title="Log food" chip="Today · Lunch" onChip={onChip} type="full" closeHref="#/today" scrim={false} />)
    expect(q('.g-bs').classList.contains('g-bs-full')).toBe(true)
    const chip = q('button.g-bs-chip')
    expect(chip.getAttribute('aria-label')).toBe('Logging to Today · Lunch')
    click(chip)
    expect(onChip).toHaveBeenCalledTimes(1)
    expect(q('a.g-bs-x').getAttribute('href')).toBe('#/today')
    expect(q('.g-bs-scrim')).toBeNull()
    expect(q('.g-bs-foot')).toBeNull()
    view.render(<BottomSheet title="Push A" chip="Mon 12 Oct" onChip={onChip} chipLabel="Open Mon 12 Oct" />)
    expect(q('button.g-bs-chip').getAttribute('aria-label')).toBe('Open Mon 12 Oct')
    expect(q('.g-bs-pin')).toBeNull()
  })

  it('pins `head` between the title and the body, outside the scroll', () => {
    view.render(<BottomSheet title="Log food" head={<input aria-label="Search food" />}><p>Banana</p></BottomSheet>)
    const pin = q('.g-bs-pin')
    expect(pin.querySelector('input')).not.toBeNull()
    expect(pin.previousElementSibling.classList.contains('g-bs-head')).toBe(true)
    expect(pin.nextElementSibling.classList.contains('g-bs-body')).toBe(true)
    expect(q('.g-bs-body').contains(pin)).toBe(false)
  })

  it('throws in development on a type it does not have', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => view.render(<BottomSheet title="x" type="tall" />)).toThrow(/type="tall"/)
    error.mockRestore()
  })
})

describe('BottomSheet in the app\'s sheet frame', () => {
  let root, driver
  const q = s => document.querySelector(s)
  const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) }) }
  const open = (render, opts = {}) => { let h; act(() => { h = useUI.getState().openSheet(render, { variant: 'ds', ...opts }) }); return h }
  const key = k => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })) })
  const finishAll = () => act(async () => { for (const anim of driver.running()) anim.finish() })
  const Drawer = ({ close, onClose, ...props }) => (
    <BottomSheet title="Weigh-in" chip="Today" onClose={onClose} footer={<button onClick={close}>Save weigh-in</button>} {...props}>
      <input aria-label="weight" />
    </BottomSheet>
  )

  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"><button id="opener">Open</button></div><div id="root"></div>'
    useUI.setState({ sheets: [] })
    driver = fakeMotionDriver()
    setMotionDriver(driver)
    root = createRoot(document.getElementById('root'))
    await act(async () => { root.render(<Modals />) })
    document.getElementById('opener').focus()
  })
  afterEach(async () => {
    setMotionDriver(null)
    await act(async () => { useUI.getState().closeAll(); root.unmount() })
    await settle()
    while (scrollRestorePending()) await act(async () => { await new Promise(r => setTimeout(r, 25)) })
    await settle()
    document.body.innerHTML = ''
  })

  it('is a modal dialog named by its title, on the design system root in the mapped accent', () => {
    useStore.setState(s => ({ S: { ...s.S, accent: 'sky' } }))
    open(close => <Drawer close={close} />)
    const panel = q('.g-bs')
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(panel.getAttribute('aria-labelledby')).textContent).toBe('Weigh-in')
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    const layer = panel.parentElement
    expect(layer.classList.contains('g-root')).toBe(true)
    expect(layer.dataset.accent).toBe('cobalt')
    expect(q('.sheet')).toBeNull()
    expect(q('.mback')).toBeNull()
  })

  it('rises with its scrim through the kit and leaves with it', async () => {
    const h = open(close => <Drawer close={close} />)
    const panel = q('.g-bs'), scrim = q('.g-bs-scrim')
    expect(driver.on(panel)[0].keyframes).toEqual(PRESETS.sheet.enter.keyframes)
    expect(driver.on(scrim)[0].keyframes).toEqual(PRESETS.backdrop.enter.keyframes)
    act(() => h.close())
    expect(panel.closest('[data-leaving]')).not.toBeNull()
    expect(driver.on(panel).at(-1).keyframes).toEqual(PRESETS.sheet.exit.keyframes)
    await finishAll()
    expect(q('.g-bs')).toBeNull()
  })

  it('takes the focus, keeps it inside, and gives it back to the opener on close', async () => {
    open(close => <Drawer close={close} />)
    const panel = q('.g-bs')
    expect(document.activeElement).toBe(panel)
    const controls = [...panel.querySelectorAll('input, button')]
    controls.at(-1).focus()
    await act(async () => { panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })) })
    expect(document.activeElement).toBe(controls[0])
    await act(async () => { q('.g-bs-foot button').click() })
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(document.activeElement).toBe(document.getElementById('opener'))
  })

  it('is dismissed by Escape, the scrim and the close button, each running onDismiss', async () => {
    for (const how of [() => key('Escape'), () => act(async () => { q('.g-bs-scrim').click() }), () => act(async () => { q('.g-bs-x').click() })]) {
      const onDismiss = vi.fn()
      open(close => <Drawer close={close} />, { onDismiss })
      await how()
      expect(useUI.getState().sheets).toHaveLength(0)
      expect(onDismiss).toHaveBeenCalledTimes(1)
      await finishAll()
    }
  })

  it('runs its own onClose from the close button when it has one', async () => {
    const onClose = vi.fn(), onDismiss = vi.fn()
    open(close => <Drawer close={close} onClose={() => { onClose(); close() }} />, { onDismiss })
    await act(async () => { q('.g-bs-x').click() })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onDismiss).not.toHaveBeenCalled()
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('stays when locked: no grab bar, no close, the scrim and Escape do nothing', async () => {
    open(close => <Drawer close={close} />, { locked: true })
    expect(q('.g-bs-grab')).toBeNull()
    expect(q('.g-bs-x')).toBeNull()
    await act(async () => { q('.g-bs-scrim').click() })
    await key('Escape')
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('goes with a long pull down, unless its body is scrolled', async () => {
    const pull = el => act(async () => {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }))
      el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 150 }))
      el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 260 }))
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 100, clientY: 260 }))
    })
    open(close => <Drawer close={close} />)
    q('.g-bs-body').scrollTop = 40
    await pull(q('.g-bs-body'))
    expect(useUI.getState().sheets).toHaveLength(1)
    q('.g-bs-body').scrollTop = 0
    await pull(q('.g-bs-head'))
    expect(useUI.getState().sheets).toHaveLength(0)
  })
})
