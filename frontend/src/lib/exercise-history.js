import { metricEntriesForExercise, metricRowsForEntry, bestWeightForEntry, completedRepsOf, modeOf, workoutAt } from './history.js'
import { completedVolumeOf } from './workout-model.js'
import { bestSetOf, formulaOf } from './onerm.js'
import { beatsWeight } from './exercises.js'
import { currentDbLoad, historyAs, volumeFactor, workoutAs } from './dumbbells.js'

// One exercise's past, read back for the history sheet (issue #43): a chart series and the
// last few sessions, derived in a single pass over the log so the sheet can memoise the
// result and never rescan on a re-render.
//
// The chart plots ONE number per session, chosen the way Stats does it:
//   reps   — the heaviest completed work set (metric 'weight'); an exercise never loaded
//            (pull-ups, push-ups) plots its best rep count instead (metric 'reps'), because
//            that is the thing improving
//   time   — the longest completed hold, in seconds (metric 'sec')
//   cardio — the fastest set of the session, in km/h as stored (metric 'speed'), the number the
//            Progress hero ranks by, so a long slow run is not a record under a Top speed hero
// The mode is the one the exercise was logged in most recently; a session logged in another
// mode still appears in the list (its sets are labelled by their own target) but gets no point
// and no value, so the curve never mixes seconds with kilos.
//
// Warm-up rows are excluded from every number here, as everywhere else.

export const HISTORY_SESSIONS = 10

// Volume of the exercise in one session: main set plus its drops/bursts, reps mode only —
// there is no honest tonnage for a hold or a run.
// A dumbbell entry logged per bell counts both bells (lib/dumbbells.js volumeFactor).
const entryVolume = (rows, en) => rows.reduce((v, s) => v + completedVolumeOf(s), 0) * volumeFactor(en)

// The estimated 1RM of each session uses the profile's formula, the one the Progress hero uses.
export function exerciseHistory(S, exId, { limit = HISTORY_SESSIONS, formula = formulaOf(S) } = {}) {
  // Dumbbell weights are read in the exercise's current meaning (lib/dumbbells.js), so the curve,
  // the best and the sessions compare like with like after a switch between each and total.
  const workouts = historyAs(S, exId, currentDbLoad(S, exId))?.workouts || []
  // Chronological pairs of (workout, entry); the sort covers backfilled sessions, which are
  // inserted by date rather than appended.
  const logged = []
  workouts.forEach(w => {
    // A combined session can contain the same exercise more than once. Keep one dated
    // snapshot, but read every completed occurrence that shares the session's latest mode.
    const entries = metricEntriesForExercise(w, exId)
    if (!entries.length) return
    const mode = entries.at(-1).mode
    const sameMode = entries.filter(item => item.mode === mode)
    const rows = sameMode.flatMap(item => item.rows)
    const en = { ...sameMode.at(-1).entry, sets: rows }
    // An occurrence with no rows is a legacy reps record holding its load in topW only
    // (metricEntriesForExercise keeps no other kind): a session, with that load as its value.
    logged.push({ w, en, mode, rows })
  })
  logged.sort((a, b) => workoutAt(a.w) - workoutAt(b.w))

  const empty = { mode: modeOf({ id: exId }), metric: 'weight', best: 0, prId: null, total: 0, sessions: [], points: [], e1rmPoints: [] }
  if (!logged.length) return empty

  const mode = logged[logged.length - 1].mode
  const repsOnly = mode === 'reps' && !logged.some(l => l.mode === 'reps' && bestWeightForEntry(l.en) > 0)
  const metric = mode === 'cardio' ? 'speed' : mode === 'time' ? 'sec' : repsOnly ? 'reps' : 'weight'
  const valueOf = ({ en, rows }) => {
    if (metric === 'speed') return Math.max(0, ...rows.map(s => Number(s.speed) || 0))
    if (metric === 'sec') return Math.max(0, ...rows.map(s => Number(s.sec) || 0))
    if (metric === 'reps') return Math.max(0, ...rows.map(completedRepsOf))
    return bestWeightForEntry(en)
  }

  let best = 0, prId = null
  const records = new Set()
  const sessions = [], points = [], e1rmPoints = []
  logged.forEach(({ w, en, mode: m, rows }) => {
    const same = m === mode
    const value = same ? valueOf({ en, rows }) : null
    const e1rm = m === 'reps' ? (bestSetOf(en, formula)?.est ?? null) : null
    const t = workoutAt(w)
    // A "new best" goes on a session that beat the best before it, so a record that was itself
    // beaten later keeps its marker and a match of the best does not get one. The first session has
    // nothing to beat. `prId` is the session that holds the all-time best now. On an assistance
    // machine a weight beats the best by being lower (beatsWeight), as the Progress hero reads it.
    const beats = metric === 'weight' ? beatsWeight(exId, value, best) : value > best
    if (value != null && beats) {
      if (best > 0) records.add(w.id)
      best = value
      prId = w.id
    }
    if (value != null && value > 0) points.push({ t, d: w.d, y: value, e1rm })
    if (e1rm != null) e1rmPoints.push({ t, d: w.d, y: e1rm })
    sessions.push({
      id: w.id, d: w.d, t, name: w.name || null, mode: m, target: en.target || null, sets: rows, value, e1rm,
      volume: m === 'reps' ? entryVolume(rows, en) : null,
    })
  })
  // The "first reached" rule only holds for records above zero: a bodyweight session with
  // no weight logged is not a PR of anything.
  if (best <= 0) prId = null

  return {
    mode, metric, best, prId, total: sessions.length,
    sessions: sessions.slice(-limit).reverse().map(s => ({ ...s, pr: records.has(s.id) })),
    points, e1rmPoints,
  }
}

/**
 * Which of a session's sets set its number, so the "New best" mark sits on a set and not on the
 * day. `metric` is the history's (`weight`, `reps`, `sec`, `speed`); the first set that matches the
 * session's value wins. A legacy record that kept its load in a top weight with no sets has no set
 * to mark: -1, and the caller marks its top-set line instead. An unknown metric, a session with no
 * value, or a value no set matches falls back to the first set.
 */
export function bestSetIndex(session, metric) {
  if (!session.sets?.length) return -1
  const key = { weight: s => Number(s.w) || 0, reps: completedRepsOf, sec: s => Number(s.sec) || 0, speed: s => Number(s.speed) || 0 }[metric]
  if (!key || !(session.value > 0)) return 0
  const at = session.sets.findIndex(s => key(s) === session.value)
  return at < 0 ? 0 : at
}

/**
 * How a series moved over a window: the last point against the first one at or after `from` (ms),
 * oldest to newest. `{ delta, from, to }`, or null with fewer than two points in the window, so
 * a caller leaves the line out rather than inventing one.
 */
export function trendDelta(points, from = 0) {
  const inside = points.filter(p => p.t >= from).sort((a, b) => a.t - b.t)
  if (inside.length < 2) return null
  const first = inside[0].y, last = inside.at(-1).y
  return { delta: Math.round((last - first) * 100) / 100, from: first, to: last }
}

/**
 * The best set ever logged of an exercise, for the "Best set" reference on the workout card
 * (#173) — the answer to "last time was a bad day, what can I actually do". It is the heaviest
 * completed work set, and of equally heavy ones the one with the most reps: the same "heaviest"
 * the Best chip and a PR mean, which on an assistance machine is the least help. A timed exercise
 * compares holds, then their load; cardio compares minutes, then speed. An exercise never loaded
 * (pull-ups) comes down to its reps that way.
 *
 * Unlike "Last time" this looks across every routine: a record belongs to the exercise, not to
 * the slot it was set in. Only sets logged in `mode` count, so a hold is never measured against
 * a rep set. A tie keeps the first time it was reached, as the PR marker does.
 * `as` reads dumbbell weights in that meaning (lib/dumbbells.js): the session's own, so a past
 * "40 total" is held against today's sets as the "20 each" it was.
 * Returns { d, set, target } or null.
 */
export function bestSetFor(S, exId, mode = modeOf({ id: exId }), as) {
  const keys = s => mode === 'cardio' ? [Number(s.min) || 0, Number(s.speed) || 0]
    : mode === 'time' ? [Number(s.sec) || 0, Number(s.w) || 0]
      : [Number(s.w) || 0, Number(s.r) || 0]
  const better = (a, b) => {
    const [a1, a2] = keys(a), [b1, b2] = keys(b)
    if (a1 !== b1) return mode === 'reps' ? beatsWeight(exId, a1, b1) : a1 > b1
    return a2 > b2
  }
  // One pass over the history as it is stored, with no copy and no sort: this runs on every
  // render of every exercise card while the line shows the best set, and every stepper tap
  // re-renders them all, so sorting a long imported history each time was the cost of a tap.
  // Stored order is not always the order things happened in (a moved session keeps its place
  // until it is filed again), so a tie is settled by the start time, not by which came first
  // in the array; within one session the set logged first keeps it.
  let best = null
  for (const stored of S?.workouts || []) {
    const w = as ? workoutAs(stored, exId, as) : stored
    let t = null
    for (const en of w.entries || []) {
      if (en.id !== exId) continue
      for (const set of metricRowsForEntry(en, mode)) {
        t ??= workoutAt(w)
        if (!best || better(set, best.set) || (!better(best.set, set) && t < best.t)) best = { d: w.d, set, target: en.target || null, t }
      }
    }
  }
  return best && { d: best.d, set: best.set, target: best.target }
}
