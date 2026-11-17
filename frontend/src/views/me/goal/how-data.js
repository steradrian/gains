// What "How this is worked out" (board Me3How) says, from the person's own data: every number comes
// from lib/me/goal-calc.js (through useGoal's `targets`) or from what is stored. A sentence whose
// data is missing is left out rather than guessed. No UI.
import { dateLocale, t } from '../../../lib/i18n.js'
import { workoutAdjustState } from '../../../lib/nutrition/goals.js'
import { goalLabel, inUnit, weightText } from './goal-data.js'

// A stored calorie target this close to the goal's own is the goal's (rounding, a capped factor).
const SAME_TARGET = 0.02

const digits = n => n.toLocaleString(dateLocale(), { maximumFractionDigits: 1 })
const percentOf = factor => Math.round(Math.abs(1 - factor) * 100)

/** "Lose weight takes 20% off: 2,100 kcal a day, about 0.4 kg a week." Null without a goal. */
export function goalSentence({ goal, targets, unit, energy }) {
  const name = goalLabel(goal)
  if (!name || !targets) return null
  const pct = percentOf(targets.factor)
  const kcal = energy(targets.calories)
  const weekly = inUnit(Math.abs(targets.weeklyChangeKg), unit)
  const rate = weekly > 0 ? weightText(weekly) + ' ' + unit : null
  if (goal === 'lose' && pct > 0) {
    return rate ? t('{0} takes {1}% off: {2} a day, about {3} a week.', name, pct, kcal, rate) : t('{0} takes {1}% off: {2} a day.', name, pct, kcal)
  }
  if (goal === 'build' && pct > 0) {
    return rate ? t('{0} adds {1}%: {2} a day, about {3} a week.', name, pct, kcal, rate) : t('{0} adds {1}%: {2} a day.', name, pct, kcal)
  }
  return t('{0} eats about what you burn: {1} a day.', name, kcal)
}

/** "Protein is set to about 1.9 g per kg of your target weight." Null without the grams or the target weight. */
export function proteinSentence({ proteinG, targetKg }) {
  if (!(proteinG > 0) || !(targetKg > 0)) return null
  return t('Protein is set to about {0} g per kg of your target weight.', digits(Math.round((proteinG / targetKg) * 10) / 10))
}

/** The workouts sentence by the real mode (owner question 18). Null while Adaptive has not said if it is ready. */
export function workoutsSentence({ mode, adjust, adaptive, adaptiveStatus }) {
  const state = workoutAdjustState(mode, adaptive, adaptiveStatus)
  if (state === 'pending') return null
  if (state === 'burn') return t('Your target follows your burn, workouts included.')
  if (adjust) return t('Workouts and activities add their calories to the target. Turn this off in More options.')
  return t('Workouts and activities are never added to the target. Burned is shown on its own.')
}

/**
 * Adaptive's block, only in Adaptive mode and only when the estimate answered:
 * `{ ready, title, value, burn?, confidence?, early?, firmsUp? }`. "Early" and "firms up at 35 days" need a
 * 35-day figure in the data (`daysFull`); without one they are left out.
 */
export function adaptiveBlock({ mode, adaptive, energy }) {
  if (mode !== 'adaptive' || !adaptive) return null
  const days = adaptive.daysAvailable ?? 0
  if (!adaptive.ready) {
    return { ready: false, title: t('Adaptive is learning'), value: t('{0} of {1} so far', days, adaptive.daysRequired ?? 21) }
  }
  const full = Number.isFinite(adaptive.daysFull) ? adaptive.daysFull : null
  const early = full != null && days < full
  const c = adaptive.confidence
  return {
    ready: true,
    title: t('Adaptive is ready'),
    value: adaptive.tdee != null ? t('Estimated burn {0} a day', energy(adaptive.tdee)) : null,
    confidence: c != null ? `${Math.round(c * (c <= 1 ? 100 : 1))}%` : null,
    early,
    firmsUp: early ? t('Firms up at {0} days', full) : null,
  }
}

/**
 * The drawer's content. `figures` is null when the profile cannot produce a burn (no body details or
 * weigh-in): the drawer then offers Body details.
 *   profile  useGoal().profile      targets  useGoal().targets
 *   settings NutriTrace's settings  fmt      { energy(kcal) }
 *   adaptive the adaptive-tdee answer or null
 */
export function howViewOf({ profile, targets, settings, adaptive, adaptiveStatus, fmt }) {
  const mode = profile.mode
  const adaptiveView = adaptiveBlock({ mode, adaptive, energy: fmt.energy })
  const workouts = workoutsSentence({ mode, adjust: settings?.calorieAdjustFromActivity === true, adaptive, adaptiveStatus })
  if (!targets) return { figures: null, paragraphs: [], adaptive: adaptiveView }

  const stored = profile.calories
  const own = stored != null && Math.abs(stored - targets.calories) > targets.calories * SAME_TARGET
  const factor = digits(targets.factor)
  const paragraphs = [
    t('Your burn comes from your height, age, sex and daily movement: about {0} a day before workouts.', fmt.energy(targets.burn)),
    goalSentence({ goal: profile.goal, targets, unit: profile.unit, energy: fmt.energy }),
    own ? t('Your Daily targets are set to {0} a day.', fmt.energy(stored)) : null,
    proteinSentence({ proteinG: profile.macros.proteinG, targetKg: profile.targetKg }),
    workouts,
  ].filter(Boolean)
  return {
    figures: [
      { id: 'burn', label: t('Your burn'), value: fmt.energy(targets.burn) },
      { id: 'factor', label: t('Goal factor'), value: factor, sub: goalLabel(profile.goal) },
      { id: 'target', label: t('Target'), value: stored != null ? fmt.energy(stored) : t('Not set') },
    ],
    paragraphs,
    adaptive: adaptiveView,
  }
}
