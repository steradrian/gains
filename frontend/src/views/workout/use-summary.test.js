// @vitest-environment happy-dom
// The summary's model (use-summary.js, W2.0 and W2.2): tiles with and without a previous workout of
// the same routines, the first time, new bests, last and next time in words, and cardio.
import { describe, expect, it } from 'vitest'
import { DEF } from '../../store/useStore.js'
import { exOr } from '../../lib/exercises.js'
import { exerciseNameText, fmtDate } from '../../lib/format.js'
import { setLabel } from '../../lib/history.js'
import { speedUnitOf } from '../../lib/speed.js'
import { nextText, summaryOf, trainedLine } from './use-summary.js'

const clone = v => JSON.parse(JSON.stringify(v))
const BENCH = '0025', FLY = '0227', SQUAT = '0043', RUN = '0334'
const name = id => exerciseNameText(exOr(id))
const at = (d, hm) => Date.parse(d + 'T' + hm + ':00')
const sets = (w, ...rs) => rs.map(r => ({ w, r, done: true }))
const workout = (id, d, routineIds, entries, over = {}) => ({
  id, d, start: at(d, '17:42'), end: at(d, '18:34'), routineIds, name: 'Push A', entries, ...over,
})
const routines = [{ id: 'push', name: 'Push A', ex: [{ id: BENCH, sets: 3, reps: 8, weight: 80 }] }]
const state = workouts => ({ ...clone(DEF), routines: clone(routines), workouts })

const before = [
  workout('w0', '2026-10-04', ['other'], [{ id: FLY, sets: sets(17.5, 12, 12, 12) }], { name: 'Chest' }),
  // The same 80 kg for fewer reps: today's 80 × 8 is no heavier, but a better estimated 1RM.
  workout('w1', '2026-10-11', ['push'], [{ id: BENCH, rid: 'push', sets: sets(80, 7, 7, 7) }]),
]
const today = workout('w2', '2026-10-18', ['push'], [
  { id: BENCH, rid: 'push', sets: sets(80, 8, 8, 7) },
  { id: FLY, sets: sets(20, 12, 12, 12) },
  { id: RUN, target: { mode: 'cardio' }, sets: [{ min: 20, speed: 8, done: true }] },
], { prs: [FLY], note: 'Felt strong' })

describe('summaryOf', () => {
  const S = state([...before, today])
  const m = summaryOf(S, 'w2')

  it('the heading, the date and the tiles, Volume against the last Push A', () => {
    expect(m.w).toBe(S.workouts[2])
    expect(m.eyebrow).toBe('Workout saved')
    expect(m.title).toBe('Push A, done')
    expect(m.dateLine.startsWith(fmtDate('2026-10-18', true) + ' · ')).toBe(true)
    expect(m.dateLine).toContain(' to ')
    // Sets: 3 bench, 3 fly and the run.
    expect(m.tiles.map(x => [x.key, x.label, x.value])).toEqual([['time', 'Time', '52 min'], ['sets', 'Sets', '7'], ['volume', 'Volume', '2.6 t']])
    // 2,560 kg (cardio carries no load) against 1,680 kg.
    expect(m.tiles[2].delta).toEqual({ dir: 1, text: 'up 0.9 t' })
    expect(m.first).toBe(false)
    expect(m.firstNote).toBeNull()
  })

  it('new bests: the weight best on its set, the estimated 1RM with how much it rose', () => {
    expect(m.bests[0]).toEqual({ id: FLY, name: name(FLY), kind: 'weight', text: '20 kg × 12 · best set ever' })
    expect(m.bests[1]).toMatchObject({ id: BENCH, kind: 'e1rm' })
    expect(m.bests[1].text).toMatch(/^Est\. 1RM .+ kg · up .+ kg$/)
  })

  it('what you just trained, with the trend in words', () => {
    expect(m.trained.find(r => r.id === BENCH)).toMatchObject({ line: '80 kg, 8 · 8 · 7', trend: 'up', trendText: 'up on last time' })
    expect(m.trained.find(r => r.id === FLY)).toMatchObject({ line: '20 kg × 12, 3 sets', trend: 'up' })
  })

  it('cardio as logged', () => {
    const row = today.entries[2]
    expect(m.cardio).toEqual([{ id: RUN, name: name(RUN), line: setLabel(RUN, row.sets[0], row.target, speedUnitOf(S)) }])
  })

  it('the note, the muscles and the photos', () => {
    expect(m.note).toBe('Felt strong')
    expect(m.muscles.chest).toBeGreaterThan(0)
    expect(m.media).toEqual([])
  })

  it('no such workout: null', () => {
    expect(summaryOf(S, 'gone')).toBeNull()
  })
})

describe('the first time (W2.2)', () => {
  it('no delta but "first time", no next time, and the note says why; the saved bests still show', () => {
    const first = workout('f', '2026-10-18', ['push'], [{ id: SQUAT, sets: sets(80, 5, 5, 5) }], { prs: [SQUAT] })
    const m = summaryOf(state([first]), 'f')
    expect(m.first).toBe(true)
    expect(m.tiles[2].delta).toEqual({ dir: null, text: 'first time' })
    expect(m.bests).toEqual([{ id: SQUAT, name: name(SQUAT), kind: 'weight', text: '80 kg × 5 · best set ever' }])
    expect(m.next).toEqual([])
    expect(m.firstNote).toBe('Your first Push A. Its new bests are below.')
    expect(m.trained).toEqual([{ id: SQUAT, name: name(SQUAT), line: '3 sets at 80 kg', trend: 'first', trendText: 'first time' }])
  })

  it('a first workout with no bests keeps the promise for the next one', () => {
    const first = workout('f', '2026-10-18', ['push'], [{ id: SQUAT, sets: sets(80, 5, 5, 5) }])
    const m = summaryOf(state([first]), 'f')
    expect(m.bests).toEqual([])
    expect(m.firstNote).toBe('Your first Push A. From the next one on, this shows what went up and your new bests.')
  })

  it('a first pairing of lifts trained before keeps the bests its record carries', () => {
    const earlier = workout('e', '2026-10-01', [], [{ id: SQUAT, sets: sets(70, 5, 5, 5) }], { name: 'Freestyle' })
    const first = workout('f', '2026-10-18', ['push'], [{ id: SQUAT, sets: sets(80, 5, 5, 5) }], { prs: [SQUAT] })
    const m = summaryOf(state([earlier, first]), 'f')
    expect(m.first).toBe(true)
    expect(m.bests.map(b => b.id)).toEqual([SQUAT])
  })

  it('freestyle has no comparison of its own: no delta, never "first"', () => {
    const free = workout('x', '2026-10-18', [], [{ id: BENCH, sets: sets(60, 5) }], { name: 'Freestyle' })
    const m = summaryOf(state([...before, free]), 'x')
    expect(m.first).toBe(false)
    expect(m.tiles[2].delta).toBeNull()
  })

  it('a workout of other routines is no previous one', () => {
    const m = summaryOf(state([before[0], workout('p', '2026-10-18', ['push'], [{ id: BENCH, sets: sets(80, 8) }])]), 'p')
    expect(m.first).toBe(true)
  })
})

describe('trainedLine', () => {
  it('reads the sets', () => {
    expect(trainedLine([{ w: 80, r: 8 }, { w: 80, r: 8 }, { w: 80, r: 7 }], 'kg')).toBe('80 kg, 8 · 8 · 7')
    expect(trainedLine([{ w: 30, r: 12 }, { w: 30, r: 12 }, { w: 30, r: 12 }], 'kg')).toBe('30 kg × 12, 3 sets')
    expect(trainedLine([{ w: 80, r: 8 }, { w: 75, r: 6 }], 'kg')).toBe('80 × 8 · 75 × 6')
    expect(trainedLine([{ w: 80, r: 5 }], 'kg')).toBe('80 kg × 5')
    expect(trainedLine([{ w: 0, r: 12 }, { w: 0, r: 10 }], 'kg')).toBe('12 · 10')
    expect(trainedLine([{ w: 24, r: 8 }, { w: 24, r: 8 }, { w: 24, r: 6 }], 'kg', true)).toBe('3 sets at 24 kg')
    expect(trainedLine([], 'kg')).toBe('')
  })

  it('marks a set taken to failure with F', () => {
    expect(trainedLine([{ w: 80, r: 8 }, { w: 80, r: 8 }, { w: 80, r: 6, f: true }], 'kg')).toBe('80 kg, 8 · 8 · 6 F')
    expect(trainedLine([{ w: 80, r: 6, f: true }], 'kg')).toBe('80 kg × 6 F')
    expect(trainedLine([{ w: 80, r: 8 }, { w: 75, r: 6, f: true }], 'kg')).toBe('80 × 8 · 75 × 6 F')
    expect(trainedLine([{ w: 30, r: 12, f: true }, { w: 30, r: 12, f: true }], 'kg')).toBe('30 kg × 12 F, 2 sets')
    expect(trainedLine([{ w: 0, r: 12, f: true }], 'kg')).toBe('12 F')
  })
})

describe('nextText', () => {
  it('step up, same again, lighter and deload in words', () => {
    expect(nextText({ kind: 'up', w: 82.5, r: 8, sets: 3 }, [], 'kg')).toBe('Step up to 82.5 kg × 8')
    expect(nextText({ kind: 'hold', w: 24, r: 8, sets: 3 }, [], 'kg')).toBe('Same again, aim for 8 · 8 · 8')
    expect(nextText({ kind: 'hold', w: 24, r: 8, sets: null }, [{}, {}], 'kg')).toBe('Same again, aim for 8 · 8')
    expect(nextText({ kind: 'down', w: 7, r: 15, sets: 3 }, [], 'kg')).toBe('Lighter: 7 kg × 15')
    expect(nextText({ kind: 'deload', w: 60, r: 5, sets: 3 }, [], 'kg')).toBe('Deload: 60 kg × 5')
    expect(nextText({ kind: 'up', w: null, r: 12, sets: 3 }, [], 'kg')).toBe('Step up to 12 reps')
  })
})
