// @vitest-environment happy-dom
// ConfirmDrawer (R5): the only confirm. Drawn alone it lists what goes with the danger button first
// and Cancel under it; opened with confirmDrawer() every way out but the danger button is a Cancel.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals, { scrollRestorePending } from '../components/Modals.jsx'
import { useUI } from '../store/useUI.js'
import { setMotionDriver } from '../lib/motion.js'
import { fakeMotionDriver } from '../lib/motion.test-util.js'
import { confirmDrawer } from '../views/settings/confirm-drawer.js'
import ConfirmDrawer from './ConfirmDrawer.jsx'
import { click, useView } from './render.test-util.js'

describe('ConfirmDrawer, drawn alone', () => {
  const view = useView()
  const q = s => view.host.querySelector(s)

  it('lists what goes, then the danger button, then Cancel', () => {
    const onConfirm = vi.fn(), onCancel = vi.fn()
    view.render(<ConfirmDrawer title="Remove this passkey?" body="No more sign-in with it." items={['Pixel 9', 'iPhone']} note="Others keep working."
      confirmLabel="Remove passkey" onConfirm={onConfirm} onCancel={onCancel} />)
    expect([...view.host.querySelectorAll('.g-confirm li')].map(li => li.textContent)).toEqual(['Pixel 9', 'iPhone'])
    const buttons = [...view.host.querySelectorAll('.g-confirm > button')]
    expect(buttons.map(b => b.textContent)).toEqual(['Remove passkey', 'Cancel'])
    expect(buttons[0].classList.contains('g-confirm-danger')).toBe(true)
    click(buttons[0])
    expect(onConfirm).toHaveBeenCalledTimes(1)
    click(buttons[1])
    click(q('.g-bs-x'))
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('has no list or note when it is given none', () => {
    view.render(<ConfirmDrawer title="Start over?" confirmLabel="Start over" onConfirm={() => {}} onCancel={() => {}} />)
    expect(q('.g-confirm ul')).toBeNull()
    expect(q('.g-confirm-note')).toBeNull()
  })

  it('haptic marks the danger button for a tick and still confirms; a link never gets one', () => {
    const onConfirm = vi.fn()
    view.render(<ConfirmDrawer title="Remove Mara?" confirmLabel="Remove Mara" haptic onConfirm={onConfirm} onCancel={() => {}} />)
    expect(q('.g-confirm-danger').classList.contains('g-haptic')).toBe(true)
    click(q('.g-confirm-danger'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    view.render(<ConfirmDrawer title="Go" confirmLabel="Go" haptic confirmHref="#/x" onCancel={() => {}} />)
    expect(q('.g-confirm-danger').classList.contains('g-haptic')).toBe(false)
  })
})

describe('confirmDrawer()', () => {
  let root, driver
  const q = s => document.querySelector(s)
  const key = k => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })) })
  const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) }) }
  const finishAll = () => act(async () => { for (const anim of driver.running()) anim.finish() })
  const open = (extra = {}) => {
    const onConfirm = vi.fn(), onCancel = vi.fn()
    act(() => { confirmDrawer({ title: 'Sign out everywhere?', confirmLabel: 'Sign out everywhere', onConfirm, onCancel, ...extra }) })
    return { onConfirm, onCancel }
  }

  beforeEach(async () => {
    document.body.innerHTML = '<div id="root"></div>'
    useUI.setState({ sheets: [] })
    driver = fakeMotionDriver()
    setMotionDriver(driver)
    root = createRoot(document.getElementById('root'))
    await act(async () => { root.render(<Modals />) })
  })
  afterEach(async () => {
    setMotionDriver(null)
    await act(async () => { useUI.getState().closeAll(); root.unmount() })
    await settle()
    while (scrollRestorePending()) await act(async () => { await new Promise(r => setTimeout(r, 25)) })
    document.body.innerHTML = ''
  })

  it('confirm closes the drawer and runs onConfirm once, not onCancel', async () => {
    const { onConfirm, onCancel } = open()
    await act(async () => { q('.g-confirm-danger').click() })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('the Cancel button and the × run onCancel once each', async () => {
    for (const pick of ['.g-btn-secondary', '.g-bs-x']) {
      const { onConfirm, onCancel } = open()
      await act(async () => { q(pick).click() })
      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(onConfirm).not.toHaveBeenCalled()
      expect(useUI.getState().sheets).toHaveLength(0)
      await finishAll()
    }
  })

  it('the scrim and Escape are a Cancel too', async () => {
    for (const how of [() => act(async () => { q('.g-bs-scrim').click() }), () => key('Escape')]) {
      const { onConfirm, onCancel } = open()
      await how()
      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(onConfirm).not.toHaveBeenCalled()
      expect(useUI.getState().sheets).toHaveLength(0)
      await finishAll()
    }
  })
})

// Without a title it is only the content of a drawer that asks first (the workout's discard).
describe('ConfirmDrawer, content only', () => {
  const view = useView()
  const buttons = () => [...view.host.querySelectorAll('.g-btn')]

  it('shows the body, what goes, the note, then the danger button and the way back, in that order', () => {
    view.render(<ConfirmDrawer body="Push A closes and these go:" items={['14 logged sets, warm-up included', '24:18 on the clock']}
      note="You can still undo for 8 s on Today." confirmLabel="Discard workout" cancelLabel="Keep going" />)
    const root = view.host.firstElementChild
    expect(root.classList.contains('g-confirm')).toBe(true)
    expect([...root.children].map(c => c.tagName)).toEqual(['P', 'UL', 'P', 'BUTTON', 'BUTTON'])
    expect(root.querySelector('p').textContent).toBe('Push A closes and these go:')
    expect([...root.querySelectorAll('li')].map(li => li.textContent)).toEqual(['14 logged sets, warm-up included', '24:18 on the clock'])
    expect(root.querySelector('.g-confirm-note').textContent).toBe('You can still undo for 8 s on Today.')
    expect(buttons().map(b => b.textContent)).toEqual(['Discard workout', 'Keep going'])
  })

  it('the confirm button is the danger one and the cancel is the plain one', () => {
    view.render(<ConfirmDrawer confirmLabel="Discard workout" cancelLabel="Keep going" />)
    expect(buttons()[0].classList.contains('g-confirm-danger')).toBe(true)
    expect(buttons()[1].classList.contains('g-btn-secondary')).toBe(true)
    expect(buttons()[1].classList.contains('g-btn-block')).toBe(true)
  })

  it('calls onConfirm and onCancel', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    view.render(<ConfirmDrawer confirmLabel="Discard" onConfirm={onConfirm} cancelLabel="Keep going" onCancel={onCancel} />)
    click(buttons()[0])
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
    click(buttons()[1])
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('is a link for each button that has an href', () => {
    view.render(<ConfirmDrawer confirmLabel="Discard" confirmHref="#/discard" cancelLabel="Keep going" cancelHref="#/back" />)
    expect(buttons().map(b => b.tagName)).toEqual(['A', 'A'])
    expect(buttons().map(b => b.getAttribute('href'))).toEqual(['#/discard', '#/back'])
  })

  it('draws a warning triangle on the danger button unless told another icon, and leaves out what it has no words for', () => {
    view.render(<ConfirmDrawer confirmLabel="Discard" cancelLabel="Keep going" />)
    expect(buttons()[0].querySelector('svg').getAttribute('data-icon')).toBe('warning')
    expect(view.host.querySelector('ul')).toBeNull()
    expect(view.host.querySelector('p')).toBeNull()
    view.render(<ConfirmDrawer confirmLabel="Delete" icon="xmark" cancelLabel="Cancel" />)
    expect(buttons()[0].querySelector('svg').getAttribute('data-icon')).toBe('xmark')
  })
})
