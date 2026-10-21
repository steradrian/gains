// The parts of a workout: warm-up exercises first, the workout, cool-down stretches last
// (PR-03, owner question 2). `entry.part` is 'warmup' or 'cooldown', written only then; an entry
// without it is the workout itself, so every routine and session saved before parts existed is
// all workout and reads exactly as it did.
//
// Warm-up and cool-down exercises count in history and the muscle map, never in volume, bests,
// `exWeights` or progression. Warm-up rows inside a working exercise keep their own rule
// (workout-model.js isWarmupRow) and are independent of this.
//
// Imports only workout-model.js, so history.js and every finish helper can import this file
// without a cycle.
import { isWarmupRow, isSideSet } from './workout-model.js'

export const PARTS = ['warmup', 'main', 'cooldown']

/** 'warmup' | 'main' | 'cooldown'. Anything but the two stored values is the workout. */
export function partOf(entry) {
  const part = entry?.part
  return part === 'warmup' || part === 'cooldown' ? part : 'main'
}

const rank = entry => PARTS.indexOf(partOf(entry))

/**
 * The runs of each part in `entries`, in order: `[{ part, from, to, count }]`, `to` inclusive.
 * Only parts that have entries are listed. Assumes the ordering invariant (normaliseParts); a
 * list that breaks it gets one run per contiguous stretch, so nothing is silently merged.
 */
export function partsOf(entries) {
  const list = Array.isArray(entries) ? entries : []
  const out = []
  list.forEach((entry, i) => {
    const part = partOf(entry)
    const last = out[out.length - 1]
    if (last && last.part === part) { last.to = i; last.count++ }
    else out.push({ part, from: i, to: i, count: 1 })
  })
  return out
}

/** False for warm-up and cool-down exercises: they never make a best or feed `exWeights`. */
export const countsForRecords = entry => partOf(entry) === 'main'

/** False for warm-up and cool-down exercises: they never add to a workout's volume. */
export const countsForVolume = entry => partOf(entry) === 'main'

/**
 * A stable sort into warm-up, workout, cool-down. Returns the same array when it is already in
 * order, so a caller can tell nothing moved; otherwise a new array of the same entry objects.
 */
export function normaliseParts(entries) {
  const list = Array.isArray(entries) ? entries : []
  const sorted = list.map((entry, i) => ({ entry, i })).sort((a, b) => rank(a.entry) - rank(b.entry) || a.i - b.i)
  return sorted.every((x, i) => x.i === i) ? list : sorted.map(x => x.entry)
}

/** Whether `entries` keep the invariant: warm-ups first, cool-downs last. */
export function partsInOrder(entries) {
  const list = Array.isArray(entries) ? entries : []
  return list.every((entry, i) => i === 0 || rank(list[i - 1]) <= rank(entry))
}

const doneOf = set => (isSideSet(set) ? (set.sides.L.done ? 1 : 0) + (set.sides.R.done ? 1 : 0) : (set?.done ? 1 : 0))
const entriesOf = A => (Array.isArray(A?.entries) ? A.entries : [])

/** The summary's "Sets": done working sets of the workout part, warm-up rows left out. */
export function workingSetsDone(A) {
  return entriesOf(A).reduce((n, entry) => n + (countsForRecords(entry)
    ? (entry.sets || []).reduce((m, s) => m + (isWarmupRow(s) ? 0 : doneOf(s)), 0) : 0), 0)
}

/** The discard confirm's "logged sets, warm-up included": every done set of every part. */
export function loggedSetsDone(A) {
  return entriesOf(A).reduce((n, entry) => n + (entry.sets || []).reduce((m, s) => m + doneOf(s), 0), 0)
}
