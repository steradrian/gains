import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { addWater } from '../../components/WaterCard.jsx'
import { foodPickerSheet } from '../../components/FoodPickerSheet.jsx'
import { scanToSelection } from '../../components/scan-to-selection.js'
import { useRootHeader } from '../../components/use-root-header.js'
import { fmtDur, weekStartOf } from '../../lib/format.js'
import { t, tn } from '../../lib/i18n.js'
import { navToDay } from '../../lib/day-route.js'
import { nutritionAvailable } from '../../lib/nutrition/api.js'
import { resolveGoalFor } from '../../lib/nutrition/diary.js'
import { diaryIndexDays, useDiaryIndex } from '../../lib/nutrition/diary-index.js'
import { PLANS, progressOf } from '../../lib/nutrition/fasting.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { useDiaryTarget } from '../../lib/nutrition/selection.js'
import { useFasting, useNow } from '../../lib/nutrition/use-fasting.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import { waterButtons } from '../../lib/nutrition/water.js'
import { useTodayDate } from '../today/use-today.js'
import { foodDaysOf } from '../shared/week-data.js'
import { dayTargetsOf } from '../shared/food-target.js'
import { dailyTargetsSheet } from './DailyTargetsSheet.jsx'
import { heroOf, heroSlides, railStarts, railWeekOf } from './eat-data.js'
import { useAgain } from './use-again.js'

// Where the rows of "Your food" go. Daily targets stays on Nutrition › Goals until Me's My goal
// page exists (/me/goal is not in the app yet): that page holds the goal mode, templates and the
// Adaptive estimate, which the Daily targets drawer does not.
const PATHS = {
  foods: '/food/my-foods?tab=foods',
  meals: '/food/my-foods?tab=meals',
  recipes: '/food/my-foods?tab=recipes',
  trends: '/food/trends',
  fasting: '/food/fasting',
  burned: '/food/burned',
  month: '/food/month',
  goals: '/food/goals',
  settings: '/me/diary',
}

/** The diary days (and what their targets need) of `loadDays`, loaded once each, as week-data.js
 *  dayFoodOf reads them. */
function useFoodDays(on, loadDays) {
  const settingsState = useNutrition(s => s.settings)
  const days = useNutrition(s => s.days)
  const goalInputs = useNutrition(s => s.goalInputs)
  const activity = useNutrition(s => s.activity)
  const settings = settingsState.data
  const mode = settings?.calorieGoalMode
  const policy = settings?.manualActivityPolicy
  const adjust = !!settings?.diaryShowActivity
  // The goal-input loads that have finished, as "date|mode": a failed one is not kept in the
  // store, so the page needs its own word that the attempt is over (as useWeek keeps).
  const [tried, setTried] = useState({})
  const key = loadDays.join()

  useEffect(() => {
    if (!on) return
    const n = useNutrition.getState()
    n.loadSettings()
    for (const d of loadDays) n.loadDay(d)
  }, [on, key])
  useEffect(() => {
    if (!on || settingsState.status !== 'ready') return undefined
    let live = true
    const n = useNutrition.getState()
    for (const d of loadDays) {
      n.loadGoalInputs(d, mode).then(() => { if (live) setTried(was => ({ ...was, [`${d}|${mode}`]: true })) })
      if (adjust && !n.activity[d]) n.loadActivity(d, policy)
    }
    return () => { live = false }
  }, [on, key, settingsState.status, mode, adjust, policy])

  const entries = {}, triedDays = {}
  for (const d of loadDays) {
    if (days[d]?.status === 'ready') entries[d] = days[d].entry || null
    triedDays[d] = !!tried[`${d}|${mode}`]
  }
  return { on, settings, entries, goalInputs, activity, tried: triedDays, status: settingsState.status }
}

/**
 * The Eat root (PR-04 E1.0 to E1.4) as EatScreen draws it:
 *   header, status   the pinned header; 'loading' | 'off' (food tracking not set up) | 'unavailable'
 *                    (no nutrition behind this build or sign-in) | 'ready'
 *   rail             { weeks, week, home, onWeek, onDay, onMonth }: the calendar rail, one ring per day
 *   hero             { slides, onOpen }: the week ring carousel (a tap opens Trends)
 *   actions, again   the action row, and "Yesterday's lunch" (null when it cannot be logged again)
 *   library          the "Your food" rows
 *   setup            { onSetup } opens the Daily targets drawer
 * Food tracking is "off" when nutrition is reachable but there is no calorie goal (a fixed one, or
 * a mode that works one out) and nothing has ever been logged: the app has no separate switch.
 */
export function useEat() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const header = useRootHeader('food')
  const today = useTodayDate()
  const units = useUnits()
  const on = nutritionAvailable(user)
  const ws = weekStartOf(S)
  const indexStatus = useDiaryIndex(s => s.status)
  useDiaryIndex(s => s.version)
  const logged = diaryIndexDays()
  const first = logged.length ? logged.at(-1).date : null

  const starts = useMemo(() => railStarts({ today, ws, first }), [today, ws, first])
  const home = starts.length - 1
  // The rail's page is kept as weeks back from this one, not an index: the first week moves when
  // older days arrive by sync, and the same offset is still the same week.
  const [back, setBack] = useState(0)
  const shown = Math.max(home - back, 0)
  const loadDays = useMemo(
    () => [...new Set([...foodDaysOf(starts[home], today), ...foodDaysOf(starts[shown], today), ...(shown > 0 ? foodDaysOf(starts[shown - 1], today) : [])])],
    [starts, home, shown, today],
  )
  const food = useFoodDays(on, loadDays)
  const { settings } = food
  const { meal } = useDiaryTarget(settings)

  const foods = useNutrition(s => s.foods)
  const meals = useNutrition(s => s.meals)
  const recipes = useNutrition(s => s.recipes)
  const activity = useNutrition(s => s.activity)
  const fasting = useFasting()
  const fastingOn = settings?.fastingEnabled === true
  const now = useNow(!!fasting.active, 30_000)
  useEffect(() => {
    if (!on) return
    const n = useNutrition.getState()
    n.loadFoods()
    n.loadMeals({ recipes: false })
    n.loadMeals({ recipes: true })
  }, [on])
  useEffect(() => { if (on && fastingOn) useFasting.getState().load() }, [on, fastingOn])

  const again = useAgain({ settings, meal, on })

  const mode = settings?.calorieGoalMode || 'fixed'
  const goalSet = !!settings && (mode !== 'fixed' || resolveGoalFor(settings.goals?.calories, today) != null)
  const indexKnown = indexStatus === 'ready' || indexStatus === 'error'
  let status = 'ready'
  if (!on) status = 'unavailable'
  else if (!settings) status = food.status === 'error' ? 'ready' : 'loading'
  else if (!goalSet && !logged.length) status = indexKnown ? 'off' : 'loading'

  const thisStart = starts[home]
  const hero = heroOf({ start: thisStart, today, food })
  const slides = heroSlides(hero, units)
  const rail = {
    weeks: starts.map(start => railWeekOf({ start, today, ws, food })),
    week: shown,
    home,
    onWeek: i => setBack(home - i),
    onDay: d => navToDay(d.iso, 'food'),
    onMonth: () => nav(PATHS.month),
  }

  const glass = waterButtons(settings)[0]
  const water = () => { if (glass) addWater(today, glass.ml) }
  const actions = [
    { icon: 'utensils', label: t('Log food'), onClick: () => foodPickerSheet({ date: today }) },
    { icon: 'scanBarcode', label: t('Scan'), onClick: scanToSelection },
    { icon: 'bookOpen', label: t('Saved meals'), onClick: () => nav(PATHS.meals) },
    { icon: 'droplet', label: '+' + units.water(glass.ml), onClick: water },
  ]

  const targets = settings ? dayTargetsOf({ settings, date: today, goalInputs: food.goalInputs, activity: activity[today] || null, tried: true }) : null
  const protein = targets?.macro('proteins')
  const targetsSub = targets?.kcal != null
    ? [units.energy(targets.kcal), protein != null && t('{0} g protein', Math.round(protein))].filter(Boolean).join(' · ')
    : null
  // A week with a day that failed to read has no honest total: the row says so instead of quoting a part.
  const burnedDays = foodDaysOf(thisStart, today)
  const burnedFailed = !!settings?.diaryShowActivity && burnedDays.some(d => activity[d]?.status === 'error')
  const burned = settings?.diaryShowActivity && !burnedFailed
    ? burnedDays.reduce((sum, d) => sum + (activity[d]?.sum?.effective ?? 0), 0)
    : 0
  const plan = PLANS.find(p => p.hours === Number(settings?.fastingDefaultHours))
  const favourites = foods.list.filter(f => f.favorite).length
  const countSub = (state, one, many, line) => (state.status === 'ready' && state.list.length ? line(tn(one, many, state.list.length)) : null)
  const library = [
    {
      key: 'foods', icon: 'apple', title: t('Foods'), onClick: () => nav(PATHS.foods),
      sub: foods.status === 'ready' && foods.list.length
        ? [tn('{0} food', '{0} foods', foods.list.length), favourites > 0 && tn('{0} favourite', '{0} favourites', favourites)].filter(Boolean).join(' · ')
        : null,
    },
    { key: 'meals', icon: 'bookOpen', title: t('Saved meals'), onClick: () => nav(PATHS.meals), sub: countSub(meals, '{0} meal', '{0} meals', n => t('{0}, logged in one tap', n)) },
    { key: 'recipes', icon: 'cookingPot', title: t('Recipes'), onClick: () => nav(PATHS.recipes), sub: countSub(recipes, '{0} recipe', '{0} recipes', n => t('{0}, per serving', n)) },
    {
      key: 'trends', icon: 'chartLine', title: t('Trends'), onClick: () => nav(PATHS.trends),
      sub: hero.onTarget ? t('{0} of {1} days on target', hero.onTarget.days, hero.onTarget.of) : null,
    },
    {
      key: 'fasting', icon: 'timer', title: t('Fasting'), onClick: () => nav(PATHS.fasting),
      sub: !settings ? null : !fastingOn ? t('Off') : fasting.active ? t('Fasting for {0}', fmtDur(progressOf(fasting.active, now).elapsedMs)) : plan ? plan.label : t('Start a fast'),
    },
    ...(settings?.diaryShowActivity ? [{
      key: 'burned', icon: 'flame', title: t('Burned'), onClick: () => nav(PATHS.burned),
      sub: burnedFailed ? t('Could not load this week') : burned > 0 ? t('{0} this week', units.energy(burned)) : null,
    }] : []),
    { key: 'goals', icon: 'target', title: t('Daily targets'), onClick: () => nav(PATHS.goals), sub: targetsSub },
    { key: 'settings', icon: 'slider', title: t('Food settings'), onClick: () => nav(PATHS.settings), sub: t('Meals, water, units, sources') },
  ]

  return {
    header, status, rail, hero: { slides, onOpen: () => nav(PATHS.trends) }, actions,
    again: again && {
      title: t('Yesterday’s {0}', again.label),
      sub: `${again.items.join(', ')} · ${units.energy(again.kcal)}`,
      done: again.done, disabled: again.busy || !again.ready, onLog: again.log,
      logLabel: t('Log yesterday’s {0} again', again.label),
    },
    library,
    setup: { onSetup: dailyTargetsSheet },
  }
}
