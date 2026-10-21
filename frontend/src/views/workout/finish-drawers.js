// The workout's start and finish drawers, by the names every milestone calls (shared doc,
// "Opener and action names"). Until finish-M2 builds them these are today's sheets, so a caller
// switched over early changes nothing the user sees.
import { t } from '../../lib/i18n.js'
import { back } from '../../lib/use-tab-nav.js'
import { navToWorkout } from '../../lib/nav.js'
import { useUI } from '../../store/useUI.js'
import { discardWithUndo, DISCARD_UNDO_MS } from '../../lib/workout-discard.js'
import { beginWorkout, confirmSheet, finishWorkoutSheet } from '../../sheets.jsx'

/* ============================ Workout finish M2: leaving and Reopen ============================ */
// A finish or a discard clears S.active a moment before the route changes (the drawer's history
// entry is walked off first). In that moment /train/workout has nothing running and no `start`,
// which is the way in, not the way out: WorkoutRoute renders nothing while this says so, rather
// than today's Ready or the chooser.
const LEAVING_MS = 1500
let leavingUntil = 0
export const markLeaving = (now = Date.now()) => { leavingUntil = now + LEAVING_MS }
export const isLeaving = (now = Date.now()) => now < leavingUntil

// What Reopen (W2.1) puts back, held from the save to the summary's Done, in memory only (never
// in S). One at a time: a second save replaces it. `takeReopen(id)` hands it over once, and only
// for the workout it was taken for.
let held = null
export function holdReopen(snapshot, workoutId) {
  held = snapshot ? { snapshot, workoutId: String(workoutId) } : null
}
export function takeReopen(workoutId) {
  if (!held || held.workoutId !== String(workoutId)) return null
  const { snapshot } = held
  held = null
  return snapshot
}

/** W1.10 / W1.11: today's Finish sheet, its Discard going through discardSheet. */
export function finishSheet() {
  finishWorkoutSheet({ onDiscard: () => discardSheet() })
}

/** W1.46, then W1.26: today's confirm, then the discard with its Undo. */
export function discardSheet() {
  confirmSheet({
    title: t('Discard workout?'), message: t('The sets you logged in this session will be lost.'), confirmText: t('Discard'), danger: true,
    onConfirm: () => {
      const gone = discardWithUndo()
      if (!gone) return
      // Off the screen the way it came in (lib/use-tab-nav.js back): the session's page is gone.
      back()
      useUI.getState().toast(gone.text, { action: t('Undo'), onAction: () => { if (gone.undo()) navToWorkout() }, ms: DISCARD_UNDO_MS })
    },
  })
}

/** W1.31: no offer yet, the session starts with its warm-up. `bw` is the weigh-in Ready asked. */
export function warmupOfferSheet(ids, bw = null) {
  beginWorkout(ids, bw)
}

/** W1.40: nothing yet. */
export function cooldownOfferSheet() {}

/** W1.27: nothing yet. */
export function staleWorkoutSheet() {}
