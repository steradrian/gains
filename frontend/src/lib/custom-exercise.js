// A custom exercise's "How you log it" (board T6.4, owner question 3). The mode used to live only
// on each routine entry (cfg.mode, plus its bodyweight flag); a custom exercise now keeps a default
// of its own, which seeds the entry when the exercise is added somewhere (history.js
// defaultConfig). An entry's own cfg.mode, once it has one, still wins, and no entry is rewritten.
//
// Stored on the custom exercise as `mode` ('reps' | 'time' | 'cardio') and, for "Reps only",
// `bodyweight: true`. It syncs with the rest of the exercise (lib/sync-merge.js stamps custom
// exercises per field).
import { isBodyweightEq, isCustomEx } from './exercises.js'

const MODES = ['reps', 'time', 'cardio']

/** The four choices the form offers, in the board's order. */
export const LOG_CHOICES = ['weight', 'reps', 'time', 'cardio']

/**
 * What a custom exercise seeds a new routine entry with: { mode } for a timed hold or cardio,
 * { mode: 'reps', bodyweight } for Weight × reps (false) and Reps only (true). {} for a built-in
 * exercise, or a custom one saved before the field existed.
 */
export function customExDefaults(ex) {
  if (!isCustomEx(ex) || !MODES.includes(ex.mode)) return {}
  return ex.mode === 'reps' ? { mode: 'reps', bodyweight: !!ex.bodyweight } : { mode: ex.mode }
}

/**
 * The form's choice for an exercise: its stored mode, else what the app already does with it
 * (cardio for the Cardio body part, Reps only on body-weight equipment, otherwise Weight × reps).
 */
export function logChoiceOf(ex) {
  const own = customExDefaults(ex)
  if (own.mode === 'reps') return own.bodyweight ? 'reps' : 'weight'
  if (own.mode) return own.mode
  if (ex?.bp === 'cardio') return 'cardio'
  return isBodyweightEq(ex) ? 'reps' : 'weight'
}

/** Writes a choice onto a custom exercise draft: `mode`, and `bodyweight` only for Reps only. */
export function withLogChoice(c, choice) {
  c.mode = choice === 'weight' || choice === 'reps' ? 'reps' : choice
  if (choice === 'reps') c.bodyweight = true
  else delete c.bodyweight
  return c
}
