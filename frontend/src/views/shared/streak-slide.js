// The Streak ring slide, shared by the Train root (views/train/use-train.js ringsOf) and the Me
// root (views/me/me-data.js): weeks in a row with a workout, against the best run there has been.
// `hint` is what a screen reader hears after the numbers, where the tap goes. Pure; no UI.
import { streakWeeks } from '../../lib/history.js'
import { t, tn } from '../../lib/i18n.js'
import { bestStreakWeeks } from '../../lib/train-stats.js'

/** @returns {{ key: 'streak', name: string, icon: string, top: string, big: string, hint: string, unit: string, value: number, max: number, pill: string | null }} */
export function streakSlideOf(S, hint = t('Open Plan')) {
  const streak = streakWeeks(S), best = Math.max(bestStreakWeeks(S), streak)
  return {
    key: 'streak', name: t('Streak'), icon: 'flame', top: t('On plan'), big: String(streak), hint,
    unit: tn('week in a row', 'weeks in a row', streak), value: streak, max: Math.max(best, 1),
    pill: best > 0 ? t('Best: {0}', tn('{0} week', '{0} weeks', best)) : null,
  }
}
