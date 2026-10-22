// What My goal knows about a person, read from NutriTrace's settings and the store. Pure, no UI.
//
// The profile lives in NutriTrace's settings (gender, dob, height_cm, activity, calorieGoal*,
// goals, waterGoalMl, weight_kg). Weigh-ins (`S.bodyweight[].w`) and the target weight
// (`S.targetW`) are in the display unit `S.unit`; the maths is in kg.
import { weighInTime } from '../bodyweight.js'
import { convertBodyWeight } from '../units.js'
import { draftOf, macroGrams } from '../nutrition/goals.js'
import { waterGoalOf } from '../nutrition/diary.js'

export const GOALS = ['lose', 'keep', 'build']
export const MOVEMENT_LEVELS = ['sedentary', 'light', 'moderate', 'active']
// The factor each goal writes. The hub's own write of a capped loss can be milder (0.85), which
// the browser may not write back (the hub allows 0.8, 1, 1.1, 1.2 only), so Me writes these.
export const FACTOR_OF_GOAL = { lose: 0.8, keep: 1, build: 1.1 }

/** 'lose' | 'keep' | 'build' | null. A loss the onboarding capped (0.8 up to 1, exclusive) is still a loss. */
export function goalOfFactor(factor) {
  const f = Number(factor)
  if (!Number.isFinite(f)) return null
  if (f === 1) return 'keep'
  if (f === 1.1) return 'build'
  if (f >= 0.8 && f < 1) return 'lose'
  return null
}

/** The movement level to show: an onboarded very_active reads as active, until the person picks. */
export const movementOf = activity => (activity === 'very_active' ? 'active' : MOVEMENT_LEVELS.includes(activity) ? activity : null)

/** 'male' | 'female' | 'unspecified' (NutriTrace holds no value for "prefer not to say"). */
export const sexOf = gender => (gender === 'male' || gender === 'female' ? gender : 'unspecified')

/** The birth year in a `dob` ('YYYY-MM-DD'), or null. */
export function birthYearOf(dob) {
  const year = parseInt(String(dob ?? '').slice(0, 4), 10)
  return Number.isFinite(year) && year > 1850 ? year : null
}

/** The `dob` setting a birth year stands for (the hub's convention: the middle of the year). */
export const dobOf = year => `${year}-07-01`

const toKg = (w, unit) => (unit === 'lb' ? convertBodyWeight(w, 'lb', 'kg') : w)

const weighIns = S => (Array.isArray(S?.bodyweight) ? S.bodyweight : []).filter(b => b?.d && Number(b.w) > 0)

/**
 * The profile. `settings` may be null (no NutriTrace); `S` is the store state.
 *   current  the latest weigh-in, else the weight given at onboarding (`fromOnboarding`, no date)
 *   start    the earliest weigh-in { w (display unit), weightKg, d }, null with none
 *   target   `S.targetW` in the display unit; `targetKg` the same in kg
 *   macros   grams a day, a percentage target converted against the calories; null when unset or per weekday
 */
export function profileOf(settings, S) {
  const unit = S?.unit === 'lb' ? 'lb' : 'kg'
  const draft = draftOf(settings)
  const calories = draft.kcal
  const grams = id => {
    const g = macroGrams(draft.macros[id], id, calories)
    return Number.isFinite(g) && g > 0 ? g : null
  }
  const sorted = [...weighIns(S)].sort((a, b) => weighInTime(a) - weighInTime(b))
  const last = sorted[sorted.length - 1]
  const first = sorted[0]
  const onboarded = Number(settings?.weight_kg) > 0 ? Number(settings.weight_kg) : null
  const current = last
    ? { weightKg: toKg(Number(last.w), unit), date: last.d, fromOnboarding: false }
    : onboarded ? { weightKg: onboarded, date: null, fromOnboarding: true } : null
  const target = Number(S?.targetW) > 0 ? Number(S.targetW) : null
  const height = Number(settings?.height_cm)
  const factor = Number(settings?.calorieGoalFactor)
  return {
    unit,
    sex: sexOf(settings?.gender),
    birthYear: birthYearOf(settings?.dob),
    heightCm: height > 0 ? height : null,
    activity: settings?.activity ?? null,
    movement: movementOf(settings?.activity),
    goal: goalOfFactor(factor),
    factor: Number.isFinite(factor) ? factor : null,
    mode: draft.mode,
    current,
    start: first ? { w: Number(first.w), weightKg: toKg(Number(first.w), unit), d: first.d } : null,
    target,
    targetKg: target == null ? null : toKg(target, unit),
    calories: calories > 0 ? calories : null,
    macros: { proteinG: grams('proteins'), carbsG: grams('carbohydrates'), fatG: grams('fat') },
    water: settings ? waterGoalOf(settings) : null,
  }
}

/** The inputs of the goal maths from a profile, or null while a body detail is missing. */
export function calcInputs(profile, over = {}) {
  const p = { ...profile, ...over }
  const weightKg = over.weightKg ?? profile.current?.weightKg
  if (!p.birthYear || !(p.heightCm > 0) || !(weightKg > 0)) return null
  return { goal: p.goal ?? 'keep', sex: p.sex, birthYear: p.birthYear, heightCm: p.heightCm, weightKg, activity: p.activity }
}
