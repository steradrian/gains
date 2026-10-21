// Deleting a saved workout with an Undo (board T8.4): it goes at once, with no confirm, and the
// Undo puts back the exact record where it stood. What carries the Undo across devices is the
// store's own removal record (lib/sync-merge.js stampDeletions): the delete stamps the workout as
// removed, and the Undo's re-insert as added back, later, so a device that already took the
// removal brings the workout back on its next merge instead of keeping it gone.
import { referencedHashes } from './media-refs.js'
import { sameWorkout } from './workout-date.js'

const copy = v => JSON.parse(JSON.stringify(v))

/**
 * Takes workout `w` out of the draft `s`: every copy of it, matched the way the edits are (by id,
 * or by day and start for a record from before ids). Returns what the Undo needs, `{ taken:
 * [{ index, rec }] }` with each record as it was and where it stood, or null when it was not there.
 */
export function takeWorkout(s, w) {
  const list = Array.isArray(s.workouts) ? s.workouts : []
  const taken = []
  list.forEach((x, index) => { if (x && sameWorkout(x, w)) taken.push({ index, rec: copy(x) }) })
  if (!taken.length) return null
  s.workouts = list.filter(x => !(x && sameWorkout(x, w)))
  return { taken }
}

/**
 * The Undo, in the draft `s`: each record `snap` took goes back at the place it had, unless a sync
 * brought it back first. Returns whether anything was put back.
 */
export function putBackWorkout(s, snap) {
  if (!snap?.taken?.length) return false
  if (!Array.isArray(s.workouts)) s.workouts = []
  let back = false
  for (const { index, rec } of [...snap.taken].sort((a, b) => a.index - b.index)) {
    if (s.workouts.some(x => x && sameWorkout(x, rec))) continue
    s.workouts.splice(Math.min(index, s.workouts.length), 0, copy(rec))
    back = true
  }
  return back
}

/** Every photo and video file (and poster) the records `snap` took refer to. */
export const takenMediaHashes = snap => [...referencedHashes({ workouts: (snap?.taken || []).map(x => x.rec) })]
