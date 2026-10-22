// Progress › Trends: NutriTrace's Statistics page for the diary (src/routes/Statistics.svelte), pure.
// One metric at a time over a run of days: a nutrient or water per day, the days with nothing
// logged left out, a goal line where the person has a goal, and the average, lowest and highest.
// No React and no network here; `days` is GET /api/diary (every day with a row).
import { t } from '../i18n.js'
import { weekOrder } from '../format.js'
import { ON_TARGET_KCAL, dayTargetsOf } from '../../views/shared/food-target.js'
import { energyOf, nutritionOf, sumNutrition, totalsOf, waterGoalOf, waterOf, waterTotal } from './diary.js'
import { dayInitial, fastingStats, lengthOf } from './fasting.js'

const DAY = 86400000

/** The metrics the explorer offers, with the unit NutriTrace stores them in (src/lib/nutrition.js
 *  NUTRIMENTS, minus kilojoules, which is calories shown in the person's energy unit). The label
 *  is read at call time so it follows the language. Water is left out when Profile › Water says
 *  not to show it in statistics (`waterShowInStats`); without settings, everything is offered. */
export const nutrientOptions = settings => allNutrientOptions().filter(o => o.value !== 'water' || !settings || settings.waterShowInStats !== false)

const allNutrientOptions = () => [
  { value: 'calories', label: t('Calories'), unit: 'kcal' },
  { value: 'proteins', label: t('Protein'), unit: 'g' },
  { value: 'carbohydrates', label: t('Carbs'), unit: 'g' },
  { value: 'fat', label: t('Fat'), unit: 'g' },
  { value: 'water', label: t('Water'), unit: 'ml' },
  { value: 'fiber', label: t('Fiber'), unit: 'g' },
  { value: 'sugars', label: t('Sugars'), unit: 'g' },
  { value: 'added-sugars', label: t('Added sugars'), unit: 'g' },
  { value: 'saturated-fat', label: t('Saturated fat'), unit: 'g' },
  { value: 'trans-fat', label: t('Trans fat'), unit: 'g' },
  { value: 'polyunsaturated-fat', label: t('Polyunsaturated fat'), unit: 'g' },
  { value: 'monounsaturated-fat', label: t('Monounsaturated fat'), unit: 'g' },
  { value: 'cholesterol', label: t('Cholesterol'), unit: 'mg' },
  { value: 'sodium', label: t('Sodium'), unit: 'mg' },
  { value: 'salt', label: t('Salt'), unit: 'g' },
  { value: 'potassium', label: t('Potassium'), unit: 'mg' },
  { value: 'calcium', label: t('Calcium'), unit: 'mg' },
  { value: 'iron', label: t('Iron'), unit: 'mg' },
  { value: 'magnesium', label: t('Magnesium'), unit: 'mg' },
  { value: 'zinc', label: t('Zinc'), unit: 'mg' },
  { value: 'phosphorus', label: t('Phosphorus'), unit: 'mg' },
  { value: 'vitamin-a', label: t('Vitamin A'), unit: 'mcg' },
  { value: 'vitamin-c', label: t('Vitamin C'), unit: 'mg' },
  { value: 'vitamin-d', label: t('Vitamin D'), unit: 'mcg' },
  { value: 'vitamin-e', label: t('Vitamin E'), unit: 'mg' },
  { value: 'vitamin-k', label: t('Vitamin K'), unit: 'mcg' },
  { value: 'b1', label: t('Vitamin B1'), unit: 'mg' },
  { value: 'b2', label: t('Vitamin B2'), unit: 'mg' },
  { value: 'b3', label: t('Vitamin B3'), unit: 'mg' },
  { value: 'b6', label: t('Vitamin B6'), unit: 'mg' },
  { value: 'b9', label: t('Folate (B9)'), unit: 'mcg' },
  { value: 'b12', label: t('Vitamin B12'), unit: 'mcg' },
  { value: 'caffeine', label: t('Caffeine'), unit: 'mg' },
  { value: 'alcohol', label: t('Alcohol'), unit: 'g' },
]

/** The four the page opens with, as tiles. */
export const HEADLINE_METRICS = ['calories', 'proteins', 'carbohydrates', 'fat']

export const DEFAULT_METRIC = 'calories'

/** A metric from the address, or the default when it is absent or not one of ours. */
export const metricFrom = (value, settings) => (nutrientOptions(settings).some(o => o.value === value) ? value : DEFAULT_METRIC)

const round1 = n => Math.round(n * 10) / 10
const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
const mean = list => list.reduce((a, b) => a + b, 0) / list.length

/** The calendar days from `from` to `to`, both 'YYYY-MM-DD', oldest first. */
export function daysBetween(from, to) {
  const out = []
  const d = new Date(from + 'T12:00:00')
  const end = new Date(to + 'T12:00:00')
  while (d <= end) {
    out.push(dayKey(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** The first and last day of a range of `range` days ending today (0 = from the first logged
 *  day), as Progress's range control picks it. Today is left out, as Statistics does by default:
 *  a day still being logged reads as a dip. `null` when there is nothing to show. */
export function windowOf(range, days, today) {
  const end = dayKey(new Date(new Date(today + 'T12:00:00').getTime() - DAY))
  if (range > 0) return { from: dayKey(new Date(new Date(end + 'T12:00:00').getTime() - (range - 1) * DAY)), to: end }
  // A day of water alone counts: the explorer charts water too.
  const first = days.filter(d => d.date < today && ((d.items?.length || 0) > 0 || (d.water?.length || 0) > 0)).map(d => d.date).sort()[0]
  return first ? { from: first, to: end } : null
}

/** One day's value of a metric in the stored unit (kcal, ml, g, mg, mcg), or null when the day
 *  has nothing to count: no food for a nutrient, no drink for water. A day with food but none of
 *  this nutrient counts as 0. */
export function valueOf(entry, metric) {
  if (!entry) return null
  if (metric === 'water') {
    const total = waterTotal(entry)
    return total > 0 ? total : null
  }
  const items = entry.items || []
  if (!items.length) return null
  return sumNutrition(items.map(nutritionOf))[metric] || 0
}

/** The unit a metric is shown in, for the person's energy and water settings. */
export function unitOf(metric, settings) {
  if (metric === 'calories') return energyOf(0, settings).unit
  if (metric === 'water') return waterOf(0, settings).unit
  return nutrientOptions().find(o => o.value === metric)?.unit || ''
}

/** A stored value as shown: kcal as kcal or kJ, ml in the water unit. */
export function shown(metric, value, settings) {
  if (value == null) return null
  if (metric === 'calories') return energyOf(value, settings).value
  if (metric === 'water') return waterOf(value, settings).value
  return round1(value)
}

/** The per-day series of a metric over [from, to], in display units: [{ date, value|null }]. */
export function seriesOf(days, metric, window, settings) {
  if (!window) return []
  const byDate = new Map(days.map(d => [d.date, d]))
  return daysBetween(window.from, window.to).map(date => ({ date, value: shown(metric, valueOf(byDate.get(date), metric), settings) }))
}

/** Average, lowest and highest of the days that have a value; null with none. */
export function summaryOf(series) {
  const vals = series.filter(p => p.value != null).map(p => p.value)
  if (!vals.length) return null
  return { avg: round1(mean(vals)), min: round1(Math.min(...vals)), max: round1(Math.max(...vals)), count: vals.length }
}

/** LineChart points for the days that have a value. */
export const pointsOf = series => series
  .filter(p => p.value != null)
  .map(p => ({ t: new Date(p.date + 'T12:00:00').getTime(), y: p.value, d: p.date }))

// One target for a whole range, as Statistics draws it (goal-resolver.js resolveRangeGoal): a shared
// goal is its value, a weekday split the average of its positive days. Zero is no goal.
function rangeGoal(g) {
  if (!g) return null
  const positive = v => (Number(v) > 0 ? Number(v) : null)
  if (g.sharedGoal === false && Array.isArray(g.days) && g.days.length === 7) {
    const days = g.days.map(positive).filter(v => v != null)
    if (days.length) return mean(days)
  }
  return positive(g.max) ?? positive(g.min)
}

const PERCENT_DENSITY = { fat: 9, 'saturated-fat': 9, carbohydrates: 4, sugars: 4, proteins: 4 }

/** The person's goal line for a metric, in display units: `{ value, base }`, or null without one.
 *  `base` is true for the calorie line under a Dynamic or Adaptive target: that target moves every
 *  day with the wearable or the weight trend and is not kept, so the line is the fixed goal under
 *  it, which NutriTrace labels "Base Goal". A percentage macro goal is grams against the fixed
 *  calorie goal (2000 without one), in every mode. */
export function goalOf(settings, metric) {
  if (!settings) return null
  if (metric === 'water') return settings.waterGoalMl > 0 ? { value: shown('water', waterGoalOf(settings), settings), base: false } : null
  const goal = rangeGoal(settings.goals?.[metric])
  if (goal == null) return null
  if (metric === 'calories') return { value: shown('calories', goal, settings), base: (settings.calorieGoalMode || 'fixed') !== 'fixed' }
  const density = PERCENT_DENSITY[metric]
  if (settings.goals[metric].isPercent && density) {
    return { value: Math.round(((rangeGoal(settings.goals.calories) ?? 2000) * goal) / 100 / density), base: false }
  }
  return { value: round1(goal), base: false }
}

/* ------------------------------------------------------------------ Eat: Food trends and Month */
// Eat › Food trends (/food/trends) and Month (/food/month, boards Ea3Trends, Ea3Few, Ea1Month) read
// the same diary days, but a day is judged against ITS OWN goal (food-target.js dayTargetsOf, the
// Day page's own, so a day reads the same on every page). Today is shown but, still being logged,
// is never averaged or counted. A day with no goal behind it has no band and no target line.

export const FOOD_RANGES = [7, 30, 90]
/** Logged days a range needs before its averages mean anything. */
export const MIN_TREND_DAYS = 3

/** The range from the address (`?range=`): 7 when it is absent or not one of ours. */
export const foodRangeFrom = value => (FOOD_RANGES.includes(Number(value)) ? Number(value) : 7)

const shiftDay = (iso, n) => dayKey(new Date(new Date(iso + 'T12:00:00').getTime() + n * DAY))
const hasFood = entry => (entry?.items?.length || 0) > 0
const wholeMean = list => (list.length ? Math.round(mean(list)) : null)
const monthDay = (month, n) => `${month}-${String(n).padStart(2, '0')}`

/** The last `range` days, today the last of them. */
export const foodWindowOf = (range, today) => ({ from: shiftDay(today, 1 - range), to: today })

/** The days of [from, to] with food in them, oldest first: the ones whose targets are worth loading. */
export function loggedDatesOf(days, from, to) {
  return days.filter(d => d.date >= from && d.date <= to && hasFood(d)).map(d => d.date).sort()
}

/**
 * One day as the pages judge it: `{ date, logged, kcal, target, band, protein, proteinTarget,
 * carbs, carbsTarget, fat, fatTarget }`, or null until the day's target is ready (settings and, for
 * Dynamic or Adaptive, their inputs: a page never shows the fixed target and then jumps). `target`
 * and `band` ('on' within ON_TARGET_KCAL, 'over', 'under') are null without a goal for that day.
 * `entry` is the diary day (absent or empty: nothing logged).
 */
export function dayFiguresOf({ settings, entry, date, goalInputs = {}, activity = null, tried = false }) {
  if (!settings) return null
  const targets = dayTargetsOf({ settings, date, goalInputs, activity, tried })
  if (!targets.ready) return null
  const totals = totalsOf(entry?.items)
  const kcal = Math.round(totals.calories)
  const diff = targets.kcal == null ? null : kcal - targets.kcal
  return {
    date, logged: hasFood(entry), kcal, target: targets.kcal,
    band: diff == null ? null : Math.abs(diff) <= ON_TARGET_KCAL ? 'on' : diff > 0 ? 'over' : 'under',
    protein: Math.round(totals.proteins), proteinTarget: targets.macro('proteins'),
    carbs: Math.round(totals.carbohydrates), carbsTarget: targets.macro('carbohydrates'),
    fat: Math.round(totals.fat), fatTarget: targets.macro('fat'),
  }
}

// The Calories chart's bars: a bar a day for a week, else the daily average of each run of seven
// days counted back from today (a bar a day would not fit 30 or 90). `target` is the bar's goal
// (the mean of its days' goals), null where none of its days has one; `open` marks today's bar.
function barsOf(dates, figures, range, today) {
  const bar = (idx, one) => {
    const done = idx.map(i => figures[i]).filter(f => f && f.logged && f.date !== today)
    const goals = idx.map(i => figures[i]?.target).filter(g => g != null)
    const value = one ? (figures[idx[0]]?.kcal ?? 0) : (wholeMean(done.map(f => f.kcal)) ?? 0)
    return { key: dates[idx[0]], from: dates[idx[0]], to: dates[idx.at(-1)], value, target: wholeMean(goals), open: idx.some(i => dates[i] === today), one }
  }
  if (range === 7) return dates.map((_, i) => bar([i], true))
  const runs = []
  for (let end = dates.length; end > 0; end -= 7) runs.unshift(Array.from({ length: end - Math.max(0, end - 7) }, (_, k) => Math.max(0, end - 7) + k))
  return runs.map(idx => bar(idx, false))
}

/**
 * The Food trends page's numbers for the last `range` days (`days` is GET /api/diary; the rest is
 * what dayFiguresOf takes, keyed by date). `loggedCount` counts the days with food, today left out,
 * and `enough` says there are MIN_TREND_DAYS of them: below that the page shows Ea3Few instead.
 * `ready` is false while a logged day's target is still loading. Everything else is null when no
 * day backs it: `avg` (kcal a day), `onTarget` ({ days, of }, over the days that had a goal),
 * `protein` and `macros` (average against the mean of the goals, `target` null when no day had
 * one), `bars` with `targetLine` (one kcal goal for all of them) or per-bar targets, and `rows`,
 * the logged days newest first.
 */
export function foodTrendsOf({ days, settings, goalInputs = {}, activity = {}, tried = {}, range, today }) {
  const { from, to } = foodWindowOf(range, today)
  const byDate = new Map(days.map(d => [d.date, d]))
  const dates = daysBetween(from, to)
  const figures = dates.map(date => dayFiguresOf({ settings, entry: byDate.get(date), date, goalInputs, activity: activity[date] || null, tried: !!tried[date] }))
  const loggedDates = dates.filter(d => d !== today && hasFood(byDate.get(d)))
  const logged = figures.filter(f => f && f.logged && f.date !== today)
  const judged = logged.filter(f => f.band)
  const macro = (key, targetKey) => {
    if (!logged.length) return null
    const goals = logged.map(f => f[targetKey]).filter(g => g != null)
    return { avg: wholeMean(logged.map(f => f[key])), target: wholeMean(goals) }
  }
  const bars = barsOf(dates, figures, range, today)
  const goals = bars.map(b => b.target).filter(g => g != null)
  return {
    range, from, to,
    loggedCount: loggedDates.length,
    enough: loggedDates.length >= MIN_TREND_DAYS,
    ready: logged.length === loggedDates.length,
    avg: logged.length ? wholeMean(logged.map(f => f.kcal)) : null,
    onTarget: judged.length ? { days: judged.filter(f => f.band === 'on').length, of: judged.length } : null,
    protein: macro('protein', 'proteinTarget'),
    macros: [
      { id: 'proteins', ...macro('protein', 'proteinTarget') },
      { id: 'carbohydrates', ...macro('carbs', 'carbsTarget') },
      { id: 'fat', ...macro('fat', 'fatTarget') },
    ].filter(m => m.avg != null),
    bars,
    targetLine: goals.length === bars.length && goals.every(g => g === goals[0]) ? goals[0] ?? null : null,
    hasTargets: goals.length > 0,
    rows: logged.slice().reverse(),
  }
}

/** The fasting block of Food trends: `{ avgHours, streak, longestHours, longestDay }` over the fasts
 *  that ended since `since` (ms), or null when there are none (the page then leaves the block out).
 *  `streak` is the run of days on goal up to now; `longestDay` is the day the longest fast ended. */
export function fastingBlockOf({ history, since, now }) {
  const inRange = history.filter(f => f.end_at && Date.parse(f.end_at) >= since)
  if (!inRange.length) return null
  const stats = fastingStats(inRange, null, now)
  const longest = inRange.reduce((a, b) => (lengthOf(b) > lengthOf(a) ? b : a))
  return {
    avgHours: stats.avgHours, streak: stats.currentStreak, longestHours: stats.longestHours,
    longestDay: dayKey(new Date(Date.parse(longest.end_at))),
  }
}

/** Hours as the clock the boards print them: 15.67 is "15:40". */
export function hoursClock(hours) {
  const minutes = Math.round(hours * 60)
  return Math.floor(minutes / 60) + ':' + String(minutes % 60).padStart(2, '0')
}

/** The first letters of the week, in the order it starts: ["M", "T", ...] for a Monday start. */
export const weekdayLetters = (weekStart, locale) => weekOrder(weekStart).map(d => dayInitial(shiftDay('2026-10-04', d), locale))

// A day's ring in the Month grid: 1 on target, past 1 over, short of 1 under; none for a day with
// nothing logged or no goal to hold it to. Today, still open, never reads as over.
function ringOf(f, isToday) {
  if (!f?.logged || !(f.target > 0)) return null
  const share = f.kcal / f.target
  if (isToday) return Math.min(share, 1)
  return f.band === 'on' ? 1 : f.band === 'over' ? Math.max(share, 1.1) : share
}

/**
 * The Month grid's data for `month` ('2026-10'): `offset` blank cells before day 1 (`weekStart`
 * 0 or 1), a cell per day, `{ day, iso, open, ring, figures }`, and `tiles`: `onTarget`
 * ({ days, of }), `avg` (kcal a day) and `over` ({ days, dates }, newest first), each null when no
 * day backs it. `openOf(iso)` says what a day does ('day', 'today', 'future', 'before';
 * lib/day-route.js dayTargetOf). Only days before today count, so "so far" is up to yesterday.
 * `ready` is false while a logged day's target is still loading.
 */
export function monthOf({ month, days, settings, goalInputs = {}, activity = {}, tried = {}, weekStart, openOf }) {
  const [year, number] = month.split('-').map(Number)
  const byDate = new Map(days.map(d => [d.date, d]))
  const first = new Date(year, number - 1, 1)
  const cells = Array.from({ length: new Date(year, number, 0).getDate() }, (_, i) => {
    const iso = monthDay(month, i + 1)
    const open = openOf(iso)
    const entry = byDate.get(iso)
    const figures = open === 'future' ? null : dayFiguresOf({ settings, entry, date: iso, goalInputs, activity: activity[iso] || null, tried: !!tried[iso] })
    return { day: i + 1, iso, open, figures, ring: ringOf(figures, open === 'today'), pending: open !== 'future' && hasFood(entry) && !figures }
  })
  const logged = cells.filter(c => c.open !== 'today' && c.open !== 'future' && c.figures?.logged).map(c => c.figures)
  const judged = logged.filter(f => f.band)
  const over = judged.filter(f => f.band === 'over').map(f => f.date).reverse()
  return {
    month,
    offset: (first.getDay() - weekStart + 7) % 7,
    cells,
    ready: !cells.some(c => c.pending),
    tiles: {
      onTarget: judged.length ? { days: judged.filter(f => f.band === 'on').length, of: judged.length } : null,
      avg: logged.length ? wholeMean(logged.map(f => f.kcal)) : null,
      over: judged.length ? { days: over.length, dates: over } : null,
    },
  }
}
