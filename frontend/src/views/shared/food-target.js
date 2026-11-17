// A day's food targets as the Day and Week pages show them. One function for both pages, so a day
// reads the same on each (the Day page once added the activity adjustment and the Week cells did
// not). A calorie target needs a goal the person set for that day, or a mode that works one out
// (Dynamic's burn, Adaptive's estimate): the diary's 2000 kcal and 2000 ml stand-ins are never
// shown as a target, and a percent macro goal taken from the stand-in is no target either.
import { calorieTarget, macroTarget, resolveGoalFor } from '../../lib/nutrition/diary.js'

// "On target": within this many kcal of the day's target either way (Sh2Week: "within 150 kcal").
// Here, not in day-data.js, so lib/nutrition/trends.js can read it without pulling in the pages.
export const ON_TARGET_KCAL = 150

/** The water goal the person set, in ml, or null without one. */
export const waterGoalSet = settings => (Number(settings?.waterGoalMl) > 0 ? Number(settings.waterGoalMl) : null)

/**
 * `{ ready, kcal, macro(id), waterMl }` for the day `date`. `goalInputs` is the nutrition store's
 * (a Dynamic day's burn under its date, Adaptive's estimate under `adaptive`), `activity` the
 * store's activity record for the day (null until it lands), `tried` that the goal-input load for
 * the day has finished even if it kept nothing. `ready` holds until everything the target depends
 * on is in, so a cell never shows the fixed target and then jumps. `kcal` and a macro are null
 * without a goal behind them; `waterMl` is null without a water goal.
 */
export function dayTargetsOf({ settings, date, goalInputs = {}, activity = null, tried = false }) {
  const mode = settings?.calorieGoalMode || 'fixed'
  const effectiveActive = settings?.diaryShowActivity ? activity?.sum?.effective ?? 0 : 0
  const target = calorieTarget({ settings, date, caloriesOut: goalInputs[date] ?? null, adaptiveTdee: goalInputs.adaptive ?? null, effectiveActive })
  const set = target.fromBurn || resolveGoalFor(settings?.goals?.calories, date) != null
  const inputsIn = (mode !== 'dynamic' || date in goalInputs) && (mode !== 'adaptive' || 'adaptive' in goalInputs)
  return {
    ready: !!settings && (inputsIn || tried) && (!target.adjust || !!activity),
    kcal: set ? Math.round(target.target) : null,
    macro: id => (settings?.goals?.[id]?.isPercent && !set ? null : macroTarget(settings, id, date, target.base)),
    waterMl: waterGoalSet(settings),
  }
}
