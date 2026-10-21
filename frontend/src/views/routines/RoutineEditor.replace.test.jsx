// @vitest-environment happy-dom
// Replace exercise in the routine editor (#110): the exercise's settings sheet offers Replace,
// the Replace drawer (T5.7) chooses the new exercise, and the slot keeps its place and its numbers.
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
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { EXIDX } from '../../lib/exercises.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const BENCH = '0025', DB_BENCH = '0289', ROW = '0027'
const benchSlot = { id: BENCH, sg: 'g1', sets: 4, mode: 'reps', reps: 6, weight: 80, prog: 'double', repsMin: 4, note: 'touch and go', restSec: 180 }
const rowSlot = { id: ROW, sg: 'g1', sets: 3, mode: 'reps', reps: 10, weight: 50 }
let root, host

function mount(workouts = [], routines = []) {
  const S = clone(DEF)
  S.routines = [{ id: 'r1', name: 'Push', emoji: 'dumbbell', ex: [clone(benchSlot), clone(rowSlot)] }, ...routines]
  S.workouts = workouts
  useStore.setState({ S, user: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter initialEntries={['/train/routines/r1']}><Routes><Route path="/train/routines/:id" element={<RoutineEdit />} /></Routes></MemoryRouter>))
}
const slots = () => useStore.getState().S.routines[0].ex
// Tap the first row, then Replace on its settings sheet: the onPick of the drawer it opens is
// returned. The drawer closes itself (and Search all's picker) before it calls onPick.
function openReplace() {
  act(() => host.querySelector('[data-routine-row] .g-rx-open').click())
  const onReplace = sheets.exConfigSheet.mock.calls[0][6]
  expect(onReplace).toBeTypeOf('function')
  act(() => onReplace())
  expect(sheets.replaceExerciseSheet).toHaveBeenCalledOnce()
  const [exId, onPick, opts] = sheets.replaceExerciseSheet.mock.calls[0]
  // #473: the drawer is told what it replaces, so it lists the same muscle; and the routine's name.
  expect(exId).toBe(BENCH)
  expect(opts).toEqual({ routine: 'Push' })
  return onPick
}

beforeEach(() => {
  localStorage.clear()
  Object.values(sheets).forEach(mock => mock.mockReset())
  useUI.setState({ toastMsg: '' })
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('RoutineEditor — Replace exercise', () => {
  it('the settings sheet gets Replace, Remove with its Undo line, and the superset row', () => {
    mount()
    act(() => host.querySelectorAll('[data-routine-row] .g-rx-open')[1].click())
    const [, existing, , onDelete, routine, , onReplace, , options] = sheets.exConfigSheet.mock.calls[0]
    expect(existing).toEqual(rowSlot)
    expect(onDelete).toBeTypeOf('function')
    expect(routine.id).toBe('r1')
    expect(onReplace).toBeTypeOf('function')
    expect(options).toMatchObject({ removeUndo: true, superset: true })
    expect(options.onSupersetChange).toBeTypeOf('function')
  })

  it('a row of the drawer swaps the exercise in place and keeps the slot\'s numbers', () => {
    mount()
    const onPick = openReplace()
    act(() => onPick(EXIDX[DB_BENCH], true))
    expect(slots()).toEqual([{ ...benchSlot, id: DB_BENCH }, rowSlot])
    expect(useUI.getState().toastMsg).toBe('Replaced with “Dumbbell Bench Press”')
  })

  it('a tapped picker row opens the new exercise\'s settings at the slot\'s numbers first', () => {
    mount()
    const onPick = openReplace()
    act(() => onPick(EXIDX[DB_BENCH], false))
    // No replace yet: the settings sheet for the new exercise is open, seeded with the slot.
    expect(slots()[0].id).toBe(BENCH)
    const [ex, seeded, onSave, onDelete, , , , saveLabel] = sheets.exConfigSheet.mock.calls[1]
    expect(ex.id).toBe(DB_BENCH)
    expect(seeded).toEqual({ ...benchSlot, id: DB_BENCH })
    expect(onDelete).toBeNull()
    // Saving there puts the exercise into the slot, and the button says so.
    expect(saveLabel).toBe('Replace')
    act(() => onSave({ sets: 3, mode: 'reps', reps: 8, weight: 30 }))
    // Saved as the sheet left it, in the same place and the same superset.
    expect(slots()[0]).toEqual({ id: DB_BENCH, sg: 'g1', sets: 3, mode: 'reps', reps: 8, weight: 30 })
    expect(slots()[1]).toEqual(rowSlot)
  })

  it('the exercise already in the slot changes nothing and says nothing', () => {
    mount()
    const onPick = openReplace()
    act(() => onPick(EXIDX[BENCH], true))
    expect(slots()).toEqual([benchSlot, rowSlot])
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('gives a replacement trained in another routine its own weight, not the old exercise\'s', () => {
    // The dumbbells were planned at 30 in the upper-body routine: the bench's 80 is not theirs.
    const upper = { id: 'r2', name: 'Upper', emoji: 'dumbbell', ex: [{ id: DB_BENCH, sets: 3, mode: 'reps', reps: 10, weight: 30 }] }
    const planned = { sets: 3, reps: 10, weight: 30 }
    const workout = {
      id: 'w1', d: '2026-09-01', start: 1, end: 2, name: 'Upper', routineIds: ['r2'],
      entries: [{ id: DB_BENCH, rid: 'r2', target: { sets: 3, mode: 'reps', reps: 10 }, planned, sets: [1, 2, 3].map(() => ({ w: 30, r: 10, done: true })) }],
    }
    mount([workout], [upper])
    const onPick = openReplace()
    act(() => onPick(EXIDX[DB_BENCH], true))
    expect(slots()[0]).toEqual({ ...benchSlot, id: DB_BENCH, weight: 30 })
  })

  it('seeds the new exercise\'s settings from the slot as it is now, not as the editor last drew it', () => {
    mount()
    const onPick = openReplace()
    // Another device raises the bench while the picker is open.
    act(() => useStore.getState().update(s => { s.routines[0].ex[0].sets = 5 }))
    act(() => onPick(EXIDX[DB_BENCH], false))
    expect(sheets.exConfigSheet.mock.calls[1][1]).toEqual({ ...benchSlot, id: DB_BENCH, sets: 5 })
  })

  it('leaves a slot alone that changed under the picker', () => {
    mount()
    const onPick = openReplace()
    // Another device's routine arrives while the picker is open: the rows moved.
    act(() => useStore.getState().update(s => { s.routines[0].ex.reverse() }))
    act(() => onPick(EXIDX[DB_BENCH], true))
    expect(slots().map(e => e.id)).toEqual([ROW, BENCH])
    expect(useUI.getState().toastMsg).toBe('')
  })
})
