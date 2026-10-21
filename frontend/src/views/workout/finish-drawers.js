// The workout's start and finish drawers, by the names every milestone calls (shared doc,
// "Opener and action names"). Until finish-M2 builds them these are today's sheets, so a caller
// switched over early changes nothing the user sees.
import { t } from '../../lib/i18n.js'
import { back } from '../../lib/use-tab-nav.js'
import { navToWorkout } from '../../lib/nav.js'
import { useUI } from '../../store/useUI.js'
import { discardWithUndo, DISCARD_UNDO_MS } from '../../lib/workout-discard.js'
import { beginWorkout, confirmSheet, finishWorkoutSheet } from '../../sheets.jsx'

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
