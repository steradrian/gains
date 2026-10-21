import { tn } from '../../lib/i18n.js'
import { durPart } from '../../lib/format.js'
import { workoutDuration } from '../../lib/history.js'
import { workoutLabel } from '../../lib/training-day.js'
import { menuSheet, workoutDetailSheet } from '../../sheets.jsx'

// A workout's line in the list: how long it took and its PRs, whichever it has.
const lineOf = w => [...durPart(workoutDuration(w)), ...(w.prs?.length ? [tn('{0} PR', '{0} PRs', w.prs.length)] : [])].join(' · ') || null

/** A day's logged workouts: the one's detail, or a list of them to pick from. */
export function workoutsSheet(title, workouts) {
  if (workouts.length === 1) { workoutDetailSheet(workouts[0]); return }
  menuSheet({ title, items: workouts.map(w => ({ icon: 'checkCircle', label: workoutLabel(w), sub: lineOf(w), onClick: () => workoutDetailSheet(w) })) })
}
