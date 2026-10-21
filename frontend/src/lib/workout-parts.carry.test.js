// Workout core M1: `entry.part` is carried from the routine to the session, the saved workout
// and a repeat, and the warm-up and cool-down parts stay out of volume and the finish comparison.
import { describe, expect, it } from 'vitest'
import { buildSessionEntries } from './session-start.js'
import { buildCombinedEntries } from './session-merge.js'
import { buildCompletedWorkout } from './finish-workout.js'
import { repeatSessionEntries } from './session-repeat.js'
import { routineFromSession } from './session-routines.js'
import { finishCompare, finishCardio } from './finish-compare.js'
import { workoutVolume } from './history.js'
import { routineChangesFromEntry, updateRoutineFromEntry } from './routines.js'
import { partsInOrder } from './workout-parts.js'

const st = (over = {}) => ({ unit: 'kg', workouts: [], exWeights: {}, routines: [], ...over })
const set = (w, r, extra = {}) => ({ w, r, done: true, ...extra })

describe('the session start carries the part', () => {
  const r = {
    id: 'push', prog: 'off', ex: [
      { id: '0025', sets: 3, reps: 8, weight: 60 },
      { id: '0001', sets: 1, sec: 30, mode: 'time', part: 'cooldown' },
      { id: '0003', sets: 2, reps: 10, weight: 0, part: 'warmup' },
    ],
  }

  it('copies the routine entry\'s part onto the session entry and keeps warm-ups first', () => {
    const entries = buildSessionEntries(st(), r)
    expect(entries.map(e => [e.id, e.part])).toEqual([['0003', 'warmup'], ['0025', undefined], ['0001', 'cooldown']])
    expect('part' in entries[1]).toBe(false)
  })

  it('a combined session keeps every warm-up first and every cool-down last', () => {
    const r2 = { id: 'core', prog: 'off', ex: [{ id: '0009', sets: 1, reps: 10, part: 'warmup' }, { id: '0010', sets: 2, reps: 10 }] }
    const { entries } = buildCombinedEntries(st({ routines: [r, r2] }), ['push', 'core'])
    expect(partsInOrder(entries)).toBe(true)
    expect(entries.map(e => e.id)).toEqual(['0003', '0009', '0025', '0010', '0001'])
    expect(entries.map(e => e.rid)).toEqual(['push', 'core', 'push', 'core', 'push'])
  })

  it('a routine without parts builds exactly as before', () => {
    const plain = { id: 'p', prog: 'off', ex: [{ id: '0025', sets: 1, reps: 5 }, { id: '0003', sets: 1, reps: 5 }] }
    const entries = buildSessionEntries(st(), plain)
    expect(entries.map(e => e.id)).toEqual(['0025', '0003'])
    expect(entries.some(e => 'part' in e)).toBe(false)
  })
})

describe('the saved workout keeps the part', () => {
  it('buildCompletedWorkout writes part only for a warm-up or cool-down', () => {
    const active = {
      id: 'a', d: '2026-10-17', start: 1, name: 'Push', entries: [
        { id: 'bike', part: 'warmup', sets: [set(0, 0, { min: 5 })] },
        { id: 'bench', sets: [set(80, 8)] },
        { id: 'stretch', part: 'cooldown', sets: [set(0, 0, { sec: 30 })] },
      ],
    }
    const w = buildCompletedWorkout(active, { end: 2 })
    expect(w.entries.map(e => e.part)).toEqual(['warmup', undefined, 'cooldown'])
    expect('part' in w.entries[1]).toBe(false)
  })
})

describe('Repeat keeps the part', () => {
  it('a repeated warm-up stays a warm-up, first', () => {
    const w = {
      id: 'w1', name: 'Push', entries: [
        { id: 'bench', target: { reps: 8 }, sets: [set(60, 8)] },
        { id: 'jacks', part: 'warmup', target: { reps: 20 }, sets: [set(0, 20)] },
      ],
    }
    const { entries } = repeatSessionEntries(st({ workouts: [w] }), w, { exists: () => true })
    expect(entries.map(e => [e.id, e.part])).toEqual([['jacks', 'warmup'], ['bench', undefined]])
  })

  it('Save as routine copies the part into the routine entry', () => {
    const w = { id: 'w1', name: 'Push', entries: [{ id: 'stretch', part: 'cooldown', target: { mode: 'time', sec: 30 }, sets: [set(0, 0, { sec: 30 })] }] }
    expect(routineFromSession(w).ex[0].part).toBe('cooldown')
  })
})

describe('warm-up and cool-down parts stay out of volume and the comparison', () => {
  it('workoutVolume skips them; warm-up rows inside a working exercise stay out as before', () => {
    const w = {
      entries: [
        { id: 'row', part: 'warmup', sets: [set(20, 10)] },
        { id: 'bench', sets: [set(20, 10, { phase: 'warmup' }), set(80, 8), set(80, 8)] },
        { id: 'curl', part: 'cooldown', sets: [set(10, 10)] },
      ],
    }
    expect(workoutVolume(w)).toBe(1280)
  })

  it('finishCompare leaves out a warm-up exercise, keeps the working one', () => {
    const today = { id: 't', d: '2026-10-17', start: 2, entries: [
      { id: 'bench', part: 'warmup', target: { mode: 'reps' }, sets: [set(40, 10)] },
      { id: 'squat', target: { mode: 'reps' }, sets: [set(100, 5)] },
    ] }
    const rows = finishCompare(st({ workouts: [today] }), today)
    expect(rows.map(r => r.id)).toEqual(['squat'])
  })

  it('finishCardio leaves out a warm-up bike, keeps a cardio finisher of the workout', () => {
    const w = { entries: [
      { id: 'bike', part: 'warmup', target: { mode: 'cardio' }, sets: [set(0, 0, { min: 5 })] },
      { id: 'tread', target: { mode: 'cardio' }, sets: [set(0, 0, { min: 20 })] },
    ] }
    expect(finishCardio(w).map(r => r.id)).toEqual(['tread'])
  })
})

describe('Update routine carries a part changed in the session', () => {
  const routine = () => ({ id: 'r1', name: 'Push', ex: [{ id: 'bench', sets: 3, reps: 8 }, { id: 'pigeon', sets: 1, part: 'cooldown' }] })
  const entry = (id, extra = {}) => ({ id, rid: 'r1', target: {}, sets: [set(60, 8)], ...extra })

  it('offers the part when it differs from the slot', () => {
    const found = routineChangesFromEntry(routine(), [entry('bench', { part: 'warmup' })], 0)
    expect(found.changes).toContainEqual({ key: 'part', from: 'main', to: 'warmup' })
  })

  it('writes it, and a move back to the workout removes the key', () => {
    const r = routine()
    updateRoutineFromEntry(r, [entry('bench', { part: 'warmup' })], 0)
    expect(r.ex[0].part).toBe('warmup')
    updateRoutineFromEntry(r, [entry('bench', { part: 'warmup' }), entry('pigeon')], 1)
    expect('part' in r.ex[1]).toBe(false)
  })

  it('a part the session did not change survives the update untouched', () => {
    const r = routine()
    updateRoutineFromEntry(r, [entry('bench', { target: { restSec: 120 } }), entry('pigeon', { part: 'cooldown', target: { restSec: 30 } })], 1)
    expect(r.ex[1].part).toBe('cooldown')
  })
})
