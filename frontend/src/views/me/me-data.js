// The Me root's data (PR-05 M1.0 to M1.2), pure: the weight ring and its three states, the ring
// slides, the My goal card and the quick actions, from the store state and what the hooks already
// read. useMe (use-me.js) feeds it the store, the goal hook and the clock; MeScreen draws what
// comes out. Nothing here invents a number: a line whose source is missing is left out.
import { weighInTime } from '../../lib/bodyweight.js'
import { dateLocale, t } from '../../lib/i18n.js'
import { fmtNum } from '../../lib/format.js'
import { streakSlideOf } from '../shared/streak-slide.js'

const DAY_MS = 86400000
const MINUS = '−'
const LB_PER_KG = 2.2046226218

/** A change or a distance, one decimal whatever the weight-decimals setting says (0.3 must not read 0). */
const one = n => (Math.round(Math.abs(n) * 10) / 10).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })
const dayMs = iso => Date.parse(iso + 'T12:00:00')

/** The valid weigh-ins, oldest first. */
export const weighInsOf = S => (Array.isArray(S?.bodyweight) ? S.bodyweight : [])
  .filter(b => b?.d && Number(b.w) > 0)
  .sort((a, b) => weighInTime(a) - weighInTime(b))

/**
 * The weight ring's numbers: `{ kind, unit, latest, target, change, toGo, progress }`.
 *   kind      'none' (no weigh-in), 'untargeted' (weighed in, no target), 'toward', 'reached'
 *   latest    the newest weigh-in { d, w }, in `unit`
 *   change    the latest minus the newest weigh-in dated 7 or more days before it; null without one
 *   toGo      the distance to the target (0 once reached); null without a target
 *   progress  0 to 1 from the first weigh-in to the target; direction comes from start against target
 */
export function weightOf(S) {
  const unit = S?.unit === 'lb' ? 'lb' : 'kg'
  const list = weighInsOf(S)
  const latest = list.at(-1) || null
  const first = list[0] || null
  const target = Number(S?.targetW) > 0 ? Number(S.targetW) : null
  if (!latest) return { kind: 'none', unit, latest: null, target, change: null, toGo: null, progress: 0 }

  const cutoff = dayMs(latest.d) - 7 * DAY_MS
  const before = [...list].reverse().find(b => dayMs(b.d) <= cutoff)
  const change = before ? Math.round((Number(latest.w) - Number(before.w)) * 10) / 10 : null
  const w = Number(latest.w)
  if (target == null) return { kind: 'untargeted', unit, latest, target, change, toGo: null, progress: 0 }

  const start = Number(first.w)
  const reached = start > target ? w <= target : start < target ? w >= target : w === target
  if (reached) return { kind: 'reached', unit, latest, target, change, toGo: 0, progress: 1 }
  const progress = Math.min(1, Math.max(0, (start - w) / (start - target)))
  return { kind: 'toward', unit, latest, target, change, toGo: Math.abs(w - target), progress }
}

/** "−0.3 kg in 7 days", "+0.4 kg in 7 days", "No change in 7 days"; null when there is nothing 7 days back. */
export function changeLine(weight) {
  if (weight.change == null) return null
  if (weight.change === 0) return t('No change in 7 days')
  return t('{0} in 7 days', (weight.change < 0 ? MINUS : '+') + one(weight.change) + ' ' + weight.unit)
}

/** Slide 1, Weight. `to` is where a tap goes; `log` opens the weigh-in drawer instead. */
export function weightSlide(weight) {
  const base = { key: 'weight', name: t('Weight'), icon: 'scale', top: t('Weight'), max: 1 }
  const { kind, latest, target, unit } = weight
  if (kind === 'none') {
    return { ...base, big: '–', unit: t('No weigh-ins yet'), value: 0, pill: t('Log your first weigh-in'), log: true, hint: t('Log weight') }
  }
  const big = fmtNum(Number(latest.w))
  const change = changeLine(weight)
  if (kind === 'untargeted') {
    // An empty arc and the way to a target: the slide opens the goal page, where the target is set.
    return { ...base, big, unit: change || unit, value: 0, pill: t('Set a target weight'), icon: 'target', to: '/me/goal', hint: t('Set a target weight') }
  }
  if (kind === 'reached') {
    return { ...base, big, unit: t('Target reached'), value: 1, pill: change, to: '/me/body', hint: t('Open Body') }
  }
  return {
    ...base, big, unit: change || unit, value: weight.progress,
    pill: t('{0} to {1}', one(weight.toGo) + ' ' + unit, fmtNum(target)), to: '/me/body', hint: t('Open Body'),
  }
}

/**
 * Slide 2, days on target this week (Eat's heroOf(...).onTarget), only with food tracking on.
 * `kcal` is the saved daily target as the person reads it ("2,100 kcal"), null without one.
 */
export function daysSlide(hero, { kcal = null, to } = {}) {
  const on = hero?.onTarget
  return {
    key: 'days', name: t('Days on target'), icon: 'calendar', top: t('This week'),
    big: on ? t('{0} of {1}', on.days, on.of) : '0', unit: t('days on target'),
    value: on ? on.days : 0, max: on ? on.of : 7,
    pill: kcal ? [t('Daily targets'), kcal].join(' · ') : null, to, hint: t('Open Week'),
  }
}

/** The ring carousel's slides: Weight, then Days on target when food tracking is on, then Streak. */
export function ringsOf({ S, hero, foodOn, kcal, weekTo }) {
  return [
    weightSlide(weightOf(S)),
    ...(foodOn ? [daysSlide(hero, { kcal, to: weekTo })] : []),
    { ...streakSlideOf(S, t('Open Week')), to: weekTo },
  ]
}

/** The four quick actions under the rings: `{ key, icon, label }`; Invite only where an invite can be made. */
export function actionsOf({ canInvite }) {
  return [
    { key: 'weight', icon: 'scale', label: t('Log weight') },
    { key: 'measure', icon: 'ruler', label: t('Measure') },
    { key: 'photo', icon: 'camera', label: t('Photo') },
    ...(canInvite ? [{ key: 'invite', icon: 'envelope', label: t('Invite') }] : []),
  ]
}

const GOAL_NAME = { lose: () => t('Lose weight'), keep: () => t('Keep weight'), build: () => t('Build muscle') }

/**
 * The My goal card: `{ loading }`, or `{ title, lines, keep }`. `goal` is useGoal()'s answer,
 * `weight` weightOf's, `energy` writes kcal the way the person reads it. Without NutriTrace (or
 * with its settings unreadable) only the target-weight part is said. `keep` is true when the target
 * is reached and Keep my weight can be offered (it writes the goal, so it needs NutriTrace).
 */
export function goalCardOf({ goal, weight, energy }) {
  if (goal.status === 'loading') return { loading: true }
  const { unit, target, latest } = weight
  const targetLine = target != null ? t('{0} target', fmtNum(target) + ' ' + unit) : t('Set your target weight')
  const toGoLine = weight.toGo ? t('{0} to go', one(weight.toGo) + ' ' + unit) : null
  if (goal.status !== 'ready') {
    return { title: target != null ? targetLine : t('Set your target weight'), lines: target != null && latest && toGoLine ? [toGoLine] : [], keep: false }
  }
  const name = goal.goal ? GOAL_NAME[goal.goal]() : null
  const weekly = goal.targets?.weeklyChangeKg
  const pace = name && goal.goal !== 'keep' && Number.isFinite(weekly) && Math.abs(weekly) >= 0.05
    ? t('about {0} a week', one(unit === 'lb' ? weekly * LB_PER_KG : weekly) + ' ' + unit)
    : null
  const kcal = goal.profile?.calories
  const tail = [toGoLine, kcal ? t('{0} a day', energy(kcal)) : null].filter(Boolean).join(' · ')
  return {
    title: name ? [name, pace].filter(Boolean).join(' · ') : t('Set your goal'),
    lines: [targetLine, tail].filter(Boolean),
    keep: weight.kind === 'reached' && goal.goal !== 'keep',
  }
}
