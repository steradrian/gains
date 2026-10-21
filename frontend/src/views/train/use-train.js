import { useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { focusSearch, openSearch, useSearch } from '../../lib/search/session.js'
import { useConnectionTrouble } from '../../components/SyncBanner.jsx'
import { addRoutine } from '../routines/routine-actions.js'
import { dateLocale, t, tn } from '../../lib/i18n.js'
import { coachAvailable } from '../../lib/coach.js'
import { canNoteDay, dayNoteOf } from '../../lib/day-notes.js'
import { DEMO } from '../../lib/demo.js'
import { activeProfile } from '../../lib/equipment.js'
import { exOr, figureOf, imgSrc, isCustomEx } from '../../lib/exercises.js'
import { durPart, exCount, exerciseNameText, fmtDate, fmtNum, isoOf, startOfWeek, weekKey, weekOrder, weekStartOf } from '../../lib/format.js'
import { doneUnits, effectiveRoutineIds, exLine, setUnits, setsDone, setsDoneActive, streakWeeks, workoutDay, workoutDuration, workoutVolume } from '../../lib/history.js'
import { firstWorkoutDay, missedDay, movePlan, moveToToday, plusDays, skipMissed } from '../../lib/missed-day.js'
import { MOBILE } from '../../lib/mobile.js'
import { levelsOf, loadOfActive, loadOfRoutine, loadOfWorkouts, muscleBalanceWindow, MUSCLE_NAME, rankOf, REGIONS, untrainedRegions } from '../../lib/muscles.js'
import { queueOf } from '../../lib/queue.js'
import { markUndone, undoMarks } from '../../lib/sync-merge.js'
import { rotationIds, scheduleModeOf } from '../../lib/rotation.js'
import { bestStreakWeeks, usualDuration, volumePair, weekVolume } from '../../lib/train-stats.js'
import { dayMark, nameOf, nextSession, trainingDay, workoutLabel } from '../../lib/training-day.js'
import { dayNoteSheet, dayOptionsSheet, dayOverrideSheet, importPlanFile, logPastWorkoutSheet, starterPlanSheet, startChooserSheet, startFlow } from '../../sheets.jsx'
import { trainingRing, useTodayDate } from '../today/use-today.js'
import { workoutsSheet } from './workouts-sheet.js'

// T2.14: the rail reaches eight weeks past this one, and back no further than eight weeks before
// it (or the week of the first workout): its size is bounded by today, not by the history.
export const RAIL_AHEAD = 8
export const RAIL_BEHIND = 8
// The rail's weeks are Thu–Wed around today (PR02 boards): today sits fourth of seven.
const DAYS_BEFORE = 3

const daysBetween = (from, to) => Math.round((new Date(to + 'T12:00:00') - new Date(from + 'T12:00:00')) / 864e5)
const dateOf = iso => new Date(iso + 'T12:00:00')
const routinesOf = (S, ids) => ids.map(id => S.routines.find(r => r.id === id)).filter(Boolean)
const plannedOn = (S, iso, today) => routinesOf(S, effectiveRoutineIds(S, iso, today))
const exercisesIn = routines => routines.reduce((n, r) => n + (r.ex?.length || 0), 0)
const longDay = iso => dateOf(iso).toLocaleDateString(dateLocale(), { weekday: 'long' })
const andList = names => {
  try { return new Intl.ListFormat(dateLocale(), { type: 'conjunction' }).format(names) } catch { return names.join(', ') }
}
// Literal calls, so check-source-strings sees each key (lib/muscles.js REGIONS holds the English).
// 'Back' alone is already the packs' back button, so the body part has a key of its own.
const REGION_NAME = { Chest: () => t('Chest'), Back: () => t('Back muscles'), Shoulders: () => t('Shoulders'), Arms: () => t('Arms'), Core: () => t('Core'), Legs: () => t('Legs') }

/* ---------------------------------------------------------------- the rail -- */

/** The rail week `offset` weeks from today's (0), its first day and its title. */
export function railWeekStart(today, offset) { return plusDays(today, offset * 7 - DAYS_BEFORE) }

export function railTitle(offset, start) {
  if (offset === 0) return t('This week')
  if (offset === 1) return t('Next week')
  return t('Week of {0}', fmtDate(start))
}

/**
 * One day of the rail: `{ iso, dow, date, mark, state, label, name }`. `mark` is the calendar's
 * (dayMark). `state` is 'today', a past day's 'done', 'noted', 'missed' or 'rest', a later day's
 * 'planned' or 'rest', or 'plain' for a day before the first workout (no marks). `name` is what
 * the day holds: the workout done, or the routines planned.
 */
export function railDay(S, iso, today, first) {
  const d = dateOf(iso)
  const base = { iso, dow: d.toLocaleDateString(dateLocale(), { weekday: 'narrow' }), date: d.getDate() }
  const long = d.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
  if (iso < today && (!first || iso < first)) return { ...base, mark: undefined, state: 'plain', label: long, name: null }
  const mark = dayMark(S, iso)
  const planned = plannedOn(S, iso, today)
  const state = iso === today ? 'today'
    : mark === 'done' ? 'done'
      : iso < today ? (mark === 'noted' ? 'noted' : planned.length ? 'missed' : 'rest')
        : planned.length ? 'planned' : 'rest'
  const words = {
    today: t('Today'), done: t('Done'), noted: t('Day note'), missed: t('Planned, not logged'), planned: t('Planned'), rest: t('Rest day'),
  }
  const done = mark === 'done' ? S.workouts.filter(w => workoutDay(w) === iso) : null
  const name = done ? workoutLabel(done[0]) : planned.length ? nameOf(planned) : null
  return { ...base, mark, state, label: long + ', ' + words[state], name }
}

/**
 * The rail: `{ from, to, weeks }`, weeks from `from` (the week of the first workout, at most
 * RAIL_BEHIND back, or this week without one) to `to` (RAIL_AHEAD), each `{ offset, title, start,
 * days }`. Later weeks read the plan as it repeats (the weekdays, with any day changed on its own).
 */
export function railOf(S, today) {
  const first = firstWorkoutDay(S)
  const from = first && first < today ? Math.max(-RAIL_BEHIND, Math.min(0, Math.floor(daysBetween(railWeekStart(today, 0), first) / 7))) : 0
  const weeks = []
  for (let offset = from; offset <= RAIL_AHEAD; offset++) {
    const start = railWeekStart(today, offset)
    weeks.push({ offset, title: railTitle(offset, start), start, days: Array.from({ length: 7 }, (_, k) => railDay(S, plusDays(start, k), today, first)) })
  }
  return { from, to: RAIL_AHEAD, weeks }
}

/* --------------------------------------------------------------- the rings -- */

// The newest best of the week, as the volume ring's pill says it: "Bench press best: 82.5 kg".
function bestOfWeek(S, today) {
  const ws = weekStartOf(S)
  const key = weekKey(today, ws)
  const w = S.workouts.filter(x => x.prs?.length && workoutDay(x) && weekKey(workoutDay(x), ws) === key)
    .sort((a, b) => (workoutDay(a) < workoutDay(b) ? -1 : 1)).at(-1)
  const id = w?.prs[0]
  const kg = id && S.exWeights?.[id]?.w
  return kg ? t('{0} best: {1}', exerciseNameText(exOr(id)), fmtNum(kg) + ' ' + S.unit) : null
}

/** The ring carousel: workouts this week, volume against last week, the streak (RingCarousel slides). */
export function ringsOf(S, today) {
  const workouts = trainingRing(S, today)
  const day = trainingDay(S, today, today)
  if (day.kind === 'running' || day.kind === 'editing') workouts.pill = t('{0} running', day.active.name)

  const now = weekVolume(S, today), last = weekVolume(S, plusDays(today, -7))
  const pair = volumePair(now, last, S.unit)
  const volume = {
    key: 'volume', name: t('Volume'), icon: 'chartLine', top: t('Volume this week'), big: pair.a,
    unit: last > 0 ? t('{0} of {1} last week', pair.unit, pair.b + ' ' + pair.unit) : pair.unit,
    value: now, max: Math.max(last, now, 1), pill: bestOfWeek(S, today),
  }

  const streak = streakWeeks(S), best = Math.max(bestStreakWeeks(S), streak)
  const run = {
    // The streak opens the Plan (onRing), and says so as the board does.
    key: 'streak', name: t('Streak'), icon: 'flame', top: t('On plan'), big: String(streak), hint: t('Open Plan'),
    unit: tn('week in a row', 'weeks in a row', streak), value: streak, max: Math.max(best, 1),
    pill: best > 0 ? t('Best: {0}', tn('{0} week', '{0} weeks', best)) : null,
  }
  return [workouts, volume, run]
}

/* ---------------------------------------------------------------- the card -- */

// The intents a card offers, as data: the screen draws them, useTrain's onIntent runs them.
const intent = {
  start: (name, ids) => ({ intent: 'start', label: name ? t('Start {0}', name) : t('Start'), ids }),
  resume: () => ({ intent: 'resume', label: t('Resume') }),
  seeWorkout: (workouts, title) => ({ intent: 'see-workout', label: workouts.length > 1 ? t('See workouts') : t('See workout'), workouts, title }),
  trainAnyway: () => ({ intent: 'train-anyway', label: t('Train anyway') }),
  seeDay: iso => ({ intent: 'see-day', label: t('See {0}', longDay(iso)), iso }),
  changeDay: iso => ({ intent: 'change-day', label: t('Change this day'), iso }),
  routine: (id, edit) => ({ intent: 'see-routine', label: edit ? t('Edit routine') : t('See routine'), id }),
  log: (iso, routineIds) => ({ intent: 'log-workout', label: routineIds ? t('Log this workout') : t('Log workout'), iso, ...(routineIds ? { routineIds } : {}) }),
  choose: () => ({ intent: 'choose-workout', label: t('Choose a different workout') }),
  note: iso => ({ intent: 'add-note', label: t('Add a note'), iso }),
}

/** A catalogue exercise's still, or null (a custom one's picture lives in the local media store). */
export function pictureOf(S, id) {
  const ex = exOr(id)
  return ex?.img && !isCustomEx(ex) ? imgSrc(ex, figureOf(S)) : null
}

/** A planned exercise as a read-only row: "Barbell full squat", "4 × 5 · 100 kg", its still. */
const exerciseRows = (S, routines) => routines.flatMap(r => (r.ex || []).map(cfg => ({
  id: cfg.id, name: exerciseNameText(exOr(cfg.id)), line: exLine(cfg, S.unit, S.speedUnit), image: pictureOf(S, cfg.id),
})))

// A logged workout's exercises as stills, for the card's stack.
const stillsOf = (S, w) => (w.entries || []).map(e => pictureOf(S, e.id))

// How far a session is: the exercises with every set ticked, of all of them (0–1), or null.
const progressOf = active => {
  const entries = active?.entries || []
  if (!entries.length) return null
  return entries.filter(e => e.sets?.length && e.sets.every(s => doneUnits(s) === setUnits(s))).length / entries.length
}

// "Chest, shoulders, triceps": the three muscles a day's routines work most.
export const musclesLine = routines => {
  const load = {}
  for (const r of routines) for (const [m, v] of Object.entries(loadOfRoutine(r))) load[m] = (load[m] || 0) + v
  const top = rankOf(load).worked.slice(0, 3)
  return top.length ? top.map(m => t(MUSCLE_NAME[m])).join(', ') : null
}
const about = (S, routines) => {
  const ms = routines.length === 1 ? usualDuration(S, routines[0].id) : null
  return ms ? t('about {0}', durPart(ms)[0]) : null
}

/** A running session's line: "3 of 6 exercises · 11 sets · next: Cable middle fly". */
export function runningLine(active) {
  const entries = active?.entries || []
  if (!entries.length) return null
  const full = e => e.sets?.length && e.sets.every(s => doneUnits(s) === setUnits(s))
  const next = entries.find(e => !full(e))
  const sets = setsDoneActive(active)
  return [
    t('{0} of {1}', entries.filter(full).length, exCount(entries.length)),
    sets > 0 && tn('{0} set', '{0} sets', sets),
    next && t('next: {0}', exerciseNameText(exOr(next.id))),
  ].filter(Boolean).join(' · ')
}

/** A finished session's line: "52 min · 18 sets · 9,600 kg · 2 new bests", whichever it has. */
export function finishedLine(w, unit) {
  const sets = setsDone(w), vol = workoutVolume(w), bests = w.prs?.length || 0
  return [
    ...durPart(workoutDuration(w)),
    sets > 0 && tn('{0} set', '{0} sets', sets),
    vol > 0 && fmtNum(Math.round(vol)) + ' ' + unit,
    bests > 0 && tn('{0} new best', '{0} new bests', bests),
  ].filter(Boolean).join(' · ') || null
}

/**
 * The card for one rail day: `{ kind, iso, eyebrow, title, sub, since, chip, exercises, primary,
 * secondary, menu }`. `kind` is trainingDay's for today and a past day ('planned', 'running',
 * 'editing', 'done', 'rest', 'past-logged', 'past-missed', 'past-rest'), and for a later day
 * 'upcoming' (this rail week), 'future' (a later one) or 'free' (nothing planned). `since` is a
 * running clock's start (ms), `exercises` the read-only rows of a planned day. `primary` is one
 * intent, `secondary` and `menu` (the ⋯) lists of them.
 */
export function cardOf(S, iso, today) {
  const card = { iso, eyebrow: null, title: '', sub: null, since: null, progress: null, chip: null, exercises: null, thumbs: null, primary: null, secondary: [], menu: [] }
  const noteable = canNoteDay(iso, today) && !dayNoteOf(S, iso) && !S.workouts.some(w => workoutDay(w) === iso)
  const dayMenu = [intent.changeDay(iso), noteable && intent.note(iso)].filter(Boolean)

  if (iso > today) {
    const routines = plannedOn(S, iso, today)
    const date = fmtDate(iso, true)
    if (!routines.length) return { ...card, kind: 'free', eyebrow: date, title: t('Rest day'), secondary: [intent.changeDay(iso)] }
    const later = iso >= railWeekStart(today, 1)
    // T2.3 (this rail week) reads like today's card; T2.14 (a later week) lists what is in it.
    return {
      ...card, kind: later ? 'future' : 'upcoming', title: nameOf(routines),
      eyebrow: later ? date : t('{0} · planned', date), chip: later ? t('Planned') : null,
      sub: (later
        ? [exCount(exercisesIn(routines)), about(S, routines), t('read-only until the day')]
        : [musclesLine(routines), exCount(exercisesIn(routines)), about(S, routines)]).filter(Boolean).join(' · '),
      exercises: exerciseRows(S, routines),
      secondary: [intent.changeDay(iso), intent.routine(routines[0].id, later)],
    }
  }

  const day = trainingDay(S, iso, today)
  const date = iso < today ? fmtDate(iso, true) : null
  switch (day.kind) {
    case 'editing': return {
      ...card, kind: day.kind, eyebrow: t('Editing a saved workout'), title: day.active.name, sub: runningLine(day.active),
      progress: progressOf(day.active), primary: intent.resume(),
    }
    case 'running': return {
      ...card, kind: day.kind, eyebrow: t('In progress'), since: day.live ? day.active.start : null,
      title: day.active.name, sub: runningLine(day.active), progress: progressOf(day.active), primary: intent.resume(),
    }
    case 'done': return {
      ...card, kind: day.kind, eyebrow: t('Workout done'), title: workoutLabel(day.workout), sub: finishedLine(day.workout, S.unit),
      thumbs: stillsOf(S, day.workout), primary: intent.seeWorkout([day.workout], t('Today')), menu: [intent.choose(), intent.changeDay(iso)],
    }
    case 'planned': return {
      ...card, kind: day.kind, eyebrow: t('Today · planned'), title: day.name,
      sub: [musclesLine(day.routines), exCount(exercisesIn(day.routines)), about(S, day.routines), day.rescheduled && t('rescheduled')].filter(Boolean).join(' · '),
      exercises: exerciseRows(S, day.routines),
      primary: intent.start(day.name, day.ids), menu: [intent.choose(), ...dayMenu],
    }
    case 'rest': return {
      ...card, kind: day.kind, eyebrow: t('Rest day'), title: t('Recover'),
      sub: day.next ? t('Next: {0}, {1}', nameOf(day.next.routines), fmtDate(day.next.iso, true)) : null,
      primary: intent.trainAnyway(), secondary: day.next ? [intent.seeDay(day.next.iso)] : [], menu: dayMenu,
    }
    case 'past-logged': {
      const one = day.workouts.length === 1 ? day.workouts[0] : null
      return {
        ...card, kind: day.kind, eyebrow: date,
        title: one ? workoutLabel(one) : tn('{0} workout', '{0} workouts', day.workouts.length),
        sub: one ? finishedLine(one, S.unit) : null, thumbs: one ? stillsOf(S, one) : null,
        primary: intent.seeWorkout(day.workouts, date), menu: [intent.changeDay(iso)],
      }
    }
    // Owner decision 2: a past day selects in place and keeps the backfill path (conflict 2).
    case 'past-missed': return {
      ...card, kind: day.kind, eyebrow: date, title: day.name, sub: t('Planned, not logged'),
      primary: intent.log(iso, day.ids), menu: dayMenu,
    }
    default: return { ...card, kind: 'past-rest', eyebrow: date, title: t('Rest day'), primary: intent.log(iso), menu: dayMenu }
  }
}

/* ----------------------------------------------------- routines and muscles -- */

// The routines a plan holds a place for: the weekdays, or in rotation mode the queue and rotation.
const scheduledIds = S => (scheduleModeOf(S) === 'rotation'
  ? [...(queueOf(S)?.ids ?? []), ...rotationIds(S)]
  : Object.values(S.week || {}).flat())

/**
 * Routines: those in the Plan first, then the rest, each `{ id, name, sub, inPlan, today, empty }`
 * ("6 exercises · Sun", the weekdays it holds in a week plan), then Freestyle (`freestyle: true`).
 */
export function routineRows(S, today) {
  const scheduled = new Set(scheduledIds(S))
  const todays = new Set(effectiveRoutineIds(S, today, today))
  const week = scheduleModeOf(S) === 'week'
  // 11 Oct 2026 was a Sunday: day `wd` of the week is 11 + wd Oct.
  const short = wd => new Date(2026, 9, 11 + wd, 12).toLocaleDateString(dateLocale(), { weekday: 'short' })
  const days = id => (week ? weekOrder(weekStartOf(S)).filter(wd => [].concat(S.week?.[wd] || []).includes(id)).map(short).join(', ') : '')
  const row = r => ({
    id: r.id, name: r.name, inPlan: scheduled.has(r.id), today: todays.has(r.id), empty: !r.ex?.length,
    thumbs: (r.ex || []).slice(0, 3).map(cfg => pictureOf(S, cfg.id)),
    sub: [exCount(r.ex?.length || 0), days(r.id)].filter(Boolean).join(' · '),
  })
  const rows = S.routines.map(row)
  return [
    ...rows.filter(r => r.inPlan), ...rows.filter(r => !r.inPlan),
    { id: null, name: t('Freestyle'), sub: t('Pick exercises as you go'), thumbs: [], freestyle: true, inPlan: false, today: false, empty: false },
  ]
}

/**
 * Effective sets per muscle this week, `{ slug: n }`: the sets ticked in the week (a session in
 * progress included), each weighted by how much its exercise works the muscle. The By muscle page
 * reads one muscle's number off it.
 */
export function muscleLoadThisWeek(S, today, now = Date.now()) {
  const load = loadOfWorkouts(muscleBalanceWindow(S.workouts, 7, now, today, weekStartOf(S)))
  if (S.active && !S.active.editingWorkoutId) for (const [m, v] of Object.entries(loadOfActive(S.active))) load[m] = (load[m] || 0) + v
  return load
}

/**
 * Muscles this week, for BodyMap: `{ title, levels, note }`. `levels` are 0–4 per muscle,
 * relative to the hardest-worked one, from the sets ticked this week (a session in progress
 * included), as Muscle balance's week shows them. `note` names the parts not trained yet.
 */
export function musclesThisWeekOf(S, today, now = Date.now()) {
  const ws = weekStartOf(S)
  const load = muscleLoadThisWeek(S, today, now)
  const missing = untrainedRegions(load)
  return {
    title: t('Week of {0}', fmtDate(isoOf(startOfWeek(today, ws)))),
    levels: levelsOf(load),
    note: !missing.length ? null
      : missing.length === REGIONS.length ? t('Nothing trained yet this week')
        : t('{0} not trained yet', andList(missing.map(n => REGION_NAME[n]()))),
  }
}

/* -------------------------------------------------------- more and profile -- */

/**
 * The Your training rows, `{ key, title, sub, to | action }`: History, Training load, Coach (when
 * it is available; `suggestions` is its count this week, when known), Ready-made plans, Gym setup,
 * and the gym card ("Gym card", route /train/checkin) when Coach is off and check-in is on (owner
 * decision 3, renamed by owner question 7).
 */
export function moreOf(S, { coach, suggestions = null }) {
  const days = S.workouts.map(workoutDay).filter(Boolean).sort()
  const gym = activeProfile(S) || (S.equipProfiles || []).find(p => p.id === S.activeEquipId) || (S.equipProfiles || [])[0]
  return [
    {
      key: 'history', title: t('History'), to: '/train/history',
      sub: S.workouts.length ? [tn('{0} workout', '{0} workouts', S.workouts.length), days.length && t('last: {0}', fmtDate(days.at(-1), true))].filter(Boolean).join(' · ') : t('Nothing logged yet'),
    },
    { key: 'load', title: t('Training load'), sub: t('Activity, muscle balance, fatigue, strength'), to: '/progress/load' },
    coach && { key: 'coach', title: t('Coach'), sub: suggestions > 0 ? tn('{0} suggestion this week', '{0} suggestions this week', suggestions) : null, to: '/train/coach' },
    { key: 'plans', title: t('Ready-made plans'), sub: [t('Full Body'), t('Push / Pull / Legs'), t('Upper / Lower'), t('5×5')].join(', '), action: 'plans' },
    { key: 'gym', title: t('Gym setup'), sub: gym?.name || null, to: '/me/equipment' },
    !coach && S.checkIn !== false && { key: 'checkin', title: t('Gym card'), sub: null, to: '/train/checkin' },
  ].filter(Boolean)
}

/** 'off' (T2.9) with no routines, no plan, no workouts and nothing running; `activities` are the
 *  week's other activities to show above the invitation. Otherwise 'on'. */
export function profileOf(S, activities = []) {
  const off = !S.routines.length && !S.workouts.length && !S.active && !queueOf(S)
  return off ? { kind: 'off', activities } : { kind: 'on' }
}

/* ------------------------------------------------------------- missed day -- */

const nameOfIds = (S, ids) => nameOf(routinesOf(S, ids))

// The banner's body when the missed day held one routine ("it"), and when it held several, of
// which Move carries one (movePlan's `id`), named.
const ONE_BODY = {
  free: coach => (coach ? t('Coach suggests doing it today. Nothing changes until you choose.') : t('You can do it today. Nothing changes until you choose.')),
  to: (coach, other, to) => (coach ? t('Coach suggests doing it today; {0} would move to {1}. Nothing changes until you choose.', other, to)
    : t('You can do it today; {0} would move to {1}. Nothing changes until you choose.', other, to)),
  instead: (coach, other) => (coach ? t('Coach suggests doing it today instead of {0}. Nothing changes until you choose.', other)
    : t('You can do it today instead of {0}. Nothing changes until you choose.', other)),
}
const NAMED_BODY = {
  free: (coach, name) => (coach ? t('Coach suggests doing {0} today. Nothing changes until you choose.', name) : t('You can do {0} today. Nothing changes until you choose.', name)),
  to: (coach, name, other, to) => (coach ? t('Coach suggests doing {0} today; {1} would move to {2}. Nothing changes until you choose.', name, other, to)
    : t('You can do {0} today; {1} would move to {2}. Nothing changes until you choose.', name, other, to)),
  instead: (coach, name, other) => (coach ? t('Coach suggests doing {0} today instead of {1}. Nothing changes until you choose.', name, other)
    : t('You can do {0} today instead of {1}. Nothing changes until you choose.', name, other)),
}

/**
 * The missed-day banner (T2.8): `{ iso, ids, name, title, body, displaced }`, or null. `body` says
 * what Move to today would do, naming the routine that moves when the day held several; Coach is
 * named only where it is on.
 */
export function missedOf(S, today, { coach }) {
  const m = missedDay(S, today)
  if (!m) return null
  const plan = movePlan(S, m.iso, today)
  if (!plan) return null
  const name = nameOfIds(S, m.ids)
  const d = plan.displaced
  const kind = !d ? 'free' : d.to ? 'to' : 'instead'
  // What leaves today: the one routine that moves to `to`, or all of today's session it replaces.
  const args = !d ? [] : d.to ? [nameOfIds(S, [d.id]), fmtDate(d.to, true)] : [nameOfIds(S, d.ids)]
  const body = m.ids.length > 1 ? NAMED_BODY[kind](coach, nameOfIds(S, [plan.id]), ...args) : ONE_BODY[kind](coach, ...args)
  return {
    iso: m.iso, ids: m.ids, name, displaced: d,
    title: t('You missed {0} on {1}', name, fmtDate(m.iso, true)), body,
    moveLabel: t('Move to today'), skipLabel: t('Skip it'),
  }
}

/** T2.12's toast: "Moved Legs to today. Push A is now Tue 20 Oct". `S` is the state before. */
export function movedText(S, moved) {
  const name = nameOfIds(S, [moved.id])
  const d = moved.displaced
  return d?.to ? t('Moved {0} to today. {1} is now {2}', name, nameOfIds(S, [d.id]), fmtDate(d.to, true)) : t('Moved {0} to today', name)
}

/** T2.13's toast: "Skipped Legs on Fri 16 Oct. Push A stays today". `S` is the state before. */
export function skippedText(S, missed, today) {
  const todays = plannedOn(S, today, today)
  const name = nameOfIds(S, missed.ids), date = fmtDate(missed.iso, true)
  return todays.length ? t('Skipped {0} on {1}. {2} stays today', name, date, nameOf(todays)) : t('Skipped {0} on {1}', name, date)
}

/* ------------------------------------------------------------------ the hook -- */

/**
 * Everything Train's root shows (PR02 T2.0 and its states), as data:
 *
 *   { header, searching, today, selected, select(iso), rail, card(iso = selected), rings,
 *     onRing(slide), actions, onIntent(intent), onPlan, onDayMenu(card), routines, onRoutine(row), onRoutineStart(row),
 *     musclesThisWeek, onMuscles, more, onMore(row), profile, setup, missed }
 *
 * `header` is StageHeader's props. `setup` is T2.9's { onPlans, onRoutine, onImport(file) }.
 * `missed` adds `move()` and `skip()`, each returning the toast `{ text, undo }` (UndoToast) or
 * null, and `onMove()` / `onSkip()`, which do the same and show that toast.
 * The rail selects locally (conflict 1): `selected` is Train's own, today until a day is picked.
 */
export function useTrain() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const config = useStore(s => s.config)
  const user = useStore(s => s.user)
  const coachMode = useStore(s => s.coachLocal?.mode)
  const today = useTodayDate()
  const [picked, select] = useState(null)
  const selected = picked || today
  const coach = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode })
  const connection = useConnectionTrouble()
  const searching = useSearch(s => s.open)
  const update = mut => useStore.getState().update(mut)

  const rail = useMemo(() => railOf(S, today), [S, today])
  const toWorkout = () => nav('/train/workout')
  const start = ids => (S.active ? toWorkout() : startFlow(ids))

  const onIntent = it => {
    switch (it.intent) {
      case 'start': return start(it.ids)
      case 'resume': return toWorkout()
      case 'choose-workout': case 'train-anyway': return startChooserSheet()
      case 'see-workout': return workoutsSheet(it.title, it.workouts)
      case 'see-day': return select(it.iso)
      case 'change-day': return dayOverrideSheet(it.iso)
      case 'see-routine': return nav('/train/routines/' + it.id)
      case 'log-workout': return logPastWorkoutSheet(it.routineIds ? { iso: it.iso, routineIds: it.routineIds } : { iso: it.iso })
      case 'add-note': return dayNoteSheet(it.iso)
      default: return undefined
    }
  }

  const onPlan = () => nav('/train/schedule')
  const todayCard = cardOf(S, today, today)
  const missed = missedOf(S, today, { coach })
  // T2.12 and T2.13: the app's toast with Undo (8 s).
  const toast = r => { if (r) useUI.getState().toast(r.text, { action: t('Undo'), onAction: r.undo }) }

  const header = {
    initial: user?.name || '',
    placeholder: t('Search training'),
    alert: connection ? t('Connection problem') : null,
    onSettings: () => nav('/me'),
    onBell: () => nav('/me/notifications'),
    // As on Today: the tab's own header takes over while the search is open, mounted and focused
    // inside this tap so a phone raises its keyboard.
    onSearch: open => { if (open) flushSync(() => focusSearch(() => openSearch('train'))) },
  }

  return {
    header, searching,
    today, selected, select,
    rail,
    card: (iso = selected) => (iso === today ? todayCard : cardOf(S, iso, today)),
    rings: ringsOf(S, today),
    // PR02Graph: a ring opens Training load, the streak the Plan (conflict 11).
    onRing: slide => nav(slide?.key === 'streak' ? '/train/schedule' : '/progress/load'),
    actions: [
      { key: 'start', icon: 'play', label: t('Start'), onClick: () => (todayCard.primary?.intent === 'start' || todayCard.primary?.intent === 'resume' ? onIntent(todayCard.primary) : startChooserSheet()) },
      { key: 'plan', icon: 'calendar', label: t('Plan'), onClick: onPlan },
      { key: 'routines', icon: 'list', label: t('Routines'), onClick: () => nav('/train/routines') },
      { key: 'exercises', icon: 'bookOpen', label: t('Exercises'), onClick: () => nav('/train/exercises') },
    ],
    onIntent,
    onPlan,
    // The card's ⋯ opens the Day options drawer (T2.2).
    onDayMenu: c => dayOptionsSheet(c.iso),
    routines: routineRows(S, today),
    onRoutine: row => (row.freestyle ? start([]) : nav('/train/routines/' + row.id)),
    onRoutineStart: row => (row.freestyle ? start([]) : row.empty && !S.active ? nav('/train/routines/' + row.id) : start([row.id])),
    musclesThisWeek: musclesThisWeekOf(S, today),
    onMuscles: () => nav('/progress/load'),
    more: moreOf(S, { coach }),
    onMore: row => (row.action === 'plans' ? starterPlanSheet() : nav(row.to)),
    // No source for other activities yet (lib/health-connect.js only writes): the list is empty.
    profile: profileOf(S),
    // T2.9's three ways in: a ready-made plan, a new routine in the editor, a plan file.
    setup: { onPlans: () => starterPlanSheet(), onRoutine: () => addRoutine(), onImport: file => importPlanFile(file) },
    missed: missed && { ...missed, move: moveMissed, skip: skipIt, onMove: () => toast(moveMissed()), onSkip: () => toast(skipIt()) },
  }

  // An Undo marks the plan days it put back (Plan's pattern, lib/sync-merge.js undoMarks), so a
  // change another device made to one of them in the meantime still wins.
  function withUndo(change) {
    const before = useStore.getState().S
    let done = null
    update(s => { done = change(s) })
    if (!done) return null
    const marks = undoMarks(before, useStore.getState().S)
    return { done, undo: () => update(s => { done.undo(s); markUndone(s, marks) }) }
  }
  function moveMissed() {
    const r = withUndo(s => moveToToday(s, missed.iso, today))
    return r && { text: movedText(S, r.done), undo: r.undo }
  }
  function skipIt() {
    const r = withUndo(s => skipMissed(s, missed.iso))
    return { text: skippedText(S, missed, today), undo: r.undo }
  }
}
