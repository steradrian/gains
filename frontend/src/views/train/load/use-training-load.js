// Training load (board T9.0, /progress/load) and the muscle page (T9.6, /progress/load/muscle/:slug):
// what they say, worked out from the store's state. Everything but useNow is pure, so it can be
// tested on its own; the screens only lay it out.
import { useEffect, useState } from 'react'
import { dateLocale, t, tn } from '../../../lib/i18n.js'
import { durPart, fmtDate, fmtNum, weekKey, weekStartOf } from '../../../lib/format.js'
import { activityGrid } from '../../../lib/activity-heatmap.js'
import { dayNoteLine, dayNoteOf } from '../../../lib/day-notes.js'
import { isHardSet } from '../../../lib/effort.js'
import { exAvailable } from '../../../lib/equipment.js'
import { CATALOGUE, EXIDX } from '../../../lib/exercises.js'
import { effectiveRoutines, workoutAt, workoutDay, workoutDuration } from '../../../lib/history.js'
import { plusDays } from '../../../lib/missed-day.js'
import { levelsOf, loadOfRoutine, loadOfWeeklyPlan, loadOfWorkouts, muscleBalanceWindow, musclesOf, rankOf, MUSCLES, MUSCLE_NAME, REGIONS } from '../../../lib/muscles.js'
import { fatigueOf, fatigueReadyAt, strengthOf } from '../../../lib/recovery.js'
import { fatigueStateOf, STRENGTH_LEVELS, weeksSinceTraining } from '../../../lib/recovery-view.js'
import { primaryMuscleOf } from '../../../lib/strength-exercises.js'
import { bodyweightKgOf } from '../../../lib/structuralBalance.js'
import { volumeText } from '../../../lib/train-stats.js'
import { isWarmupRow } from '../../../lib/workout-model.js'
import { andList, REGION_NAME } from '../region-names.js'

const DAY = 86400000
export const ROWS = 4
export const round1 = n => Math.round((n || 0) * 10) / 10
const dateOf = iso => new Date(iso + 'T12:00:00')
const doneSets = e => (e.sets || []).filter(s => s?.done && !isWarmupRow(s)).length

/** The clock the fatigue and strength maps read: it ticks once a minute, so a muscle recovers on screen. */
export function useNow() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick(tick => tick + 1), 60000)
    return () => clearInterval(iv)
  }, [])
  return Date.now()
}

/** The options fatigueOf and strengthOf read: the profile's unit and its bodyweight in kg. */
export const recoveryOpts = S => ({ bodyweightKg: bodyweightKgOf(S), unit: S.unit })

/** "1 set", "6.6 sets": a set count that may carry a decimal (secondaries count in part). */
export const setsText = n => (n === 1 ? t('{0} set', fmtNum(1)) : t('{0} sets', fmtNum(n)))

/* -------------------------------------------------------------- the page -- */

/**
 * The line under the title: "24 workouts · 14h 20m since May" (with the year when the first
 * workout was in another year; the time only when some was recorded). Null without workouts.
 */
export function loadSub(S, today) {
  const days = (S.workouts || []).map(workoutDay).filter(Boolean).sort()
  if (!days.length) return null
  const ms = (S.workouts || []).reduce((sum, w) => sum + Math.max(0, workoutDuration(w) || 0), 0)
  const first = dateOf(days[0])
  const month = first.toLocaleDateString(dateLocale(), first.getFullYear() === Number(today.slice(0, 4)) ? { month: 'long' } : { month: 'long', year: 'numeric' })
  return t('{0} since {1}', [tn('{0} workout', '{0} workouts', days.length), ...durPart(ms)].join(' · '), month)
}

/**
 * Which segment `?view=` opens. Activity (the card above the segments) and Muscles (the old name)
 * open Balance; Effort only while it is offered; anything else Balance.
 */
export function tabOf(view, effort) {
  if (view === 'fatigue' || view === 'strength') return view
  if (view === 'effort' && effort) return 'effort'
  return 'balance'
}
/** The `?view=` a segment writes: Balance keeps the old link's name. */
export const viewOf = tab => (tab === 'balance' ? 'muscles' : tab)
/** The Plan segment and its old link moved to the Plan page (T3.0, owner question 4). */
export const toSchedule = search => {
  const q = new URLSearchParams(search)
  return q.get('view') === 'plan' || q.get('focus') === 'weekly-volume'
}

/**
 * The Activity card: a year of weeks for ds/Heatmap (byWeek, 5 levels). `days[i].label` says the
 * day ("Mon 12 Oct, 52 min" or, by volume, "Mon 12 Oct, 9,600 kg"), and a day has an `iso` (so
 * it can be tapped) only when it holds a workout or a note and is not in the future.
 */
export function activityOf(S, metric, now = new Date()) {
  const { cells, months } = activityGrid({ workouts: S.workouts, weekStart: weekStartOf(S), metric, now, hasNote: iso => !!dayNoteOf(S, iso) })
  const locale = dateLocale()
  const days = cells.map(c => {
    const parts = [fmtDate(c.iso, true)]
    if (c.n > 1) parts.push(tn('{0} workout', '{0} workouts', c.n))
    if (c.n) parts.push(metric === 'vol' ? volumeText(c.vol, S.unit) : c.min ? t('{0} min', c.min) : null)
    if (c.noted) parts.push(dayNoteLine(dayNoteOf(S, c.iso), t))
    return { iso: (c.n || c.noted) && !c.future ? c.iso : undefined, label: parts.filter(Boolean).join(', '), today: c.today, future: c.future, noted: c.noted }
  })
  return {
    values: cells.map(c => c.level),
    days,
    months: months.map(m => ({ week: m.week, label: new Date(2023, m.month, 1).toLocaleDateString(locale, { month: 'short' }) })),
  }
}

/* --------------------------------------------------------------- Balance -- */

/**
 * Balance for a period: `win` 7 is a week (`weekOffset` back from this one, 0 or less), 30 and 90
 * the last days, 0 everything. `hard` counts only the sets taken near failure, and only on a
 * window that has rated sets (with none, the map would read "you trained nothing").
 * Rows: this week, every muscle the plan programs or you trained, read against the plan
 * (`target`); any other period, the muscles trained, busiest first.
 */
export function balanceOf(S, { win, weekOffset = 0, hard = false, now, today }) {
  const ws = weekStartOf(S)
  const weekly = win === 7
  const week = weekly ? plusDays(weekKey(today, ws), weekOffset * 7) : null
  const inWin = weekly
    ? (S.workouts || []).filter(w => workoutDay(w) && weekKey(workoutDay(w), ws) === week)
    : muscleBalanceWindow(S.workouts, win, now, today, ws)
  const rated = !weekly && inWin.some(w => (w.entries || []).some(e => (e.sets || []).some(s => s.done && isHardSet(s))))
  const on = hard && rated
  const load = loadOfWorkouts(inWin, on ? isHardSet : null)
  const levels = levelsOf(load)
  const vsPlan = weekly && weekOffset === 0
  const planned = vsPlan ? loadOfWeeklyPlan(S) : {}
  const { worked, missed } = rankOf(load)
  const listed = vsPlan
    ? MUSCLES
      .filter(m => (planned[m] || 0) > 0 || (load[m] || 0) > 0)
      .sort((a, b) => (load[b] || 0) - (load[a] || 0) || (planned[b] || 0) - (planned[a] || 0) || MUSCLES.indexOf(a) - MUSCLES.indexOf(b))
    : worked
  return {
    weekly, week, vsPlan, rated, hard: on, load, levels, worked, missed,
    rows: listed.map(slug => ({ slug, level: levels[slug] || 0, done: round1(load[slug]), target: round1(planned[slug]) })),
    empty: vsPlan ? !listed.length : !inWin.length,
  }
}

/**
 * What a Balance row says on its right. Against the plan, "8/10 · 80%" and a spoken "Completed 8
 * sets · Planned 10 sets"; a muscle the plan does not program, or any other period, its sets alone
 * (never "3/0").
 */
export function rowValue(row, vsPlan) {
  if (vsPlan && row.target > 0) {
    const pct = Math.round(row.done / row.target * 100)
    return {
      value: fmtNum(row.done) + '/' + fmtNum(row.target) + ' · ' + pct + '%',
      spoken: t('Completed') + ' ' + setsText(row.done) + ' · ' + t('Planned') + ' ' + setsText(row.target),
    }
  }
  return { value: setsText(row.done) }
}

/* --------------------------------------------------------------- Fatigue -- */

/** The muscles carrying any fatigue (1% or more), most fatigued first: `{ slug, pct, state }`. */
export function fatigueRows(fatigue) {
  return MUSCLES
    .map(slug => ({ slug, pct: Math.round((fatigue[slug] || 0) * 100), state: fatigueStateOf(fatigue[slug] || 0) }))
    .filter(r => r.pct >= 1)
    .sort((a, b) => b.pct - a.pct || MUSCLES.indexOf(a.slug) - MUSCLES.indexOf(b.slug))
}

const exercisesOf = S => Object.fromEntries((S.customEx || []).map(ex => [ex.id, ex]))

/**
 * "Legs ready. Monday’s Legs session fits.": the first session planned in the next 7 days (today
 * included, unless something is logged today) whose every muscle will be ready by that day, at
 * the fatigue it has now and no more training. Null when none fits, so the line is left out.
 */
export function readyLine(S, fatigue, { now, today }) {
  const exercises = exercisesOf(S)
  const trainedToday = (S.workouts || []).some(w => workoutDay(w) === today)
  for (let i = 0; i < 7; i++) {
    const iso = plusDays(today, i)
    if (i === 0 && trainedToday) continue
    const routines = effectiveRoutines(S, iso)
    if (!routines.length) continue
    const load = {}
    for (const r of routines) for (const [m, v] of Object.entries(loadOfRoutine(r, exercises))) load[m] = (load[m] || 0) + v
    const muscles = Object.keys(load).filter(m => load[m] > 0)
    if (!muscles.length) continue
    const by = Math.max(now, dateOf(iso).getTime())
    const ready = m => { const at = fatigueReadyAt(fatigue[m] || 0, m, now); return at == null || at <= by }
    if (!muscles.every(ready)) continue
    const name = routines.map(r => r.name).join(' + ')
    const fits = i === 0 ? t('Today’s {0} session fits.', name) : t('{0}’s {1} session fits.', dateOf(iso).toLocaleDateString(dateLocale(), { weekday: 'long' }), name)
    const regions = REGIONS.filter(r => r.muscles.some(m => (load[m] || 0) >= 1)).map(r => REGION_NAME[r.name]())
    return regions.length ? t('{0} ready.', andList(regions)) + ' ' + fits : fits
  }
  return null
}

/* -------------------------------------------------------------- Strength -- */

/** When each muscle last had a finished work set, by the muscles its exercise trains. */
export function latestMuscleTraining(workouts) {
  const latest = {}
  for (const workout of workouts || []) {
    const timestamp = workoutAt(workout)
    if (!Number.isFinite(timestamp)) continue
    for (const entry of workout.entries || []) {
      if (!doneSets(entry)) continue
      const exercise = EXIDX[entry.id] || entry.exercise || entry
      for (const slug of Object.keys(musclesOf(exercise))) {
        if (latest[slug] == null || timestamp > latest[slug]) latest[slug] = timestamp
      }
    }
  }
  return latest
}

/**
 * The Strength segment's map and its "Losing strength" list: retained strength per muscle with
 * its shades, and every muscle below full, strongest first, with its sets in the last 90 days and
 * the whole weeks since it was trained (null: never).
 */
export function strengthMuscles(S, now) {
  const strength = strengthOf(S.workouts, now, recoveryOpts(S))
  const levels = levelsOf(strength, STRENGTH_LEVELS)
  const last = latestMuscleTraining(S.workouts)
  const vol90 = loadOfWorkouts((S.workouts || []).filter(w => workoutAt(w) > now - 90 * DAY))
  const losing = rankOf(strength).worked.filter(slug => strength[slug] < 1).map(slug => ({
    slug, level: levels[slug] || 0, sets90: round1(vol90[slug]), weeks: last[slug] == null ? null : weeksSinceTraining(now, last[slug]),
  }))
  return { strength, levels, losing }
}

/** "Weeks since training: 3", or "not trained". */
export const sinceText = weeks => (weeks == null ? t('not trained') : t('Weeks since training: {0}', weeks))

/* ------------------------------------------------------------ the muscle -- */

export const isMuscle = slug => MUSCLES.includes(slug)
export const muscleName = slug => t(MUSCLE_NAME[slug])

/**
 * This week's exercises that trained `slug`, its main movers first: `{ id, entry, sets, counted,
 * day, primary }`. `sets` are the finished work sets; `counted` is what they count for this muscle
 * (a secondary mover's sets count in part, as the map counts them).
 */
export function trainedBy(workouts, slug) {
  const rows = new Map()
  for (const w of workouts || []) {
    const day = workoutDay(w)
    for (const e of w.entries || []) {
      const n = doneSets(e)
      if (!n) continue
      const saved = e.exercise || e
      const weight = musclesOf(saved?.muscleWeights ? saved : (EXIDX[e.id] || saved))[slug]
      if (!weight) continue
      const row = rows.get(e.id) || { id: e.id, entry: e, sets: 0, weight, day: null, primary: primaryMuscleOf(e)?.slug === slug }
      row.sets += n
      if (day && (!row.day || day > row.day)) row.day = day
      rows.set(e.id, row)
    }
  }
  return [...rows.values()]
    .map(r => ({ ...r, counted: round1(r.sets * r.weight) }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || b.counted - a.counted)
}

/**
 * "Try next": catalogue strength and bodyweight exercises with `slug` as a main mover that you
 * have never logged, the ones your equipment allows first (exAvailable), `limit` of them.
 */
export function tryNextFor(S, slug, limit = 3) {
  const done = new Set((S.workouts || []).flatMap(w => (w.entries || []).map(e => e.id)))
  const fits = CATALOGUE.filter(ex => (ex.cat === 'strength' || ex.cat === 'calisthenics') && !done.has(ex.id) && musclesOf(ex)[slug] >= 1)
  const ok = fits.filter(ex => exAvailable(S, ex))
  return [...ok, ...fits.filter(ex => !ok.includes(ex))].slice(0, limit)
}

/**
 * The muscle page's numbers: sets this week and in the last 4 weeks (and a week on average),
 * fatigue now with its state and when it is ready (null when it is, or it cannot be told), this
 * week's exercises, and what to try next.
 */
export function muscleOf(S, slug, { now, today }) {
  const ws = weekStartOf(S)
  const thisWeek = (S.workouts || []).filter(w => workoutDay(w) && weekKey(workoutDay(w), ws) === weekKey(today, ws))
  const four = round1(loadOfWorkouts((S.workouts || []).filter(w => workoutAt(w) > now - 28 * DAY))[slug])
  const fatigue = fatigueOf(S.workouts, now, recoveryOpts(S))[slug] || 0
  return {
    week: round1(loadOfWorkouts(thisWeek)[slug]),
    four,
    perWeek: round1(four / 4),
    fatigue,
    state: fatigueStateOf(fatigue),
    readyAt: fatigueReadyAt(fatigue, slug, now),
    exercises: trainedBy(thisWeek, slug),
    tryNext: tryNextFor(S, slug),
  }
}

/**
 * When a resting muscle is ready, as the tile says it: the time when that is today, else the
 * weekday ("Tue"). Null when it is ready already.
 */
export function readyWhen(readyAt, now) {
  if (readyAt == null) return null
  const at = new Date(readyAt)
  const sameDay = at.toDateString() === new Date(now).toDateString()
  return sameDay
    ? at.toLocaleTimeString(dateLocale(), { hour: 'numeric', minute: '2-digit' })
    : at.toLocaleDateString(dateLocale(), { weekday: 'short' })
}
