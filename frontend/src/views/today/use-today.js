import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { dateLocale, t, tn } from '../../lib/i18n.js'
import { DAYN, durPart, exCount, fmtNum, isoOf, startOfWeek, todayISO, weekStartOf } from '../../lib/format.js'
import { doneUnits, setUnits, setsDone, workoutDuration } from '../../lib/history.js'
import { weekTally } from '../../lib/queue.js'
import { dayMark, nameOf, trainingDay } from '../../lib/training-day.js'
import { mealItems, resolveGoalFor, totalsOf } from '../../lib/nutrition/diary.js'
import { diaryIndexDays, useDiaryIndex } from '../../lib/nutrition/diary-index.js'
import { dayHasLog } from '../../lib/nutrition/first-log.js'
import { loadErrorText } from '../../lib/nutrition/log-feedback.js'
import { mealLabels } from '../../lib/nutrition/meal-name.js'
import { useDiarySelection, useDiaryTarget } from '../../lib/nutrition/selection.js'
import { useHubStatusRefresh, useHubTrouble } from '../../lib/nutrition/sync.js'
import { useDiaryDay } from '../../lib/nutrition/use-diary-day.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import { waterButtons } from '../../lib/nutrition/water.js'
import { usePlanRefused } from '../../lib/onboarding/use-plan-refused.js'
import { focusSearch, openSearch, useSearch } from '../../lib/search/session.js'
import { bwSheet, startFlow, workoutDetailSheet } from '../../sheets.jsx'
import { foodPickerSheet } from '../../components/FoodPickerSheet.jsx'
import { nutritionDaySheet } from '../../components/NutritionDaySheet.jsx'
import { scanToSelection } from '../../components/scan-to-selection.js'
import { useConnectionTrouble } from '../../components/SyncBanner.jsx'
import { addWater, waterAria } from '../../components/WaterCard.jsx'
import { useOfflinePill } from './use-offline-pill.js'

// The glasses row stays one line: twelve at most (ds/WaterGlasses).
const MAX_GLASSES = 12
const MEAL_ICONS = ['sunrise', 'sun', 'moon', 'apple']
const MACROS = [
  { id: 'proteins', name: () => t('Protein'), left: () => t('Protein left') },
  { id: 'carbohydrates', name: () => t('Carbs'), left: () => t('Carbs left') },
  { id: 'fat', name: () => t('Fat'), left: () => t('Fat left') },
]

const grams = g => fmtNum(Math.round(Number(g) || 0))

/** Today's date, as of when the app last came to the front (PR01Edges, Midnight): a screen left
 *  open over midnight keeps its day, and rolls over the next time the app opens. */
export function useTodayDate() {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const onShow = () => { if (document.visibilityState !== 'hidden') setToday(todayISO()) }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [])
  return today
}

/** Which Today: 'both', 'food' (no Up next) or 'training' (one ring, the week, no food). Food is
 *  nutrition being there (a session for the hub, not the phone build); training has no switch
 *  yet, so it is always on. */
export function todayProfile(food, training = true) {
  if (food && training) return 'both'
  return food ? 'food' : 'training'
}

/** The hero's four rings: energy left, then protein, carbs and fat left. `day` is useDiaryDay's. */
export function foodRings(day, units) {
  const eaten = day.totals.calories
  const target = day.target.target
  const over = day.left < 0
  const burned = day.activitySum?.effective > 0 ? day.activitySum.effective : 0
  const energy = {
    key: 'energy', name: t('Calories'), icon: 'flame',
    top: over ? t('Over today') : t('Left today'),
    big: units.energyValue(Math.abs(day.left)),
    unit: over ? t('{0} over {1}', units.energyUnit, units.energyValue(target)) : t('of {0}', units.energy(target)),
    value: eaten, max: target, over: over && target > 0 ? -day.left / target : 0,
    pill: [burned && t('{0} burned', units.energyValue(burned)), eaten > 0 ? t('{0} eaten', units.energyValue(eaten)) : t('Nothing eaten yet')].filter(Boolean).join(' · '),
  }
  return [energy, ...MACROS.map(m => {
    const had = Number(day.totals[m.id]) || 0
    const goal = day.macros[m.id]
    const pill = had > 0 ? t('{0} eaten', grams(had) + ' g') : t('Nothing yet')
    if (!(goal > 0)) return { key: m.id, name: m.name(), icon: 'utensils', top: m.name(), big: grams(had), unit: 'g', value: 0, max: 1, pill }
    const left = goal - had
    return {
      key: m.id, name: m.name(), icon: 'utensils',
      top: left < 0 ? t('Over today') : m.left(),
      big: grams(Math.abs(left)),
      unit: left < 0 ? t('{0} over {1}', 'g', grams(goal) + ' g') : t('{0} of {1}', 'g', grams(goal) + ' g'),
      value: had, max: goal, over: left < 0 ? -left / goal : 0, pill,
    }
  })]
}

/** The one ring of the training profile: workouts this week against the plan. */
export function trainingRing(S, today) {
  const { done, planned } = weekTally(S, today)
  const day = trainingDay(S, today, today)
  return {
    key: 'workouts', name: t('Workouts'), icon: 'dumbbell',
    top: t('This week'), big: String(done),
    unit: t('of {0}', tn('{0} workout', '{0} workouts', planned)),
    value: done, max: Math.max(planned, 1),
    pill: day.kind === 'planned' ? t('{0} today', day.name) : null,
  }
}

/** The Up next row (GlassRow props) for today's training, or the way to a plan when there is none. */
export function upNextOf(S, today, { planRefused, nav }) {
  const toWorkout = () => nav('/train/workout')
  if (planRefused && !S.active) {
    return { eyebrow: t('No plan yet'), title: t('Your plan couldn’t be set up'), sub: t('Pick one in Training.'), trailing: 'chev', onClick: () => nav('/train') }
  }
  if (!S.routines.length && !S.active) {
    return { title: t('No plan yet'), sub: t('Choose a plan any time in Train'), trailing: 'chev', onClick: () => nav('/train') }
  }
  const day = trainingDay(S, today, today)
  switch (day.kind) {
    case 'editing': return { eyebrow: t('Editing a saved workout'), title: day.active.name, trailing: 'chev', onClick: toWorkout }
    // `since`: the clock after the eyebrow, for a live session (a backfill has none).
    case 'running': return {
      eyebrow: t('Workout running'), since: day.live ? day.active.start : null, title: day.active.name,
      sub: exercisesDone(day.active), trailing: 'resume', onClick: toWorkout,
    }
    case 'done': return {
      eyebrow: t('Done today'), title: day.workout.name || t('Workout done'), sub: doneLine(day.workout),
      trailing: 'check', onClick: () => workoutDetailSheet(day.workout),
    }
    case 'planned': return {
      eyebrow: t('Training today'), title: day.name,
      sub: [exCount(day.routines.reduce((n, r) => n + (r.ex?.length || 0), 0)), day.rescheduled && t('rescheduled')].filter(Boolean).join(' · '),
      trailing: 'play', onClick: () => startFlow(day.ids),
    }
    default: return {
      eyebrow: t('Rest day'), title: t('Recover'),
      sub: day.next ? nextLine(day.next, today) : null,
      trailing: 'chev', onClick: () => nav('/train/schedule'),
    }
  }
}

const plusDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d) }
const daysBetween = (from, to) => Math.round((new Date(to + 'T12:00:00') - new Date(from + 'T12:00:00')) / 864e5)

/** Up next on a rest day: the next session and its day, "tomorrow" when it is. */
function nextLine(next, today) {
  const name = nameOf(next.routines)
  return next.iso === plusDays(today, 1) ? t('Next: {0}, tomorrow', name) : t('Next: {0}, {1}', name, t(DAYN[next.weekday]))
}

/** A running session's progress: "3 of 6 exercises done", an exercise done once every set is. */
export function exercisesDone(active) {
  const entries = active?.entries || []
  if (!entries.length) return null
  const done = entries.filter(e => e.sets?.length && e.sets.every(s => doneUnits(s) === setUnits(s))).length
  return t('{0} of {1} done', done, exCount(entries.length))
}

/** A finished session's line: how long, its sets and its new bests, whichever it has. */
export function doneLine(w) {
  const sets = setsDone(w)
  const bests = w.prs?.length || 0
  return [
    ...durPart(workoutDuration(w)),
    sets > 0 && tn('{0} set', '{0} sets', sets),
    bests > 0 && tn('{0} new best', '{0} new bests', bests),
  ].filter(Boolean).join(' · ') || null
}

// T1.10: a return after this many days without a log of any kind.
export const AWAY_DAYS = 7
const AWAY_KEY = 'gains.awaySeen'
const storage = () => { try { return globalThis.localStorage || null } catch { return null } }

/** The day of the last thing logged: a workout, a weigh-in or food (`food`: the newest diary day,
 *  null for none, undefined while that is not known yet). Null when nothing was ever logged,
 *  undefined while the diary may still hold something newer. */
export function lastLogOf(S, food) {
  if (food === undefined) return undefined
  let last = food || null
  for (const w of S.workouts) if (w.d && (!last || w.d > last)) last = w.d
  for (const b of S.bodyweight) if (b.d && (!last || b.d > last)) last = b.d
  return last
}

/** Days since the last log when it is a return worth a welcome (AWAY_DAYS or more), else 0. */
export function awayDays(lastLog, today) {
  const days = lastLog ? daysBetween(lastLog, today) : 0
  return days >= AWAY_DAYS ? days : 0
}

/** T1.9's steps, for a first day: the goal and the first meal with food, the week's plan with
 *  training, and a weigh-in. Each step is done once the app holds it; `label` is "1 of 4". */
export function firstStepsOf({ food, training = true, goalSet, planRefused, nav, onMeal, onWeigh }) {
  const steps = [
    food && (goalSet
      ? { title: t('Set your goal'), sub: t('Done in onboarding'), done: true }
      : { title: t('Set your goal'), sub: t('Open Food goals'), onClick: () => nav('/food/goals') }),
    food && { title: t('Log your first meal'), sub: t('Takes about 20 seconds'), onClick: onMeal },
    training && { title: t('Plan your training week'), sub: planRefused ? t('Your plan couldn’t be set up') : t('Pick your days in Plan'), onClick: () => nav('/train/schedule') },
    { title: t('Weigh in'), sub: t('Starts your trend'), onClick: onWeigh },
  ].filter(Boolean)
  return { steps, label: t('{0} of {1}', steps.filter(s => s.done).length, steps.length) }
}

/** The welcome back (T1.10), once per return: shown for the last log it is owed for until it is
 *  answered (Weigh in or Not now), then not again for that one. Logging anything puts it away. */
function useAway(lastLog, today) {
  const days = awayDays(lastLog, today)
  const [answered, setAnswered] = useState(null)
  const owed = days > 0 && answered !== lastLog && storage()?.getItem(AWAY_KEY) !== lastLog
  const answer = () => {
    try { storage()?.setItem(AWAY_KEY, lastLog) } catch { /* private mode: it shows again next open */ }
    setAnswered(lastLog)
  }
  return { days: owed ? days : 0, answer }
}

/** Whether the person chose a calorie goal: a target of their own, or Adaptive or Dynamic, which
 *  set it for them. calorieTarget falls back to 2000 without one, so its target cannot tell. */
export function goalSetOf(settings, date) {
  const mode = settings?.calorieGoalMode
  return mode === 'adaptive' || mode === 'dynamic' || resolveGoalFor(settings?.goals?.calories, date) != null
}

/** The week of the training profile, a mark a day: done, missed, today, planned or rest. */
export function weekOf(S, today) {
  const start = startOfWeek(today, weekStartOf(S))
  const words = { done: t('Done'), missed: t('Planned, not logged'), today: t('Today'), planned: t('Planned'), rest: t('Rest day') }
  return Array.from({ length: 7 }, (_, k) => {
    const d = new Date(start)
    d.setDate(d.getDate() + k)
    const iso = isoOf(d)
    // The training calendar's own marks (WeekStrip's dots): done, or a plan (overridden or not).
    const mark = dayMark(S, iso)
    const plans = mark === 'plan' || mark === 'ovr'
    const state = mark === 'done' ? 'done' : iso === today ? 'today' : plans ? (iso < today ? 'missed' : 'planned') : 'rest'
    const long = d.toLocaleDateString(dateLocale(), { weekday: 'long' })
    return { key: iso, dow: d.toLocaleDateString(dateLocale(), { weekday: 'narrow' }), state, label: t('{0}, {1}', long, words[state]) }
  })
}

/** The meal tiles: logged ones with their energy, the meal of the hour to add now, the rest empty. */
export function mealsOf(day, mealNow, units) {
  return mealLabels(day.settings).map((name, slot) => {
    const items = day.dayReady ? mealItems(day.entry, slot) : []
    const state = items.length ? 'done' : slot === mealNow ? 'now' : 'empty'
    return {
      slot, name, state, icon: MEAL_ICONS[slot] || 'utensils',
      sub: state === 'done' ? units.energy(totalsOf(items).calories) : state === 'now' ? t('Add now') : t('Nothing yet'),
    }
  })
}

/** The container the + of the glasses adds: the first one, or a bigger one where the first would
 *  draw more than twelve glasses for the goal. */
export function glassOf(settings, goal) {
  const buttons = waterButtons(settings)
  return buttons.find(b => goal / b.ml <= MAX_GLASSES) || buttons.reduce((a, b) => (b.ml > a.ml ? b : a))
}

// Today logs to the day on screen. The selected day is shared with Nutrition, so a log from here
// moves it to that day first, the way the picker's own chip shows it. Past midnight with the app
// still open that is yesterday (PR01Edges, Midnight), the day the water and the rings are on too.
function selectDay(day) {
  useDiarySelection.getState().setDate(day === todayISO() ? null : day)
}
function logFood(day, slot) {
  selectDay(day)
  if (slot != null) useDiarySelection.getState().setMeal(slot)
  foodPickerSheet()
}
function scanToday(day) {
  selectDay(day)
  scanToSelection()
}

/**
 * Everything Today shows, for TodayScreen: { profile, status, error, header, searching,
 * saved, away, firstSteps, nextPending, rings, onRing, actions, upNext, meals, onMeal, onSeeDay,
 * water, week }. `status` ('known' | 'pending' | 'failed') gates everything below the rings.
 * Sections a profile or the day leaves out are null: firstSteps (T1.9) stands in for Up next on a
 * first day, nextPending while that is not known yet, away (T1.10) is the welcome back, saved
 * (T1.14) the offline pill. Taps go where the
 * boards link: the rings, See day and a logged meal open the Nutrition drawer (T1.3), on the
 * ring's own tab.
 */
export function useToday() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const units = useUnits()
  const today = useTodayDate()
  const day = useDiaryDay(today)
  const { meal } = useDiaryTarget(day.settings ?? null)
  const planRefused = usePlanRefused(user, S.routines.length > 0)
  const connection = useConnectionTrouble()
  const hub = useHubTrouble()
  useHubStatusRefresh()
  const searching = useSearch(s => s.open)
  const [watering, setWatering] = useState(false)
  const indexComplete = useDiaryIndex(s => s.complete)
  const indexSynced = useDiaryIndex(s => s.synced)
  useDiaryIndex(s => s.version)
  const saved = useOfflinePill()

  const profile = todayProfile(day.on)
  const food = profile !== 'training'
  // What Today knows below the rings, one value every section reads: 'failed' when the day did
  // not load (a retry banner, nothing that looks like an empty day), 'pending' until it has.
  const status = !food ? 'known' : day.status === 'error' ? 'failed' : day.status === 'ready' ? 'known' : 'pending'
  // The newest food log: today's diary once it has landed and has one, else the diary index once
  // this session's sync has caught every day up (a saved copy from a past visit can be behind).
  // Until then it is not known, and neither First steps nor the welcome back shows.
  const foodLast = !food ? null
    : !day.dayReady ? undefined
      : dayHasLog(day.entry) ? today
        : indexComplete && indexSynced ? (diaryIndexDays()[0]?.date ?? null) : undefined
  const lastLog = lastLogOf(S, foodLast)
  const away = useAway(lastLog, today)
  // A first day needs no plan and no log anywhere. Without a plan or a log in Gains, the row under
  // the actions waits for the food one (a skeleton), unless the index sync failed: then it is Up
  // next, never First steps for someone who may have years of logs.
  const planless = !S.routines.length && !S.active
  const firstDay = planless && lastLog === null
  const nextPending = planless && lastLog === undefined && !indexSynced && lastLogOf(S, null) === null
  const error = status === 'failed' ? { text: loadErrorText(day.error), retry: day.reload } : null
  const glass = food ? glassOf(day.settings, day.water.goal) : null

  const addGlass = async () => {
    if (!glass || watering || !day.dayReady) return
    setWatering(true)
    await addWater(today, glass.ml)
    setWatering(false)
  }
  const weighIn = { icon: 'scale', label: t('Weigh-in'), onClick: () => bwSheet({ date: today }) }
  const start = () => {
    const d = trainingDay(S, today, today)
    if (d.kind === 'planned') startFlow(d.ids)
    else nav('/train/workout')
  }

  const header = {
    initial: user?.name || '',
    placeholder: t('Search'),
    alert: connection ? t('Connection problem') : hub ? t('Nutrition sync needs attention') : null,
    onSettings: () => nav('/me'),
    onBell: () => nav('/me/notifications'),
    // The app's search types into a header input: the tab's own header takes over while it is open,
    // mounted and focused inside this tap so a phone raises its keyboard.
    onSearch: open => { if (open) flushSync(() => focusSearch(() => openSearch('home'))) },
  }

  const water = food ? {
    value: day.water.total / 1000,
    target: day.water.goal / 1000,
    step: glass.ml / 1000,
    label: t('{0} of {1}', units.waterParts(day.water.total).value, units.water(day.water.goal)),
    ariaLabel: t('Water, {0} of {1}', units.water(day.water.total), units.water(day.water.goal)),
    addLabel: waterAria(glass, units),
    onAdd: addGlass,
  } : null

  const firstSteps = firstDay
    ? firstStepsOf({ food, training: profile !== 'food', goalSet: goalSetOf(day.settings, today), planRefused, nav, onMeal: () => logFood(today), onWeigh: weighIn.onClick })
    : null
  const welcome = away.days > 0 ? {
    title: t('Welcome back'),
    body: tn('{0} day since your last log.', '{0} days since your last log.', away.days) + ' '
      + (S.routines.length ? t('Your Plan kept going, so start from today. Nothing to catch up on.') : t('Start from today. Nothing to catch up on.')),
    actions: [
      { label: t('Weigh in'), solid: true, onClick: () => { away.answer(); bwSheet({ date: today }) } },
      { label: t('Not now'), onClick: away.answer },
    ],
  } : null

  return {
    profile, status, error, header, searching, saved, away: welcome, firstSteps, nextPending,
    rings: food ? (day.status === 'ready' ? foodRings(day, units) : []) : [trainingRing(S, today)],
    onRing: (_, i) => (food ? nutritionDaySheet({ date: today, tab: i }) : nav('/train')),
    actions: food
      ? [
        { icon: 'utensils', label: t('Log food'), onClick: () => logFood(today) },
        { icon: 'scanBarcode', label: t('Scan'), onClick: () => scanToday(today) },
        { icon: 'droplet', label: t('Water'), onClick: addGlass },
        weighIn,
      ]
      : [
        { icon: 'play', label: t('Start'), onClick: start },
        { icon: 'chartLine', label: t('Activity'), onClick: () => nav('/train/history') },
        weighIn,
        { icon: 'calendar', label: t('Plan'), onClick: () => nav('/train/schedule') },
      ],
    upNext: profile === 'food' || firstSteps || nextPending ? null : upNextOf(S, today, { planRefused, nav }),
    meals: food ? mealsOf(day, meal, units) : null,
    onMeal: m => (m.state === 'done' ? nutritionDaySheet({ date: today }) : logFood(today, m.slot)),
    onSeeDay: () => nutritionDaySheet({ date: today }),
    water,
    week: food ? null : { days: weekOf(S, today), label: weekDone(S, today) },
  }
}

const weekDone = (S, today) => { const { done, planned } = weekTally(S, today); return t('{0} of {1} done', done, planned) }
