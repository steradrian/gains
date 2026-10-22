// What one finished workout lets Friends show (PR-09 decision 3): `workout.share`, written on the
// saved record and synced with it.
//
//   share = { off?: true, best?: [exerciseId], together?: false }
//
// `off` keeps the whole workout to yourself (the summary's "<Workout> done" switched off): it still
// counts as a number in the group's ring, it just is not shown as a moment. `best` lists the new-best exercises the person chose to show; the
// exercise only, never the weight (a record never gains a copy of one). `together: false` leaves
// this workout out of any Trained together moment, for this person only: the others keep theirs,
// and switching it on again brings it back (api/friends/moments.js). Absent means "follow my
// defaults" (What you share), so a default is never stored and older workouts never change. The
// server reads the field as it is (api/friends/*); the synced merge carries it with the workout.
import { useStore } from '../../store/useStore.js'
import { stampWorkout } from '../sync-merge.js'
import { sameWorkout } from '../workout-date.js'

const ids = v => (Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && x))] : [])

// The canonical shape of a share's parts: only what differs from the defaults is kept.
const canonical = ({ off, best, together }) => ({
  ...(off === true && { off: true }),
  ...(best?.length && { best }),
  ...(together === false && { together: false }),
})

/** The share of `w` in its canonical shape: `{}` when it follows the defaults. */
export function shareOf(w) {
  const s = w?.share
  if (!s || typeof s !== 'object') return {}
  return canonical({ off: s.off, best: ids(s.best), together: s.together })
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// One write: `patch` replaces those parts of the current share and keeps the rest; an empty share
// removes the field. The record is stamped (stampWorkout) only when the share changed, as the
// session note is (lib/workout-note.js).
function write(w, patch) {
  const { S, update } = useStore.getState()
  const rec = (S.workouts || []).find(x => x && sameWorkout(x, w))
  if (!rec) return false
  const cur = shareOf(rec)
  const next = canonical({ ...cur, ...patch(cur) })
  if (same(next, cur)) return false
  update(s => {
    const draft = (s.workouts || []).find(x => x && sameWorkout(x, w))
    if (!draft) return
    if (Object.keys(next).length) draft.share = next
    else delete draft.share
    stampWorkout(draft)
  })
  return true
}

/** Don't share this one on or off; the other choices are kept as they were. True when the record changed. */
export function setShareOff(w, off) {
  return write(w, () => ({ off }))
}

/** Shares (or stops sharing) the new best of exercise `id`: the id, nothing else. True when the record changed. */
export function setShareBest(w, id, on) {
  return write(w, cur => {
    const best = cur.best || []
    return { best: on ? [...new Set([...best, id])] : best.filter(x => x !== id) }
  })
}

/** Trained together on or off for this workout, for this person only. True when the record changed. */
export function setShareTogether(w, on) {
  return write(w, () => ({ together: on }))
}
