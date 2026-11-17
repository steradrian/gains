// The Goals page's rules, ported from NutriTrace (src/routes/Goals.svelte, settings/Goals.svelte,
// lib/goal-resolver.js) and held apart from the screen so they are tested on their own.
//
// A goal is one entry of the `goals` setting: { sharedGoal, isMin, isPercent, autoAdjust,
// showInDiary, showInStats, days[7], max | min }. This page edits calories, protein, carbs and fat
// as one number for all seven days, or per weekday (the draft keeps both: value + days). A number
// set for every day replaces a split by weekday; an entry nobody touched is written back as it was.
import { WATER_UNITS, calorieTarget, waterGoalOf } from './diary.js'

export const MACROS = ['proteins', 'carbohydrates', 'fat']
export const DENSITY = { proteins: 4, carbohydrates: 4, fat: 9 }
export const MODES = ['fixed', 'adaptive', 'dynamic']
// 1.1 is the onboarding's lean gain (owner, 2026-10-15), which the hub writes for "build muscle".
export const FACTORS = [0.8, 1, 1.1, 1.2]

// Macro splits NutriTrace offers, as shares of calories (Goals.svelte MACRO_PRESETS).
export const MACRO_PRESETS = {
  balanced: { proteins: 30, carbohydrates: 40, fat: 30 },
  keto: { proteins: 25, carbohydrates: 5, fat: 70 },
  'high-protein': { proteins: 40, carbohydrates: 30, fat: 30 },
}

// Wearables whose burn Dynamic mode can read (NutriTrace: fitbitFamilyEnabled || garminEnabled).
const WEARABLE_KEYS = ['fitbitEnabled', 'googleHealthEnabled', 'healthConnectEnabled', 'garminEnabled']
export const hasWearable = settings => WEARABLE_KEYS.some(k => settings?.[k] === true)

export const isPerWeekday = g => !!g && g.sharedGoal === false
const sharedValue = g => (g ? g.max ?? g.min ?? null : null)

const positive = n => (Number.isFinite(n) && n > 0 ? n : null)

// A goal is stored once per day of the week: `days` is indexed like Date#getDay (0 = Sunday), the
// way diary.js resolveGoalFor reads it. A shared goal is the same number on all seven days.
export const DAYS = 7

/** A goal entry's value for each weekday. A weekday entry's blank day takes its fallback value. */
export function daysOf(g) {
  const shared = positive(sharedValue(g))
  if (isPerWeekday(g) && Array.isArray(g.days) && g.days.length === DAYS) return g.days.map(v => positive(Number(v)) ?? shared)
  return Array(DAYS).fill(shared)
}

const allSame = days => days.every(v => v != null && v === days[0])

/** The number a goal has when its days are all alike (null when they differ or are blank), and
 *  whether it varies by weekday: the shape a draft keeps a goal in (value, days, perWeekday). */
function dayState(days) {
  const value = allSame(days) ? days[0] : null
  return { value, days, perWeekday: value == null && days.some(v => v != null) }
}

/** The same number on every day (null clears the goal). */
export const allDaysEdit = value => dayState(Array(DAYS).fill(positive(value)))

/** One day changed, the others kept. `days` is the goal's current seven values. */
export function oneDayEdit(days, index, value) {
  return dayState(days.map((v, i) => (i === index ? positive(value) : v)))
}

/** What the page edits, read from NutriTrace's settings. */
export function draftOf(settings) {
  const goals = settings?.goals || {}
  const macro = id => ({
    value: isPerWeekday(goals[id]) ? null : sharedValue(goals[id]),
    percent: !!goals[id]?.isPercent,
    perWeekday: isPerWeekday(goals[id]),
    days: daysOf(goals[id]),
  })
  const factor = Number(settings?.calorieGoalFactor)
  return {
    mode: MODES.includes(settings?.calorieGoalMode) ? settings.calorieGoalMode : 'fixed',
    factor: FACTORS.includes(factor) ? factor : 1,
    kcal: isPerWeekday(goals.calories) ? null : sharedValue(goals.calories),
    kcalPerWeekday: isPerWeekday(goals.calories),
    kcalDays: daysOf(goals.calories),
    macros: { proteins: macro('proteins'), carbohydrates: macro('carbohydrates'), fat: macro('fat') },
    waterMl: waterGoalOf(settings),
    adjust: settings?.calorieAdjustFromActivity === true,
    // Set when a template is applied: the goals it carries replace the saved ones.
    baseGoals: null,
  }
}

/** One goal entry with a new shared value, keeping the flags it already has. Null removes it. */
export function withGoalValue(old, value, { percent = false } = {}) {
  const v = positive(value)
  if (v == null) return null
  const key = old?.isMin ? 'min' : 'max'
  const { max: _max, min: _min, ...rest } = old || {}
  return {
    isMin: false, autoAdjust: false, showInDiary: true, showInStats: true,
    ...rest, sharedGoal: true, isPercent: percent, days: Array(7).fill(v), [key]: v,
  }
}

/** One goal entry that differs by weekday: every day explicit, `max` (or `min`) their average, the
 *  fallback NutriTrace and the range charts read. */
function withGoalDays(old, days, { percent = false } = {}) {
  const set = days.map(positive).filter(v => v != null)
  const mean = Math.round((set.reduce((a, b) => a + b, 0) / set.length) * 100) / 100
  const key = old?.isMin ? 'min' : 'max'
  const { max: _max, min: _min, ...rest } = old || {}
  return {
    isMin: false, autoAdjust: false, showInDiary: true, showInStats: true,
    ...rest, sharedGoal: false, isPercent: percent, days: days.map(v => positive(v) ?? mean), [key]: mean,
  }
}

/** The `goals` setting after the draft is applied over `base`. Entries the page does not touch
 *  pass through unchanged. `only` limits it to those goal ids (the ones the person changed on
 *  this page). A goal with a number is that number on all seven days; with no number but some
 *  days filled it differs by weekday. A blank calorie target never removes the calorie goal. */
export function goalsAfter(base, draft, only = null) {
  const next = { ...(base || {}) }
  const put = (id, value, percent, days) => {
    if (only && !only.has(id)) return
    const was = next[id]
    // Alike days with no number is a cleared goal, not a split by day (unless it already was one).
    if (value == null && Array.isArray(days) && days.some(v => positive(v) != null) && (isPerWeekday(was) || !allSame(days))) {
      if (isPerWeekday(was) && !!was.isPercent === percent && same(daysOf(was), days)) return
      next[id] = withGoalDays(was, days, { percent })
      return
    }
    if (id === 'calories' && positive(value) == null) return
    // An entry the person did not change stays as NutriTrace wrote it.
    if (!isPerWeekday(next[id]) && sharedValue(next[id]) === (positive(value) ?? null) && !!next[id]?.isPercent === percent) return
    const entry = withGoalValue(next[id], value, { percent })
    if (entry) next[id] = entry
    else delete next[id]
  }
  put('calories', draft.kcal, false, draft.kcalDays)
  for (const id of MACROS) put(id, draft.macros[id].value, draft.macros[id].percent, draft.macros[id].days)
  return next
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** The goal ids the draft changed against the snapshot it was made from. A template that was
 *  applied replaces every goal, so it names all of them. */
function changedGoalIds(draft, snapshot) {
  if (draft.baseGoals) return null
  const was = draftOf(snapshot)
  const out = new Set()
  if (draft.kcal !== was.kcal || !same(draft.kcalDays ?? was.kcalDays, was.kcalDays)) out.add('calories')
  for (const id of MACROS) {
    const m = draft.macros[id]
    if (m.value !== was.macros[id].value || m.percent !== was.macros[id].percent || !same(m.days ?? was.macros[id].days, was.macros[id].days)) out.add(id)
  }
  return out
}

/** The `goals` setting as the person's changes on this page leave `settings`: what they changed
 *  against `snapshot` is applied, everything else stays as `settings` has it now. */
export function goalsFor(settings, draft, snapshot = settings) {
  return goalsAfter(draft.baseGoals || settings?.goals || {}, draft, changedGoalIds(draft, snapshot))
}

/**
 * The settings writes a draft needs, as [key, value] pairs. `snapshot` is the settings the draft
 * was made from: only what the person changed against it is written, and only when `settings`
 * (the server's current ones) do not already hold it, so a change made elsewhere meanwhile is
 * never reverted. The workout setting needs the diary's activity line on (`diary.js`
 * calorieTarget reads both), so that is written first and a retry after a failed second write
 * still has it.
 */
export function writesFor(settings, draft, snapshot = settings) {
  const out = []
  const was = draftOf(snapshot)
  const now = draftOf(settings)
  const changed = (key) => draft[key] !== was[key] && draft[key] !== now[key]
  if (changed('mode')) out.push(['calorieGoalMode', draft.mode])
  if (changed('factor')) out.push(['calorieGoalFactor', draft.factor])
  const goals = goalsFor(settings, draft, snapshot)
  if (!same(goals, settings?.goals || {})) out.push(['goals', goals])
  if (draft.waterMl > 0 && changed('waterMl')) out.push(['waterGoalMl', Math.round(draft.waterMl)])
  if (draft.adjust && settings?.diaryShowActivity !== true) out.push(['diaryShowActivity', true])
  if (changed('adjust')) out.push(['calorieAdjustFromActivity', draft.adjust])
  return out
}

/** The settings as the draft would leave them, for the preview and the macro arithmetic. */
export function settingsWith(settings, draft) {
  return {
    ...settings,
    calorieGoalMode: draft.mode,
    calorieGoalFactor: draft.factor,
    goals: goalsAfter(draft.baseGoals || settings?.goals || {}, draft),
    calorieAdjustFromActivity: draft.adjust,
  }
}

/** Grams to a share of calories, and back, against `kcal` (goal-resolver.js). Null without a base. */
export function gramsToPercent(grams, kcal, perGram) {
  const g = Number(grams)
  if (!Number.isFinite(g) || !(kcal > 0)) return null
  // The fewest decimals (0 to 2) that still convert back to the same whole grams, so switching
  // the unit on and off never drifts the target (goal-resolver.js gramsGoalToPercent).
  const exact = (g * perGram * 100) / kcal
  const wanted = Math.round(g)
  for (const places of [0, 1, 2]) {
    const f = 10 ** places
    const pct = Math.round(exact * f) / f
    if (percentToGrams(pct, kcal, perGram) === wanted) return pct
  }
  return Math.round(exact * 100) / 100
}
export function percentToGrams(percent, kcal, perGram) {
  const p = Number(percent)
  if (!Number.isFinite(p) || !(kcal > 0)) return null
  return Math.round((kcal * p) / 100 / perGram)
}

/** A macro's grams in the draft (a percentage converted against the base calories). */
export function macroGrams(macro, id, kcal) {
  if (macro.value == null) return null
  return macro.percent ? percentToGrams(macro.value, kcal, DENSITY[id]) : macro.value
}

/** Flip one macro between grams and percent, converting its number so the target stays put. */
export function toggleMacroUnit(macro, id, kcal, dayKcal = null) {
  const percent = !macro.percent
  const convert = (v, k) => {
    if (v == null) return null
    return (percent ? gramsToPercent(v, k, DENSITY[id]) : percentToGrams(v, k, DENSITY[id])) ?? v
  }
  if (!macro.days) return { ...macro, percent, value: convert(macro.value, kcal) }
  // Each day converts against its own calories, so a split by day keeps its shape.
  return { ...macro, percent, ...dayState(macro.days.map((v, i) => convert(v, dayKcal?.[i] ?? kcal))) }
}

/** A preset as grams against the calories (applyMacroPreset), set on every day: `kcal` is the
 *  base, `dayKcal` (seven numbers, when calories differ by day) the base of each day. Null when
 *  there is nothing for the preset to set. */
export function applyPreset(name, kcal, dayKcal = null) {
  const split = MACRO_PRESETS[name]
  if (!split || !(kcal > 0)) return null
  const out = {}
  for (const id of MACROS) {
    const days = Array.from({ length: DAYS }, (_, i) => percentToGrams(split[id], dayKcal?.[i] > 0 ? dayKcal[i] : kcal, DENSITY[id]))
    out[id] = { ...dayState(days), percent: false }
  }
  return out
}

/** The calories the draft's mode lands on today, from the figures the server gave. `date` is the
 *  day (a weekday-specific target resolves to its weekday). */
export function previewBase(settings, draft, { caloriesOut = null, adaptive = null, date = null } = {}) {
  const adaptiveTdee = adaptive?.ready && adaptive.tdee != null ? adaptive.tdee : null
  const s = settingsWith(settings, draft)
  const { base, fromBurn } = calorieTarget({ settings: s, date, caloriesOut, adaptiveTdee })
  return { kcal: base, fromBurn }
}

/** Notes under the macros: an odd calorie target, or macros that do not add up to it. */
export function goalNotes(kcal, grams) {
  const out = []
  if (kcal > 0 && kcal < 1200) out.push({ code: 'low', kcal })
  else if (kcal > 5000) out.push({ code: 'high', kcal })
  const sum = MACROS.reduce((n, id) => n + (grams[id] || 0) * DENSITY[id], 0)
  if (sum > 0 && kcal > 0 && Math.abs(sum - kcal) > kcal * 0.05) out.push({ code: 'mismatch', kcal, sum: Math.round(sum) })
  return out
}

/** Whether the workout-kcal setting can change the target in this mode (decision-workout-kcal.md):
 *  never in Dynamic or a ready Adaptive, opt-in in Fixed and while Adaptive is still learning.
 *  'pending': Adaptive, and the server has not yet said whether its estimate is ready
 *  (`adaptiveStatus` 'loading' or 'failed'), so which of the two applies is not known. */
export function workoutAdjustState(mode, adaptive, adaptiveStatus = adaptive ? 'ready' : 'loading') {
  if (mode === 'dynamic') return 'burn'
  if (mode === 'adaptive') {
    if (adaptiveStatus !== 'ready') return 'pending'
    if (adaptive?.ready) return 'burn'
  }
  return 'optin'
}

// Water is stored in ml; the page edits it in the person's unit (diary.js waterOf shows it).
export const waterUnitOf = settings => (WATER_UNITS[settings?.waterUnit] ? settings.waterUnit : 'ml')
export function waterToUnit(ml, unit) {
  const u = WATER_UNITS[unit]
  return u ? Number((ml / u[0]).toFixed(u[1])) : Math.round(ml)
}
export function waterFromUnit(value, unit) {
  return Math.round((Number(value) || 0) * (WATER_UNITS[unit]?.[0] || 1))
}

// Calories are stored as kcal; a person on kJ edits them in kJ (diary.js energyOf shows them).
export const energyFromUnit = (value, settings) => (value == null ? null : Math.round(settings?.energyUnit === 'kJ' ? value / 4.184 : value))

/** A saved template: the goals and water goal as they stand (goalTemplates in NutriTrace). */
export function makeTemplate(name, goals, waterMl, now = Date.now()) {
  const goalCount = Object.values(goals).filter(g => g?.min != null || g?.max != null).length + (waterMl > 0 ? 1 : 0)
  return { id: now, name, createdAt: new Date(now).toISOString(), goals: { ...goals }, waterGoalMl: waterMl, goalCount }
}

// NutriTrace keeps at most this many templates (the hub refuses a longer list).
export const MAX_TEMPLATES = 30

/** A template saved under the old schema holds `kilojoules`: it becomes `calories` in kcal and
 *  the old key goes (Goals.svelte _migrateKilojoulesGoal). */
export function migrateKilojoules(goals) {
  if (!goals?.kilojoules) return goals
  const next = { ...goals }
  const kj = next.kilojoules
  if (!next.calories) {
    const days = Array.isArray(kj.days) ? kj.days : null
    const hasDays = days && days.some(v => v != null && Number.isFinite(v) && v > 0)
    const shared = kj.max ?? kj.min
    if ((shared != null && Number.isFinite(shared) && shared > 0) || hasDays) {
      const calories = {
        ...kj,
        max: kj.max != null ? kj.max / 4.184 : undefined,
        min: kj.min != null ? kj.min / 4.184 : undefined,
        days: days ? days.map(v => (v != null ? v / 4.184 : null)) : undefined,
      }
      next.calories = Object.fromEntries(Object.entries(calories).filter(([, v]) => v !== undefined))
    }
  }
  delete next.kilojoules
  return next
}

/** The draft after applying a template: its goals replace the saved ones, as in NutriTrace. */
export function applyTemplate(draft, tpl) {
  const goals = migrateKilojoules({ ...(tpl.goals || {}) })
  const fresh = draftOf({ goals, calorieGoalMode: draft.mode, calorieGoalFactor: draft.factor })
  return {
    ...draft,
    kcal: fresh.kcal, kcalPerWeekday: fresh.kcalPerWeekday, kcalDays: fresh.kcalDays, macros: fresh.macros,
    waterMl: tpl.waterGoalMl > 0 ? tpl.waterGoalMl : draft.waterMl,
    baseGoals: goals,
  }
}
