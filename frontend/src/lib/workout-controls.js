// The one optional control the app still reads from the old "Workout controls" group:
// Settings → Fine-tuning → Swipe actions. Lives in its own module so views can read it without
// the store — the store's DEF only references it. S.wc overlays WC_DEFAULT, so a profile written
// before the setting existed reads as the default; the other keys an older profile may hold
// (steppers, setShortcuts, pairButtons, exerciseButtons, exerciseChips) are ignored.
export const WC_DEFAULT = Object.freeze({
  swipeSets: true,        // swipe actions: a set row (start deletes with Undo, end copies) and, despite the
                          // name, Plan's routines, loop and routine exercises too (Settings: "Swipe actions")
})

export function workoutControls(S) {
  return { ...WC_DEFAULT, ...((S && S.wc) || {}) }
}
