// Discard with Undo (owner question 9, boards W1.46 Discard 14 sets? and W1.26 Discarded): the
// confirm lists what goes, the session is cleared, and Today offers Undo for 8 s. What Undo puts
// back is held here, in memory only: never in S, so it is never pushed, synced or backed up.
// The timers are not restored: a rest or a hold that was counting is simply over.
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from './i18n-core.js'
import { loggedSetsDone } from './workout-parts.js'
import { clockText } from './workout-finish.js'

export const DISCARD_UNDO_MS = 8000

/**
 * What a discard of `A` takes away (W1.46): `{ name, sets, clock, clockText, confirm }`. `sets`
 * counts every logged set, warm-up rows and warm-up exercises included; `confirm` is false for a
 * workout with nothing logged, which goes without the question (still with Undo).
 */
export function discardFacts(A, now = Date.now()) {
  if (!A) return null
  const sets = loggedSetsDone(A)
  const clock = Math.max(0, now - (Number(A.start) || now))
  return { name: A.name || t('Freestyle'), sets, clock, clockText: clockText(clock), confirm: sets > 0 }
}

/** The toast on Today after a discard (W1.26). */
export const discardedText = name => t('Discarded {0}. The sets go unless you undo.', name)

const clone = v => JSON.parse(JSON.stringify(v))

/**
 * Clears the running session and stops the rest and the hold. Returns `{ name, text, undo }`, or
 * null with nothing running. `undo()` puts the session back as it was and returns true; it does
 * nothing (false) once used, or when another session has started meanwhile.
 */
export function discardWithUndo() {
  const A = useStore.getState().S.active
  if (!A) return null
  const kept = clone(A)
  const name = kept.name || t('Freestyle')
  useStore.getState().update(s => { s.active = null })
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  let used = false
  const undo = () => {
    if (used || useStore.getState().S.active) return false
    used = true
    useStore.getState().update(s => { s.active = kept })
    return true
  }
  return { name, text: discardedText(name), undo }
}
