// @vitest-environment happy-dom
// share-copy: the four switches turned into the preview's words, each line only when the person's
// own data backs it.
import { describe, expect, it } from 'vitest'
import { PREVIEW, PREVIEW_STATE, SHARE } from '../../dev/screens/states/friends-fixture.js'
import { neverShared, previewRows } from './share-copy.js'

const TODAY = '2026-10-21'   // a Wednesday
const ALL = { training: true, consistency: true, targets: true, bests: true }
const NONE = { training: false, consistency: false, targets: false, bests: false }
const bare = { workouts: [], routines: [], week: {} }
const keys = rows => rows.map(r => r.key)
const row = (rows, key) => rows.find(r => r.key === key)

describe('previewRows', () => {
  it('writes the board\'s lines from the person\'s own state', () => {
    expect(PREVIEW.map(r => r.title)).toEqual(['Training done', 'This week', 'Food targets', 'New bests'])
    expect(row(PREVIEW, 'training').sub).toMatch(/^Push B · .+ · 52 min$/)
    expect(row(PREVIEW, 'consistency').sub).toBe('4 of 4 planned workouts')
    expect(row(PREVIEW, 'targets').sub).toBe('Reached 5 of 7 days · no foods, no numbers')
    expect(row(PREVIEW, 'bests').sub).toBe('Off · you share them one by one')
    expect(SHARE.bests).toBe(false)
  })

  it('leaves a line out when its switch is off', () => {
    const rows = previewRows({ ...SHARE, training: false, targets: false }, PREVIEW_STATE, TODAY)
    expect(keys(rows)).toEqual(['consistency', 'bests'])
    expect(keys(previewRows(NONE, PREVIEW_STATE, TODAY))).toEqual(['bests'])
  })

  it('leaves a line out when the data cannot back it: no workout, no plan, no days on target', () => {
    const rows = previewRows(ALL, bare, TODAY)
    expect(keys(rows)).toEqual(['bests'])
  })

  it('a workout the person hid from friends is never the one shown', () => {
    const S = { ...bare, workouts: [
      { name: 'Legs', d: '2026-10-19', start: 1, end: 1 + 40 * 60000 },
      { name: 'Secret', d: '2026-10-20', start: 1, end: 1 + 30 * 60000, share: { off: true } },
    ] }
    expect(row(previewRows({ ...NONE, training: true }, S, TODAY), 'training').sub).toMatch(/^Legs · .+ · 40 min$/)
  })

  it('names no minutes when the workout has no duration, and no title means no line', () => {
    const S = { ...bare, workouts: [{ name: 'Legs', d: '2026-10-19' }] }
    expect(row(previewRows({ ...NONE, training: true }, S, TODAY), 'training').sub).toMatch(/^Legs · [^·]+$/)
    expect(previewRows({ ...NONE, training: true }, { ...bare, workouts: [{ d: '2026-10-19' }] }, TODAY)).toEqual([
      { key: 'bests', title: 'New bests', sub: 'Off · you share them one by one' },
    ])
  })

  it('counts food targets over the days that have an answer in the last seven, never more', () => {
    const S = { ...bare, targetsReached: { '2026-10-21': { all: true }, '2026-10-20': { all: false }, '2026-10-01': { all: true } } }
    expect(row(previewRows({ ...NONE, targets: true }, S, TODAY), 'targets').sub).toBe('Reached 1 of 2 days · no foods, no numbers')
  })

  it('new bests says how it works when on, and never the weight', () => {
    const sub = row(previewRows({ ...NONE, bests: true }, bare, TODAY), 'bests').sub
    expect(sub).toBe('On · only the exercise, never the weight')
  })

  it('never carries a weight, food or intake in any line', () => {
    const text = previewRows(ALL, PREVIEW_STATE, TODAY).map(r => r.title + ' ' + r.sub).join(' ')
    expect(text).not.toMatch(/\bkg\b|\blb\b|kcal|protein/i)
    expect(neverShared()).toBe('Never shared: weight, foods, what you ate, photos')
  })
})
