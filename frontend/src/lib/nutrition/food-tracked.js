/**
 * Whether the person tracks food (Settings > Features > What you track). Off hides Food everywhere
 * the app reads it (Today's profile, the diary hooks, the Food rows in Settings) and deletes
 * nothing: the diary stays on the hub and comes back when the switch does. A profile saved before
 * the switch existed has no key and reads as on.
 */
export const foodTracked = S => S?.trackFood !== false

/** Training and Activity are the other two "What you track" switches; same default. */
export const trainingTracked = S => S?.trackTraining !== false
export const activityTracked = S => S?.trackActivity !== false
