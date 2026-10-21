// @vitest-environment happy-dom
// The drag handle (#277, #114), now in the editor's Reorder mode: a grip with a grab cursor, and a
// mouse press on it picks the row up at once. The long press everywhere else is unchanged.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sheets = vi.hoisted(() => ({
  exConfigSheet: vi.fn(), exercisePicker: vi.fn(), replaceExerciseSheet: vi.fn(), routineMenuSheet: vi.fn(), startFlow: vi.fn(), supersetSheet: vi.fn(),
  // What the Train helpers the editor reads (use-train.js) import.
  starterPlanSheet: vi.fn(), dayNoteSheet: vi.fn(), dayOptionsSheet: vi.fn(), dayOverrideSheet: vi.fn(), importPlanFile: vi.fn(), logPastWorkoutSheet: vi.fn(), startChooserSheet: vi.fn(),
}))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../../sheets.jsx', () => sheets)
vi.mock('../../components/BodyMap.jsx', () => ({ default: () => null, useBodyPaths: () => null }))

import RoutineEdit from './RoutineEditor.jsx'
import { ROUTINE_LONG_PRESS_MS } from './routine-reorder.js'
import { DEF, useStore } from '../../store/useStore.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const configured = (id, extra = {}) => ({ id, mode: 'reps', sets: 3, reps: 5, weight: 0, ...extra })
let root
let host

function stateFor(entries) {
  const S = clone(DEF)
  S.routines = [{ id: 'r1', name: 'Drag routine', emoji: 'dumbbell', prog: 'linear', ex: entries }]
  return S
}
function rect(top, height, left = 20, width = 340) {
  return { x: left, y: top, left, right: left + width, top, bottom: top + height, width, height }
}
const rows = () => [...host.querySelectorAll('[data-routine-row]')]
function geometry(heights = rows().map(() => 70)) {
  const list = host.querySelector('.g-re-list')
  let top = 100
  const tops = [], bottoms = [], centers = []
  rows().forEach((row, i) => {
    const height = heights[i] ?? 70
    tops.push(top); bottoms.push(top + height); centers.push(top + height / 2)
    vi.spyOn(row, 'getBoundingClientRect').mockImplementation(() => rect(tops[i], height))
    top += height + 10
  })
  const listRect = rect(80, top - 80)
  vi.spyOn(list, 'getBoundingClientRect').mockImplementation(() => listRect)
  return { list, tops, bottoms, centers, listRect }
}
// The grips are Reorder mode's: `ordering` false leaves the list as it opens.
function mount(entries, ordering = true) {
  useStore.setState({ S: stateFor(entries), user: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter initialEntries={['/train/routines/r1']}><Routes><Route path="/train/routines/:id" element={<RoutineEdit />} /></Routes></MemoryRouter>))
  if (ordering) act(() => [...host.querySelectorAll('.g-ssec-act')].find(b => b.textContent === 'Reorder').click())
  return geometry()
}
function pointer(target, type, { id = 7, kind = 'touch', primary = true, button = 0, x = 120, y = 120 } = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  for (const [key, value] of Object.entries({ pointerId: id, pointerType: kind, isPrimary: primary, button, clientX: x, clientY: y })) {
    Object.defineProperty(event, key, { configurable: true, value })
  }
  act(() => target.dispatchEvent(event))
  return event
}
const exercises = () => useStore.getState().S.routines[0].ex

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => window.setTimeout(() => cb(Date.now()), 16))
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => window.clearTimeout(id))
  localStorage.clear()
  Object.values(sheets).forEach(mock => mock.mockReset())
  root = null; host = null
})
afterEach(() => {
  if (root) act(() => root.unmount())
  host?.remove()
  vi.clearAllTimers(); vi.restoreAllMocks(); vi.useRealTimers()
})

const grip = i => rows()[i].querySelector('[data-drag-handle]')
const cssSource = readFileSync(resolve(process.cwd(), 'src/ds/ds.css'), 'utf8')

describe('routine drag handle', () => {
  it('puts a grip on every row in Reorder mode, out of the accessibility tree, named for what it does', () => {
    mount([configured('1001'), configured('1002')])
    expect(rows().map(row => !!row.querySelector('.g-rx [data-drag-handle] svg'))).toEqual([true, true])
    expect(grip(0).getAttribute('aria-hidden')).toBe('true')
    expect(grip(0).getAttribute('title')).toBe('Reorder exercises')
  })

  it('shows no grip until Reorder, and Done puts them away again', () => {
    mount([configured('1001'), configured('1002')], false)
    expect(host.querySelector('[data-drag-handle]')).toBeNull()
    act(() => [...host.querySelectorAll('.g-ssec-act')].find(b => b.textContent === 'Reorder').click())
    expect(host.querySelectorAll('[data-drag-handle]')).toHaveLength(2)
    act(() => [...host.querySelectorAll('.g-ssec-act')].find(b => b.textContent === 'Done').click())
    expect(host.querySelector('[data-drag-handle]')).toBeNull()
  })

  it('gives the grip a grab cursor, and the whole list a grabbing one while a row is held', () => {
    const base = cssSource.match(/\.g-rx-handle \{[^}]*\}/)?.[0] || ''
    expect(base).toMatch(/cursor: grab/)
    expect(cssSource).toMatch(/\.g-re-list\.is-reordering, \.g-re-list\.is-reordering \* \{ cursor: grabbing; \}/)
  })

  it('keeps the list one column on a computer: the editor\'s list is never a grid', () => {
    // The reorder reads rows top to bottom; in two columns a drop landed in the wrong place.
    expect(cssSource).not.toMatch(/\.g-re-list[^{]*\{[^}]*display: grid/)
  })

  it('picks the row up at once under a mouse and drops it where it is let go', () => {
    const layout = mount([configured('a'), configured('b'), configured('c'), configured('d')])
    const down = pointer(grip(0), 'pointerdown', { kind: 'mouse', y: layout.centers[0] })
    // No hold: lifted on the press itself, and the press does not go on to select text.
    expect(rows()[0].classList.contains('is-dragging')).toBe(true)
    expect(down.defaultPrevented).toBe(true)
    pointer(grip(0), 'pointermove', { kind: 'mouse', y: layout.centers[2] + 1 })
    pointer(grip(0), 'pointerup', { kind: 'mouse', y: layout.centers[2] + 1 })
    expect(exercises().map(e => e.id)).toEqual(['b', 'c', 'a', 'd'])
    // The click that follows the drop does not open the exercise's settings.
    act(() => grip(2).click())
    expect(sheets.exConfigSheet).not.toHaveBeenCalled()
  })

  it('leaves a click on the grip without a move as nothing at all', () => {
    const layout = mount([configured('a'), configured('b')])
    pointer(grip(1), 'pointerdown', { kind: 'mouse', y: layout.centers[1] })
    pointer(grip(1), 'pointerup', { kind: 'mouse', y: layout.centers[1] })
    act(() => grip(1).click())
    expect(exercises().map(e => e.id)).toEqual(['a', 'b'])
    expect(sheets.exConfigSheet).not.toHaveBeenCalled()
  })

  it('keeps the long press for a mouse on the rest of the row, and for a finger on the grip', () => {
    const layout = mount([configured('a'), configured('b')])
    const item = rows()[0].querySelector('.g-rx-open')
    pointer(item, 'pointerdown', { kind: 'mouse', y: layout.centers[0] })
    expect(rows()[0].classList.contains('is-dragging')).toBe(false)
    act(() => vi.advanceTimersByTime(ROUTINE_LONG_PRESS_MS))
    expect(rows()[0].classList.contains('is-dragging')).toBe(true)
    pointer(item, 'pointercancel', { kind: 'mouse', y: layout.centers[0] })

    act(() => vi.advanceTimersByTime(200))
    const touch = pointer(grip(1), 'pointerdown', { kind: 'touch', y: layout.centers[1] })
    expect(touch.defaultPrevented).toBe(false)
    expect(rows()[1].classList.contains('is-dragging')).toBe(false)
    act(() => vi.advanceTimersByTime(ROUTINE_LONG_PRESS_MS))
    expect(rows()[1].classList.contains('is-dragging')).toBe(true)
  })

  it('ignores a right-click on the grip', () => {
    const layout = mount([configured('a'), configured('b')])
    pointer(grip(0), 'pointerdown', { kind: 'mouse', button: 2, y: layout.centers[0] })
    expect(rows()[0].classList.contains('is-dragging')).toBe(false)
  })
})
