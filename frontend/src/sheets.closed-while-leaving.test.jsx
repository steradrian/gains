// @vitest-environment happy-dom
/* A sheet that does something when it goes away (writes what was typed, undoes a pick, tells the
 * flow it is done) does it the moment it is closed, not when its way out is over and it unmounts.
 * The page under a leaving sheet takes taps at once: on the onboarding Plan screen, "No plan for
 * now" tapped while the AI coach sheet was still going down was undone by that sheet's late
 * cleanup. And a backgrounded phone may never run the safety timer that ends the way out.
 *
 * The real Modals and the real sheets; the Web Animations API is the fake driver, which never
 * finishes on its own, so every sheet here is still in the page when it is checked. */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals, { scrollRestorePending } from './components/Modals.jsx'
import CoachSheet from './components/onboarding/CoachSheet.jsx'
import DaySheet from './components/onboarding/DaySheet.jsx'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { effortPickerSheet, workoutDetailSheet } from './sheets.jsx'
import { setMotionDriver } from './lib/motion.js'
import { fakeMotionDriver } from './lib/motion.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
const q = s => document.querySelector(s)
const open = fn => act(() => { fn() })
const backdrop = () => act(async () => { q('.mback').click() })
const escape = () => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
// React tracks a field's value through the prototype setter, so a bare el.value never reaches onChange.
const type = (el, value) => act(() => {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
const leaving = () => {
  const sheet = q('.sheet')
  expect(sheet).not.toBeNull()
  expect(sheet.parentElement.hasAttribute('data-leaving')).toBe(true)
}

beforeEach(async () => {
  document.body.innerHTML = '<div id="app"></div><nav id="tabbar"></nav><div id="root"></div>'
  useUI.setState({ sheets: [], toast: vi.fn() })
  const S = JSON.parse(JSON.stringify(DEF))
  Object.assign(S, { unit: 'kg', routines: [], workouts: [], active: null })
  useStore.setState({ S, user: null })
  setMotionDriver(fakeMotionDriver())
  root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(<Modals />) })
})
afterEach(async () => {
  setMotionDriver(null)
  await act(async () => { useUI.getState().closeAll(); root.unmount() })
  while (scrollRestorePending()) await act(async () => { await new Promise(r => setTimeout(r, 25)) })
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('what a sheet does on its way out happens when it is closed', () => {
  it('the effort picker logs a typed rating as it is dismissed', async () => {
    const onPick = vi.fn()
    open(() => effortPickerSheet('rir', null, onPick))
    type(q('.sheet input'), '3')
    expect(onPick).not.toHaveBeenCalled()
    await backdrop()
    leaving()
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith(3)
  })

  it('a workout\'s note is saved as its sheet is dismissed', async () => {
    const w = { id: 'w1', d: '2026-09-15', start: Date.UTC(2026, 8, 15, 17), end: Date.UTC(2026, 8, 15, 18), name: 'Push', vol: 0, prs: [], routineIds: [], entries: [] }
    useStore.setState(s => ({ S: { ...s.S, workouts: [w] } }))
    open(() => workoutDetailSheet(w))
    // T8.1 is the design system's drawer, in the same frame as every sheet
    type(q('.g-bs textarea'), 'Good day')
    await escape()
    expect(q('.g-bs').closest('[data-leaving]')).not.toBeNull()
    expect(useStore.getState().S.workouts[0].note).toBe('Good day')
  })

  it('the AI coach sheet undoes the pick as it is dismissed', async () => {
    const onDismiss = vi.fn()
    const consent = { reads: { one: 'Reads {0} day', other: 'Reads {0} days' }, where: 'Kept on your server' }
    open(() => useUI.getState().openSheet(close => (
      <CoachSheet consent={consent} days={3} experience={null} equipment="gym" onBuild={() => {}} onDismiss={onDismiss} close={close} />
    )))
    await backdrop()
    leaving()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('the Summary\'s day sheet tells the flow it is done as a pick closes it', async () => {
    const onDone = vi.fn()
    open(() => useUI.getState().openSheet(close => (
      <DaySheet value="sitting" onPick={() => {}} onDone={onDone} close={close} />
    )))
    await act(async () => { q('.sheet [role="radio"]').click() })
    leaving()
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
