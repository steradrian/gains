// @vitest-environment happy-dom
// workout.share = { off?: true, best?: [exerciseId] }: each choice writes exactly its field, a
// default is never stored, Don't share this one keeps the rest and the workout, and a new best is
// the exercise id only.
import { beforeEach, describe, expect, it } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { setShareBest, setShareOff, shareOf } from './workout-share.js'

const clone = v => JSON.parse(JSON.stringify(v))
const W = {
  id: 'w1', d: '2026-10-18', start: 1, end: 2, name: 'Push A', prs: ['0227'],
  entries: [{ id: '0227', sets: [{ w: 20, r: 12, done: true }] }],
}
const rec = () => useStore.getState().S.workouts[0]

beforeEach(() => {
  useStore.setState({ S: { ...clone(DEF), workouts: [clone(W)] }, user: null })
})

describe('shareOf', () => {
  it('is empty for a workout that follows the defaults, and drops what is not in the shape', () => {
    expect(shareOf(W)).toEqual({})
    expect(shareOf(null)).toEqual({})
    expect(shareOf({ share: { off: false, best: [], weight: 80, x: 1 } })).toEqual({})
    expect(shareOf({ share: { off: true, best: ['0227', '0227', 5] } })).toEqual({ off: true, best: ['0227'] })
  })
})

describe('Don\'t share this one', () => {
  it('writes off: true and stamps the record; nothing else on the workout changes', () => {
    const before = clone(rec())
    expect(setShareOff(W, true)).toBe(true)
    expect(rec().share).toEqual({ off: true })
    expect(rec()._ts).toBeGreaterThan(0)
    expect({ ...rec(), share: undefined, _ts: undefined }).toEqual({ ...before, share: undefined, _ts: undefined })
  })

  it('turned off again, the field goes away rather than storing a default', () => {
    setShareOff(W, true)
    expect(setShareOff(W, false)).toBe(true)
    expect('share' in rec()).toBe(false)
  })

  it('keeps the bests the person picked', () => {
    setShareBest(W, '0227', true)
    setShareOff(W, true)
    expect(rec().share).toEqual({ off: true, best: ['0227'] })
    setShareOff(W, false)
    expect(rec().share).toEqual({ best: ['0227'] })
  })

  it('the same value writes nothing and stamps nothing', () => {
    const before = useStore.getState().S
    expect(setShareOff(W, false)).toBe(false)
    expect(useStore.getState().S).toBe(before)
    expect(rec()._ts).toBeUndefined()
  })
})

describe('a new best', () => {
  it('shares the exercise id and nothing else: no weight or set is copied onto the record', () => {
    expect(setShareBest(W, '0227', true)).toBe(true)
    expect(rec().share).toEqual({ best: ['0227'] })
    expect(rec().entries).toEqual(W.entries)
  })

  it('adds each exercise once and removes only the one switched off', () => {
    setShareBest(W, '0227', true)
    setShareBest(W, '0025', true)
    expect(setShareBest(W, '0227', true)).toBe(false)
    expect(rec().share.best).toEqual(['0227', '0025'])
    setShareBest(W, '0227', false)
    expect(rec().share.best).toEqual(['0025'])
    setShareBest(W, '0025', false)
    expect('share' in rec()).toBe(false)
  })

  it('keeps off when it is set', () => {
    setShareOff(W, true)
    setShareBest(W, '0227', true)
    expect(rec().share).toEqual({ off: true, best: ['0227'] })
  })
})

describe('defaults and missing workouts', () => {
  it('a workout nobody touched has no share field', () => {
    expect('share' in rec()).toBe(false)
  })

  it('a workout that is gone changes nothing', () => {
    expect(setShareOff({ id: 'gone', d: '2026-01-01' }, true)).toBe(false)
    expect('share' in rec()).toBe(false)
  })
})
