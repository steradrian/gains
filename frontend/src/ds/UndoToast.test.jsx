// @vitest-environment happy-dom
// UndoToast (boards T1.5, T1.6): a check, the message naming the day and meal, Undo, a bar draining
// over 8 s. Drawn alone, and as the app's one toast (components/Toast.jsx on useUI.toast), which
// owns its timing: Undo runs once, the toast goes after 8 s, and reduced motion only fades it.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Toast from '../components/Toast.jsx'
import { useUI } from '../store/useUI.js'
import { MS, setMotionDriver } from '../lib/motion.js'
import { fakeMotionDriver } from '../lib/motion.test-util.js'
import UndoToast from './UndoToast.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const q = s => view.host.querySelector(s)

describe('UndoToast, drawn', () => {
  it('says what it wrote, with a check, Undo and an 8 s bar', () => {
    const onUndo = vi.fn()
    view.render(<UndoToast message="Added Chicken rice bowl to Today, Lunch" onUndo={onUndo} />)
    expect(q('.g-utoast').getAttribute('role')).toBe('status')
    expect(q('.g-utoast-msg').textContent).toBe('Added Chicken rice bowl to Today, Lunch')
    expect(q('.g-utoast-ic')).not.toBeNull()
    expect(q('.g-utoast-drain').style.getPropertyValue('--dur')).toBe('8s')
    click(q('.g-utoast-undo'))
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(q('.g-utoast-undo').textContent).toBe('Undo')
  })

  it('names another action, as a link with an href', () => {
    view.render(<UndoToast message="Workout saved" actionLabel="Reopen" actionHref="#/train" icon="reset" />)
    const act = q('a.g-utoast-undo')
    expect(act.textContent).toBe('Reopen')
    expect(act.getAttribute('href')).toBe('#/train')
  })

  it('hides the button, the glyph and the bar when asked, and holds the bar when paused', () => {
    view.render(<UndoToast message="Saved" onUndo={false} icon={null} />)
    expect(q('.g-utoast-undo')).toBeNull()
    expect(q('.g-utoast-ic')).toBeNull()
    expect(q('.g-utoast-drain')).toBeNull()
    view.render(<UndoToast message="Saved" onUndo={() => {}} paused />)
    expect(q('.g-utoast-drain').classList.contains('g-utoast-paused')).toBe(true)
  })
})

describe('UndoToast as the app\'s toast', () => {
  let driver
  const toast = () => document.querySelector('#toast .g-utoast')
  beforeEach(() => {
    vi.useFakeTimers()
    useUI.setState({ toastMsg: '', toastAction: null, toastPaused: false })
    driver = fakeMotionDriver()
    setMotionDriver(driver)
    view.render(<Toast />)
  })
  afterEach(() => {
    setMotionDriver(null)
    delete document.documentElement.dataset.motion
    vi.clearAllTimers()
    vi.useRealTimers()
  })
  const finishAll = () => act(async () => { for (const anim of driver.calls) anim.finish() })

  it('runs Undo once and goes', async () => {
    const onAction = vi.fn()
    act(() => { useUI.getState().toast('Added 250 ml of water to Today', { action: 'Undo', onAction }) })
    expect(toast().querySelector('.g-utoast-drain').style.getPropertyValue('--dur')).toBe('8s')
    click(toast().querySelector('.g-utoast-undo'))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(useUI.getState().toastMsg).toBe('')
    expect(toast().hasAttribute('inert')).toBe(true)
    await finishAll()
    expect(toast()).toBeNull()
  })

  it('expires after 8 s without running Undo', async () => {
    const onAction = vi.fn()
    act(() => { useUI.getState().toast('Added Banana to Today, Snacks', { action: 'Undo', onAction }) })
    act(() => { vi.advanceTimersByTime(7999) })
    expect(toast().hasAttribute('inert')).toBe(false)
    act(() => { vi.advanceTimersByTime(2) })
    await finishAll()
    expect(toast()).toBeNull()
    expect(onAction).not.toHaveBeenCalled()
  })

  it('holds its bar while a finger rests on it', () => {
    act(() => { useUI.getState().toast('Removed Banana', { action: 'Undo', onAction: () => {} }) })
    act(() => { toast().dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    expect(toast().querySelector('.g-utoast-paused')).not.toBeNull()
  })

  it('only fades under reduced motion, and still expires on time', async () => {
    document.documentElement.dataset.motion = 'reduce'
    act(() => { useUI.getState().toast('Removed Banana', { action: 'Undo', onAction: () => {} }) })
    act(() => { vi.advanceTimersByTime(8001) })
    expect(driver.calls).toHaveLength(2)
    for (const anim of driver.calls) {
      expect(anim.keyframes.every(k => Object.keys(k).every(p => p === 'opacity'))).toBe(true)
      expect(anim.options.duration).toBe(MS.rm)
    }
    await finishAll()
    expect(toast()).toBeNull()
  })
})
