import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { dayTargetOf, firstLogDay, navToDay, navToWeek, weekStartOfId } from '../../lib/day-route.js'
import { weekStartOf } from '../../lib/format.js'
import { nutritionAvailable } from '../../lib/nutrition/api.js'
import { diaryIndexDays, useDiaryIndex } from '../../lib/nutrition/diary-index.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { useTodayDate } from '../today/use-today.js'
import { foodDaysOf, weekOf } from './week-data.js'

/**
 * The Week page (PR07 D2) for the week `isoWeek` (`2026-W42`), opened under `tab`: weekOf's data
 * (week-data.js), or null for a name that is no week, plus what its taps do:
 *
 *   openDay(iso)       a day cell: its Day page; today opens Today, a day to come the Plan day drawer
 *   openWeek(isoWeek)  ‹ ›, or a week of Last 4 weeks: that week, in place (the address is replaced)
 *
 * Each cell also carries `open`, what tapping it does (dayTargetOf: 'day', 'today', 'future' or
 * 'before', which opens nothing), and `foodOn` says whether nutrition is on at all.
 *
 * With nutrition on it loads the week's diary days up to today (each once; a cached day is not read
 * again), the settings, what a Dynamic or Adaptive target needs and, when activity adjusts the
 * target, each day's activity: the Day page's inputs (food-target.js), so a cell's target is the
 * Day page's. A cell's food waits until its target is ready, then fills in.
 */
export function useWeek(isoWeek, tab) {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const today = useTodayDate()
  const on = nutritionAvailable(user)
  const settingsState = useNutrition(s => s.settings)
  const days = useNutrition(s => s.days)
  const goalInputs = useNutrition(s => s.goalInputs)
  const activity = useNutrition(s => s.activity)
  useDiaryIndex(s => s.version)
  const start = weekStartOfId(isoWeek, weekStartOf(S))
  const settings = settingsState.data
  const mode = settings?.calorieGoalMode
  const policy = settings?.manualActivityPolicy
  const adjust = !!settings?.diaryShowActivity && !!settings?.calorieAdjustFromActivity
  // The goal-input loads that have finished, as "date|mode": a failed one is not kept in the store,
  // so the page needs its own word that the attempt is over (as useDiaryDay keeps).
  const [tried, setTried] = useState({})

  const loadDays = useMemo(() => (start ? foodDaysOf(start, today) : []), [start, today])
  useEffect(() => {
    if (!on || !loadDays.length) return
    const n = useNutrition.getState()
    n.loadSettings()
    for (const d of loadDays) n.loadDay(d)
  }, [on, loadDays])
  useEffect(() => {
    if (!on || settingsState.status !== 'ready') return undefined
    let live = true
    const n = useNutrition.getState()
    for (const d of loadDays) {
      n.loadGoalInputs(d, mode).then(() => { if (live) setTried(was => ({ ...was, [`${d}|${mode}`]: true })) })
      if (adjust && !n.activity[d]) n.loadActivity(d, policy)
    }
    return () => { live = false }
  }, [on, loadDays, settingsState.status, mode, adjust, policy])

  const entries = {}, triedDays = {}
  for (const d of loadDays) {
    if (days[d]?.status === 'ready') entries[d] = days[d].entry || null
    triedDays[d] = !!tried[`${d}|${mode}`]
  }
  const first = firstLogDay(S, diaryIndexDays())
  const data = weekOf({ S, isoWeek, today, first, food: { on, settings, entries, goalInputs, activity, tried: triedDays } })
  if (!data) return null
  return {
    ...data,
    foodOn: on,
    cells: data.cells.map(c => ({ ...c, open: dayTargetOf(c.iso, { today, first }) })),
    openDay: iso => navToDay(iso, tab),
    openWeek: id => navToWeek(id, tab, { replace: true }),
  }
}
