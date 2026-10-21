// @vitest-environment happy-dom
// Swipe actions on the Routines page (v1.3.11, kept on T4.0): toward the start deletes with an
// Undo (no confirm, T4.3's toast), toward the end duplicates. The rows stay keyboard buttons.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { closeOpenRow } from '../../lib/use-swipe-row.js'
import { restoreRoutine, routineSnapshot, deleteRoutine } from '../../lib/routines.js'
import { deleteRoutineWithUndo } from './routine-actions.js'
import RoutinesScreen from './RoutinesScreen.jsx'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav, useLocation: () => ({ pathname: '/train/routines', state: null }) }))
vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), startFlow: vi.fn(), dayNoteSheet: vi.fn(), dayOptionsSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  importPlanFile: vi.fn(), logPastWorkoutSheet: vi.fn(), startChooserSheet: vi.fn(),
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
  act(() => root.render(<RoutinesScreen />))
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

describe('the routines list', () => {
  it('rows stay keyboard buttons that open the routine, with both panes out of reach while shut', () => {
    mount()
    expect(swrows()).toHaveLength(3)
    const r = rowOf('Pull A').querySelector('.g-rt-row')
    expect(r.tagName).toBe('BUTTON')
    expect(r.tabIndex).toBe(0)
    click(r)
    expect(nav).toHaveBeenLastCalledWith('/train/routines/b')
    click(rowOf('Push A').querySelector('.g-rt-row'))
    expect(nav).toHaveBeenLastCalledWith('/train/routines/a')
    const panes = rowOf('Push A').querySelectorAll('.swpane')
    expect(panes).toHaveLength(2)
    for (const pane of panes) {
      expect(pane.getAttribute('aria-hidden')).toBe('true')
      expect(pane.hasAttribute('inert')).toBe(true)
      expect(pane.querySelector('button').tabIndex).toBe(-1)
    }
    expect(rowOf('Push A').querySelector('.swpane.cp').textContent).toBe('Duplicate')
  })

  it('a long swipe toward the start deletes without a confirm, says which days are now rest, and Undo puts everything back', () => {
    mount()
    const before = clone(S())
    swipe(rowOf('Pull A'), 330, 60)
    expect(S().routines.map(r => r.id)).toEqual(['a', 'c'])
    expect(S().week).toEqual({ 1: ['a'], 5: ['c'] })
    expect(S().dayPlan).toEqual({})
    // Monday keeps Push A, so only Wednesday became a rest day; the dated reschedule is counted.
    expect(useUI.getState().toastMsg).toBe('Deleted Pull A. Wed is now a rest day and 1 planned date is cleared')
    expect(nav).not.toHaveBeenCalled()

    undo()
    // the same routines in the same order, the one put back without an edit time it never had
    // (stamped "now", it beat a rename an older app made offline before the swipe)
    expect(S().routines).toEqual(before.routines)
    expect(S().week).toEqual(before.week)
    expect(S().dayPlan).toEqual(before.dayPlan)
    expect(rowOf('Pull A')).toBeTruthy()
  })

  it('a long swipe toward the end duplicates right below, and stays on the list', () => {
    mount()
    swipe(rowOf('Push A'), 100, 330)
    expect(S().routines.map(r => r.name)).toEqual(['Push A', 'Push A (Copy)', 'Pull A', 'Legs'])
    const copy = S().routines[1]
    expect(copy.id).not.toBe('a')
    expect(copy.ex).toEqual(S().routines[0].ex)
    expect(S().week).toEqual({ 1: ['a', 'b'], 3: ['b'], 5: ['c'] })   // a copy is not planned anywhere
    expect(useUI.getState().toastMsg).toBe('Copied as “Push A (Copy)”.')
    expect(nav).not.toHaveBeenCalled()
    // planned nowhere, so it lands in "Not in your Plan"
    expect(rowOf('Push A (Copy)')).toBeTruthy()
  })

  it('the duplicate’s toast has its own Undo, which takes the copy away again', () => {
    mount()
    swipe(rowOf('Push A'), 100, 330)
    expect(S().routines).toHaveLength(4)
    expect(useUI.getState().toastAction).toBeTruthy()
    undo()
    expect(S().routines.map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('an Undo that finds the routine already back says so instead of nothing', () => {
    mount()
    act(() => { deleteRoutineWithUndo('b') })
    const pending = useUI.getState().toastAction
    act(() => useStore.getState().update(s => { s.routines.splice(1, 0, routine('b', 'Pull A')) }))   // a sync brought it back
    act(() => pending.run())
    expect(S().routines.map(r => r.id)).toEqual(['a', 'b', 'c'])
    expect(useUI.getState().toastMsg).toBe('It’s already back.')
  })

  it('is a plain list with the setting off', () => {
    mount({ wc: { ...DEF.wc, swipeSets: false } })
    expect(swrows()).toHaveLength(0)
    expect(host.querySelectorAll('.g-rt-row')).toHaveLength(4)   // three routines and Freestyle
  })
})

describe('restoreRoutine', () => {
  const base = () => ({
    routines: [routine('a', 'A'), routine('b', 'B'), routine('c', 'C')],
    week: { 1: ['a', 'b'], 3: 'b' }, dayPlan: { '2099-01-01': 'b', '2099-01-02': 'a' },
    rotation: { id: 'r', sequence: ['b', 'c'] }, queue: { ids: ['c', 'b'] },
  })

  it('puts back what deleteRoutine took, at the same places', () => {
    const s = base()
    const snap = routineSnapshot(s, 'b')
    deleteRoutine(s, 'b')
    s.rotation.sequence = ['c']; s.queue.ids = ['c']           // a save in between dropped it too
    expect(restoreRoutine(s, snap)).toBe(true)
    expect(s.routines.map(r => r.id)).toEqual(['a', 'b', 'c'])
    expect(s.week).toEqual({ 1: ['a', 'b'], 3: ['b'] })
    expect(s.dayPlan).toEqual(base().dayPlan)
    expect(s.rotation.sequence).toEqual(['b', 'c'])
    expect(s.queue.ids).toEqual(['c', 'b'])
  })

  it('fits into lists that got shorter, keeps a date planned since, and never doubles a routine', () => {
    const s = base()
    const snap = routineSnapshot(s, 'b')
    deleteRoutine(s, 'b')
    s.routines = [s.routines[1]]          // A deleted meanwhile
    delete s.week[1]
    s.dayPlan['2099-01-01'] = 'c'
    expect(restoreRoutine(s, snap)).toBe(true)
    expect(s.routines.map(r => r.id)).toEqual(['c', 'b'])
    expect(s.week[1]).toEqual(['b'])
    expect(s.dayPlan['2099-01-01']).toBe('c')
    expect(restoreRoutine(s, snap)).toBe(false)
    expect(s.routines.map(r => r.id)).toEqual(['c', 'b'])
  })
})
