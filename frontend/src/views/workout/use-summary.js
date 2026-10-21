// The summary after Finish and save (boards W2.0 Wk2Summary and W2.2 Wk2First), read from the
// saved workout by id, so a reload of /train/workout/summary/:id shows the same page. It holds
// what the old finish sheet showed (tiles, bests, the muscle map, last and next time, cardio,
// photos) and nothing the data cannot back: no Friends section (owner question 7), no delta
// without a previous workout of the same routines.
import { useMemo } from 'react'
import { useStore } from '../../store/useStore.js'
import { dateLocale, t, tn } from '../../lib/i18n.js'
import { exOr, betterWeight } from '../../lib/exercises.js'
import { exerciseNameText, fmtDate, fmtDur, fmtNum } from '../../lib/format.js'
import { setLabel, workoutAt, workoutDay, workoutDuration, workoutVolume } from '../../lib/history.js'
import { finishCardio, finishCompare } from '../../lib/finish-compare.js'
import { workoutMediaOf } from '../../lib/media-refs.js'
import { loadOfWorkouts } from '../../lib/muscles.js'
import { speedUnitOf } from '../../lib/speed.js'
import { isWarmupRow } from '../../lib/workout-model.js'
import { workingSetsDone } from '../../lib/workout-parts.js'
import { sameRoutines, sessionBests, volumeDelta, volumeText } from '../../lib/workout-finish.js'

const nameOf = id => exerciseNameText(exOr(id))
const routineIdsOf = w => (Array.isArray(w?.routineIds) ? w.routineIds : (w?.routineId ? [w.routineId] : []))

// "17:42", in the language's clock.
const timeOf = ms => {
  const d = new Date(ms)
  if (!Number.isFinite(ms) || Number.isNaN(d.getTime())) return ''
  try { return d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) } catch { return d.toTimeString().slice(0, 5) }
}

const kg = (w, unit) => fmtNum(w) + ' ' + unit
const repsText = r => tn('{0} rep', '{0} reps', r)

/**
 * One exercise's sets as the summary reads them: "80 kg, 8 · 8 · 7", "20 kg × 12, 3 sets",
 * "80 × 8 · 75 × 6" when the weight changed; the first time ever, "3 sets at 80 kg".
 */
export function trainedLine(sets, unit, firstTime = false) {
  const n = sets.length
  if (!n) return ''
  // A set taken to failure keeps its "F" after the reps ("8 F"), so a failure set never merges with plain ones.
  const rep = s => s.r + (s.f ? ' ' + t('F') : '')
  const ws = new Set(sets.map(s => s.w))
  if (ws.size > 1) return sets.map(s => (s.w > 0 ? fmtNum(s.w) + ' × ' : '') + rep(s)).join(' · ')
  const w0 = sets[0].w
  const load = w0 > 0 ? kg(w0, unit) : null
  if (firstTime) return load ? tn('{0} set at {1}', '{0} sets at {1}', n, load) : tn('{0} set', '{0} sets', n)
  if (n === 1) return load ? load + ' × ' + rep(sets[0]) : sets[0].f ? rep(sets[0]) : repsText(sets[0].r)
  const rs = new Set(sets.map(rep))
  if (rs.size === 1) return (load ? load + ' × ' + rep(sets[0]) : sets[0].f ? rep(sets[0]) : repsText(sets[0].r)) + ', ' + tn('{0} set', '{0} sets', n)
  return (load ? load + ', ' : '') + sets.map(rep).join(' · ')
}

const TREND = { up: () => t('up on last time'), same: () => t('same'), down: () => t('down'), first: () => t('first time') }
const trendOf = row => (row.trend == null ? 'first' : row.trend > 0 ? 'up' : row.trend < 0 ? 'down' : 'same')

/** Next time in words: "Step up to 82.5 kg × 8", "Same again, aim for 8 · 8 · 8", "Lighter: 7 kg × 15", "Deload: 60 kg × 5". */
export function nextText(next, today, unit) {
  const load = next.w != null && next.w > 0 ? (next.r != null ? kg(next.w, unit) + ' × ' + next.r : kg(next.w, unit)) : next.r != null ? repsText(next.r) : ''
  if (next.kind === 'up') return t('Step up to {0}', load)
  if (next.kind === 'down') return t('Lighter: {0}', load)
  if (next.kind === 'deload') return t('Deload: {0}', load)
  if (next.r == null) return t('Same again')
  const sets = Number(next.sets) || today.length || 1
  return t('Same again, aim for {0}', Array(sets).fill(next.r).join(' · '))
}

// The heaviest done working set of `id` in `w`, the most reps on a tie: the set a weight best stands on.
function topSetOf(w, id) {
  let top = null
  for (const e of w.entries || []) {
    if (e?.id !== id) continue
    for (const s of e.sets || []) {
      if (!s?.done || isWarmupRow(s) || !(Number(s.w) > 0)) continue
      const sw = Number(s.w), sr = Math.round(Number(s.r) || 0)
      if (!top || (sw !== top.w && betterWeight(id, sw, top.w) === sw) || (sw === top.w && sr > top.r)) top = { w: sw, r: sr }
    }
  }
  return top
}

/**
 * The summary's model for workout `id`, or null when there is no such workout:
 * `{ w, eyebrow, title, dateLine, first, firstNote, tiles, bests, muscles, trained, cardio, next,
 *    note, media }`.
 * `tiles` is `[{ key, label, value, delta }]`, `delta` `{ dir: 1 | 0 | -1 | null, text }` or null;
 * `bests` `[{ id, name, kind: 'weight' | 'e1rm', text }]`; `trained` `[{ id, name, line, trend,
 * trendText }]` (`trend` 'up' | 'same' | 'down' | 'first'); `cardio` `[{ id, name, line }]`;
 * `next` `[{ id, name, kind, text }]`. `first` (W2.2) is the first workout of its routines: no
 * delta, no bests, no next time, and `firstNote` says why.
 */
export function summaryOf(S, id) {
  const w = (S?.workouts || []).find(x => x && x.id != null && String(x.id) === String(id))
  if (!w) return null
  const unit = S.unit || 'kg'
  const at = workoutAt(w)
  const before = S.workouts.filter(x => x && x !== w && x.id !== w.id && workoutAt(x) < at)
  const ids = routineIdsOf(w)
  const prev = ids.length ? before.filter(x => sameRoutines(x, ids)).sort((a, b) => workoutAt(a) - workoutAt(b)).at(-1) || null : null
  const first = ids.length > 0 && !prev
  const name = w.name || t('Workout')
  const vol = workoutVolume(w)

  const day = workoutDay(w)
  const span = Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start ? t('{0} to {1}', timeOf(w.start), timeOf(w.end)) : null
  const dur = workoutDuration(w)

  const tiles = [
    { key: 'time', label: t('Time'), value: dur >= 60000 ? fmtDur(dur) : '–', delta: null },
    { key: 'sets', label: t('Sets'), value: String(workingSetsDone(w)), delta: null },
    {
      key: 'volume', label: t('Volume'), value: volumeText(vol, unit),
      delta: first ? { dir: null, text: t('first time') } : prev ? volumeDelta(vol, workoutVolume(prev), unit) : null,
    },
  ]

  let bests = []
  if (!first) {
    const weightIds = [...new Set(w.prs || [])]
    const weight = weightIds.map(exId => {
      const top = topSetOf(w, exId)
      return top ? { id: exId, name: nameOf(exId), kind: 'weight', text: t('{0} × {1} · best set ever', kg(top.w, unit), top.r) } : null
    }).filter(Boolean)
    const { e1prs } = sessionBests({ ...S, workouts: before }, w)
    const e1 = e1prs.filter(p => !weightIds.includes(p.id)).map(p => ({
      id: p.id, name: nameOf(p.id), kind: 'e1rm',
      text: p.prev > 0 ? t('Est. 1RM {0} · up {1}', kg(p.est, unit), kg(p.est - p.prev, unit)) : t('Est. 1RM {0}', kg(p.est, unit)),
    }))
    bests = [...weight, ...e1]
  }

  const rows = finishCompare(S, w)
  const trained = rows.map(row => {
    const trend = trendOf(row)
    return { id: row.id, name: nameOf(row.id), line: trainedLine(row.today, unit, trend === 'first'), trend, trendText: TREND[trend]() }
  })
  const next = first ? [] : rows.filter(row => row.next).map(row => ({ id: row.id, name: nameOf(row.id), kind: row.next.kind, text: nextText(row.next, row.today, unit) }))
  const speed = speedUnitOf(S)
  const cardio = finishCardio(w).map(row => ({
    id: row.id, name: nameOf(row.id), line: row.sets.map(x => setLabel(row.id, x, row.target, speed)).join(' · '),
  }))

  return {
    w,
    eyebrow: t('Workout saved'),
    title: t('{0}, done', name),
    dateLine: [day ? fmtDate(day, true) : null, span].filter(Boolean).join(' · '),
    first,
    firstNote: first ? t('Your first {0}. From the next one on, this shows what went up and your new bests.', name) : null,
    tiles, bests,
    muscles: loadOfWorkouts([w]),
    trained, cardio, next,
    note: w.note || '',
    media: workoutMediaOf(w),
  }
}

/** The summary's model for workout `id`, kept while the store is the same. */
export function useSummary(id) {
  const S = useStore(s => s.S)
  return useMemo(() => summaryOf(S, id), [S, id])
}
