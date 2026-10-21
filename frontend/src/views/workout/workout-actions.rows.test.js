// @vitest-environment happy-dom
// Rows that move under a running rest or hold, ported from views/Workout.swipe.test.jsx (guard-M2a).
// The other swipe cases about removing and copying a set are in workout-actions.test.js
// ('remove, undo and copy a set'); the gestures themselves are dropped by design (owner question 12:
// remove and copy live in Set edit, exercise-drawers.test.jsx).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { copyActiveSet, deleteActiveSet, holdRow, setHoldRow } from './workout-actions.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const row = (w, done = false, extra = {}) => ({ w, r: 8, done, ...extra })
const entry = (id, sets, extra = {}) => ({ id, target: { sets: sets.length, reps: 8 }, sets, ...extra })

function seed(entries) {
  const S = clone(DEF)
  S.active = { id: 'rows-test', d: '2026-10-22', start: Date.now(), name: 'Rows', bw: null, cur: 0, entries: clone(entries) }
  useStore.setState({ S, user: null })
}
const sets = () => useStore.getState().S.active.entries[0].sets
const toast = () => useUI.getState().toastMsg

beforeEach(() => {
  setHoldRow(null)
  useUI.setState({ timer: null, work: null, toastMsg: '', toastAction: null, setFlash: null })
})
afterEach(() => {
  setHoldRow(null)
  useUI.setState({ timer: null, work: null })
  useStore.setState({ S: clone(DEF) })
})

describe('removing a set, more cases', () => {
  // old Workout.swipe:99
  it('numbers a warm-up as a warm-up', () => {
    seed([entry('1001', [row(40, false, { phase: 'warmup', warmup: true }), row(80), row(80)])])
    deleteActiveSet(0, 0)
    expect(toast()).toBe('Warm-up gone.')
  })

  // old :127
  it('keeps a rest another set started, pointed at where that set moved, and Undo points it back', () => {
    seed([entry('1001', [row(80, true), row(80, true), row(80)])])
    useUI.getState().startRest(90, 0, { forSet: 1 })
    deleteActiveSet(0, 0)
    expect(useUI.getState().timer?.forSet).toBe(0)
    expect(toast()).toBe('Set 1 gone.')
    useUI.getState().runToastAction()
    expect(useUI.getState().timer?.forSet).toBe(1)
  })

  // old :150
  it('a newer toast takes the old Undo with it, and the removal stays', () => {
    seed([entry('1001', [row(80), row(81), row(82)])])
    deleteActiveSet(0, 0)
    copyActiveSet(0, 0)
    expect(useUI.getState().toastAction).toBeNull()
    expect(sets().map(s => s.w)).toEqual([81, 81, 82])
  })
})

describe('a hold running while rows move', () => {
  const timed = secs => entry('1002', secs.map(sec => ({ sec, w: 0, done: false })), { target: { sets: secs.length, sec: 30, mode: 'time' } })
  const holdOn = i => {
    setHoldRow({ owner: { idx: 0, i }, idx: 0, i })
    useUI.setState({ work: { left: 50, total: 50, endsAt: Date.now() + 50_000, owner: { idx: 0, i } } })
  }

  // old :199: the saved owner follows the row, so a reload brings the hold back to its own row
  it('moves the saved owner and the row it will write to along with the copies and removals above it', () => {
    seed([timed([30, 40, 50])])
    holdOn(2)
    copyActiveSet(0, 0)
    expect(useUI.getState().work.owner).toMatchObject({ idx: 0, i: 3 })
    expect(holdRow()).toMatchObject({ idx: 0, i: 3 })
    deleteActiveSet(0, 0)
    expect(useUI.getState().work.owner).toMatchObject({ idx: 0, i: 2 })
    expect(holdRow()).toMatchObject({ idx: 0, i: 2 })
  })

  // old :188
  it('stops when its own row is removed, and logs nothing anywhere', () => {
    seed([timed([30, 40])])
    holdOn(1)
    deleteActiveSet(0, 1)
    expect(useUI.getState().work).toBeNull()
    expect(holdRow()).toBeNull()
    expect(toast()).toBe('Set 2 gone. Its timer stopped too.')
    expect(sets()).toEqual([{ sec: 30, w: 0, done: false }])
  })

  // old :173 runs the real hold: use-workout.test.jsx 'a hold writes what it held to its own row...'
})

describe('a timed per-side hold (an L row and an R row)', () => {
  const pair = sec => [{ sec, w: 0, done: false, side: 'L' }, { sec, w: 0, done: false, side: 'R' }]
  const sided = rows => entry('1002', rows, { target: { sets: rows.length / 2, sec: 30, mode: 'time', side: true } })

  // old :215
  it('removes both halves as one set, and Undo puts both back', () => {
    const rows = [...pair(30), ...pair(40)]
    seed([sided(rows)])
    deleteActiveSet(0, 1)
    expect(sets()).toEqual(pair(40))
    expect(toast()).toBe('Set 1 gone.')
    useUI.getState().runToastAction()
    expect(sets()).toEqual(rows)
  })

  // old :225
  it('keeps the last pair of a live session', () => {
    seed([sided(pair(30))])
    expect(deleteActiveSet(0, 0)).toBe(false)
    expect(sets()).toEqual(pair(30))
    expect(toast()).toBe('Keep at least one set, champ')
  })
})
