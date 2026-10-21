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
