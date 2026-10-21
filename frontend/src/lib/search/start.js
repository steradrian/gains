// What the search shows before anything is typed (boards Sh0Search, Sh0SearchFirst,
// Sh0SearchTrain, Sh0SearchEat, Sh0Cleared): the field's placeholder, four Go to chips per tab,
// Recent, and up to three suggestions worked out from real data. On a first use (nothing ever
// searched) Suggested comes first, under one line on what search finds. And the way back from a
// Recent entry to the row it names, which also tells a deleted target from one still there.
import { t, tn } from '../i18n-core.js'
import { fmtDate, isoOf, startOfWeek, todayISO } from '../format.js'
import { effectiveRoutines, workoutDay } from '../history.js'
import { dayMark, nameOf, trainingDay } from '../training-day.js'
import { EXIDX } from '../exercises.js'
import { defaultMeal } from '../nutrition/diary.js'
import { PAGE_INDEX } from './pages.js'
import { dayResults, exerciseRow, foodRow, kindLabel, mealRow, pageResults, routineRow, stageSub, workoutRow } from './results.js'
import { settingsResults } from './settings-source.js'
import { placeholderFor, searchTab } from './scopes.js'

const chip = (id, label, glyph, target) => ({ id, label, glyph, target })
const route = path => ({ kind: 'route', path })

const HISTORY = chip('history', 'History', 'history', route('/train/history'))
const EXERCISES = chip('exercises', 'Exercises', 'dumbbell', route('/train/exercises'))
const FOODS = chip('foods', 'Foods', 'apple', route('/food/foods'))
const BODY = chip('body', 'Body', 'scale', route('/progress/body'))
const ROUTINES = chip('routines', 'Routines', 'clipboard', route('/train/routines'))
const PLAN = chip('plan', 'Plan', 'calendarCheck', route('/train/schedule'))
const STRENGTH = chip('strength', 'Strength', 'chartLine', route('/progress/strength'))
const WORKOUT_SETTINGS = chip('workout-settings', 'Workout settings', 'gear', route('/me/workout'))
const SAVED_MEALS = chip('meals', 'Saved meals', 'utensils', route('/food/meals'))
const RECIPES = chip('recipes', 'Recipes', 'cookingPot', route('/food/recipes'))
const TRENDS = chip('trends', 'Trends', 'chart', route('/progress/trends'))
// Days has no page of its own: the chip scopes the search to your diary's days, newest first.
const DAYS = chip('days', 'Days', 'calendar', { kind: 'scope', group: 'days' })

/**
 * The Go to chips, fixed per tab: { id, label (an English key), glyph, target } where target is
 * { kind: 'route', path } or { kind: 'scope', group }. With nutrition off a food chip gives its
 * place to a training one, and Eat's chips are Train's.
 */
export function shortcutsFor(tab, nutrition) {
  const scope = searchTab(tab)
  const training = [ROUTINES, PLAN, STRENGTH, WORKOUT_SETTINGS]
  if (scope === 'train') return training
  if (scope === 'food') return nutrition ? [SAVED_MEALS, RECIPES, TRENDS, DAYS] : training
  return [HISTORY, EXERCISES, nutrition ? FOODS : ROUTINES, BODY]
}

/**
 * The row a reference names now, or null when it is gone: { type, id } from Recent. `data` is the
 * overlay's (use-search-data.js).
 */
export function resolveRef(type, id, data) {
  const { S } = data
  switch (type) {
    case 'page': {
      const p = PAGE_INDEX.find(x => x.path === id)
      return p ? pageResults([], data.pagesCtx, { all: true, withOff: true }).find(r => r.id === id) || null : null
    }
    case 'setting': return settingsResults([], S, data.settingsCtx, undefined, { all: true }).find(r => r.id === id) || null
    case 'exercise': {
      const ex = (S.customEx || []).find(e => e?.id === id) || EXIDX[id]
      return ex ? exerciseRow(ex, S, []) : null
    }
    case 'routine': { const r = (S.routines || []).find(x => x.id === id); return r ? routineRow(r, S, [], data.today) : null }
    case 'workout': { const w = (S.workouts || []).find(x => x.id === id); return w ? workoutRow(w) : null }
    case 'food': { const f = (data.foods || []).find(x => String(x.id) === String(id)); return f ? foodRow(f) : null }
    case 'meal':
    case 'recipe': {
      const m = [...(data.meals || []), ...(data.recipes || [])].find(x => String(x.id) === String(id))
      return m ? mealRow(m) : null
    }
    case 'day': {
      const d = (data.days || []).find(x => x.date === id)
      return d ? dayResults([], [d], data.mealNames || [], { from: d.date, to: d.date, rest: [] })[0] || null : null
    }
    default: return null
  }
}

// Whether the list a result's source reads has loaded: a Recent entry is only dropped as deleted
// once its source has answered.
export const sourceReady = (type, data) => (type === 'food' ? data.foodsReady : ['meal', 'recipe'].includes(type) ? data.mealsReady : type === 'day' ? data.daysReady : true)

const daysAgo = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - n); return isoOf(d) }
const daysBetween = (from, to) => Math.round((Date.parse(to + 'T12:00:00') - Date.parse(from + 'T12:00:00')) / 864e5)
const exerciseOf = (S, id) => (S.customEx || []).find(e => e?.id === id) || EXIDX[id] || null

// A suggestion: the row, why it is here (`reason`) and its line on the stage (`sub`): the reason
// after the row's kind, or the reason alone where it already says what the row is.
const suggest = (row, reason, { withKind = true } = {}) => row && { ...row, reason, sub: withKind ? [kindLabel(row.type), reason].filter(Boolean).join(' · ') : reason }

// Today's planned session, not yet done: "Push A · Routine · planned today".
function plannedToday(S, today) {
  const day = trainingDay(S, today, today)
  const r = day.kind === 'planned' ? day.routines.find(x => (x.ex || []).length) : null
  return r ? suggest(routineRow(r, S, [], today), t('planned today')) : null
}

// The food logged most often this week, twice or more, with the meal it is most often in:
// "Chicken rice bowl · Lunch, 4 times this week".
function frequentFood(data, today) {
  if (!data.nutrition) return null
  const since = isoOf(startOfWeek(today, data.weekStart))
  const counts = new Map()
  for (const d of data.days || []) {
    if (d.date < since || d.date > today) continue
    for (const i of d.items) {
      if (i.food_id == null) continue
      const c = counts.get(String(i.food_id)) || { n: 0, meals: new Map() }
      c.n++
      c.meals.set(i.meal, (c.meals.get(i.meal) || 0) + 1)
      counts.set(String(i.food_id), c)
    }
  }
  const top = [...counts].filter(([, c]) => c.n >= 2).sort((a, b) => b[1].n - a[1].n)[0]
  const food = top && (data.foods || []).find(f => String(f.id) === top[0])
  if (!food) return null
  const [slot] = [...top[1].meals].sort((a, b) => b[1] - a[1])[0]
  const meal = (data.mealNames || [])[slot]
  const reason = meal ? tn('{1}, {0} time this week', '{1}, {0} times this week', top[1].n, meal) : tn('{0} time this week', '{0} times this week', top[1].n)
  return suggest(foodRow(food), reason, { withKind: false })
}

// The last weigh-in and how long ago it was, once it is a day old or more: "Weigh-in · Last one 7
// days ago". It opens the weigh-in drawer for today.
function weighIn(S, today) {
  const last = (S.bodyweight || []).reduce((m, b) => (b?.d && b.d <= today && (!m || b.d > m) ? b.d : m), null)
  if (!last || last === today) return null
  const n = daysBetween(last, today)
  const reason = tn('Last one {0} day ago', 'Last one {0} days ago', n)
  return { type: 'weighin', id: today, key: 'weighin:' + today, title: t('Weigh-in'), ranges: [], subtitle: '', media: { kind: 'glyph', glyph: 'scale' }, date: today, frecency: 0, reason, sub: reason }
}

// The latest new best in the last two weeks: "Bench press · Exercise · new best on Mon 12 Oct".
function newBest(S, today) {
  const since = daysAgo(today, 14)
  const w = [...(S.workouts || [])].filter(x => String(workoutDay(x) || x.d) >= since && (x.prs || []).length)
    .sort((a, b) => String(workoutDay(b) || b.d).localeCompare(String(workoutDay(a) || a.d)))[0]
  const ex = w && exerciseOf(S, w.prs[0])
  return ex ? suggest(exerciseRow(ex, S, []), t('new best on {0}', fmtDate(workoutDay(w) || w.d, true))) : null
}

// The latest planned day of the last six that went untrained and unexcused, since training began:
// "Legs · Missed Fri 16 Oct · move it". It opens the plan, where a day is moved.
function missedDay(S, today) {
  const first = (S.workouts || []).reduce((m, w) => { const d = workoutDay(w) || w.d; return d && (!m || d < m) ? d : m }, null)
  if (!first) return null
  for (let i = 1; i <= 6; i++) {
    const iso = daysAgo(today, i)
    if (iso < first) break
    const mark = dayMark(S, iso)
    if (mark !== 'plan' && mark !== 'ovr') continue
    const routines = effectiveRoutines(S, iso)
    if (!routines.length) continue
    const reason = t('Missed {0} · move it', fmtDate(iso, true))
    return { type: 'missed', id: iso, key: 'missed:' + iso, title: nameOf(routines), ranges: [], subtitle: '', media: { kind: 'date', iso }, date: iso, path: '/train/schedule', frecency: 0, reason, sub: reason }
  }
  return null
}

// On Eat, the food usually logged at the meal it is now: "Greek yogurt 2% · Your food · 170 g".
function usualNow(data, today, now) {
  if (!data.nutrition) return null
  const slot = defaultMeal(data.ntSettings, now)
  const since = daysAgo(today, 30)
  const counts = new Map()
  for (const d of data.days || []) {
    if (d.date < since) continue
    for (const i of d.items) if (i.meal === slot && i.food_id != null) counts.set(String(i.food_id), (counts.get(String(i.food_id)) || 0) + 1)
  }
  const usual = [...counts].sort((a, b) => b[1] - a[1])[0]
  const food = usual && (data.foods || []).find(f => String(f.id) === usual[0])
  if (!food) return null
  const row = foodRow(food)
  return { ...row, reason: t('Usual at {0}', (data.mealNames || [])[slot] || ''), sub: stageSub(row) }
}

// On Eat, the saved meal used most: "Usual breakfast · Saved meal · 485 kcal".
function topMeal(data) {
  if (!data.nutrition) return null
  const meal = [...(data.meals || [])].sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))[0]
  if (!meal?.usage_count) return null
  const row = mealRow(meal)
  return { ...row, reason: t('Your top saved meal'), sub: stageSub(row) }
}

/**
 * Up to three rows for right now, from real data only: a row whose data is absent is left out,
 * never filled in. Each has `reason` and its stage line `sub`. Types beyond the results': 'weighin'
 * (opens today's weigh-in) and 'missed' (`path`, the plan).
 *   Today, Me  today's planned session, the food you log most this week, the weigh-in
 *   Train      today's planned session, a new best, a missed day to move
 *   Eat        the food you log most this week, the one usual at this meal, your top saved meal
 */
export function suggestionsFor(tab, data, now = new Date()) {
  const { S } = data
  const today = data.today || todayISO()
  const scope = searchTab(tab)
  const rows = scope === 'train' ? [plannedToday(S, today), newBest(S, today), missedDay(S, today)]
    : scope === 'food' ? [frequentFood(data, today), usualNow(data, today, now), topMeal(data)]
      : [plannedToday(S, today), frequentFood(data, today), weighIn(S, today)]
  const out = []
  for (const r of rows) if (r && !out.some(x => x.key === r.key)) out.push(r)
  return out.slice(0, 3)
}

const recentKey = r => (r.kind === 'query' ? 'q:' + r.query.toLowerCase() : r.type + ':' + r.id)

/**
 * Everything the search shows before typing, worked out once:
 *   placeholder  the field's ("Search training")
 *   firstUse     nothing ever searched (no Recent ever, no search run): Suggested first, under
 *                the intro line, then Go to
 *   shortcuts    the Go to chips (shortcutsFor)
 *   recents      [{ r, key, row?, title?, sub, pending?, gone }]: a query (`row` absent, `sub`
 *                "Search"), a result with the row it names, or one whose list has not loaded yet
 *                (`pending`: its stored label as `title`, its kind as `sub`), kept in its place
 *                until the list has loaded; `gone` (its target deleted, once its list has loaded)
 *                drops out
 *   suggested    suggestionsFor, less any already in Recent: one row per thing
 * `list` and `searched` are the Recent store's (recents.js).
 */
export function beforeTypingOf({ tab, data, list, searched, now }) {
  const entries = list.map(r => {
    const key = recentKey(r)
    if (r.kind === 'query') return { r, key, sub: t('Search') }
    const row = resolveRef(r.type, r.id, data)
    if (row) return { r, key, row, sub: stageSub(row) }
    if (sourceReady(r.type, data)) return { r, key, gone: true }
    return { r, key, pending: true, title: r.label || r.query || kindLabel(r.type) || '', sub: kindLabel(r.type) || '', gone: false }
  })
  const recents = entries.filter(e => !e.gone && (e.r.kind === 'query' || e.row || e.pending))
  const suggested = suggestionsFor(tab, data, now).filter(s => !recents.some(e => e.row?.key === s.key || e.key === s.key))
  return {
    placeholder: placeholderFor(tab),
    firstUse: !searched && !list.length,
    shortcuts: shortcutsFor(tab, data.nutrition),
    entries,
    recents,
    suggested,
  }
}
