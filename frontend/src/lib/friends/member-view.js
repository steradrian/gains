import { dateLocale, t } from '../i18n.js'
import { MONDAY, fmtMonth, todayISO, weekKey } from '../format.js'
import { plusDays } from '../missed-day.js'

// What the Member page says and draws, worked out from the GET /groups/{id}/members/{uid} payload
// (contract in gains-pr09-friends-shared.md). Nothing here invents a value: a field the payload
// does not carry gives nothing back, and the callers leave the line out.

/** The Monday key of the week `iso` is in. The server's weeks run Monday to Sunday whatever the profile's first weekday is. */
export const serverWeekKey = (iso = todayISO()) => weekKey(iso, MONDAY)

const dayText = (iso, options) => new Date(iso + 'T12:00:00').toLocaleDateString(dateLocale(), options)

/**
 * The seven day cells of the week that starts on `monday` (StageWeekCells' days). `flags[i]` is
 * whether day i counts (a workout done, a target reached); a day that does not count is the quiet
 * rest dot, never a missed mark, because nothing here says what was planned on which day.
 * `describe(day, on)` is the caller's translated sentence for a cell.
 */
export function weekCells(monday, flags, describe, today = todayISO()) {
  return Array.from({ length: 7 }, (_, i) => {
    const iso = plusDays(monday, i)
    const on = flags?.[i] === true
    return {
      key: iso,
      dow: dayText(iso, { weekday: 'narrow' }),
      date: Number(iso.slice(8, 10)),
      training: on ? 'done' : 'rest',
      today: iso === today,
      label: describe(dayText(iso, { weekday: 'long', day: 'numeric', month: 'long' }), on),
    }
  })
}

/** The ISO week number of the week whose Monday is `monday`: the W34..W41 under the Consistency bars. */
export function isoWeekNumber(monday) {
  const thursday = new Date(monday + 'T12:00:00')
  thursday.setDate(thursday.getDate() + 3)
  const jan4 = new Date(thursday.getFullYear(), 0, 4, 12)
  return 1 + Math.round(((thursday - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}

/**
 * The Consistency chart of `consistency` ([{ week, share }], share 0..1 or null for a week off).
 * A week off, or one with nothing planned, is an empty bar: never a red one and never a zero that
 * reads as failure. `barLabels` are the spoken lines, one per bar.
 */
export function consistencyBars(consistency) {
  const weeks = Array.isArray(consistency) ? consistency : []
  return {
    values: weeks.map(w => (Number.isFinite(w?.share) ? Math.min(Math.max(w.share, 0), 1) : 0)),
    labels: weeks.map(w => t('W{0}', isoWeekNumber(w.week))),
    barLabels: weeks.map(w => {
      const label = t('W{0}', isoWeekNumber(w.week))
      return Number.isFinite(w?.share) ? t('{0}: {1}% of planned workouts done', label, Math.round(w.share * 100)) : t('{0}: week off', label)
    }),
    highlight: weeks.length - 1,
  }
}

const joinList = names => {
  try { return new Intl.ListFormat(dateLocale(), { style: 'long', type: 'unit' }).format(names) } catch { return names.join(', ') }
}

/** What this person does not share, in words: the switches they turned off, then the three that are never shared. */
export function notShared(shares) {
  const off = []
  if (!shares?.training) off.push(t('training'))
  if (!shares?.consistency) off.push(t('consistency'))
  if (!shares?.targets) off.push(t('food targets'))
  if (!shares?.bests) off.push(t('new bests'))
  return [...off, t('weight'), t('foods'), t('photos')]
}

/** The footer of the page: "Mara doesn't share: weight, foods, photos. You can't ask to see them." */
export const footerLine = (name, shares) => t("{0} doesn't share: {1}. You can't ask to see them.", name, joinList(notShared(shares)))

/** True when at least one of the four switches is on. With none the page says the person has shared nothing. */
export const sharesAnything = shares => !!shares && ['training', 'consistency', 'targets', 'bests'].some(k => shares[k] === true)

/** "In Iron Sunday since August"; the date is left out when the payload has none. */
export function sinceLine(groupName, since) {
  if (typeof since !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(since)) return t('In {0}', groupName)
  return t('In {0} since {1}', groupName, fmtMonth(since.slice(0, 10), true, { yearIfOld: true }))
}

/**
 * What removing `member` does to the group goal: { mine, before, after } ("22 becomes 18"), or
 * null when either figure is unknown or the person had nothing planned (the line is left out).
 */
export function removeEffect(member, group) {
  const mine = member?.week?.planned
  const before = group?.week?.planned
  if (!Number.isFinite(mine) || !Number.isFinite(before) || mine <= 0 || mine > before) return null
  return { mine, before, after: before - mine }
}
