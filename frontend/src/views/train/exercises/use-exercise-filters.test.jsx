// @vitest-environment happy-dom
// The filters the Exercises page and By muscle share: search, body part, equipment, type,
// favourites and the equipment profile. The page tests cover what shows; these cover the rules.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EQUIP_ANY, EQUIP_PROFILE, useExerciseFilters } from './use-exercise-filters.js'
import { CATALOGUE, CATEGORIES, EXDB } from '../../../lib/exercises.js'
import { newProfile } from '../../../lib/equipment.js'
import { exercisesForMuscle } from '../../../lib/muscle-explore.js'
import { DEF, useStore } from '../../../store/useStore.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
vi.setConfig({ testTimeout: 15000 })

const mounted = []
function Probe({ muscle, out }) {
  out.current = useExerciseFilters({ muscle })
  return null
}
function setup(muscle = null) {
  const out = { current: null }
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(<Probe muscle={muscle} out={out} />))
  const rerender = m => act(() => root.render(<Probe muscle={m} out={out} />))
  return { f: () => out.current, rerender }
}
const seed = over => useStore.setState(s => ({ S: { ...structuredClone(DEF), ...over }, user: s.user }))
const day = (id, n = 0) => {
  const d = new Date(); d.setHours(9, 0, 0, 0); d.setDate(d.getDate() - n)
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { id: 'w' + id + n, d: iso, start: d.getTime(), end: d.getTime() + 3600000, name: 'x', prs: [], entries: [{ id, target: {}, sets: [{ w: 50, r: 8, done: true }] }] }
}

beforeEach(() => { seed({}); document.body.innerHTML = '' })
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('useExerciseFilters', () => {
  it('lists the catalogue a page at a time, A to Z, and Show more adds the next page', () => {
    const { f } = setup()
    expect(f().visible).toHaveLength(40)
    expect(f().hasMore).toBe(true)
    expect(f().total).toBe(CATALOGUE.length)
    act(() => f().more())
    expect(f().visible).toHaveLength(80)
  })

  it('puts favourites first, and exercises you have logged apart, most-trained first', () => {
    const [a, b, c] = CATALOGUE.slice(100, 103).map(e => e.id)
    seed({ favEx: [c], workouts: [day(a, 3), day(a, 2), day(b, 1)] })
    const { f } = setup()
    expect(f().logged.map(e => e.id)).toEqual([a, b])
    expect(f().visible[0].id).toBe(c)
    expect(f().visible.map(e => e.id)).not.toContain(a)
    expect(f().loggedCount).toBe(2)
  })

  it('a search ranks by relevance with yours first, and has no logged section', () => {
    const bench = '0025'
    seed({ workouts: [day(bench, 1)] })
    const { f } = setup()
    act(() => f().setQ('bench press'))
    expect(f().searching).toBe(true)
    expect(f().logged).toEqual([])
    expect(f().visible[0].id).toBe(bench)
    expect(f().narrowed).toBe(true)
  })

  it('offers similar exercises when the search runs out', () => {
    const { f } = setup()
    act(() => f().setQ('dumbbell curl qwxz'))
    expect(f().similar.length).toBeGreaterThan(0)
    expect(f().similar.map(e => e.id)).not.toContain(undefined)
  })

  it('body part narrows the list; the equipment choice survives it, and "All" clears it (#71)', () => {
    const { f } = setup()
    act(() => f().setBp('lower arms'))
    expect(f().total).toBe(CATALOGUE.filter(e => e.bp === 'lower arms').length)
    expect(f().eqOpts).toContain('dumbbell')
    act(() => f().setEq('dumbbell'))
    expect(f().eq).toBe('dumbbell')
    act(() => f().setBp('upper arms'))
    expect(f().eq).toBe('dumbbell')
    act(() => f().setBp(''))
    expect(f().eq).toBe('')
  })

  it('ignores an equipment or type choice the narrowing took away, so there is never a dead end', () => {
    const neck = CATALOGUE.filter(e => e.bp === 'neck')
    const away = [...new Set(CATALOGUE.map(e => e.eq))].find(x => x && !neck.some(e => e.eq === x))
    const awayCat = CATEGORIES.find(c => CATALOGUE.some(e => e.cat === c) && !neck.some(e => e.cat === c))
    const { f } = setup()
    act(() => f().setEq(away))
    expect(f().eq).toBe(away)
    act(() => f().setBp('neck'))
    expect(f().eq).toBe('')
    expect(f().total).toBe(neck.length)
    act(() => f().setBp(''))
    act(() => f().setCat(awayCat))
    expect(f().cat).toBe(awayCat)
    act(() => f().setBp('neck'))
    expect(f().cat).toBe('')
    expect(f().total).toBe(neck.length)
  })

  it('Favourites filters to the starred ones and counts them', () => {
    const ids = CATALOGUE.slice(0, 4).map(e => e.id)
    seed({ favEx: ids })
    const { f } = setup()
    expect(f().favCount).toBe(4)
    act(() => f().setFavOnly(true))
    expect(f().total).toBe(4)
    expect(f().narrowed).toBe(true)
  })

  it('the equipment profile filters by default, "any" turns it off, and a kind of equipment narrows within', () => {
    const profile = { ...newProfile('Home gym'), id: 'p1', equipment: ['dumbbell'] }
    seed({ equipProfiles: [profile], activeEquipId: 'p1', equipFilterOn: true })
    const { f } = setup()
    expect(f().profile.name).toBe('Home gym')
    expect(f().equipChoice).toBe(EQUIP_PROFILE)
    const within = f().total
    expect(within).toBeLessThan(CATALOGUE.length)
    act(() => f().chooseEquipment(EQUIP_ANY))
    expect(f().equipChoice).toBe(EQUIP_ANY)
    expect(f().total).toBe(CATALOGUE.length)
    act(() => f().chooseEquipment('barbell'))
    expect(f().equipChoice).toBe('barbell')
    act(() => f().chooseEquipment(EQUIP_PROFILE))
    expect(f().equipChoice).toBe(EQUIP_PROFILE)
    expect(f().total).toBe(within)
  })

  it('without a profile the choices are a kind of equipment, or any', () => {
    const { f } = setup()
    expect(f().profile).toBeNull()
    expect(f().equipChoice).toBe(EQUIP_ANY)
    act(() => f().setEq('barbell'))
    expect(f().equipChoice).toBe('barbell')
    expect(f().total).toBe(CATALOGUE.filter(e => e.eq === 'barbell').length)
  })

  it('a muscle scopes the list, and another muscle starts without the equipment choice', () => {
    const { f, rerender } = setup('chest')
    expect(f().muscleTotal).toBe(exercisesForMuscle(CATALOGUE, 'chest').length)
    expect(f().total).toBe(f().muscleTotal)
    act(() => f().setEq('dumbbell'))
    expect(f().eq).toBe('dumbbell')
    act(() => f().more())
    rerender('triceps')
    expect(f().eq).toBe('')
    expect(f().muscleTotal).toBe(exercisesForMuscle(CATALOGUE, 'triceps').length)
    expect(f().visible.length).toBeLessThanOrEqual(40)
  })

  it('only the equipment choice and the paging reset when the muscle changes', () => {
    const { f, rerender } = setup('chest')
    act(() => f().setQ('press'))
    act(() => f().setBp('chest'))
    rerender('triceps')
    expect(f().q).toBe('press')
    expect(f().bp).toBe('chest')
  })

  it('every exercise is shown once: logged, then the rest', () => {
    const ids = EXDB.slice(0, 3).map(e => e.id)
    seed({ workouts: ids.map(id => day(id, 1)) })
    const { f } = setup()
    expect(f().logged).toHaveLength(3)
    expect(f().logged.length + f().visible.length).toBe(Math.min(43, f().total))
    const all = [...f().logged, ...f().visible].map(e => e.id)
    expect(new Set(all).size).toBe(all.length)
  })
})
