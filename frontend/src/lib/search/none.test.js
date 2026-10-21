// @vitest-environment happy-dom
// Nothing matches (board Sh0None) and no such exercise (Sh0NoExercise): what is said, and only the
// ways on that apply, in the board's order.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CATALOGUE } from '../exercises.js'
import { exerciseNameText } from '../format.js'
import { exerciseMiss, noneActions, noneHeading } from './none.js'
import { noteOpened, useRecents } from './recents.js'
import { searchLocal } from './results.js'

const byId = new Map(CATALOGUE.map(ex => [ex.id, ex]))
const data = (over = {}) => ({
  S: { routines: [], workouts: [], customEx: [], dayPlan: {}, week: {} }, exercises: CATALOGUE, nameOf: id => (byId.has(id) ? exerciseNameText(byId.get(id)) : ''),
  nutrition: true, pagesCtx: { nutrition: true, checkIn: true, fastingOn: false },
  settingsCtx: { user: { id: 1 }, mobile: false, nutrition: true, ntSettings: null, lang: 'en' }, foods: [{ id: 5, name: 'Protein bar', portion: 60, unit: 'g', nutrition: { calories: 210 } }],
  ...over,
})
const lateral = CATALOGUE.find(e => /lateral raise/i.test(exerciseNameText(e)))

describe('nothing matches', () => {
  it('says so, with a line on what to do', () => {
    expect(noneHeading(' protien bar ', 'any')).toEqual({ title: 'Nothing matches “protien bar”', body: 'Try another word, or make it yourself.' })
    expect(noneHeading('cable Y raise', 'exercise')).toEqual({ title: 'No exercise called “cable Y raise”', body: 'It isn’t in the library or your own exercises yet.' })
  })

  it('Did you mean (a food of yours, as its row), Create food, Create exercise, Search Open Food Facts', () => {
    const actions = noneActions({ query: 'protien bar', data: data(), onlineStatus: 'tap' })
    expect(actions.map(a => a.kind)).toEqual(['near', 'create-food', 'create-exercise', 'online'])
    expect(actions[0]).toMatchObject({ title: 'Did you mean “Protein bar”?', name: 'Protein bar', sub: 'Your food · 60 g', row: { type: 'food', id: 5 } })
    expect(actions[1]).toMatchObject({ title: 'Create food “protien bar”', sub: 'Opens the food editor with this name', name: 'protien bar' })
    expect(actions[2]).toMatchObject({ title: 'Create exercise “protien bar”', sub: 'Opens New exercise with this name' })
    expect(actions[3]).toMatchObject({ title: 'Search Open Food Facts', sub: 'For “protien bar”, online' })
  })

  it('only the ones that apply: no food without nutrition, no Open Food Facts once asked, offline or off', () => {
    const kinds = over => noneActions({ query: 'qqzzxxv', data: data(over.data), onlineStatus: over.online }).map(a => a.kind)
    expect(kinds({ online: 'tap' })).toEqual(['create-food', 'create-exercise', 'online'])
    expect(kinds({ data: { nutrition: false }, online: 'off' })).toEqual(['create-exercise'])
    for (const online of ['ready', 'offline', 'off', 'error']) expect(kinds({ online })).toEqual(['create-food', 'create-exercise'])
    expect(noneActions({ query: '  ', data: data() })).toEqual([])
  })
})

describe('Did you mean', () => {
  const foods = [{ id: 7, name: 'Rice cake', portion: 1, unit: 'g', nutrition: { calories: 1 } }, { id: 8, name: 'Rice bake', portion: 1, unit: 'g', nutrition: { calories: 1 } }]
  afterEach(() => useRecents.setState({ opened: {} }))

  it('on a tie, takes the one opened more often from search', () => {
    const near = () => noneActions({ query: 'rice xake', data: data({ foods, exercises: [] }) }).find(a => a.kind === 'near')
    expect(near().name).toBe('Rice cake')
    noteOpened('food:8')
    expect(near()).toMatchObject({ name: 'Rice bake', row: { type: 'food', id: 8 } })
  })

  it('folds the 5,600 exercise names once per list and language, not on every search', () => {
    const d = data()
    const nameOf = vi.fn(d.nameOf)
    const same = { ...d, nameOf }
    noneActions({ query: 'qqzzxxv', data: same })
    const once = nameOf.mock.calls.length
    expect(once).toBeGreaterThan(1000)
    noneActions({ query: 'qqzzxxvw', data: same })
    noneActions({ query: 'protien bar', data: same })
    expect(nameOf.mock.calls.length).toBe(once)
    // Another language (a new nameOf) reads the names again.
    noneActions({ query: 'qqzzxxv', data: { ...same, nameOf: vi.fn(d.nameOf) } })
    expect(nameOf.mock.calls.length).toBe(once)
  })
})

describe('no such exercise', () => {
  it('reads an exercise search from Train, or scoped to exercises, that found none', () => {
    const local = searchLocal('cable y raise', data(), 'train')
    expect(exerciseMiss({ query: 'cable y raise', tab: 'train', group: null, local: { ...local, groups: { ...local.groups, exercises: [] }, best: null } })).toBe(true)
    expect(exerciseMiss({ query: 'x', tab: 'home', group: 'exercises', local: { groups: { exercises: [] }, best: null } })).toBe(true)
    expect(exerciseMiss({ query: 'x', tab: 'home', group: null, local: { groups: { exercises: [] }, best: null } })).toBe(false)
    expect(exerciseMiss({ query: 'x', tab: 'train', group: null, local: { groups: { exercises: [] }, best: { group: 'exercises' } } })).toBe(false)
    expect(exerciseMiss({ query: '', tab: 'train', group: null, local: { groups: { exercises: [] }, best: null } })).toBe(false)
  })

  it('Create first, then Did you mean an exercise (never a food)', () => {
    const name = exerciseNameText(lateral)
    const typo = name.slice(0, -1) + (name.endsWith('e') ? 'a' : 'e')
    const actions = noneActions({ query: typo, data: data(), mode: 'exercise', onlineStatus: 'tap' })
    expect(actions[0]).toMatchObject({ kind: 'create-exercise', title: `Create “${typo}”`, sub: 'Opens New exercise with the name filled in', name: typo })
    expect(actions.slice(1).map(a => a.kind)).toEqual(['near'])
    expect(actions[1].row.type).toBe('exercise')
    expect(noneActions({ query: 'protien bar', data: data({ exercises: [] }), mode: 'exercise' }).map(a => a.kind)).toEqual(['create-exercise'])
  })
})
