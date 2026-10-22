// How a My goal change becomes NutriTrace settings writes. `planChange` is pure (what to write);
// `applyWrites` sends them in order and puts back what it wrote when one fails.
//
// Order: the profile keys first (gender, dob, height_cm, activity, tdee), then the calorie factor,
// then `goals`. A failure part-way leaves a profile with a new body and old targets, so a failed
// write rolls back the keys already written (best effort) and says whether that worked.
import { goalsFor, draftOf } from '../nutrition/goals.js'
import { useNutrition } from '../nutrition/store.js'
import { burnOf, targetsFor } from './goal-calc.js'
import { FACTOR_OF_GOAL, calcInputs, dobOf, profileOf } from './goal-profile.js'

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * The writes a change needs, as [key, value] pairs, plus the targets they carry.
 * `change`: { goal?, sex?, birthYear?, heightCm?, activity? } (`activity` is the movement level).
 * Targets are recomputed when the maths has everything it needs and the resulting goal is one of
 * lose, keep, build; otherwise only the profile keys (and a picked goal's factor) are written, and
 * `recomputed` is false so the caller can say the targets were left alone.
 * `skipped` lists the goal ids that differ by weekday and so were not touched.
 */
export function planChange(settings, S, change, now = Date.now()) {
  const profile = profileOf(settings, S)
  const next = {
    sex: change.sex ?? profile.sex,
    birthYear: change.birthYear ?? profile.birthYear,
    heightCm: change.heightCm ?? profile.heightCm,
    activity: change.activity ?? profile.activity,
    goal: change.goal ?? profile.goal,
  }
  const inputs = calcInputs({ ...profile, ...next })
  const writes = []
  const put = (key, value) => { if (!same(settings?.[key], value)) writes.push([key, value]) }

  if (change.sex !== undefined) {
    if (change.sex === 'unspecified') { if (settings?.gender != null) writes.push(['gender', null]) } else put('gender', change.sex)
  }
  if (change.birthYear !== undefined) put('dob', dobOf(change.birthYear))
  if (change.heightCm !== undefined) put('height_cm', change.heightCm)
  if (change.activity !== undefined) put('activity', change.activity)
  const burn = inputs ? burnOf({ ...inputs, now }) : null
  if (burn != null) put('tdee', burn)

  if (change.goal !== undefined) put('calorieGoalFactor', FACTOR_OF_GOAL[change.goal])

  const targets = inputs && next.goal ? targetsFor({ ...inputs, goal: next.goal, now }) : null
  let skipped = []
  if (targets) {
    const draft = draftOf(settings)
    const macro = (id, value) => ({ ...draft.macros[id], value, percent: false })
    draft.kcal = targets.calories
    draft.macros = {
      proteins: macro('proteins', targets.proteinG),
      carbohydrates: macro('carbohydrates', targets.carbsG),
      fat: macro('fat', targets.fatG),
    }
    skipped = [
      ...(draft.kcalPerWeekday ? ['calories'] : []),
      ...Object.keys(draft.macros).filter(id => draft.macros[id].perWeekday),
    ]
    const goals = goalsFor(settings, draft, settings)
    if (!same(goals, settings?.goals || {})) writes.push(['goals', goals])
  }
  return { writes, targets, recomputed: targets != null, skipped }
}

/**
 * Sends `list` in order. On the first failure puts back (newest first) the keys already written
 * and resolves { ok: false, error, rolledBack, stuck }: `stuck` are the keys that could not be put
 * back. On success { ok: true, order, before, after } for the journal. A key that was not set
 * before goes back as null.
 */
export async function applyWrites(list) {
  const nt = useNutrition.getState()
  const done = []
  for (const [key, value] of list) {
    const was = useNutrition.getState().settings.data?.[key]
    try {
      await nt.saveSetting(key, value)
    } catch (error) {
      const stuck = []
      for (const [k, back] of [...done].reverse()) {
        try { await nt.saveSetting(k, back ?? null) } catch { stuck.push(k) }
      }
      return { ok: false, error, rolledBack: stuck.length === 0, stuck }
    }
    done.push([key, was])
  }
  return {
    ok: true,
    order: list.map(([key]) => key),
    before: Object.fromEntries(done.map(([key, was]) => [key, was ?? null])),
    after: Object.fromEntries(list.map(([key, value]) => [key, value])),
  }
}
