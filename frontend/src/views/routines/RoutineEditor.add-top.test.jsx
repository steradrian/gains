// @vitest-environment happy-dom
// Add exercise in the routine editor (board T5.0, T5.4; moved from RoutineEdit.add-top.test.jsx).
// The board puts Add exercise under the list (the old editor had it above, v1.3.11), and an empty
// routine leads with it. The picker takes several at once (owner question 7): they go in at the
// quick-add defaults, and the toast's Undo takes exactly those out.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../../sheets.jsx', () => ({
  exConfigSheet: vi.fn(), exercisePicker: vi.fn(), replaceExerciseSheet: vi.fn(), routineMenuSheet: vi.fn(), startFlow: vi.fn(), supersetSheet: vi.fn(),
  // What the Train helpers the editor reads (use-train.js) import.
  starterPlanSheet: vi.fn(), dayNoteSheet: vi.fn(), dayOptionsSheet: vi.fn(), dayOverrideSheet: vi.fn(), importPlanFile: vi.fn(), logPastWorkoutSheet: vi.fn(), startChooserSheet: vi.fn(),
}))
vi.mock('../../components/BodyMap.jsx', () => ({ default: () => null, useBodyPaths: () => null }))

import RoutineEdit from './RoutineEditor.jsx'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { exercisePicker } from '../../sheets.jsx'
import { EXIDX } from '../../lib/exercises.js'
import { exerciseNameText } from '../../lib/format.js'
import { defaultConfig } from '../../lib/history.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host

function mount(ex) {
  const S = JSON.parse(JSON.stringify(DEF))
  S.routines = [{ id: 'r1', name: 'Push day', emoji: 'dumbbell', ex }]
  useStore.setState({ S, user: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter initialEntries={['/train/routines/r1']}><Routes><Route path="/train/routines/:id" element={<RoutineEdit />} /></Routes></MemoryRouter>))
}
const buttonNamed = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const stored = () => useStore.getState().S.routines[0].ex
const bench = { id: '0025', sets: 3, mode: 'reps', reps: 5, weight: 80 }

beforeEach(() => { vi.clearAllMocks(); useUI.setState({ toastMsg: '', toastAction: null }) })
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('RoutineEditor — Add exercise', () => {
  it('sits under the list, the one Add exercise there is', () => {
    mount([bench, { ...bench, reps: 8 }])
    const add = buttonNamed('Add exercise')
    const rows = host.querySelectorAll('[data-routine-row]')
    expect(rows[rows.length - 1].compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect([...host.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Add exercise')).toHaveLength(1)
  })

  it('an empty routine says so and leads with Add exercises, and Start is off', () => {
    mount([])
    expect(host.textContent).toContain('Nothing in it yet')
    expect(host.textContent).toContain('Add exercises from the library. Sets, reps and weight come next.')
    act(() => buttonNamed('Add exercises').click())
    expect(exercisePicker).toHaveBeenCalledOnce()
    expect(buttonNamed('Start Push day').disabled).toBe(true)
  })

  it('opens the picker taking several, its button naming the count and the routine', () => {
    mount([bench])
    act(() => buttonNamed('Add exercise').click())
    const [, opts] = exercisePicker.mock.calls[0]
    expect(opts.routine).toBe('Push day')
    expect(opts.multi.label(1)).toBe('Add 1 exercise to Push day')
    expect(opts.multi.label(3)).toBe('Add 3 exercises to Push day')
  })

  it('adds every choice at the quick-add defaults, and Undo takes out exactly those', () => {
    mount([bench])
    act(() => buttonNamed('Add exercise').click())
    const { onAdd } = exercisePicker.mock.calls[0][1].multi
    act(() => onAdd([EXIDX['0289'], EXIDX['0027']]))
    expect(stored()).toEqual([bench, { id: '0289', ...defaultConfig('0289') }, { id: '0027', ...defaultConfig('0027') }])
    expect(useUI.getState().toastMsg).toBe('Added 2 exercises to Push day')
    // An edit to the routine in between stays.
    act(() => useStore.getState().update(s => { s.routines[0].ex[0].reps = 6 }))
    act(() => useUI.getState().runToastAction())
    expect(stored()).toEqual([{ ...bench, reps: 6 }])
  })

  it('one exercise is named in the toast', () => {
    mount([])
    act(() => buttonNamed('Add exercises').click())
    const { onAdd } = exercisePicker.mock.calls[0][1].multi
    act(() => onAdd([EXIDX['0025']]))
    expect(stored().map(e => e.id)).toEqual(['0025'])
    expect(useUI.getState().toastMsg).toBe(`Added ${exerciseNameText(EXIDX['0025'])} to Push day`)
    expect(useUI.getState().toastAction.label).toBe('Undo')
  })
})
