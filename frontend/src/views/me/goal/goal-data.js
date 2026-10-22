// What My goal shows, worked out from useGoal() (boards Me3Goal, Me3GoalSheet, Me3Target, Me3BodySheet,
// Me3Movement). No UI: the screen draws it. Weights are in the person's unit; the maths is in kg.
import { dateLocale, t, tn } from '../../../lib/i18n.js'
import { fmtDate } from '../../../lib/format.js'
import { convertBodyWeight } from '../../../lib/units.js'
import { weeksTo } from '../../../lib/me/goal-calc.js'

const round1 = n => Math.round(n * 10) / 10
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const digits = n => n.toLocaleString(dateLocale(), { maximumFractionDigits: 1 })

/** 78 -> "78.0", always one decimal, as the page's rows read. */
export const weightText = n => round1(n).toLocaleString(dateLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const shortWeight = n => digits(round1(n))

/** kg in the person's unit, to a tenth. */
export const inUnit = (kg, unit) => round1(unit === 'lb' ? convertBodyWeight(kg, 'kg', 'lb') : kg)
const toKg = (w, unit) => (unit === 'lb' ? convertBodyWeight(w, 'lb', 'kg') : w)

/** What a typed weight reads as: a tenth, '' and nonsense are 0. */
export const parseWeight = text => round1(Number(String(text).trim().replace(',', '.')) || 0)

export const GOAL_IDS = ['lose', 'keep', 'build']
export const goalLabel = goal => (goal === 'lose' ? t('Lose weight') : goal === 'keep' ? t('Keep my weight') : goal === 'build' ? t('Build muscle') : null)

/** "Eat about 20% under your burn": the percentage is the factor the targets really use. */
export function goalSub(goal, factor) {
  if (goal === 'keep') return t('Eat about what you burn')
  const f = Number(factor)
  if (goal === 'lose') return t('Eat about {0}% under your burn', Math.round((1 - (f > 0 && f < 1 ? f : 0.8)) * 100))
  if (goal === 'build') return t('Eat about {0}% over your burn', Math.round(((f > 1 ? f : 1.1) - 1) * 100))
  return null
}

export const MOVEMENT_IDS = ['sedentary', 'light', 'moderate', 'active']
export const movementOptions = () => [
  { id: 'sedentary', title: t('Mostly sitting'), sub: t('Desk work, little walking') },
  { id: 'light', title: t('On my feet some of the day'), sub: t('Walks, errands, some standing') },
  { id: 'moderate', title: t('On my feet most of the day'), sub: t('Shop floor, teaching, nursing') },
  { id: 'active', title: t('Physical work'), sub: t('Building, warehouse, farm') },
]
export const movementLabel = id => movementOptions().find(o => o.id === id)?.title ?? null

export const SEX_IDS = ['male', 'female', 'unspecified']
export const sexLabel = sex => (sex === 'male' ? t('Male') : sex === 'female' ? t('Female') : t('Prefer not to say'))

/** The hub's bounds (gains-hub/src/onboarding/answers.ts) for the Body details drawer. */
export const HEIGHT_CM = { min: 100, max: 250 }
export const BIRTH_YEAR = { min: 1900 }
export const birthYearMax = (now = Date.now()) => new Date(now).getUTCFullYear() - 13

const CM_PER_INCH = 2.54
/** 182 cm -> { ft: 5, inch: 11 } (rounded to the inch). */
export function feetOf(cm) {
  const total = Math.round(cm / CM_PER_INCH)
  return { ft: Math.floor(total / 12), inch: total % 12 }
}
export const cmOfFeet = (ft, inch) => Math.round(((Number(ft) || 0) * 12 + (Number(inch) || 0)) * CM_PER_INCH)
export function heightText(cm, unit) {
  if (!(cm > 0)) return null
  if (unit === 'lb') {
    const { ft, inch } = feetOf(cm)
    return t('{0} ft {1} in', ft, inch)
  }
  return digits(cm) + ' ' + t('cm')
}

/**
 * The ring: from the first weigh-in to the target. `value` of 1 when there; `reached` when today's
 * weight is on or past the target, in the direction the person set out (start to target, else the goal).
 */
export function progressOf({ current, start, target, goal }) {
  if (current == null || target == null) return { value: 0, reached: false }
  const dir = start != null && start !== target ? Math.sign(target - start) : goal === 'lose' ? -1 : goal === 'build' ? 1 : 0
  const reached = dir < 0 ? current <= target : dir > 0 ? current >= target : current === target
  if (reached) return { value: 1, reached: true }
  if (start == null || dir === 0) return { value: 0, reached: false }
  return { value: clamp((dir * (current - start)) / Math.abs(target - start), 0, 1), reached: false }
}

const modeSub = mode => (mode === 'adaptive' ? t('Adaptive') : mode === 'dynamic' ? t('Dynamic') : t('Fixed, the same every day'))

/**
 * The page. `g` is useGoal()'s result; `fmt` is { energy(kcal), water(ml) } (the person's units).
 *   ring      { value, max, top, big, unit }
 *   summary   "Lose weight · 78 kg · 2,100 kcal a day", the parts there are
 *   started   "Started at 85.0 kg on Sun 2 Aug" or null
 *   reached   the ring is closed; `canKeep` adds the Keep my weight button (not when the goal is Keep already)
 *   goal, target, height, birthYear, sex, movement, calories, protein, carbs, fat, water   rows { title, value, sub }
 */
export function goalViewOf(g, fmt) {
  const { profile: p, targets } = g
  const unit = p.unit
  const current = p.current ? inUnit(p.current.weightKg, unit) : null
  const target = p.target
  const start = g.startWeight ? g.startWeight.w : null
  const { value, reached } = progressOf({ current, start, target, goal: p.goal })
  const gap = current != null && target != null ? round1(Math.abs(target - current)) : null
  const toGo = gap != null ? t('{0} to go', weightText(gap) + ' ' + unit) : null

  let line = null
  if (target == null) line = t('Set a target weight')
  else if (current == null) line = t('Log your first weigh-in')
  else line = reached ? t('Target reached') : toGo

  const calories = p.calories
  const summary = [
    goalLabel(p.goal),
    target != null ? shortWeight(target) + ' ' + unit : null,
    calories != null ? t('{0} a day', fmt.energy(calories)) : null,
  ].filter(Boolean).join(' · ')

  const grams = v => (v != null ? t('{0} g', digits(v)) : null)
  const add = t('Add')
  return {
    unit,
    ring: { value, max: 1, top: t('Target weight'), big: target != null ? weightText(target) : '–', unit: target != null ? unit + (line ? ' · ' + line : '') : line },
    summary,
    started: g.startWeight ? t('Started at {0} on {1}', weightText(g.startWeight.w) + ' ' + unit, fmtDate(g.startWeight.d, true)) : null,
    reached,
    canKeep: reached && p.goal !== 'keep',
    goal: { title: t('Goal'), value: goalLabel(p.goal) ?? add, sub: goalSub(p.goal, targets?.factor ?? p.factor) },
    target: {
      title: t('Target weight'),
      value: target != null ? weightText(target) + ' ' + unit : add,
      sub: !reached && gap != null ? t('{0} to go from {1}', weightText(gap) + ' ' + unit, weightText(current) + ' ' + unit) : null,
    },
    height: { title: t('Height'), value: heightText(p.heightCm, unit) ?? add },
    birthYear: { title: t('Birth year'), value: p.birthYear ? String(p.birthYear) : add },
    sex: { title: t('Sex'), value: sexLabel(p.sex), sub: t('Only for your burn estimate') },
    movement: { title: t('Daily movement'), value: movementLabel(p.movement) ?? add },
    calories: { title: t('Calories'), value: calories != null ? fmt.energy(calories) : t('Not set'), sub: calories != null ? modeSub(p.mode) : null },
    protein: { title: t('Protein'), value: grams(p.macros.proteinG) ?? t('Not set') },
    carbs: { title: t('Carbs'), value: grams(p.macros.carbsG) ?? t('Not set') },
    fat: { title: t('Fat'), value: grams(p.macros.fatG) ?? t('Not set') },
    water: { title: t('Water'), value: p.water != null ? fmt.water(p.water) : t('Not set') },
  }
}

/**
 * The line under the Target weight field while typing: "3.4 kg to go from 81.4 kg. About 9 weeks at
 * 0.4 kg a week." The weeks are left out when they cannot be worked out (no body details, or the
 * goal moves the other way). Null when there is no number or no weigh-in to measure from.
 */
export function targetPreview({ text, profile, targets }) {
  const typed = parseWeight(text)
  if (!(typed > 0) || !profile.current) return null
  const unit = profile.unit
  const current = inUnit(profile.current.weightKg, unit)
  const gap = round1(Math.abs(typed - current))
  if (gap === 0) return t('That is your weight now ({0}).', weightText(current) + ' ' + unit)
  const head = t('{0} to go from {1}', weightText(gap) + ' ' + unit, weightText(current) + ' ' + unit) + '.'
  const weekly = targets?.weeklyChangeKg
  const weeks = weeksTo(profile.current.weightKg, toKg(typed, unit), weekly)
  if (weeks == null || weeks < 1) return head
  const rate = inUnit(Math.abs(weekly), unit)
  if (!(rate > 0)) return head
  return head + ' ' + t('About {0} at {1} a week.', tn('{0} week', '{0} weeks', weeks), weightText(rate) + ' ' + unit)
}
