// The Day and Week pages' addresses (PR07 D1, D2): `/:tab/day/YYYY-MM-DD` and `/:tab/week/YYYY-Www`,
// pushed under the tab they were opened from, so the lit tab and Back stay where you were.
//
// A week is named by its ISO week (`2026-W42`), which is Monday-first. A profile whose weeks start
// on another day keeps the same name for the week that holds that ISO week's Monday, so every week
// has exactly one name whatever the first weekday.
//
// Which days open (PR07Edges, D1): today never shows here (it is Today), a day to come opens the
// Plan day drawer over the page you are on, and a day before the first log cannot be opened.
import { useStore } from '../store/useStore.js'
import { MONDAY, isoOf, startOfWeek, todayISO, weekKey, weekStartOf } from './format.js'
import { firstWorkoutDay, plusDays } from './missed-day.js'
import { nav } from './nav.js'
import { diaryIndexDays } from './nutrition/diary-index.js'
import { TABS, TAB_ROOT, tabOf } from './tab-route.js'
import { dayOverrideSheet } from '../sheets/plan.jsx'

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const WEEK = /^(\d{4})-W(\d{2})$/
const DAY_MS = 864e5

const utc = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
const fromUtc = ms => new Date(ms).toISOString().slice(0, 10)

/** Whether `iso` is a real calendar day written YYYY-MM-DD. */
export const isDate = iso => typeof iso === 'string' && DATE.test(iso) && fromUtc(utc(iso)) === iso

// The Monday of ISO week 1 of `year`: the week holding 4 January.
const weekOneMonday = year => {
  const jan4 = Date.UTC(year, 0, 4)
  return jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY_MS
}

// How far into its week the ISO Monday of a week that starts on weekday `ws` sits.
const mondayOffset = ws => (1 - ws + 7) % 7

/** The ISO week name (`2026-W42`) of the profile's week that holds `iso`. */
export function isoWeekOf(iso, ws = MONDAY) {
  const monday = plusDays(isoOf(startOfWeek(iso, ws)), mondayOffset(ws))
  const year = new Date(utc(monday) + 3 * DAY_MS).getUTCFullYear()
  const n = Math.round((utc(monday) - weekOneMonday(year)) / (7 * DAY_MS)) + 1
  return `${year}-W${String(n).padStart(2, '0')}`
}

/** The first day (YYYY-MM-DD) of the profile's week named `id`, or null for a name that is no week. */
export function weekStartOfId(id, ws = MONDAY) {
  const m = typeof id === 'string' ? WEEK.exec(id) : null
  if (!m) return null
  const monday = fromUtc(weekOneMonday(+m[1]) + (+m[2] - 1) * 7 * DAY_MS)
  if (isoWeekOf(monday) !== id) return null
  return plusDays(monday, -mondayOffset(ws))
}

/** The week number of a week name ("2026-W41" → 41), or null. */
export const weekNumberOf = id => (typeof id === 'string' && WEEK.test(id) ? Number(id.slice(6)) : null)

/** The earliest day anything was logged: a workout, a weigh-in, a measurement or (from the diary
 *  index, newest first) food. null when nothing is. */
export function firstLogDay(S, foodDays = []) {
  const days = [
    firstWorkoutDay(S),
    ...(S?.bodyweight || []).map(b => b?.d),
    ...(S?.measurements || []).map(m => m?.d),
    foodDays.length ? foodDays.at(-1)?.date : null,
  ].filter(isDate)
  return days.length ? days.reduce((a, b) => (b < a ? b : a)) : null
}

/**
 * What opening the day `iso` does: 'day' (the Day page), 'today' (Today instead), 'future' (the
 * Plan day drawer), 'before' (before the first log: nothing opens) or 'bad' (not a date).
 */
export function dayTargetOf(iso, { today = todayISO(), first = null } = {}) {
  if (!isDate(iso)) return 'bad'
  if (iso === today) return 'today'
  if (iso > today) return 'future'
  if (!first || iso < first) return 'before'
  return 'day'
}

/** What opening the week `id` does: 'week', 'future' (after this week: nothing opens) or 'bad'. */
export function weekTargetOf(id, { today = todayISO(), ws = MONDAY } = {}) {
  const start = weekStartOfId(id, ws)
  if (!start) return 'bad'
  return start > weekKey(today, ws) ? 'future' : 'week'
}

const tabOrHome = tab => (TABS.includes(tab) ? tab : 'home')

export const dayPath = (iso, tab) => `/${tabOrHome(tab)}/day/${iso}`
export const weekPath = (id, tab) => `/${tabOrHome(tab)}/week/${id}`

// The tab of the page on screen, read from the address (a sheet flow has no router of its own).
const currentTab = () => tabOf(String(globalThis.location?.hash || '').replace(/^#/, '').split(/[?#]/)[0]) || 'home'

const navOpts = replace => (replace ? { replace: true } : undefined)

/**
 * Opens the day `iso` under `tab` (the tab on screen by default), by the rules of dayTargetOf:
 * the Day page, Today, the Plan day drawer, or nothing. `replace` swaps the page on screen (the
 * Day rail, a sheet's history entry). Returns the target.
 */
export function navToDay(iso, tab = currentTab(), { replace = false } = {}) {
  const S = useStore.getState().S
  const target = dayTargetOf(iso, { today: todayISO(), first: firstLogDay(S, diaryIndexDays()) })
  if (target === 'today') nav(TAB_ROOT.home, navOpts(replace))
  else if (target === 'future') dayOverrideSheet(iso)
  else if (target === 'day') nav(dayPath(iso, tab), navOpts(replace))
  return target
}

/** Opens the week `id` under `tab`; a week after this one or a bad name opens nothing. */
export function navToWeek(id, tab = currentTab(), { replace = false } = {}) {
  const S = useStore.getState().S
  const target = weekTargetOf(id, { today: todayISO(), ws: weekStartOf(S) })
  if (target === 'week') nav(weekPath(id, tab), navOpts(replace))
  return target
}
