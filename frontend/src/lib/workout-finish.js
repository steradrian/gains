// What the Finish drawer says about the running session (boards W1.10 Finish Push A? and W1.11
// Finish early?), and the one rule for a new best that the drawer, the live NEW BEST on a set
// (owner question 14) and the save itself (sheets/workout-flow.jsx finishAndSave) share.
//
// Warm-up rows never make a best; neither do warm-up and cool-down exercises (lib/workout-parts.js
// countsForRecords). Volume leaves both parts out too (countsForVolume).
import { t, tn } from './i18n-core.js'
import { fmtNum, exerciseNameText } from './format.js'
import { exOr, betterWeight, beatsWeight } from './exercises.js'
import { bestWeightFor, workoutVolume, doneUnits, setUnits, modeOf } from './history.js'
import { is1RMRecord } from './onerm.js'
import { entryDbLoad } from './dumbbells.js'
import { isWarmupRow } from './workout-model.js'
import { partOf, countsForRecords, countsForVolume, workingSetsDone } from './workout-parts.js'

const nameOf = id => exerciseNameText(exOr(id))

/**
 * The finish pass's bests for a session (or any `{ entries }`) held against `st`'s history, which
 * must not hold it yet: `prs` the ids whose heaviest done working set beats every load logged
 * before (one id per entry, as the save has always written them), `e1prs` the estimated-1RM bests
 * of the rest, `{ id, est, w, r, prev }`.
 */
export function sessionBests(st, A) {
  const prs = []
  const e1prs = []
  for (const e of A?.entries || []) {
    if (!e || !countsForRecords(e)) continue
    const loads = (e.sets || []).filter(s => s.done && !isWarmupRow(s)).map(s => s.w).filter(w => w > 0)
    const mx = loads.length ? loads.reduce((a, b) => betterWeight(e.id, a, b)) : 0
    // Held against history read the way this session logged a dumbbell weight (lib/dumbbells.js).
    if (beatsWeight(e.id, mx, bestWeightFor(st, e.id, entryDbLoad(e)))) prs.push(e.id)
    // A heavier estimate without a heavier top set is its own kind of progress — same weight for
    // more reps. Reported separately so it can't be read as a load best.
    const rec = is1RMRecord(st, e.id, e)
    if (rec && !prs.includes(e.id)) e1prs.push({ id: e.id, ...rec })
  }
  return { prs, e1prs }
}

/** Whether one done set of `entry` is a new weight best against `st`'s history: the same rule as sessionBests. */
export function beatsBest(st, entry, set) {
  if (!entry || !set?.done || isWarmupRow(set) || !countsForRecords(entry)) return false
  return beatsWeight(entry.id, Number(set.w) || 0, bestWeightFor(st, entry.id, entryDbLoad(entry)))
}

/** "51:40": a session's running time, as the workout's clock shows it. */
export function clockText(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

// A workout's volume reads in tonnes from a tonne up when the profile lifts in kilograms (the
// boards' "6.4 t"); a pound profile stays in pounds.
export const TONNE_FROM = 1000
const inTonnes = (v, unit) => unit === 'kg' && v >= TONNE_FROM

/** "6.4 t" or "850 kg". */
export function volumeText(v, unit = 'kg') {
  const n = Math.max(0, Number(v) || 0)
  return inTonnes(n, unit) ? fmtNum(Math.round(n / 100) / 10) + ' t' : fmtNum(Math.round(n)) + ' ' + unit
}

/** Today's volume against the last one, in today's unit: `{ dir: 1 | 0 | -1, text }` ("up 0.3 t"). */
export function volumeDelta(today, last, unit = 'kg') {
  const a = Math.max(0, Number(today) || 0), b = Math.max(0, Number(last) || 0)
  const tonnes = inTonnes(Math.max(a, b), unit)
  const round = v => (tonnes ? Math.round(v / 100) / 10 : Math.round(v))
  const d = round(a) - round(b)
  if (Math.abs(d) < 1e-9) return { dir: 0, text: t('same as last time') }
  const amount = fmtNum(Math.abs(d)) + ' ' + (tonnes ? 't' : unit)
  return d > 0 ? { dir: 1, text: t('up {0}', amount) } : { dir: -1, text: t('down {0}', amount) }
}

/** "A", "A and B", "A, B and C". */
export function listText(items) {
  if (items.length <= 1) return items[0] || ''
  return t('{0} and {1}', items.slice(0, -1).join(', '), items.at(-1))
}

// The routines a workout came from; a record from before combined sessions carries one `routineId`.
const routineIdsOf = w => (Array.isArray(w?.routineIds) ? w.routineIds : (w?.routineId ? [w.routineId] : []))

/** Whether workout `w` came from exactly the routines `ids` (in any order). False for freestyle. */
export function sameRoutines(w, ids) {
  const a = [...new Set(routineIdsOf(w))].sort(), b = [...new Set([].concat(ids ?? []).filter(Boolean))].sort()
  return b.length > 0 && a.length === b.length && a.every((id, i) => id === b[i])
}

const capFirst = s => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s)

// How much of an entry is done: its done units and its units, warm-up rows left out of what
// counts as left (a warm-up row skipped is not work left undone).
const workRows = e => (e.sets || []).filter(s => !isWarmupRow(s))
const doneOf = e => (e.sets || []).reduce((n, s) => n + doneUnits(s), 0)
const leftOf = e => workRows(e).reduce((n, s) => n + setUnits(s) - doneUnits(s), 0)

// A part that was not started at all reads as one thing: "the 3 stretches" when every exercise
// in it is a timed hold, else "the cool-down" / "the warm-up".
function partPhrase(part, entries) {
  if (part === 'cooldown' && entries.every(e => modeOf({ ...(e.target || {}), id: e.id }) === 'time')) {
    return { phrase: tn('the {0} stretch', 'the {0} stretches', entries.length), plural: entries.length > 1 }
  }
  return { phrase: part === 'cooldown' ? t('the cool-down') : t('the warm-up'), plural: false }
}

/**
 * What a session left undone, in its order: `left` the exercises begun with sets still unticked
 * (`{ id, name, left }`), `notStarted` the ones never begun (`{ id, name }`), and `parts` the
 * warm-up or cool-down not begun at all, each read as one thing (`{ part, count, phrase, plural }`). A part
 * skipped from its offer (`A.skipped`) is not missing.
 */
export function notDoneOf(A) {
  const entries = (A?.entries || []).filter(e => e && (e.sets || []).length)
  const skipped = A?.skipped || {}
  const left = [], notStarted = [], parts = []
  for (const part of ['warmup', 'cooldown']) {
    const inPart = entries.filter(e => partOf(e) === part)
    if (inPart.length && !skipped[part] && inPart.every(e => doneOf(e) === 0)) parts.push({ part, count: inPart.length, ...partPhrase(part, inPart) })
  }
  const asOne = new Set(parts.map(p => p.part))
  for (const e of entries) {
    const part = partOf(e)
    if (asOne.has(part) || (part !== 'main' && skipped[part])) continue
    if (doneOf(e) === 0) notStarted.push({ id: e.id, name: nameOf(e.id) })
    else {
      const n = leftOf(e)
      if (n > 0) left.push({ id: e.id, name: nameOf(e.id), left: n })
    }
  }
  return { left, notStarted, parts }
}

/** W1.11's heading: "2 exercises and the cool-down not started", "Cool-down not started", "3 sets left". */
export function notDoneHeadline({ left, notStarted, parts }) {
  const n = notStarted.length
  const cool = parts.some(p => p.part === 'cooldown')
  const warm = parts.some(p => p.part === 'warmup')
  if (n && cool) return tn('{0} exercise and the cool-down not started', '{0} exercises and the cool-down not started', n)
  if (n) return tn('{0} exercise not started', '{0} exercises not started', n)
  if (cool) return t('Cool-down not started')
  if (warm) return t('Warm-up not started')
  const sets = left.reduce((m, x) => m + x.left, 0)
  return sets ? tn('{0} set left', '{0} sets left', sets) : null
}

/**
 * W1.11's sentence: "Cable fly has 2 sets left; Triceps pushdown and Lateral raise were not
 * started, nor the 3 stretches. They stay in Push A for next time." The last sentence only when
 * the session came from a routine (`routineName`): the routine is not changed, so it is true.
 */
export function notDoneSentence({ left, notStarted, parts }, routineName = null) {
  const clauses = left.map(x => tn('{1} has {0} set left', '{1} has {0} sets left', x.left, x.name))
  const phrases = parts.map(p => p.phrase)
  if (notStarted.length) {
    const names = listText(notStarted.map(x => x.name))
    const clause = notStarted.length === 1 ? t('{0} was not started', names) : t('{0} were not started', names)
    clauses.push(phrases.length ? t('{0}, nor {1}', clause, listText(phrases)) : clause)
  } else if (phrases.length) {
    const many = parts.length > 1 || parts[0].plural
    clauses.push(many ? t('{0} were not started', listText(phrases)) : t('{0} was not started', listText(phrases)))
  }
  if (!clauses.length) return null
  const things = left.length + notStarted.length + parts.length
  const tail = routineName
    ? ' ' + (things === 1 ? t('It stays in {0} for next time.', routineName) : t('They stay in {0} for next time.', routineName))
    : ''
  return capFirst(clauses.join('; ')) + '.' + tail
}

/**
 * The Finish drawer's facts for `A` (W1.10, W1.11 and the Edges rows):
 * `{ kind, name, title, message, clock, clockText, sets, volume, volumeText, bests, bestsCount,
 *    bestsLine, notDone, headline, sentence, fromRoutine }`.
 * `kind` is 'empty' (no exercise has a set), 'nothing' (none ticked), 'early' (something left,
 * cool-down included) or 'done'. `bests` is `[{ id, name, kind: 'weight' | 'e1rm' }]`.
 */
export function finishFacts(st, A, now = Date.now()) {
  if (!A) return null
  const unit = st?.unit || 'kg'
  const name = A.name || t('Freestyle')
  const clock = Math.max(0, now - (Number(A.start) || now))
  const volume = workoutVolume({ entries: (A.entries || []).filter(countsForVolume) })
  const anyRows = (A.entries || []).some(e => (e?.sets || []).length)
  const anyDone = (A.entries || []).some(e => doneOf(e) > 0)
  const { prs, e1prs } = anyDone ? sessionBests(st, A) : { prs: [], e1prs: [] }
  const bests = [
    ...[...new Set(prs)].map(id => ({ id, name: nameOf(id), kind: 'weight' })),
    ...e1prs.map(p => ({ id: p.id, name: nameOf(p.id), kind: 'e1rm' })),
  ]
  const notDone = notDoneOf(A)
  const early = notDone.left.length + notDone.notStarted.length + notDone.parts.length > 0
  const kind = !anyRows ? 'empty' : !anyDone ? 'nothing' : early ? 'early' : 'done'
  const fromRoutine = (A.routineIds || []).length > 0
  return {
    kind, name,
    title: kind === 'done' ? t('Finish {0}?', name) : kind === 'early' ? t('Finish early?') : t('Nothing logged yet'),
    message: kind === 'nothing' ? t('You haven’t checked off any sets. Finish anyway?') : null,
    clock, clockText: clockText(clock),
    sets: workingSetsDone(A),
    volume, volumeText: volumeText(volume, unit),
    bests,
    bestsCount: bests.length ? tn('{0} new best', '{0} new bests', bests.length) : null,
    bestsLine: bests.length ? bests.map(b => (b.kind === 'e1rm' ? t('{0} est. 1RM', b.name) : b.name)).join(', ') : null,
    notDone,
    headline: kind === 'early' ? notDoneHeadline(notDone) : null,
    sentence: kind === 'early' ? notDoneSentence(notDone, fromRoutine ? name : null) : null,
    fromRoutine,
  }
}
