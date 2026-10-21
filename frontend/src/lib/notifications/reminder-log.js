// The reminders that really went off on this phone: the notifications inbox's `reminder` kind
// (PR07 N1). The phone build schedules the workout-day reminder and the missed-workout nudge as
// native local notifications (lib/mobile.js syncReminder), and nothing reports back when one is
// shown. So every sync remembers what it scheduled, and the next one moves whatever came due into
// the log: a reminder still scheduled when its time came was delivered, because logging that day's
// workout, a day note or turning the reminder off resyncs, which takes it out first. A sync that
// finds the permission off forgets what came due instead: the phone did not show it.
//
// Kept on this device only (localStorage), per profile (as search's Recent is, lib/search/recents.js:
// two accounts on one phone never see each other's), for LOG_DAYS. No back-fill: the log starts
// empty. The web app's reminders are server pushes and never pass through here.
//
// An entry: { kind: 'workout' | 'nudge', iso, at, routines: [{ id, name }], time?, tone? }, the
// routine names as they were when it was scheduled, so a routine deleted since can still be named.
const KEY = 'gains_reminder_log:'
export const LOG_DAYS = 30
const DAY_MS = 86400000

// Whose log it is: the store hands over its signed-in user (it cannot be imported from here, as
// the store imports lib/mobile.js, which imports this). No owner yet, or signed out, is 'guest'.
let ownerOf = () => null
export const setReminderLogOwner = fn => { ownerOf = fn }
const profileOf = user => (user ? 'u' + String(user.id ?? user.name ?? '') : 'guest')
const keyOf = () => KEY + profileOf(ownerOf())

const isEntry = e => !!e && typeof e === 'object' && (e.kind === 'workout' || e.kind === 'nudge') &&
  Number.isFinite(e.at) && typeof e.iso === 'string'
const entries = v => (Array.isArray(v) ? v.filter(isEntry) : [])
const idOf = e => e.kind + ':' + e.iso

/** Pure: the log after a sync at `now` that left `scheduled` waiting. What was waiting and came
 *  due is fired when `delivered` (the phone may show notifications); the rest was cancelled by
 *  the sync and is forgotten. */
export function nextLog(log, scheduled, now, delivered = true) {
  const fired = entries(log?.fired)
  const seen = new Set(fired.map(idOf))
  if (delivered) {
    for (const e of entries(log?.pending)) {
      if (e.at <= now && !seen.has(idOf(e))) { fired.push(e); seen.add(idOf(e)) }
    }
  }
  return {
    pending: entries(scheduled).filter(e => e.at > now),
    fired: fired.filter(e => e.at > now - LOG_DAYS * DAY_MS && e.at <= now).sort((a, b) => a.at - b.at),
  }
}

/** This profile's log as stored, '' when there is none: what the feed's memo watches. */
export const reminderLogRaw = () => {
  try { return localStorage.getItem(keyOf()) || '' } catch { return '' }
}
const read = () => {
  try { return JSON.parse(reminderLogRaw() || 'null') } catch { return null }
}
const write = log => {
  try { localStorage.setItem(keyOf(), JSON.stringify(log)) } catch { /* storage blocked: no log */ }
}

/** After a sync: `scheduled` is what it left waiting (an empty list when it only cancelled);
 *  `delivered`, whether the phone could show what came due since the last one. */
export function recordScheduled(scheduled, now = Date.now(), delivered = true) {
  write(nextLog(read(), scheduled, now, delivered))
}

/** The reminders that went off on this device in the last LOG_DAYS, oldest first. One still
 *  waiting in the log whose time has passed went off too, before any sync has moved it: it was
 *  only logged as waiting with the permission on. */
export function firedReminders(now = Date.now()) {
  const log = read()
  return log ? nextLog(log, [], now).fired : []
}
