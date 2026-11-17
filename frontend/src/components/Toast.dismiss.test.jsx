// @vitest-environment happy-dom
// Every toast can be put away by hand: a tap on its body, a swipe down (the way it came in from),
// Escape. Its action button still runs the action. For an Undo toast, putting it away is the timer's
// own ending (the Undo is not taken, onClose runs) and happens once, however the timer and the hand
// race.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUI } from '../store/useUI.js'
import { setMotionDriver } from '../lib/motion.js'
import { fakeMotionDriver } from '../lib/motion.test-util.js'
import BarToast from '../ds/BarToast.jsx'
import { click, useView } from '../ds/render.test-util.js'
import { Presence } from './presence.jsx'
import Toast from './Toast.jsx'

const view = useView()
const toast = () => document.querySelector('#toast .g-utoast')
const msgEl = () => toast().querySelector('.g-utoast-msg')
const fire = (el, type, y = 0) => act(() => {
  el.dispatchEvent(new (globalThis.PointerEvent ?? MouseEvent)(type, { bubbles: true, clientY: y, pointerId: 1 }))
})
const swipe = (el, to) => { fire(el, 'pointerdown', 100); fire(el, 'pointermove', 100 + to / 2); fire(el, 'pointermove', 100 + to); fire(el, 'pointerup', 100 + to) }
const show = (msg, opts) => act(() => { useUI.getState().toast(msg, opts) })

let driver
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

describe('the app toast, put away by hand', () => {
  it('names a hidden close button for a screen reader', () => {
    show('Saved')
    const x = toast().querySelector('.g-utoast-x')
    expect(x.tagName).toBe('BUTTON')
    expect(x.textContent).toBe('Dismiss')
  })

  // What is left once the way out is over: the toast's own timer must not be.
  const settle = async () => { await act(async () => { for (const anim of driver.calls) anim.finish() }) }

  it('goes on a tap on its body, text alone included, and clears its timer', async () => {
    show('Saved')
    expect(vi.getTimerCount()).toBe(1)
    click(msgEl())
    expect(useUI.getState().toastMsg).toBe('')
    expect(toast().hasAttribute('inert')).toBe(true)
    await settle()
    expect(toast()).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('goes on a swipe down, and a short drag lets it settle back', async () => {
    show('Saved')
    swipe(toast(), 20)
    expect(useUI.getState().toastMsg).toBe('Saved')
    expect(toast().style.transform).toBe('')
    swipe(toast(), 80)
    expect(useUI.getState().toastMsg).toBe('')
    await settle()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not slide under the finger when the app keeps still, but still goes', () => {
    document.documentElement.dataset.motion = 'reduce'
    show('Saved')
    fire(toast(), 'pointerdown', 100)
    fire(toast(), 'pointermove', 160)
    expect(toast().style.transform).toBe('')
    fire(toast(), 'pointerup', 160)
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('goes on Escape from inside it', () => {
    show('Saved')
    act(() => { toast().querySelector('.g-utoast-x').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('a tap on the action runs the action and not a dismissal; dismissing never runs it', () => {
    const onAction = vi.fn()
    const onClose = vi.fn()
    show('Removed Banana', { action: 'Undo', onAction, onClose })
    click(toast().querySelector('.g-utoast-undo'))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)

    show('Removed Apple', { action: 'Undo', onAction, onClose })
    click(msgEl())
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('a swipe that began on an older toast leaves the newer one alone', () => {
    show('One')
    fire(toast(), 'pointerdown', 100)
    show('Two')
    fire(toast(), 'pointermove', 180)
    fire(toast(), 'pointerup', 180)
    expect(useUI.getState().toastMsg).toBe('Two')
  })

  it('commits once when the timer lands in the middle of a swipe', () => {
    const onAction = vi.fn()
    const onClose = vi.fn()
    show('Removed Banana', { action: 'Undo', onAction, onClose })
    fire(toast(), 'pointerdown', 100)
    fire(toast(), 'pointermove', 140)
    // A mouse that left the toast lets the timer run again while the drag goes on.
    act(() => { useUI.getState().resumeToast() })
    act(() => { vi.advanceTimersByTime(8001) })
    expect(onClose).toHaveBeenCalledTimes(1)
    fire(toast(), 'pointermove', 200)
    fire(toast(), 'pointerup', 200)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAction).not.toHaveBeenCalled()
  })

  it('commits once when the swipe finishes first and the timer would have fired after', () => {
    const onAction = vi.fn()
    const onClose = vi.fn()
    show('Removed Banana', { action: 'Undo', onAction, onClose })
    swipe(toast(), 80)
    act(() => { useUI.getState().dismissToast(); vi.advanceTimersByTime(20000) })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAction).not.toHaveBeenCalled()
  })

  it('commits once when a tap and the timer race', () => {
    const onClose = vi.fn()
    show('Removed Banana', { action: 'Undo', onAction: vi.fn(), onClose })
    act(() => { vi.advanceTimersByTime(8001) })
    act(() => { useUI.getState().dismissToast(useUI.getState().toastId) })
    click(msgEl())
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('BarToast, put away by hand', () => {
  const bar = () => view.host.querySelector('.g-btoast')
  const mount = onDismiss => view.render(
    <Presence>
      <BarToast key="t" message="Warm-up done" actionLabel="Back" onAction={() => {}} dismissLabel="Dismiss" onDismiss={onDismiss} />
    </Presence>,
  )

  it('asks to go on a tap, a swipe down and Escape, and not on its action', () => {
    const onDismiss = vi.fn()
    mount(onDismiss)
    click(bar().querySelector('.g-btoast-a'))
    expect(onDismiss).not.toHaveBeenCalled()
    click(bar().querySelector('.g-btoast-m'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    swipe(bar(), 80)
    expect(onDismiss).toHaveBeenCalledTimes(2)
    act(() => { bar().querySelector('.g-btoast-x').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(onDismiss).toHaveBeenCalledTimes(3)
    expect(bar().querySelector('.g-btoast-x').textContent).toBe('Dismiss')
  })

  it('has no close button and no gestures without onDismiss', () => {
    view.render(<BarToast message="Next: Dumbbell press" dismissLabel="Dismiss" />)
    expect(bar().querySelector('.g-btoast-x')).toBeNull()
  })

  it('leaves through the kit when the caller takes it out', async () => {
    mount(() => {})
    view.render(<Presence>{null}</Presence>)
    expect(bar().hasAttribute('inert')).toBe(true)
    await act(async () => { for (const anim of driver.calls) anim.finish() })
    expect(bar()).toBeNull()
  })
})
