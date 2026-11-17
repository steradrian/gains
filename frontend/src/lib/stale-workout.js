// A workout left open (owner question 8, board W1.27): a running session whose last ticked set,
// or its start when nothing is ticked, is more than 3 h ago. Never an edit of a saved workout,
// never a workout being logged into the past: neither has a clock that runs.
import { useStore } from '../store/useStore.js'
import { t } from './i18n-core.js'
import { hasCompletedWork } from './workout-model.js'
import { sessionEnd } from './finish-workout.js'
import { loggedSetsDone } from './workout-parts.js'
import { finishAndSave } from '../sheets.jsx'
import { launchPath, workoutRunning } from './tab-route.js'

export const STALE_MS = 3 * 60 * 60 * 1000

const lastTickOf = A => {
  let last = null
  for (const e of A?.entries || []) for (const s of e?.sets || []) {
    if (hasCompletedWork(s) && Number.isFinite(s.at) && (last == null || s.at > last)) last = s.at
  }
  return last
}

/**
 * `{ name, started, setsLogged, lastSet, openFor, endAt }` for a session left open at `now`, else
 * null. `started` and `lastSet` are times (ms; `lastSet` null with nothing ticked), `openFor` the
 * time since the start, `endAt` where a save ends it (lib/finish-workout.js sessionEnd: the last
 * set's end), null when nothing is ticked.
 */
export function staleFacts(A, now = Date.now()) {
  if (!A || A.editingWorkoutId || A.backfill || !Number.isFinite(Number(A.start))) return null
  const lastSet = lastTickOf(A)
  const since = lastSet ?? Number(A.start)
  if (now - since <= STALE_MS) return null
  return {
    name: A.name || t('Freestyle'),
    started: Number(A.start),
    setsLogged: loggedSetsDone(A),
    lastSet,
    openFor: Math.max(0, now - Number(A.start)),
    endAt: lastSet == null ? null : sessionEnd(A, now),
  }
}

/**
 * Where a launch with no route of its own lands: into a running workout, unless it was left open
 * for hours, which lands on Today for StaleWorkoutCheck to ask about. Sent to the workout first,
 * the check's own move to Today raced the launch's, and the workout could win.
 */
export const launchTarget = (S, now = Date.now()) => launchPath(workoutRunning(S) && !staleFacts(S?.active, now))

/** Save with N sets (W1.27): the save, ending at the last set. Null when nothing is left open. */
export function saveStale(now = Date.now()) {
  const facts = staleFacts(useStore.getState().S.active, now)
  if (!facts) return null
  return finishAndSave(facts.endAt == null ? {} : { end: facts.endAt })
}
