// writeWorkoutNote: the saved workout's note, trimmed and capped, deleted when empty, stamped only
// when it changed, and nothing at all for a workout that is gone.
import { beforeEach, describe, expect, it } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { NOTE_MAX } from './history.js'
import { writeWorkoutNote } from './workout-note.js'

const clone = v => JSON.parse(JSON.stringify(v))
const rec = () => useStore.getState().S.workouts[0]
const W = { id: 'w1', d: '2026-10-18', start: 1, end: 2, name: 'Push A', entries: [] }

beforeEach(() => {
  useStore.setState({ S: { ...clone(DEF), workouts: [clone(W)] }, user: null })
})

describe('writeWorkoutNote', () => {
  it('writes the note trimmed and stamps the record', () => {
    expect(writeWorkoutNote(W, '  Felt strong  ')).toBe(true)
    expect(rec().note).toBe('Felt strong')
    expect(rec()._ts).toBeGreaterThan(0)
  })

  it('caps it at NOTE_MAX', () => {
    writeWorkoutNote(W, 'x'.repeat(NOTE_MAX + 20))
    expect(rec().note).toHaveLength(NOTE_MAX)
  })

  it('an empty note deletes the field', () => {
    writeWorkoutNote(W, 'Felt strong')
    expect(writeWorkoutNote(W, '   ')).toBe(true)
    expect('note' in rec()).toBe(false)
  })

  it('the same note changes nothing and stamps nothing', () => {
    useStore.getState().update(s => { s.workouts[0].note = 'Felt strong' })
    const before = useStore.getState().S
    expect(writeWorkoutNote(W, 'Felt strong ')).toBe(false)
    expect(useStore.getState().S).toBe(before)
    expect(rec()._ts).toBeUndefined()
  })

  it('empty on a workout with no note changes nothing', () => {
    expect(writeWorkoutNote(W, '')).toBe(false)
    expect(rec()._ts).toBeUndefined()
  })

  it('a workout that is gone: nothing written', () => {
    expect(writeWorkoutNote({ id: 'gone' }, 'Hello')).toBe(false)
    expect(rec().note).toBeUndefined()
  })
})
