import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { dateLocale, t, tn } from '../../lib/i18n.js'
import { DAYN, exCount, fmtNum, isoOf, startOfWeek, todayISO, weekStartOf } from '../../lib/format.js'
import { weekTally } from '../../lib/queue.js'
import { dayMark, nameOf, trainingDay } from '../../lib/training-day.js'
import { mealItems, totalsOf } from '../../lib/nutrition/diary.js'
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
import { workoutLine } from '../../components/TrainingHero.jsx'
import { addWater } from '../../components/WaterCard.jsx'

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
    pill: [burned && t('{0} burned', units.energyValue(burned)), t('{0} eaten', units.energyValue(eaten))].filter(Boolean).join(' · '),
  }
  return [energy, ...MACROS.map(m => {
    const had = Number(day.totals[m.id]) || 0
    const goal = day.macros[m.id]
    const pill = t('{0} eaten', grams(had) + ' g')
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
    case 'running': return { eyebrow: t('Workout running'), title: day.active.name, trailing: 'resume', onClick: toWorkout }
    case 'done': return {
      eyebrow: t('Done today'), title: day.workout.name || t('Workout done'), sub: workoutLine(day.workout),
      trailing: 'check', onClick: () => workoutDetailSheet(day.workout),
    }
    case 'planned': return {
      eyebrow: t('Training today'), title: day.name,
      sub: [exCount(day.routines.reduce((n, r) => n + (r.ex?.length || 0), 0)), day.rescheduled && t('rescheduled')].filter(Boolean).join(' · '),
      trailing: 'play', onClick: () => startFlow(day.ids),
    }
    default: return {
      eyebrow: t('Rest day'), title: t('Recover'),
      sub: day.next ? t('Next: {0}, {1}', nameOf(day.next.routines), t(DAYN[day.next.weekday])) : null,
      trailing: 'chev', onClick: () => nav('/train/schedule'),
    }
  }
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
    return { key: iso, dow: d.toLocaleDateString(dateLocale(), { weekday: 'narrow' }), state, label: long + ', ' + words[state] }
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

// Today logs to today. The selected day is shared with Nutrition, so a log from here moves it back
// to today first, the way the picker's own chip would show it.
function logFood(slot) {
  const sel = useDiarySelection.getState()
  sel.setDate(null)
  if (slot != null) sel.setMeal(slot)
  foodPickerSheet()
}
function scanToday() {
  useDiarySelection.getState().setDate(null)
  scanToSelection()
}

/**
 * Everything Today shows, for TodayScreen: { profile, loading, error, header, searching, rings,
 * onRing, actions, upNext, meals, onMeal, onSeeDay, water, week }. Sections a profile leaves out
 * are null. Taps go where the boards link: the rings, See day and a logged meal open the Nutrition
 * drawer (T1.3), on the ring's own tab.
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

  const profile = todayProfile(day.on)
  const food = profile !== 'training'
  const loading = food && (day.status === 'loading' || day.status === 'idle')
  const error = food && day.status === 'error' ? { text: loadErrorText(day.error), retry: day.reload } : null
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
    onAdd: addGlass,
  } : null

  return {
    profile, loading, error, header, searching,
    rings: food ? (day.status === 'ready' ? foodRings(day, units) : []) : [trainingRing(S, today)],
    onRing: (_, i) => (food ? nutritionDaySheet({ date: today, tab: i }) : nav('/train')),
    actions: food
      ? [
        { icon: 'utensils', label: t('Log food'), onClick: () => logFood() },
        { icon: 'scanBarcode', label: t('Scan'), onClick: scanToday },
        { icon: 'droplet', label: t('Water'), onClick: addGlass },
        weighIn,
      ]
      : [
        { icon: 'play', label: t('Start'), onClick: start },
        { icon: 'chartLine', label: t('Activity'), onClick: () => nav('/train/history') },
        weighIn,
        { icon: 'calendar', label: t('Plan'), onClick: () => nav('/train/schedule') },
      ],
    upNext: profile === 'food' ? null : upNextOf(S, today, { planRefused, nav }),
    meals: food ? mealsOf(day, meal, units) : null,
    onMeal: m => (m.state === 'done' ? nutritionDaySheet({ date: today }) : logFood(m.slot)),
    onSeeDay: () => nutritionDaySheet({ date: today }),
    water,
    week: food ? null : { days: weekOf(S, today), label: weekDone(S, today) },
  }
}

const weekDone = (S, today) => { const { done, planned } = weekTally(S, today); return t('{0} of {1} done', done, planned) }
