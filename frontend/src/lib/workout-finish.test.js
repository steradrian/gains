// @vitest-environment happy-dom
// The Finish drawer's facts (W1.10, W1.11 and the Edges rows) and the one best rule the drawer, the
// live NEW BEST and the save share (workout-finish.js).
import { describe, expect, it } from 'vitest'
import { DEF } from '../store/useStore.js'
import { exOr } from './exercises.js'
import { exerciseNameText, fmtNum } from './format.js'
import {
  beatsBest, clockText, finishFacts, listText, notDoneHeadline, notDoneOf, notDoneSentence, sameRoutines,
  sessionBests, volumeDelta, volumeText,
} from './workout-finish.js'

const clone = v => JSON.parse(JSON.stringify(v))
const BENCH = '0025', FLY = '0227', LATERAL = '0334', SITUP = '0001', SQUAT = '0043', DIP = '0251'
const name = id => exerciseNameText(exOr(id))
const START = Date.parse('2026-10-18T17:42:00')

const set = (w, r, done = true, extra = {}) => ({ w, r, done, ...(done ? { at: START + 60000 } : {}), ...extra })
const entry = (id, sets, extra = {}) => ({ id, target: { mode: 'reps', sets: sets.length, reps: 8 }, sets, ...extra })
const hold = (id, done = false) => ({ id, part: 'cooldown', target: { mode: 'time', sets: 1, sec: 30 }, sets: [{ w: 0, sec: 30, done }] })
const active = (entries, over = {}) => ({ id: 'a1', d: '2026-10-18', start: START, routineIds: ['push'], name: 'Push A', cur: 0, entries, ...over })
const state = (workouts = []) => ({ ...clone(DEF), workouts })
const past = (id, sets) => ({ id: 'w-' + id + sets[0].w, d: '2026-10-10', start: START - 8 * 86400000, end: START - 8 * 86400000 + 3600000, routineIds: ['push'], entries: [{ id, sets }] })

// Push A, finished early: the warm-up done, Bench done, Cable fly 1 of 3, Lateral raise and Squat
// not started, the two stretches not started.
const early = () => active([
  entry(SITUP, [set(0, 15)], { part: 'warmup' }),
  entry(BENCH, [set(40, 5, true, { phase: 'warmup' }), set(80, 8), set(80, 8), set(80, 8)]),
  entry(FLY, [set(17.5, 12), set(17.5, 12, false), set(17.5, 12, false)]),
  entry(LATERAL, [set(8, 15, false), set(8, 15, false)]),
  entry(SQUAT, [set(100, 5, false)]),
  hold(DIP), hold(SQUAT),
])

describe('notDoneOf and its sentences (W1.11)', () => {
  it('names what is left, what was not started, and the cool-down as one thing', () => {
    const nd = notDoneOf(early())
    expect(nd.left).toEqual([{ id: FLY, name: name(FLY), left: 2 }])
    expect(nd.notStarted.map(x => x.id)).toEqual([LATERAL, SQUAT])
    expect(nd.parts).toEqual([{ part: 'cooldown', count: 2, phrase: 'the 2 stretches', plural: true }])
    expect(notDoneHeadline(nd)).toBe('2 exercises and the cool-down not started')
    expect(notDoneSentence(nd, 'Push A')).toBe(
      `${name(FLY)} has 2 sets left; ${name(LATERAL)} and ${name(SQUAT)} were not started, nor the 2 stretches. They stay in Push A for next time.`)
  })

  it('freestyle says nothing about next time', () => {
    expect(notDoneSentence(notDoneOf(early()), null)).not.toContain('next time')
  })

  it('one thing left: "It stays", and the headline counts the sets', () => {
    const A = active([entry(BENCH, [set(80, 8), set(80, 8, false)])])
    const nd = notDoneOf(A)
    expect(notDoneHeadline(nd)).toBe('1 set left')
    expect(notDoneSentence(nd, 'Push A')).toBe(`${name(BENCH)} has 1 set left. It stays in Push A for next time.`)
  })

  it('one exercise not started reads singular', () => {
    const nd = notDoneOf(active([entry(BENCH, [set(80, 8)]), entry(FLY, [set(17.5, 12, false)])]))
    expect(notDoneHeadline(nd)).toBe('1 exercise not started')
    expect(notDoneSentence(nd, null)).toBe(`${name(FLY)} was not started.`)
  })

  it('only the cool-down not started', () => {
    const nd = notDoneOf(active([entry(BENCH, [set(80, 8)]), hold(DIP)]))
    expect(notDoneHeadline(nd)).toBe('Cool-down not started')
    expect(notDoneSentence(nd, 'Push A')).toBe('The 1 stretch was not started. It stays in Push A for next time.')
  })

  it('a cool-down that is not all holds is "the cool-down"', () => {
    const nd = notDoneOf(active([entry(BENCH, [set(80, 8)]), entry(LATERAL, [set(8, 15, false)], { part: 'cooldown' })]))
    expect(nd.parts[0].phrase).toBe('the cool-down')
    expect(notDoneSentence(nd, null)).toBe('The cool-down was not started.')
  })

  it('a cool-down begun lists its exercises one by one', () => {
    const nd = notDoneOf(active([entry(BENCH, [set(80, 8)]), hold(DIP, true), hold(SQUAT)]))
    expect(nd.parts).toEqual([])
    expect(nd.notStarted.map(x => x.id)).toEqual([SQUAT])
  })

  it('a part skipped from its offer is not missing', () => {
    const nd = notDoneOf(active([entry(BENCH, [set(80, 8)]), hold(DIP)], { skipped: { cooldown: true } }))
    expect(nd).toEqual({ left: [], notStarted: [], parts: [] })
  })

  it('a warm-up not started reads as the warm-up', () => {
    const nd = notDoneOf(active([entry(SITUP, [set(0, 10, false)], { part: 'warmup' }), entry(BENCH, [set(80, 8)])]))
    expect(notDoneHeadline(nd)).toBe('Warm-up not started')
    expect(notDoneSentence(nd, null)).toBe('The warm-up was not started.')
  })

  it('a warm-up row left unticked is not work left', () => {
    const nd = notDoneOf(active([entry(BENCH, [set(40, 5, false, { phase: 'warmup' }), set(80, 8)])]))
    expect(nd).toEqual({ left: [], notStarted: [], parts: [] })
  })
})

describe('finishFacts', () => {
  const now = START + (51 * 60 + 40) * 1000

  it('early: the clock, working sets and volume without warm-ups, the sentence', () => {
    const f = finishFacts(state(), early(), now)
    expect(f).toMatchObject({ kind: 'early', name: 'Push A', title: 'Finish early?', clockText: '51:40', fromRoutine: true })
    // Bench 3 + Cable fly 1; the warm-up exercise and Bench's warm-up row are left out.
    expect(f.sets).toBe(4)
    // 3 × 80 × 8 + 17.5 × 12 = 2,130 kg.
    expect(f.volume).toBe(2130)
    expect(f.volumeText).toBe('2.1 t')
    expect(f.headline).toBe('2 exercises and the cool-down not started')
    expect(f.sentence).toContain('They stay in Push A for next time.')
  })

  it('every set done: "Finish Push A?" and the bests by name', () => {
    const A = active([entry(BENCH, [set(85, 8)]), entry(FLY, [set(20, 12)]), hold(DIP, true)])
    const st = state([past(BENCH, [set(100, 1)]), past(FLY, [set(17.5, 12)])])
    const f = finishFacts(st, A, now)
    expect(f).toMatchObject({ kind: 'done', title: 'Finish Push A?', headline: null, sentence: null })
    expect(f.bests).toEqual([{ id: FLY, name: name(FLY), kind: 'weight' }, { id: BENCH, name: name(BENCH), kind: 'e1rm' }])
    expect(f.bestsCount).toBe('2 new bests')
    expect(f.bestsLine).toBe(`${name(FLY)}, ${name(BENCH)} est. 1RM`)
  })

  it('nothing ticked: says so, with the Edges wording', () => {
    const f = finishFacts(state(), active([entry(BENCH, [set(80, 8, false)])]), now)
    expect(f).toMatchObject({ kind: 'nothing', title: 'Nothing logged yet', message: 'You haven’t checked off any sets. Finish anyway?', sets: 0, bests: [] })
  })

  it('an empty workout is its own case', () => {
    expect(finishFacts(state(), active([], { routineIds: [], name: 'Freestyle' }), now)).toMatchObject({ kind: 'empty', fromRoutine: false })
    expect(finishFacts(state(), null)).toBeNull()
  })

  it('freestyle is not from a routine', () => {
    const f = finishFacts(state(), active([entry(BENCH, [set(80, 8), set(80, 8, false)])], { routineIds: [] }), now)
    expect(f.fromRoutine).toBe(false)
    expect(f.sentence).toBe(`${name(BENCH)} has 1 set left.`)
  })
})

describe('sessionBests and beatsBest', () => {
  it('a heavier load is a weight best; a better estimate alone an e1RM best; parts never', () => {
    const st = state([past(BENCH, [set(100, 1)]), past(FLY, [set(17.5, 12)])])
    const A = active([
      entry(SITUP, [set(20, 15)], { part: 'warmup' }),
      entry(BENCH, [set(40, 5, true, { phase: 'warmup' }), set(85, 8)]),
      entry(FLY, [set(20, 12)]),
      entry(LATERAL, [set(30, 10)], { part: 'cooldown' }),
    ])
    const { prs, e1prs } = sessionBests(st, A)
    expect(prs).toEqual([FLY])
    expect(e1prs.map(p => p.id)).toEqual([BENCH])
    expect(e1prs[0].prev).toBeGreaterThan(0)
  })

  it('a first time is a best (nothing logged before), as the save has always counted it', () => {
    expect(sessionBests(state(), active([entry(BENCH, [set(60, 5)])])).prs).toEqual([BENCH])
  })

  it('one set: done working sets of the workout part that beat the best before', () => {
    const st = state([past(BENCH, [set(100, 5)])])
    const bench = entry(BENCH, [])
    expect(beatsBest(st, bench, set(102.5, 3))).toBe(true)
    expect(beatsBest(st, bench, set(100, 8))).toBe(false)
    expect(beatsBest(st, bench, set(110, 3, false))).toBe(false)
    expect(beatsBest(st, bench, set(110, 3, true, { phase: 'warmup' }))).toBe(false)
    expect(beatsBest(st, { ...bench, part: 'warmup' }, set(110, 3))).toBe(false)
    expect(beatsBest(st, { ...bench, part: 'cooldown' }, set(110, 3))).toBe(false)
  })
})

describe('formatting', () => {
  it('the clock', () => {
    expect(clockText((51 * 60 + 40) * 1000)).toBe('51:40')
    expect(clockText(0)).toBe('0:00')
    expect(clockText(75 * 60000)).toBe('1:15:00')
    expect(clockText(23 * 3600000 + 5000)).toBe('23:00:05')
  })

  it('volume in tonnes from a tonne in kilograms; pounds stay pounds', () => {
    expect(volumeText(6400, 'kg')).toBe('6.4 t')
    expect(volumeText(850, 'kg')).toBe('850 kg')
    expect(volumeText(6400, 'lb')).toBe(fmtNum(6400) + ' lb')
  })

  it('the delta in the larger one\'s unit', () => {
    expect(volumeDelta(6400, 6100, 'kg')).toEqual({ dir: 1, text: 'up 0.3 t' })
    expect(volumeDelta(6100, 6400, 'kg')).toEqual({ dir: -1, text: 'down 0.3 t' })
    expect(volumeDelta(6420, 6400, 'kg')).toEqual({ dir: 0, text: 'same as last time' })
    expect(volumeDelta(900, 700, 'kg')).toEqual({ dir: 1, text: 'up 200 kg' })
  })

  it('lists', () => {
    expect(listText(['A'])).toBe('A')
    expect(listText(['A', 'B'])).toBe('A and B')
    expect(listText(['A', 'B', 'C'])).toBe('A, B and C')
  })

  it('the same routines, in any order; freestyle never', () => {
    expect(sameRoutines({ routineIds: ['a', 'b'] }, ['b', 'a'])).toBe(true)
    expect(sameRoutines({ routineId: 'a' }, ['a'])).toBe(true)
    expect(sameRoutines({ routineIds: ['a'] }, ['a', 'b'])).toBe(false)
    expect(sameRoutines({ routineIds: [] }, [])).toBe(false)
  })
})
