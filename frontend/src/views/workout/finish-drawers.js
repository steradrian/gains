// The workout's start and finish drawers, by the names every milestone calls (shared doc,
// "Opener and action names"). The drawers themselves are in FinishDrawers.jsx; a .js module has
// no JSX here, so they open through createElement.
import { createElement } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { discardFacts } from '../../lib/workout-discard.js'
import { staleFacts } from '../../lib/stale-workout.js'
import { partOf } from '../../lib/workout-parts.js'
import { beginWorkout, saveWorkoutEdits } from '../../sheets.jsx'
import { readyOf } from './use-ready.js'
import { markOffered } from './workout-actions.js'
import { CooldownOfferDrawer, DiscardDrawer, FinishDrawer, StaleWorkoutDrawer, WarmupOfferDrawer, discardNow } from './FinishDrawers.jsx'

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

/* ============================ Workout finish M2: the openers ============================ */
const S = () => useStore.getState().S
const open = (Drawer, props = {}) => useUI.getState().openSheet(close => createElement(Drawer, { ...props, close }), { variant: 'ds' })

/** W1.10 / W1.11 for the running session. The editor of a saved workout still saves at once. */
export function finishSheet() {
  const A = S().active
  if (!A) return
  if (A.editingWorkoutId) { saveWorkoutEdits(); return }
  open(FinishDrawer)
}

/** W1.46, then W1.26 on Today. With nothing logged there is nothing to confirm: it goes at once (still with Undo). */
export function discardSheet() {
  const A = S().active
  if (!A) return
  if (!discardFacts(A).confirm) { discardNow(() => {}); return }
  open(DiscardDrawer)
}

/** W1.31 over Ready: Start warm-up or Skip warm-up. `bw` is the weigh-in Ready asked. Without a warm-up the session starts. */
export function warmupOfferSheet(ids, bw = null) {
  if (!readyOf(S(), ids)?.groups.some(g => g.part === 'warmup')) { beginWorkout(ids, bw); return }
  open(WarmupOfferDrawer, { ids, bw })
}

/** W1.40 over the running screen, once per session (`A.offered.cooldown`), only when it has a cool-down. */
export function cooldownOfferSheet() {
  const A = S().active
  if (!A || A.offered?.cooldown || !(A.entries || []).some(e => partOf(e) === 'cooldown')) return
  markOffered('cooldown')
  open(CooldownOfferDrawer)
}

/** W1.27 over Today, for a session left open (lib/stale-workout.js). */
export function staleWorkoutSheet() {
  if (!staleFacts(S().active)) return
  open(StaleWorkoutDrawer)
}
