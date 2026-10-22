// @vitest-environment happy-dom
// A workout left open (owner question 8, W1.27): over 3 h since the last tick, or since the start
// with nothing ticked; never an edit or a backfill; a save ends at the last set.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { finishAndSave } from '../sheets.jsx'
import { saveStale, staleFacts, STALE_MS } from './stale-workout.js'

vi.mock('../sheets.jsx', () => ({ finishAndSave: vi.fn(() => ({ w: { id: 'w' } })) }))

const START = Date.parse('2026-10-17T18:05:00')
const LAST = Date.parse('2026-10-17T19:02:00')
const H = 60 * 60 * 1000
const set = (at, extra = {}) => ({ w: 80, r: 8, done: at != null, ...(at != null ? { at } : {}), ...extra })
const active = (sets, over = {}) => ({ id: 'a', d: '2026-10-17', start: START, routineIds: ['push'], name: 'Push A', cur: 0, entries: [{ id: '0025', target: { sets: sets.length }, sets }], ...over })

describe('staleFacts', () => {
  // Ticks 18:45, 18:57 and 19:02: one unbroken run (lib/finish-workout.js sessionEnd), so it ends at 19:02.
  const A = active([set(LAST - 17 * 60000, { phase: 'warmup' }), set(LAST - 5 * 60000), set(LAST), set(null)])

  it('over 3 h since the last tick: the facts, ending at the last set', () => {
    const now = START + 23 * H
    expect(staleFacts(A, now)).toEqual({ name: 'Push A', started: START, setsLogged: 3, lastSet: LAST, openFor: 23 * H, endAt: LAST })
  })

  it('not at 3 h exactly, only past it', () => {
    expect(staleFacts(A, LAST + STALE_MS)).toBeNull()
    expect(staleFacts(A, LAST + STALE_MS + 1)).not.toBeNull()
  })

  it('a recent tick keeps a session that started long ago from being stale', () => {
    const late = active([set(START + 5 * H)])
    expect(staleFacts(late, START + 6 * H)).toBeNull()
  })

  it('nothing ticked: measured from the start, with no end to save at', () => {
    const none = active([set(null)])
    expect(staleFacts(none, START + 2 * H)).toBeNull()
    expect(staleFacts(none, START + 4 * H)).toMatchObject({ setsLogged: 0, lastSet: null, endAt: null, openFor: 4 * H })
  })

  it('never for an edit of a saved workout or a workout logged into the past', () => {
    const now = START + 23 * H
    expect(staleFacts({ ...A, editingWorkoutId: 'w0' }, now)).toBeNull()
    expect(staleFacts({ ...A, backfill: { iso: '2026-10-17' } }, now)).toBeNull()
    expect(staleFacts(null, now)).toBeNull()
  })
})

describe('saveStale', () => {
  beforeEach(() => {
    vi.mocked(finishAndSave).mockClear()
    localStorage.clear()
  })

  it('saves through finishAndSave, ending at the last set', () => {
    useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), active: active([set(LAST)]) }, user: null })
    expect(saveStale(START + 23 * H)).toEqual({ w: { id: 'w' } })
    expect(finishAndSave).toHaveBeenCalledWith({ end: LAST })
  })

  it('does nothing when the session is not left open', () => {
    useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), active: active([set(LAST)]) }, user: null })
    expect(saveStale(LAST + H)).toBeNull()
    expect(finishAndSave).not.toHaveBeenCalled()
  })
})
