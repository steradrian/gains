// @vitest-environment happy-dom
// The editor of a saved workout with a half-done cool-down (review finding 1): no cool-down offer
// on mount, and every finish path updates the record in place instead of pushing a second one.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { setNav } from '../../lib/nav.js'
import { editCompletedSession } from '../../lib/session-edit.js'
import { finishAndSave, finishToSummary } from '../../sheets.jsx'
import { cooldownOfferSheet } from './finish-drawers.js'
import { buildWorkoutView } from './workout-view.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const lift = { id: '0025', part: 'main', target: { sets: 1, reps: 5, weight: 80 }, sets: [{ w: 80, r: 5, done: true }] }
const stretch = {
  id: '0027', part: 'cooldown', target: { sets: 2, reps: 1, weight: 0 },
  sets: [{ w: 0, r: 1, done: true }, { w: 0, r: 1, done: false }],
}
const saved = { id: 'saved', d: '2026-09-22', start: 1000, end: 2000, routineIds: [], name: 'Push', entries: [lift, stretch], prs: [] }

function seedEditor() {
  const S = clone(DEF)
  S.workouts = [clone(saved)]
  editCompletedSession(S, 'saved')
  useStore.setState({ S, user: null })
}
const S = () => useStore.getState().S

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], timer: null, work: null, toastMsg: '', toastAction: null })
  setNav(() => {})
})
afterEach(() => {
  useUI.getState().closeAll()
  useStore.setState({ S: clone(DEF) })
})

describe('editing a saved workout with a partly ticked cool-down', () => {
  it('makes no cool-down offer, neither in the view nor as a drawer', () => {
    seedEditor()
    expect(buildWorkoutView({ S: S(), A: S().active }).offer).toBeNull()
    act(() => cooldownOfferSheet())
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('finishing keeps one record and puts the edit in it', () => {
    seedEditor()
    act(() => useStore.getState().update(s => { s.active.entries[0].sets[0].w = 90 }))
    let result
    act(() => { result = finishToSummary() })

    expect(result).toBeNull()
    expect(S().active).toBeNull()
    expect(S().workouts.filter(w => w.id === 'saved')).toHaveLength(1)
    expect(S().workouts).toHaveLength(1)
    expect(S().workouts[0].entries[0].sets[0].w).toBe(90)
  })

  it('finishAndSave refuses an editing session', () => {
    seedEditor()
    expect(finishAndSave()).toBeNull()
    expect(S().active.editingWorkoutId).toBe('saved')
    expect(S().workouts).toHaveLength(1)
  })
})
