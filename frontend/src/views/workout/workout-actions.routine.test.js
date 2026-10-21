// @vitest-environment happy-dom
// Update routine, from How to (workout-actions.js routineUpdateAt), ported from
// views/Workout.test.jsx:3247-3343 (guard-M2a). The first cases of the row are in
// workout-actions.drawers.test.js ('offers Update routine only when the session differs').
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { confirmSheet } from '../../sheets/confirm-menu.jsx'
import { addWarmupAt, routineUpdateAt } from './workout-actions.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))
vi.mock('../../sheets/confirm-menu.jsx', () => ({ confirmSheet: vi.fn(), menuSheet: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const BENCH = '0025'
const ROW = '0027'
const slot = (extra = {}) => ({ id: BENCH, sets: 1, mode: 'reps', reps: 5, weight: 60, ...extra })
const routine = (extra = {}) => ({ id: 'A', name: 'Push', ex: [slot(extra)] })
const own = ({ target, ...extra } = {}) => ({ id: BENCH, rid: 'A', target: { mode: 'reps', reps: 5, weight: 60, ...target }, sets: [{ w: 60, r: 5, done: false }], ...extra })

function seed(entries, routines, over = {}) {
  const S = clone(DEF)
  Object.assign(S, { unit: 'kg', restSec: 90, routines: clone(routines), ...over })
  S.active = { id: 'act', d: '2026-10-22', start: Date.now(), name: 'Push', bw: null, cur: 0, entries: clone(entries) }
  useStore.setState({ S, user: null })
}
const st = () => useStore.getState().S
const slotNow = () => st().routines[0].ex[0]

beforeEach(() => {
  useUI.setState({ timer: null, work: null, toastMsg: null, toastAction: null })
  vi.mocked(confirmSheet).mockClear()
})
afterEach(() => { useStore.setState({ S: clone(DEF) }) })

describe('Update routine', () => {
  it('is not offered while the routine already says what the session does', () => {
    seed([own()], [routine()])
    expect(routineUpdateAt(0)).toBeNull()
  })

  it('is offered once a warm-up is added, and saves it into the routine only after confirming', () => {
    seed([own()], [routine()])
    addWarmupAt(0)
    const found = routineUpdateAt(0)
    expect(found.sub).toBe('Warm-up sets 0 → 1')

    found.run()
    expect(confirmSheet).toHaveBeenCalledOnce()
    expect(slotNow().warmupSets).toBeUndefined()

    vi.mocked(confirmSheet).mock.calls[0][0].onConfirm()
    // the rest of the slot is exactly what it was
    expect(slotNow()).toEqual(slot({ warmupSets: 1 }))
    expect(useUI.getState().toastMsg).toBe('Routine updated')
  })

  it('names the rest and note edited on the settings sheet', () => {
    seed([own({ target: { restSec: 150, note: 'pause on the chest' } })], [routine({ restSec: 90 })])
    const found = routineUpdateAt(0)
    expect(found.sub).toBe('Rest 1:30 → 2:30 · Note')
    found.run()
    vi.mocked(confirmSheet).mock.calls[0][0].onConfirm()
    expect(slotNow()).toMatchObject({ restSec: 150, note: 'pause on the chest' })
  })

  it('names a slot with no rest of its own as the default, as the wheel does', () => {
    seed([own({ target: { restSec: 180 } })], [routine()])
    expect(routineUpdateAt(0).sub).toBe('Rest Default (1:30) → 3:00')
  })

  it('leaves the note added for today with the workout, and says so before confirming', () => {
    seed([own({ note: 'Elbows tucked' })], [routine()])
    expect(routineUpdateAt(0)).toBeNull()
    addWarmupAt(0)
    const found = routineUpdateAt(0)
    expect(found.sub).toBe('Warm-up sets 0 → 1')
    found.run()
    const { message } = vi.mocked(confirmSheet).mock.calls[0][0]
    expect(message).toMatch(/Exercise settings/)
    expect(message).toMatch(/note added for today stays with this workout/)
    vi.mocked(confirmSheet).mock.calls[0][0].onConfirm()
    expect(slotNow().note).toBeUndefined()
  })

  it('does not write into a workout that changed while the confirmation was open', () => {
    seed([own({ target: { restSec: 150 } })], [routine()])
    routineUpdateAt(0).run()
    useStore.getState().update(s => { s.active.id = 'another-workout' })
    vi.mocked(confirmSheet).mock.calls[0][0].onConfirm()
    expect(slotNow().restSec).toBeUndefined()
    expect(useUI.getState().toastMsg).not.toBe('Routine updated')
  })

  it('is not offered for a freestyle exercise, one the routine never had, or a saved workout being edited', () => {
    const target = { restSec: 150 }
    seed([own({ rid: undefined, target })], [routine()])
    expect(routineUpdateAt(0)).toBeNull()

    seed([own({ id: ROW, target })], [routine()])
    expect(routineUpdateAt(0)).toBeNull()

    seed([own({ target })], [routine()])
    useStore.getState().update(s => { s.active.editingWorkoutId = 'saved' })
    expect(routineUpdateAt(0)).toBeNull()
  })
})
