// What the Reminders page needs to decide, kept pure so it is testable without a browser.

/**
 * Which of the page's four faces to draw. The phone app schedules its own notifications, so it
 * is always 'ready'. On the web: an iPhone browser tab can not push until Gains is on the Home
 * Screen ('install'); a browser with no push at all shows 'nopush'; a permission answered "no"
 * once is 'blocked' (the page can not ask again); anything else is 'ready'.
 */
export function deviceKind({ mobile, pushOK, needsHome, permission }) {
  if (mobile) return 'ready'
  if (needsHome) return 'install'
  if (!pushOK) return 'nopush'
  if (permission === 'denied') return 'blocked'
  return 'ready'
}

/** How many reminders are on: the workout-day one, and the nudge that rides on it. */
export function reminderCount(S) {
  const r = S?.reminder
  if (!r?.on) return 0
  return r.nudge ? 2 : 1
}

/** "08:30" to [8, 30]; anything unreadable is 08:00. */
export function splitTime(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || '')
  if (!m) return [8, 0]
  return [Math.min(23, +m[1]), Math.min(59, +m[2])]
}

export const joinTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

/** The weekdays (0 = Sunday) that have a routine planned: the days the reminder can fire on. */
export function plannedWeekdays(S) {
  const routines = S?.routines || []
  const days = new Set()
  for (let wd = 0; wd < 7; wd++) {
    if ([].concat(S?.week?.[wd] || []).some(id => routines.some(r => r.id === id))) days.add(wd)
  }
  return days
}

/** The routines planned on any weekday, once each, in week order (Monday first). */
export function plannedRoutineNames(S) {
  const routines = S?.routines || []
  const names = []
  for (const wd of [1, 2, 3, 4, 5, 6, 0]) {
    for (const id of [].concat(S?.week?.[wd] || [])) {
      const name = routines.find(r => r.id === id)?.name
      if (name && !names.includes(name)) names.push(name)
    }
  }
  return names
}
