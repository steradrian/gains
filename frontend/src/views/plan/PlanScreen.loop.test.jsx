// @vitest-environment happy-dom
// Swipe actions on the loop's editor (v1.3.11, moved from Plan.swipe.test.jsx with the Plan page):
// toward the start takes the routine out, with an Undo, and nothing on the other side. The Undo
// puts the loop, its round and its swept pins back, or, when the loop changed since, slots the
// routine back at its old place. A pass someone else wrote does not swipe; the grid never does.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { closeOpenRow } from '../../lib/use-swipe-row.js'
import { deleteRoutine } from '../../lib/routines.js'
import { chooseFixedWeek, saveRotation, scheduleModeOf } from '../../lib/rotation.js'
import PlanScreen from './PlanScreen.jsx'
import { takeOutOfLoop } from './plan-actions.js'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav, useLocation: () => ({ pathname: '/train/schedule' }) }))
vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../train/coach/use-coach-banner.js', () => ({ useCoachBanner: () => null }))
vi.mock('../../sheets.jsx', () => ({
  confirmSheet: vi.fn(), menuSheet: vi.fn(), dayOverrideSheet: vi.fn(), planToolsSheet: vi.fn(), starterPlanSheet: vi.fn(),
  workoutDetailSheet: vi.fn(), dayNoteSheet: vi.fn(), dayOptionsSheet: vi.fn(), startChooserSheet: vi.fn(), readyOrStart: vi.fn(),
  logPastWorkoutSheet: vi.fn(), importPlanFile: vi.fn(), planHasRoutines: () => true, exportPlanFile: vi.fn(), printWholePlan: vi.fn(),
  usePlanDayParam: vi.fn(),
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const routine = (id, name) => ({ id, name, emoji: null, ex: [{ id: '0025' }] })
let host, root, widthSpy

function mount(extra = {}) {
  const S = clone(DEF)
  Object.assign(S, {
    routines: [routine('a', 'Push A'), routine('b', 'Pull A'), routine('c', 'Legs')],
    week: { 1: ['a', 'b'], 3: ['b'], 5: ['c'] }, dayPlan: { '2099-01-01': 'b' },
  }, extra)
  useStore.setState({ S, user: null })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  act(() => root.render(<PlanScreen />))
}
const S = () => useStore.getState().S
const swrows = () => [...host.querySelectorAll('.swrow')]
const rowOf = name => swrows().find(r => r.querySelector('.g-glist-body b')?.textContent === name)
function pointer(target, type, x, y = 300) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y })
  act(() => { target.dispatchEvent(event) })
}
const click = target => act(() => { target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })) })
function swipe(target, x0, x1) {
  pointer(target, 'pointerdown', x0)
  pointer(target, 'pointermove', (x0 + x1) / 2)
  pointer(target, 'pointermove', x1)
  pointer(target, 'pointerup', x1)
  click(target)
  act(() => vi.advanceTimersByTime(800))
}
const undo = () => act(() => useUI.getState().runToastAction())
const edit = () => click([...host.querySelectorAll('.g-loop-act')].find(b => b.textContent === 'Edit'))

beforeEach(() => {
  vi.useFakeTimers()
  nav.mockClear()
  document.documentElement.dir = 'ltr'
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  // happy-dom lays nothing out: a phone's width, so the thresholds mean what they do there.
  widthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(360)
})
afterEach(() => {
  closeOpenRow(true)
  act(() => root.unmount()); host.remove()
  widthSpy.mockRestore()
  vi.clearAllTimers(); vi.useRealTimers()
})

describe('the loop', () => {
  const loop = { rotation: { id: 'rot', sequence: ['a', 'b', 'c'], label: 'My loop' },
    queue: { ids: ['a', 'b', 'c'], since: 1, startsOn: '2026-10-01', label: 'My loop', rotationId: 'rot' },
    scheduleMode: 'rotation', week: {}, dayPlan: { '2099-01-01': 'b' } }

  it('a swipe toward the start takes the routine out, and Undo puts the loop and its pin back', () => {
    mount(clone(loop))
    edit()
    expect(swrows()).toHaveLength(3)
    // remove-only: no copy pane, and a swipe toward the end does nothing
    expect(rowOf('Pull A').querySelector('.swpane.cp')).toBeNull()
    expect(rowOf('Pull A').querySelector('.swpane.del').textContent).toBe('Remove')
    swipe(rowOf('Pull A'), 60, 330)
    expect(S().queue.ids).toEqual(['a', 'b', 'c'])

    swipe(rowOf('Pull A'), 330, 60)
    expect(S().queue.ids).toEqual(['a', 'c'])
    expect(S().rotation.sequence).toEqual(['a', 'c'])
    expect(S().dayPlan).toEqual({})          // its future pin was swept with it
    expect(S().routines).toHaveLength(3)     // out of the loop, not deleted
    expect(useUI.getState().toastMsg).toBe('“Pull A” is out of the loop.')

    undo()
    expect(S().queue).toEqual(loop.queue)
    expect(S().rotation).toEqual(loop.rotation)
    expect(S().dayPlan).toEqual(loop.dayPlan)
  })

  it('Undo after the loop changed again slots the routine back at its old place', () => {
    mount(clone(loop))
    edit()
    swipe(rowOf('Pull A'), 330, 60)
    const pending = useUI.getState().toastAction
    act(() => useStore.getState().update(s => { s.queue = { ...s.queue, ids: ['c', 'a'] }; s.rotation = { ...s.rotation, sequence: ['c', 'a'] } }))
    act(() => pending.run())
    expect(S().queue.ids).toEqual(['c', 'b', 'a'])
    expect(S().rotation.sequence).toEqual(['c', 'b', 'a'])
  })

  // The store's update, the way the Plan page's editor saves (use-plan.js setSeq).
  const setSeq = ids => useStore.getState().update(s => {
    if (ids.length) saveRotation(s, ids, 'My loop')
    else { s.queue = null; s.rotation = { ...s.rotation, sequence: [] }; s.scheduleMode = 'rotation' }
  })

  it('Undo after switching to Fixed week puts the routine back in the saved loop and stays on Fixed week', () => {
    mount(clone(loop))
    act(() => { takeOutOfLoop('b', setSeq, ['a', 'b', 'c'], 'My loop') })
    const pending = useUI.getState().toastAction
    act(() => useStore.getState().update(s => { chooseFixedWeek(s) }))
    act(() => pending.run())
    expect(S().queue).toBeNull()
    expect(scheduleModeOf(S())).toBe('week')
    expect(S().rotation.sequence).toEqual(['a', 'b', 'c'])
  })

  it('the same after taking out the last routine, where the loop itself did not change', () => {
    mount({ ...clone(loop), rotation: { ...loop.rotation, sequence: ['a'] }, queue: { ...loop.queue, ids: ['a'] } })
    act(() => { takeOutOfLoop('a', setSeq, ['a'], 'My loop') })
    expect(S().queue).toBeNull()
    const pending = useUI.getState().toastAction
    act(() => useStore.getState().update(s => { chooseFixedWeek(s) }))
    act(() => pending.run())
    expect(S().queue).toBeNull()
    expect(scheduleModeOf(S())).toBe('week')
    expect(S().rotation.sequence).toEqual(['a'])
  })

  it('a coach’s queue written meanwhile is left alone by the Undo', () => {
    mount(clone(loop))
    act(() => { takeOutOfLoop('b', setSeq, ['a', 'b', 'c'], 'My loop') })
    const pending = useUI.getState().toastAction
    const coach = { ids: ['c', 'a'], since: 5, startsOn: '2026-10-02', label: 'Coach' }
    act(() => useStore.getState().update(s => { s.queue = clone(coach) }))
    act(() => pending.run())
    expect(S().queue).toEqual(coach)
    expect(S().rotation.sequence).toEqual(['a', 'b', 'c'])
  })

  it('Undo for a routine deleted meanwhile says it is too late', () => {
    mount(clone(loop))
    act(() => { takeOutOfLoop('b', setSeq, ['a', 'b', 'c'], 'My loop') })
    const pending = useUI.getState().toastAction
    act(() => useStore.getState().update(s => { deleteRoutine(s, 'b') }))
    act(() => pending.run())
    expect(S().queue.ids).toEqual(['a', 'c'])
    expect(useUI.getState().toastMsg).toBe('Too late, that one’s gone')
  })

  it('the editor\'s minus has the same Undo, and the grid\'s days never swipe', () => {
    mount({ ...clone(loop), week: { 1: ['c'], 2: ['a'] } })
    edit()
    click(host.querySelector('button[aria-label="Remove Legs"]'))
    expect(S().queue.ids).toEqual(['a', 'b'])
    undo()
    expect(S().queue.ids).toEqual(['a', 'b', 'c'])
    act(() => root.unmount()); host.remove()

    mount({ week: { 1: ['a'], 3: ['b'] } })   // a fixed week
    expect(host.querySelectorAll('.g-pcell').length).toBe(14)
    expect(swrows()).toHaveLength(0)
  })

  it('a coach’s own queue has no editor and does not swipe', () => {
    mount({ ...clone(loop), queue: { ...loop.queue, rotationId: 'someone-else' } })
    expect(host.querySelector('.g-loop-act')).toBeNull()
    expect(swrows()).toHaveLength(0)
  })
})
