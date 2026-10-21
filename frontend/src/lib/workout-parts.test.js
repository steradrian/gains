import { describe, expect, it } from 'vitest'
import { partOf, partsOf, countsForRecords, countsForVolume, normaliseParts, partsInOrder, workingSetsDone, loggedSetsDone, PARTS } from './workout-parts.js'
import { makeSideSet, toggleSide } from './workout-model.js'

const e = (id, part, sets = []) => ({ id, ...(part ? { part } : {}), sets })
const done = (extra = {}) => ({ w: 60, r: 8, done: true, ...extra })
const open = (extra = {}) => ({ w: 60, r: 8, done: false, ...extra })
const warmRow = (extra = {}) => ({ w: 20, r: 10, done: true, phase: 'warmup', ...extra })

describe('partOf', () => {
  it('reads the two stored parts and treats anything else as the workout', () => {
    expect(partOf(e('a', 'warmup'))).toBe('warmup')
    expect(partOf(e('a', 'cooldown'))).toBe('cooldown')
    expect(partOf(e('a'))).toBe('main')
    expect(partOf({ part: 'main' })).toBe('main')
    expect(partOf({ part: 'stretch' })).toBe('main')
    expect(partOf(null)).toBe('main')
    expect(partOf(undefined)).toBe('main')
  })

  it('lists the parts in workout order', () => {
    expect(PARTS).toEqual(['warmup', 'main', 'cooldown'])
  })
})

describe('partsOf', () => {
  it('gives one run per part, with inclusive bounds and a count', () => {
    const list = [e('w1', 'warmup'), e('w2', 'warmup'), e('w3', 'warmup'), e('m1'), e('m2'), e('c1', 'cooldown')]
    expect(partsOf(list)).toEqual([
      { part: 'warmup', from: 0, to: 2, count: 3 },
      { part: 'main', from: 3, to: 4, count: 2 },
      { part: 'cooldown', from: 5, to: 5, count: 1 },
    ])
  })

  it('leaves out a part with no entries', () => {
    expect(partsOf([e('m1'), e('m2')])).toEqual([{ part: 'main', from: 0, to: 1, count: 2 }])
    expect(partsOf([e('w', 'warmup'), e('c', 'cooldown')]).map(p => p.part)).toEqual(['warmup', 'cooldown'])
  })

  it('is empty for no entries or a missing list', () => {
    expect(partsOf([])).toEqual([])
    expect(partsOf(undefined)).toEqual([])
  })

  it('never merges two stretches of a part that a broken order split', () => {
    expect(partsOf([e('m1'), e('w', 'warmup'), e('m2')]).map(p => [p.part, p.count])).toEqual([['main', 1], ['warmup', 1], ['main', 1]])
  })
})

describe('records and volume', () => {
  it('only the workout counts for records and for volume', () => {
    for (const fn of [countsForRecords, countsForVolume]) {
      expect(fn(e('m'))).toBe(true)
      expect(fn(e('w', 'warmup'))).toBe(false)
      expect(fn(e('c', 'cooldown'))).toBe(false)
    }
  })

  it('a warm-up row inside a working exercise keeps its own rule: the entry still counts', () => {
    expect(countsForRecords(e('m', null, [warmRow(), done()]))).toBe(true)
  })
})

describe('normaliseParts', () => {
  it('sorts warm-ups first and cool-downs last, keeping the order inside each part', () => {
    const list = [e('m1'), e('c1', 'cooldown'), e('w1', 'warmup'), e('m2'), e('w2', 'warmup'), e('c2', 'cooldown')]
    expect(normaliseParts(list).map(x => x.id)).toEqual(['w1', 'w2', 'm1', 'm2', 'c1', 'c2'])
  })

  it('returns the same array when nothing has to move, a new one with the same entries otherwise', () => {
    const ordered = [e('w', 'warmup'), e('m'), e('c', 'cooldown')]
    expect(normaliseParts(ordered)).toBe(ordered)
    const broken = [e('m'), e('w', 'warmup')]
    const out = normaliseParts(broken)
    expect(out).not.toBe(broken)
    expect(out[0]).toBe(broken[1])
    expect(broken.map(x => x.id)).toEqual(['m', 'w'])
  })

  it('keeps a routine without parts exactly as it was', () => {
    const list = [e('a'), e('b'), e('c')]
    expect(normaliseParts(list)).toBe(list)
  })

  it('always ends in order', () => {
    const list = [e('c', 'cooldown'), e('m'), e('w', 'warmup'), e('m2'), e('c2', 'cooldown'), e('w2', 'warmup')]
    expect(partsInOrder(list)).toBe(false)
    expect(partsInOrder(normaliseParts(list))).toBe(true)
    expect(normaliseParts(undefined)).toEqual([])
  })
})

describe('set counts', () => {
  const A = {
    entries: [
      e('bike', 'warmup', [done({ min: 5 }), done()]),
      e('bench', null, [warmRow(), done(), done(), open()]),
      e('row', null, [done()]),
      e('stretch', 'cooldown', [done({ sec: 30 }), open()]),
    ],
  }

  it('workingSetsDone counts done work rows of the workout part only (the summary\'s Sets)', () => {
    expect(workingSetsDone(A)).toBe(3)
  })

  it('loggedSetsDone counts every done row of every part, warm-up rows included (the discard confirm)', () => {
    expect(loggedSetsDone(A)).toBe(7)
  })

  it('counts each finished side of a per-side row on its own', () => {
    const side = toggleSide(makeSideSet({ w: 10, r: 16, done: false }), 'L')
    const B = { entries: [e('lunge', null, [side]), e('pigeon', 'cooldown', [toggleSide(toggleSide(makeSideSet({ sec: 30, done: false }), 'L'), 'R')])] }
    expect(workingSetsDone(B)).toBe(1)
    expect(loggedSetsDone(B)).toBe(3)
  })

  it('is 0 with nothing running', () => {
    expect(workingSetsDone(null)).toBe(0)
    expect(loggedSetsDone(undefined)).toBe(0)
  })
})
