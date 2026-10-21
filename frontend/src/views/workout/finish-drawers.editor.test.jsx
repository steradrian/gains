// @vitest-environment happy-dom
// Saving the saved-workout editor with every set unticked or removed (guard-M2a), ported from
// Workout.edit-empty.test.jsx: it would save a workout with nothing in it, which the history still
// lists and counts as a training day. It offers to delete the workout instead, with Keep editing as
// the way back to the sets. The editor's Save changes is `finishSheet()` (finish-drawers.js) and its
// close is `exitWorkoutEdit()`, both the real functions against the real store; the confirmation is
// the shared confirm sheet, rendered as the top sheet.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { setNav } from '../../lib/nav.js'
import { editCompletedSession } from '../../lib/session-edit.js'
import { exitWorkoutEdit } from '../../sheets.jsx'
import { finishSheet } from './finish-drawers.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const done = (id, w) => ({ id, target: { sets: 1, reps: 5, weight: w }, sets: [{ w, r: 5, done: true }] })
const saved = { id: 'saved', d: '2026-09-22', start: 1000, end: 2000, routineIds: [], name: 'Push', entries: [done('0025', 80), done('0027', 60)], prs: [] }
const other = { id: 'other', d: '2026-09-20', start: 0, end: 1, routineIds: [], name: 'Pull', entries: [done('0027', 55)], prs: [] }

function seedEditor(extra = {}) {
  const S = clone(DEF)
  S.workouts = [clone(other), { ...clone(saved), ...extra }]
  editCompletedSession(S, 'saved')
  useStore.setState({ S, user: null })
}
const mounted = []
function top() {
  const sheet = useUI.getState().sheets.at(-1)
  expect(sheet).toBeTruthy()
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const S = () => useStore.getState().S
const untickAll = () => act(() => useStore.getState().update(s => { s.active.entries.forEach(e => e.sets.forEach(set => { set.done = false })) }))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], timer: null, work: null, toastMsg: '', toastAction: null })
  document.body.innerHTML = ''
  setNav(() => {})
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) })
  useUI.getState().closeAll()
  useStore.setState({ S: clone(DEF) })
})

describe('saving an edit that leaves no set', () => {
  it('asks to delete the workout instead; Keep editing goes back with nothing saved', () => {
    seedEditor()
    untickAll()
    act(() => finishSheet())

    const dialog = top()
    expect(dialog.querySelector('h3').textContent).toBe('Delete workout?')
    expect(dialog.textContent).toContain('No sets are left in this workout, so there is nothing to save. Delete it from your history?')
    expect(button(dialog, 'Delete workout').className).toContain('danger')
    act(() => button(dialog, 'Keep editing').click())

    expect(useUI.getState().sheets).toHaveLength(0)
    expect(S().active.editingWorkoutId).toBe('saved')
    expect(S().workouts.find(w => w.id === 'saved').entries).toHaveLength(2)
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('says the workout’s photos and videos go with it, when it has any', () => {
    const ref = n => ({ kind: 'image', hash: String(n).repeat(64), mime: 'image/webp', size: 10, width: 8, height: 6, at: 1 })
    seedEditor({ media: [ref(1), ref(2), ref(3)] })
    untickAll()
    act(() => finishSheet())
    expect(top().textContent).toContain('Delete it from your history? Its 3 photos or videos are deleted with it.')
  })

  it('Delete workout takes it out of the history and closes the editor', () => {
    seedEditor()
    untickAll()
    act(() => finishSheet())
    const dialog = top()
    act(() => button(dialog, 'Delete workout').click())

    expect(S().active).toBeNull()
    expect(S().workouts.map(w => w.id)).toEqual(['other'])
    expect(useUI.getState().toastMsg).toBe('Workout deleted')
  })

  it('asks the same when every exercise was removed, and from the close button’s Save changes', () => {
    seedEditor()
    act(() => useStore.getState().update(s => { s.active.entries = [] }))
    act(() => exitWorkoutEdit())
    const closing = top()
    act(() => button(closing, 'Save changes').click())

    const dialog = top()
    expect(dialog.querySelector('h3').textContent).toBe('Delete workout?')
    act(() => button(dialog, 'Delete workout').click())
    expect(S().workouts.map(w => w.id)).toEqual(['other'])
  })

  it('an edit with a set left saves as before, with no question', () => {
    seedEditor()
    act(() => useStore.getState().update(s => { s.active.entries[1].sets[0].done = false }))
    act(() => finishSheet())

    expect(useUI.getState().sheets).toHaveLength(0)
    expect(S().active).toBeNull()
    const kept = S().workouts.find(w => w.id === 'saved')
    expect(kept.entries.map(e => e.id)).toEqual(['0025'])
    expect(useUI.getState().toastMsg).toBe('Workout updated')
  })
})
