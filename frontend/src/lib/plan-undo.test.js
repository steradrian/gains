import { describe, expect, it } from 'vitest'
import { importPlan, undoImport } from './plan-undo.js'

const file = (over = {}) => ({
  name: 'Upper Lower',
  routines: [
    { id: 'u', name: 'Upper A', ex: [{ id: 'c1', sets: 3 }, { id: '0025', sets: 3 }] },
    { id: 'l', name: 'Lower A', ex: [{ id: '0025', sets: 3 }] },
  ],
  week: { 1: ['u'], 4: ['l'] },
  customEx: [{ id: 'c1', n: 'Sled push', bp: 'upper legs' }],
  ...over,
})
const mine = () => ({
  routines: [{ id: 'push', name: 'Push', ex: [{ id: '0025', sets: 3 }] }],
  week: { 2: ['push'], 5: ['push'] },
  dayPlan: {},
  customEx: [{ id: 'own', n: 'My curl', bp: 'upper arms', custom: true }],
  workouts: [],
  active: null,
})

describe('importPlan', () => {
  it('adds the routines marked with the plan they came from, and says what it added', () => {
    const s = mine()
    const done = importPlan(s, file())
    expect(s.routines.map(r => r.name)).toEqual(['Push', 'Upper A', 'Lower A'])
    expect(s.routines.slice(1).map(r => r.importedFrom)).toEqual(['Upper Lower', 'Upper Lower'])
    expect(done.ids).toEqual(s.routines.slice(1).map(r => r.id))
    expect(done.exIds).toHaveLength(1)
    expect(done.week).toBeNull()
    expect(s.week).toEqual({ 2: ['push'], 5: ['push'] })
  })

  it('with the schedule on, keeps the week on both sides for the Undo', () => {
    const s = mine()
    const done = importPlan(s, file(), { schedule: true })
    expect(done.week.before).toEqual({ 2: ['push'], 5: ['push'] })
    expect(done.week.after).toEqual(s.week)
    expect(s.week).toEqual({ 1: [done.ids[0]], 4: [done.ids[1]] })
  })

  it('a file without weekdays leaves the week alone, so there is nothing to put back', () => {
    const s = mine()
    const done = importPlan(s, file({ week: {}, routines: [file().routines[1]] }), { schedule: true })
    expect(s.week).toEqual({ 2: ['push'], 5: ['push'] })
    expect(done.week).toBeNull()
  })
})

describe('undoImport', () => {
  it('takes away exactly the routines and custom exercises it added and puts the week back', () => {
    const s = mine()
    const done = importPlan(s, file(), { schedule: true })
    expect(undoImport(s, done)).toBe(2)
    expect(s.routines.map(r => r.id)).toEqual(['push'])
    expect(s.customEx.map(c => c.id)).toEqual(['own'])
    expect(s.week).toEqual({ 2: ['push'], 5: ['push'] })
  })

  it('keeps a weekday changed since the import, without the imported routine on it', () => {
    const s = mine()
    const done = importPlan(s, file(), { schedule: true })
    s.week[1] = [done.ids[0], 'push']
    undoImport(s, done)
    expect(s.week[1]).toEqual(['push'])
    expect(s.week[2]).toEqual(['push'])
    expect(s.week[4]).toBeUndefined()
  })

  it('keeps a custom exercise that is in use by then: logged, running, or in a routine of yours', () => {
    for (const use of [
      s => { s.workouts.push({ id: 'w', d: '2026-10-20', entries: [{ id: s.customEx[1].id, sets: [] }] }) },
      s => { s.active = { id: 'live', entries: [{ id: s.customEx[1].id, sets: [] }] } },
      s => { s.routines[0].ex.push({ id: s.customEx[1].id, sets: 3 }) },
    ]) {
      const s = mine()
      const done = importPlan(s, file())
      use(s)
      undoImport(s, done)
      expect(s.customEx.map(c => c.id)).toEqual(['own', done.exIds[0]])
      expect(s.routines.map(r => r.id)).toEqual(['push'])
    }
  })

  it('a routine already gone is not counted, and a reschedule naming one goes with it', () => {
    const s = mine()
    const done = importPlan(s, file())
    s.routines = s.routines.filter(r => r.id !== done.ids[1])
    s.dayPlan['2026-10-22'] = done.ids[0]
    expect(undoImport(s, done)).toBe(1)
    expect(s.dayPlan).toEqual({})
  })
})
