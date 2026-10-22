// @vitest-environment happy-dom
// Discard with Undo (owner question 9, W1.46 and W1.26): what goes, the session cleared with the
// rest and the hold stopped, Undo putting it back from memory once.
import { beforeEach, describe, expect, it } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { discardedText, discardFacts, discardWithUndo } from './workout-discard.js'

const START = Date.parse('2026-10-18T17:42:00')
const A = () => ({
  id: 'a', d: '2026-10-18', start: START, routineIds: ['push'], name: 'Push A', cur: 1,
  entries: [
    { id: '0001', part: 'warmup', target: { sets: 2 }, sets: [{ w: 0, r: 15, done: true }, { w: 0, r: 15, done: true }] },
    { id: '0025', target: { sets: 3 }, sets: [{ w: 40, r: 5, done: true, phase: 'warmup' }, { w: 80, r: 8, done: true }, { w: 80, r: 8 }] },
  ],
})
const S = () => useStore.getState().S

describe('discardFacts', () => {
  it('counts every logged set, warm-ups included, and the clock', () => {
    expect(discardFacts(A(), START + (24 * 60 + 18) * 1000)).toEqual({ name: 'Push A', sets: 4, clock: (24 * 60 + 18) * 1000, clockText: '24:18', confirm: true })
  })

  it('nothing logged goes without the confirm', () => {
    const empty = { ...A(), entries: [{ id: '0025', sets: [{ w: 80, r: 8 }] }] }
    expect(discardFacts(empty, START)).toMatchObject({ sets: 0, confirm: false })
    expect(discardFacts({ ...A(), entries: [] }, START)).toMatchObject({ sets: 0, confirm: false })
    expect(discardFacts(null)).toBeNull()
  })

  it('the toast text', () => {
    expect(discardedText('Push A')).toBe('Discarded Push A. The sets go unless you undo.')
  })
})

describe('discardWithUndo', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), active: A() }, user: null })
    useUI.setState({ timer: null, work: null })
  })

  it('clears the session, stops the rest and the hold, and Undo puts it back once', () => {
    useUI.getState().startRest(90, 1)
    useUI.getState().startWork(45, 'Plank', () => {})
    const gone = discardWithUndo()
    expect(gone.name).toBe('Push A')
    expect(gone.text).toBe('Discarded Push A. The sets go unless you undo.')
    expect(S().active).toBeNull()
    expect(S().workouts).toEqual([])
    expect(useUI.getState().timer).toBeNull()
    expect(useUI.getState().work).toBeNull()
    expect(gone.undo()).toBe(true)
    expect(S().active).toEqual(A())
    // The timers are not restored.
    expect(useUI.getState().timer).toBeNull()
    expect(gone.undo()).toBe(false)
  })

  it('Undo does nothing once another session is running', () => {
    const gone = discardWithUndo()
    useStore.getState().update(s => { s.active = { id: 'b', entries: [] } })
    expect(gone.undo()).toBe(false)
    expect(S().active.id).toBe('b')
  })

  it('nothing running: nothing to discard', () => {
    useStore.setState({ S: { ...S(), active: null } })
    expect(discardWithUndo()).toBeNull()
  })
})
