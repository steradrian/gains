// @vitest-environment happy-dom
// Loading a ready-made plan through the store (PR02 T10.1, T10.2; owner question 6): the whole
// week is replaced, "Your week starts" names a real day, and Undo survives a sync in between.
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../store/useStore.js'
import { firstPlannedDay, loadStarterPlanWithUndo } from './starter-load.js'

const WED = '2026-10-21'
const S = () => useStore.getState().S
const mine = { id: 'mine', name: 'My routine', emoji: 'star', ex: [] }
const nameOn = day => S().routines.find(r => r.id === [].concat(S().week[day] ?? [])[0])?.name

beforeEach(() => {
  useStore.setState(s => ({
    S: { ...s.S, routines: [structuredClone(mine)], week: { 0: ['mine'], 2: ['mine'] }, dayPlan: {}, workouts: [], active: null, queue: null, rotation: null, scheduleMode: null },
  }))
})

describe('loadStarterPlanWithUndo', () => {
  it('replaces the whole week and says when it starts', () => {
    const res = loadStarterPlanWithUndo('upper-lower', { today: WED })
    expect([1, 2, 4, 5].map(nameOn)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    expect(S().week[0]).toBeUndefined()
    expect(S().week[3]).toBeUndefined()
    expect(res.startsOn).toBe('2026-10-22')   // Thursday: the plan has nothing on a Wednesday
    expect(res.added).toHaveLength(4)
    expect(res.fit).toBeNull()
  })

  it('starts today when the plan trains today', () => {
    expect(loadStarterPlanWithUndo('ppl', { today: WED }).startsOn).toBe(WED)
  })

  it('reuses the routines of the same plan loaded again', () => {
    loadStarterPlanWithUndo('ppl', { today: WED })
    const ids = S().routines.map(r => r.id)
    const again = loadStarterPlanWithUndo('ppl', { today: WED })
    expect(again.added).toEqual([])
    expect(S().routines.map(r => r.id)).toEqual(ids)
  })

  it('Undo puts the week back and removes only the routines this load added', () => {
    loadStarterPlanWithUndo('ppl', { today: WED })
    const kept = S().routines.map(r => r.id)
    const res = loadStarterPlanWithUndo('full-body', { today: WED })
    expect(res.undo()).toBe(true)
    expect(S().routines.map(r => r.id)).toEqual(kept)
    expect(nameOn(1)).toBe('Push Day')
    expect(res.undo()).toBe(false)   // once only
  })

  it('Undo after a sync: works on the synced copy, and keeps a day the other device set', () => {
    const res = loadStarterPlanWithUndo('full-body', { today: WED })
    // A sync replaces the whole copy: new objects, and a weekday another device set meanwhile.
    const synced = structuredClone(S())
    synced.week[6] = ['mine']
    useStore.setState({ S: synced })

    expect(res.undo()).toBe(true)
    expect(S().week).toEqual({ 0: ['mine'], 2: ['mine'], 6: ['mine'] })
    expect(S().routines.map(r => r.id)).toEqual(['mine'])
    // The days it put back are marked as an Undo, so a merge does not take them for a new edit.
    expect(Object.keys(S().undone || {})).toContain('week.1')
  })

  it('in rotation mode it writes the week but promises no start day', () => {
    useStore.setState(s => ({ S: { ...s.S, scheduleMode: 'rotation' } }))
    const res = loadStarterPlanWithUndo('ppl', { today: WED })
    expect(res.startsOn).toBeNull()
    expect(nameOn(1)).toBe('Push Day')
    expect(S().scheduleMode).toBe('rotation')   // the rotation stays in charge
  })

  it('fits the plan to a profile and reports the swaps', () => {
    const res = loadStarterPlanWithUndo('ppl', { fit: { id: 'home', name: 'Home', equipment: ['dumbbell'] }, today: WED })
    expect(res.fit.swapped).toBe(res.fit.swaps.length)
    expect(res.fit.swaps.length).toBeGreaterThan(0)
    expect(S().routines.flatMap(r => r.ex.map(e => e.id))).not.toContain('0025')
  })

  it('adds a fitted plan beside a same-named routine with other exercises, and reuses the fitted ones the next time', () => {
    const home = { id: 'home', name: 'Home', equipment: ['dumbbell'] }
    loadStarterPlanWithUndo('ppl', { today: WED })
    loadStarterPlanWithUndo('ppl', { fit: home, today: WED })
    const pushes = S().routines.filter(r => r.name === 'Push Day')
    expect(pushes).toHaveLength(2)
    expect(pushes[0].ex.map(e => e.id)).not.toEqual(pushes[1].ex.map(e => e.id))
    expect(S().week[1]).toEqual([pushes[1].id])
    loadStarterPlanWithUndo('ppl', { fit: home, today: WED })
    expect(S().routines.filter(r => r.name === 'Push Day')).toHaveLength(2)
  })

  it('two different plans add independent routines', () => {
    loadStarterPlanWithUndo('ppl', { today: WED })
    const first = S().routines.slice(1).map(r => r.id)
    loadStarterPlanWithUndo('full-body', { today: WED })
    const second = S().routines.slice(4).map(r => r.id)
    expect(S().routines).toHaveLength(7)
    expect(new Set([...first, ...second]).size).toBe(6)
  })

  it('changes nothing for a plan it does not know', () => {
    const before = structuredClone(S())
    expect(loadStarterPlanWithUndo('nope')).toBeNull()
    expect(loadStarterPlanWithUndo(undefined)).toBeNull()
    expect(S()).toEqual(before)
  })
})

describe('firstPlannedDay', () => {
  it('honours a day override: a rested day is not the start', () => {
    loadStarterPlanWithUndo('ppl', { today: WED })
    const ids = S().week[3]
    useStore.setState(s => ({ S: { ...s.S, dayPlan: { [WED]: 'rest' } } }))
    expect(firstPlannedDay(S(), ids, WED)).toBe('2026-10-28')
  })
})
