// The reminders that really went off on this phone: the notifications inbox's `reminder` kind
// (PR07 N1). The phone build schedules the workout-day reminder and the missed-workout nudge as
// native local notifications (lib/mobile.js syncReminder), and nothing reports back when one is
// shown. So every sync remembers what it scheduled, and the next one moves whatever came due into
// the log: a reminder still scheduled when its time came was delivered, because logging that day's
// workout, a day note or turning the reminder off resyncs, which takes it out first.
//
// Kept on this device only (localStorage), for LOG_DAYS. No back-fill: the log starts empty. The
// web app's reminders are server pushes and never pass through here.
//
// An entry: { kind: 'workout' | 'nudge', iso, at, routines: [{ id, name }], time?, tone? }, the
// routine names as they were when it was scheduled, so a routine deleted since can still be named.

const KEY = 'gains_reminder_log'
export const LOG_DAYS = 30
const DAY_MS = 86400000

const isEntry = e => !!e && typeof e === 'object' && (e.kind === 'workout' || e.kind === 'nudge') &&
  Number.isFinite(e.at) && typeof e.iso === 'string'
const entries = v => (Array.isArray(v) ? v.filter(isEntry) : [])
const keyOf = e => e.kind + ':' + e.iso

/** Pure: the log after a sync at `now` that left `scheduled` waiting. What was waiting and came
 *  due is fired; the rest was cancelled by the sync and is forgotten. */
export function nextLog(log, scheduled, now) {
  const fired = entries(log?.fired)
  const seen = new Set(fired.map(keyOf))
  for (const e of entries(log?.pending)) {
    if (e.at <= now && !seen.has(keyOf(e))) { fired.push(e); seen.add(keyOf(e)) }
  }
  return {
    pending: entries(scheduled).filter(e => e.at > now),
    fired: fired.filter(e => e.at > now - LOG_DAYS * DAY_MS && e.at <= now).sort((a, b) => a.at - b.at),
  }
}

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}
const write = log => {
  try { localStorage.setItem(KEY, JSON.stringify(log)) } catch { /* storage blocked: no log */ }
}

/** After a sync: `scheduled` is what it left waiting (an empty list when it only cancelled). */
export function recordScheduled(scheduled, now = Date.now()) {
  write(nextLog(read(), scheduled, now))
}

/** The reminders that went off on this device in the last LOG_DAYS, oldest first. One still
 *  waiting in the log whose time has passed went off too, before any sync has moved it. */
export function firedReminders(now = Date.now()) {
  const log = read()
  return log ? nextLog(log, [], now).fired : []
}
