// What one finished workout lets Friends show (PR-09 decision 3): `workout.share`, written on the
// saved record and synced with it.
//
//   share = { off?: true, best?: [exerciseId] }
//
// `off` is "Don't share this one": the workout still counts as a number in the group's ring, it just
// is not shown as a moment. `best` lists the new-best exercises the person chose to show; the
// exercise only, never the weight (a record never gains a copy of one). Absent means "follow my
// defaults" (What you share), so a default is never stored and older workouts never change. The
// server reads the field as it is (api/friends/*); the synced merge carries it with the workout.
import { useStore } from '../../store/useStore.js'
import { stampWorkout } from '../sync-merge.js'
import { sameWorkout } from '../workout-date.js'

const ids = v => (Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && x))] : [])

/** The share of `w` in its canonical shape: `{}` when it follows the defaults. */
export function shareOf(w) {
  const s = w?.share
  if (!s || typeof s !== 'object') return {}
  const best = ids(s.best)
  return { ...(s.off === true && { off: true }), ...(best.length && { best }) }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// One write: `change(current)` returns the next share; an empty one removes the field. The record is
// stamped (stampWorkout) only when the share changed, as the session note is (lib/workout-note.js).
function write(w, change) {
  const { S, update } = useStore.getState()
  const rec = (S.workouts || []).find(x => x && sameWorkout(x, w))
  if (!rec) return false
  const next = change(shareOf(rec))
  if (same(next, shareOf(rec))) return false
  update(s => {
    const draft = (s.workouts || []).find(x => x && sameWorkout(x, w))
    if (!draft) return
    if (Object.keys(next).length) draft.share = next
    else delete draft.share
    stampWorkout(draft)
  })
  return true
}

/** Don't share this one on or off; the shared bests are kept as they were. True when the record changed. */
export function setShareOff(w, off) {
  return write(w, cur => ({ ...(off && { off: true }), ...(cur.best && { best: cur.best }) }))
}

/** Shares (or stops sharing) the new best of exercise `id`: the id, nothing else. True when the record changed. */
export function setShareBest(w, id, on) {
  return write(w, cur => {
    const best = cur.best || []
    const next = on ? [...new Set([...best, id])] : best.filter(x => x !== id)
    return { ...(cur.off && { off: true }), ...(next.length && { best: next }) }
  })
}
