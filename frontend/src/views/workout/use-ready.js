// Ready (board W1.1 Wk1Planned): the session Start workout would begin, before it runs. The rows
// come from the same builder beginWorkout uses (lib/session-merge.js buildCombinedEntries, then
// normaliseParts), so Ready cannot show a session the start would not build.
import { useMemo } from 'react'
import { useStore } from '../../store/useStore.js'
import { t } from '../../lib/i18n.js'
import { exOr } from '../../lib/exercises.js'
import { durPart, exCount, exerciseNameText, fmtNum } from '../../lib/format.js'
import { isPerSide, modeOf, setsRepsOf, sideReps, workoutAt, workoutDuration } from '../../lib/history.js'
import { MUSCLE_NAME, musclesOf, rankOf } from '../../lib/muscles.js'
import { buildCombinedEntries, deriveSessionName } from '../../lib/session-merge.js'
import { isWarmupRow } from '../../lib/workout-model.js'
import { countsForVolume, normaliseParts, partOf, partsOf } from '../../lib/workout-parts.js'
import { sameRoutines } from '../../lib/workout-finish.js'
import { pictureOf } from '../train/use-train.js'

/** The routine ids in Ready's `?start=a,b` (a URLSearchParams or its string). */
export function startIdsOf(search) {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const raw = params?.get?.('start') || ''
  return [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))]
}

const PART_LABEL = { warmup: () => t('Warm-up'), main: () => t('Workout'), cooldown: () => t('Cool-down') }
const capFirst = s => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s)

const plannedSets = e => Number(e.target?.sets) || (e.sets || []).filter(s => !isWarmupRow(s)).length || 1

// "30 s", "1 min", "1:30" for a hold.
const holdText = sec => {
  const n = Math.max(0, Math.round(Number(sec) || 0))
  if (n >= 60 && n % 60 === 0) return t('{0} min', n / 60)
  if (n < 60) return t('{0} s', n)
  return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0')
}

/** One planned exercise's line: "Barbell · 3 × 8", "Body weight · 2 × 10 each side", "Timed · 2 × 30 s each side". */
export function planLine(e) {
  const cfg = { ...(e.target || {}), id: e.id }
  const mode = modeOf(cfg)
  const n = plannedSets(e)
  let plan
  if (mode === 'time') {
    const hold = holdText(cfg.sec || 45)
    plan = (n === 1 ? hold : n + ' × ' + hold) + (isPerSide(cfg) ? ' ' + t('each side') : '')
  } else if (mode === 'reps' && isPerSide(cfg) && cfg.reps > 0 && !(cfg.repsMin > 0)) {
    plan = n + ' × ' + fmtNum(sideReps(cfg.reps)) + ' ' + t('each side')
  } else {
    plan = setsRepsOf({ ...cfg, sets: n })
  }
  const eq = exOr(e.id)?.eq
  const kind = mode === 'time' ? t('Timed') : eq ? capFirst(t(eq)) : null
  return kind ? kind + ' · ' + plan : plan
}

/** The median length (ms) of the last 3 finished workouts of exactly these routines; null without one. */
export function usualMinutes(S, ids, last = 3) {
  const times = (S.workouts || [])
    .filter(w => sameRoutines(w, ids) && workoutDuration(w) >= 60000)
    .sort((a, b) => workoutAt(a) - workoutAt(b))
    .slice(-last).map(workoutDuration).sort((a, b) => a - b)
  if (!times.length) return null
  const mid = times.length >> 1
  return times.length % 2 ? times[mid] : Math.round((times[mid - 1] + times[mid]) / 2)
}

/** The three primary muscles the session works most, by planned sets (warm-up and cool-down left out when there is a workout part). */
export function topMuscles(entries, n = 3) {
  const main = entries.filter(countsForVolume)
  const load = {}
  for (const e of main.length ? main : entries) {
    for (const [m, weight] of Object.entries(musclesOf(exOr(e.id)))) {
      if (weight >= 1) load[m] = (load[m] || 0) + plannedSets(e)
    }
  }
  return rankOf(load).worked.slice(0, n).map(m => t(MUSCLE_NAME[m]))
}

/**
 * Ready's model for `ids`, or null when none of them is a routine with exercises:
 * `{ ids, title, sub, count, minutes, muscles, hasWarmup, hasCooldown, groups }`.
 * `groups` is `[{ part, label, count, rows: [{ id, name, line, image }] }]` in the session's
 * order ("Warm-up · 3", "Workout · 6", "Cool-down · 3"); `minutes` the usual length in ms.
 */
export function readyOf(S, ids) {
  const { entries: built, routineIds, routines } = buildCombinedEntries(S, ids)
  if (!routines.length || !built.length) return null
  const entries = normaliseParts(built)
  const minutes = usualMinutes(S, routineIds)
  const muscles = topMuscles(entries)
  const groups = partsOf(entries).map(({ part, from, count }) => ({
    part, count,
    label: PART_LABEL[part]() + ' · ' + count,
    rows: entries.slice(from, from + count).map(e => ({ id: e.id, name: exerciseNameText(exOr(e.id)), line: planLine(e), image: pictureOf(S, e.id) })),
  }))
  return {
    ids: routineIds,
    title: deriveSessionName(routines.map(r => r.name)),
    sub: [exCount(entries.length), minutes ? t('about {0}', durPart(minutes)[0]) : null, muscles.join(', ') || null].filter(Boolean).join(' · '),
    count: entries.length,
    minutes, muscles,
    hasWarmup: entries.some(e => partOf(e) === 'warmup'),
    hasCooldown: entries.some(e => partOf(e) === 'cooldown'),
    groups,
  }
}

/** Ready's model for `ids`, kept while the store and the ids are the same. */
export function useReady(ids) {
  const S = useStore(s => s.S)
  const key = [].concat(ids ?? []).join(',')
  // Keyed on the joined ids, not the array: a caller builds a new one on every render.
  return useMemo(() => readyOf(S, key ? key.split(',') : []), [S, key])
}
