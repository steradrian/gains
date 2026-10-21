// The session note of a saved workout, written as the workout's drawer writes it
// (sheets/workout-detail.jsx saveNote): trimmed, cut to NOTE_MAX, gone when empty, and stamped
// for the sync (stampWorkout) only when it changed, since a stamp outranks what another device
// wrote since. The summary (views/workout/SummaryScreen.jsx) writes through here.
import { useStore } from '../store/useStore.js'
import { NOTE_MAX } from './history.js'
import { stampWorkout } from './sync-merge.js'
import { sameWorkout } from './workout-date.js'

const clean = text => String(text ?? '').trim().slice(0, NOTE_MAX)

/** Writes `text` as the note of the saved workout `w`. True when the record changed. */
export function writeWorkoutNote(w, text) {
  const next = clean(text)
  const { S, update } = useStore.getState()
  const rec = (S.workouts || []).find(x => x && sameWorkout(x, w))
  if (!rec || next === (rec.note || '')) return false
  let changed = false
  update(s => {
    const draft = (s.workouts || []).find(x => x && sameWorkout(x, w))
    if (!draft || next === (draft.note || '')) return
    if (next) draft.note = next
    else delete draft.note
    stampWorkout(draft)
    changed = true
  })
  return changed
}
