import { describe, expect, it } from 'vitest'
import { mergePlan, parsePlan } from './plan-share.js'
import { buildRoutineBundle } from './routine-share.js'

const custom = (id, n) => ({ id, n, bp: 'chest', custom: true })
const source = () => ({
  unit: 'kg',
  routines: [
    { id: 'a', name: 'Push A', emoji: 'dumbbell', prog: 'double', ex: [{ id: '0025', sets: 3, reps: 8, weight: 60 }, { id: 'cx1', sets: 3, reps: 10 }] },
    { id: 'b', name: 'Pull A', emoji: 'dumbbell', ex: [{ id: 'cx2', sets: 3, reps: 10 }] },
  ],
  week: { 1: ['a', 'b'], 4: ['a'] },
  customEx: [custom('cx1', 'My press'), custom('cx2', 'My row')],
})

describe('buildRoutineBundle', () => {
  it('is the plan file with just that routine and the custom exercises it uses, named after it', () => {
    const bundle = buildRoutineBundle(source(), 'a')
    expect(bundle.name).toBe('Push A')
    expect(bundle.routines.map(r => r.id)).toEqual(['a'])
    expect(bundle.routines[0].prog).toBe('double')
    expect(bundle.customEx.map(c => c.id)).toEqual(['cx1'])
  })

  it('carries no weekdays: one routine says nothing about the importer’s week', () => {
    const bundle = buildRoutineBundle(source(), 'a')
    expect(bundle.week).toEqual({})
    const mine = { unit: 'kg', routines: [], week: { 2: ['x'] }, customEx: [] }
    mergePlan(mine, parsePlan(JSON.stringify(bundle)))
    expect(mine.routines.map(r => r.name)).toEqual(['Push A'])
    expect(mine.customEx.map(c => c.n)).toEqual(['My press'])
    expect(mine.week).toEqual({ 2: ['x'] })
  })

  it('reads back as a plan file', () => {
    const parsed = parsePlan(JSON.stringify(buildRoutineBundle(source(), 'b')))
    expect(parsed.routines).toHaveLength(1)
    expect(parsed.routines[0].name).toBe('Pull A')
  })

  it('is null for a routine that is not there', () => {
    expect(buildRoutineBundle(source(), 'nope')).toBe(null)
  })
})
