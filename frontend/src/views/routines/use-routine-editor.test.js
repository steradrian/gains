// @vitest-environment happy-dom
// The routine editor's data and intents (board T5.0): the header lines, the rows' progression line,
// the save state, multi-add with its Undo (T5.4), the superset toggle, and the new state (T5.6).
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../../sheets.jsx', () => ({
  exConfigSheet: vi.fn(), exercisePicker: vi.fn(), replaceExerciseSheet: vi.fn(), routineMenuSheet: vi.fn(), startFlow: vi.fn(), supersetSheet: vi.fn(),
  // What the Train helpers the editor reads (use-train.js) import.
  starterPlanSheet: vi.fn(), dayNoteSheet: vi.fn(), dayOptionsSheet: vi.fn(), dayOverrideSheet: vi.fn(), importPlanFile: vi.fn(), logPastWorkoutSheet: vi.fn(), startChooserSheet: vi.fn(),
}))
vi.mock('../../components/BodyMap.jsx', () => ({ default: () => null, useBodyPaths: () => null }))

import RoutineEditor from './RoutineEditor.jsx'
import { editorOf, linkToAbove, planLineOf, progressionLine, removeAdded, saveStateOf, statsLineOf } from './use-routine-editor.js'
import { DEF, useStore } from '../../store/useStore.js'
import { exConfigSheet, replaceExerciseSheet, routineMenuSheet, startFlow } from '../../sheets.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const lift = (id, extra = {}) => ({ id, mode: 'reps', sets: 3, reps: 8, weight: 60, ...extra })
const state = (over = {}) => ({ ...JSON.parse(JSON.stringify(DEF)), ...over })

describe('the header lines', () => {
  it('says where the routine is in the Plan, with the same days as its row on Routines', () => {
    const S = state({ weekStart: 0, routines: [{ id: 'r1', name: 'Push A', ex: [] }, { id: 'r2', name: 'Arms', ex: [] }], week: { 0: ['r1'], 4: ['r1'] }, scheduleMode: 'week' })
    expect(planLineOf(S, 'r1')).toBe('In your Plan · Sun, Thu')
    expect(planLineOf(S, 'r2')).toBe('Not in your Plan')
  })

  it('counts exercises and sets, and says "about" only from the routine\'s own past workouts', () => {
    const r = { id: 'r1', name: 'Push A', ex: [lift('0025', { sets: 4 }), lift('0027')] }
    expect(statsLineOf(state({ routines: [r] }), r)).toBe('2 exercises · 7 sets')
    const done = { id: 'w1', d: '2026-10-01', start: 1000, end: 1000 + 55 * 60000, name: 'Push A', routineIds: ['r1'], entries: [], prs: [] }
    expect(statsLineOf(state({ routines: [r], workouts: [done] }), r)).toMatch(/^2 exercises · 7 sets · about \S/)
    expect(statsLineOf(state(), { id: 'r9', ex: [] })).toBe('0 exercises')
  })
})

describe('the progression line', () => {
  it('names the step and the reps for a rule that adds load', () => {
    expect(progressionLine(lift('0025', { inc: 2.5 }), { prog: 'linear' }, 'kg')).toBe('Up 2.5 kg when every set hits 8')
    expect(progressionLine(lift('0025', { inc: 2.5, prog: 'double', repsMin: 6 }), {}, 'kg')).toBe('Up 2.5 kg when every set hits 8')
  })

  it('is left out when nothing moves the exercise: no rule, a pyramid, a deload routine', () => {
    expect(progressionLine(lift('0025', { prog: 'off' }), {}, 'kg')).toBeNull()
    expect(progressionLine(lift('0025'), { prog: 'off' }, 'kg')).toBeNull()
    expect(progressionLine(lift('0025', { pyramid: [12, 10, 8] }), {}, 'kg')).toBeNull()
    expect(progressionLine(lift('0025'), { excludeFromProgression: true }, 'kg')).toBeNull()
  })

  it('says the rule\'s name where there is no load to add', () => {
    expect(progressionLine(lift('0025', { weight: 0 }), {}, 'kg')).toBe('Linear progression')
  })
})

describe('the save state', () => {
  it('comes from the store\'s sync status', () => {
    expect(saveStateOf({ status: 'ok' })).toBe('saved')
    expect(saveStateOf({ status: 'local' })).toBe('saved')
    expect(saveStateOf({ status: 'pending' })).toBe('syncing')
    expect(saveStateOf({ status: 'offline' })).toBe('offline')
    expect(saveStateOf({ status: 'auth' })).toBe('offline')
    expect(saveStateOf({ status: 'error' })).toBe('error')
    expect(saveStateOf(undefined)).toBe('idle')
  })
})

describe('supersets', () => {
  it('"Superset with the exercise above" links and unlinks, and a lone partner loses its link', () => {
    const ex = [lift('a'), lift('b'), lift('c')]
    expect(linkToAbove(ex, 1, true)).toBe(true)
    expect(ex[0].sg).toBeTruthy()
    expect(ex[1].sg).toBe(ex[0].sg)
    expect(linkToAbove(ex, 1, true)).toBe(false)
    expect(linkToAbove(ex, 2, true)).toBe(true)
    expect(ex[2].sg).toBe(ex[0].sg)
    expect(linkToAbove(ex, 2, false)).toBe(true)
    expect(ex[2].sg).toBeUndefined()
    expect(linkToAbove(ex, 1, false)).toBe(true)
    expect(ex.every(e => !e.sg)).toBe(true)
    expect(linkToAbove(ex, 0, true)).toBe(false)
  })

  it('groups a superset under its line, its members lettered in order', () => {
    const r = { id: 'r1', name: 'Push A', ex: [lift('0025', { sg: 'g', sgRest: 90 }), lift('0027', { sg: 'g' }), lift('0188')] }
    const view = editorOf(state({ routines: [r] }), r)
    expect(view.units.map(u => u.indices)).toEqual([[0, 1], [2]])
    expect(view.units[0]).toMatchObject({ superset: true, title: 'Superset' })
    expect(view.units[0].detail).toMatch(/rest after both$/)
    expect(view.rows.map(row => row.badge?.text ?? null)).toEqual(['A1', 'A2', null])
    expect(view.rows[1].badge.label).toBe('Superset position A2')
    expect(view.rows[0]).toMatchObject({ up: true, leavesUp: true })
  })
})

describe('multi-add Undo', () => {
  it('takes out exactly what was added, last match first, and leaves a changed one', () => {
    const added = [lift('x'), lift('y')]
    const ex = [lift('x'), lift('a'), ...structuredClone(added)]
    ex[3].reps = 12
    expect(removeAdded(ex, added)).toBe(1)
    expect(ex.map(e => e.id)).toEqual(['x', 'a', 'y'])
    expect(ex[2].reps).toBe(12)
  })
})

describe('the editor', () => {
  let root, host
  const Probe = () => h('i', { 'data-search': useLocation().search })
  function mount(path, ex = []) {
    useStore.setState({ S: state({ routines: [{ id: 'r1', name: 'New routine', emoji: 'dumbbell', ex }] }), user: null })
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root.render(h(MemoryRouter, { initialEntries: [path] },
      h(Routes, null, h(Route, { path: '/train/routines/:id', element: h('div', null, h(RoutineEditor), h(Probe)) })))))
  }
  const search = () => host.querySelector('[data-search]').getAttribute('data-search')
  const nameInput = () => host.querySelector('.g-tfield input')
  function type(input, value) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { act(() => root.unmount()); host.remove() })

  // ?new=1 goes from the address as the editor opens, while no sheet is on top. Dropped on the first
  // edit, it was replaced from under the picker's or the settings' history entry, and the ?new=1
  // entry stayed below: the first Back opened T5.6 again (docs/audits/gains-train-review.md #7).
  it('T5.6: a routine just made opens with its name focused and selected, and ?new=1 leaves the address at once', () => {
    mount('/train/routines/r1?new=1')
    expect(document.activeElement).toBe(nameInput())
    expect(nameInput().selectionStart).toBe(0)
    expect(nameInput().selectionEnd).toBe('New routine'.length)
    expect(host.textContent).toContain('Nothing in it yet')
    expect(search()).toBe('')
    act(() => type(nameInput(), 'Push A'))
    expect(useStore.getState().S.routines[0].name).toBe('Push A')
    expect(search()).toBe('')
  })

  // A sync can reorder the routine while T5.5 is open (docs/audits/gains-train-review.md #10).
  it('settings act on the exercise they were opened on, and do nothing once a sync moved it', () => {
    mount('/train/routines/r1', [lift('0025'), lift('0027')])
    act(() => host.querySelectorAll('.g-rx-open')[0].click())
    const [, , onSave, onDelete, , , onReplace] = exConfigSheet.mock.calls[0]
    act(() => useStore.getState().update(s => { s.routines[0].ex.reverse() }))
    const before = structuredClone(useStore.getState().S.routines[0].ex)
    act(() => onSave({ sets: 5, mode: 'reps', reps: 3, weight: 100 }))
    act(() => onDelete())
    act(() => onReplace())
    expect(useStore.getState().S.routines[0].ex).toEqual(before)
    expect(replaceExerciseSheet).not.toHaveBeenCalled()
    // Back where it was opened, Done writes there again.
    act(() => useStore.getState().update(s => { s.routines[0].ex.reverse() }))
    act(() => onSave({ sets: 5, mode: 'reps', reps: 3, weight: 100 }))
    expect(useStore.getState().S.routines[0].ex[0]).toEqual({ id: '0025', sets: 5, mode: 'reps', reps: 3, weight: 100 })
  })

  it('opened again, the name is not grabbed', () => {
    mount('/train/routines/r1')
    expect(document.activeElement).not.toBe(nameInput())
  })

  it('the header shows where it is in the Plan, the saved state and the numbers; ⋯ opens the menu', () => {
    mount('/train/routines/r1', [lift('0025'), lift('0027')])
    expect(host.textContent).toContain('Not in your Plan')
    expect(host.textContent).toContain('Autosaves as you edit')
    expect(host.textContent).toContain('2 exercises · 6 sets')
    act(() => host.querySelector('[aria-label="Routine options"]').click())
    expect(routineMenuSheet).toHaveBeenCalledWith('r1')
  })

  it('a tap on a row opens its settings with the superset row; switching it on links the exercise above', () => {
    mount('/train/routines/r1', [lift('0025'), lift('0027')])
    act(() => host.querySelectorAll('.g-rx-open')[1].click())
    const options = exConfigSheet.mock.calls[0][8]
    expect(options.superset).toBe(false)
    act(() => options.onSupersetChange(true))
    const ex = useStore.getState().S.routines[0].ex
    expect(ex[0].sg).toBeTruthy()
    expect(ex[1].sg).toBe(ex[0].sg)
    expect(host.querySelector('.g-ssg')).not.toBeNull()
    act(() => options.onSupersetChange(false))
    expect(useStore.getState().S.routines[0].ex.every(e => !e.sg)).toBe(true)
  })

  it('Start starts the routine, or goes back to the workout that is running', () => {
    mount('/train/routines/r1', [lift('0025')])
    const start = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Start New routine')
    act(() => start.click())
    expect(startFlow).toHaveBeenCalledWith(['r1'])
  })
})
