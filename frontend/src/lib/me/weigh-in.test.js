// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { mergeStates } from '../sync-merge.js'
import { deleteWeighIn, loggedAt, putWeighIn, saveWeighIn, setBack, undoWeighIn, weighInOn } from './weigh-in.js'

vi.mock('../api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../nutrition/sync.js', () => ({ syncNow: vi.fn(() => Promise.resolve()) }))

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const state = () => Object.assign(clone(DEF), { unit: 'kg', bodyweight: [{ d: '2026-10-04', w: 82.1, t: 1000 }, { d: '2026-10-11', w: 81.7, t: 2000 }] })

beforeEach(() => { useStore.setState({ S: state(), user: null }) })
afterEach(() => { localStorage.clear() })

describe('putWeighIn and setBack on a draft', () => {
  it('replaces the day, stamped, and returns what it replaced', () => {
    const draft = state()
    expect(putWeighIn(draft, '2026-10-11', 81.5, 5000)).toEqual({ d: '2026-10-11', w: 81.7, t: 2000 })
    expect(draft.bodyweight.find(b => b.d === '2026-10-11')).toEqual({ d: '2026-10-11', w: 81.5, t: 5000 })
  })

  it('adds a new day in order, one entry per day, and returns null', () => {
    const draft = state()
    expect(putWeighIn(draft, '2026-10-08', 82, 5000)).toBeNull()
    expect(draft.bodyweight.map(b => b.d)).toEqual(['2026-10-04', '2026-10-08', '2026-10-11'])
    putWeighIn(draft, '2026-10-08', 81.9, 6000)
    expect(draft.bodyweight).toHaveLength(3)
  })

  it('setBack restores the old entry stamped now, or removes the day when there was none', () => {
    const draft = state()
    setBack(draft, '2026-10-11', { d: '2026-10-11', w: 80, t: 1 }, 9000)
    expect(draft.bodyweight.at(-1)).toEqual({ d: '2026-10-11', w: 80, t: 9000 })
    setBack(draft, '2026-10-11', null)
    expect(draft.bodyweight.map(b => b.d)).toEqual(['2026-10-04'])
  })
})

describe('the store writes', () => {
  it('saveWeighIn returns the entry it replaced and Undo puts it back', () => {
    const before = saveWeighIn('2026-10-11', 81.4)
    expect(before).toMatchObject({ d: '2026-10-11', w: 81.7 })
    expect(weighInOn(S(), '2026-10-11').w).toBe(81.4)
    undoWeighIn('2026-10-11', before)
    expect(weighInOn(S(), '2026-10-11').w).toBe(81.7)
  })

  it('deleteWeighIn records the tombstone, and Undo brings the day back over it', () => {
    const removed = deleteWeighIn('2026-10-11')
    expect(removed).toMatchObject({ d: '2026-10-11', w: 81.7 })
    expect(weighInOn(S(), '2026-10-11')).toBeNull()
    expect(S().deleted.bodyweight['2026-10-11']).toBeGreaterThan(0)
    undoWeighIn('2026-10-11', removed)
    expect(weighInOn(S(), '2026-10-11').w).toBe(81.7)
    expect(S().deleted.bodyweight['2026-10-11']).toBeLessThan(0)
    // The sync keeps it against a copy that still has the old entry.
    const merged = mergeStates(S(), { ...clone(state()), deleted: {} })
    expect(merged.bodyweight.find(b => b.d === '2026-10-11').w).toBe(81.7)
  })

  it('deleting a day with no weigh-in returns null', () => {
    expect(deleteWeighIn('2026-01-01')).toBeNull()
  })
})

describe('loggedAt', () => {
  it('gives the time of an entry written on its own day', () => {
    const at = new Date(2026, 9, 11, 7, 40).getTime()
    const got = loggedAt({ d: '2026-10-11', w: 81.7, t: at })
    expect(got.day).toBe('2026-10-11')
    expect(got.time.getHours()).toBe(7)
    expect(got.time.getMinutes()).toBe(40)
  })

  it('says nothing for a stamp from another day, or none', () => {
    expect(loggedAt({ d: '2026-10-11', w: 81.7, t: new Date(2026, 9, 14, 7, 40).getTime() })).toBeNull()
    expect(loggedAt({ d: '2026-10-11', w: 81.7 })).toBeNull()
    expect(loggedAt(null)).toBeNull()
  })
})
