// The Body page's states (me-body.jsx): the boards' seven weekly weigh-ins, 83.6 kg to 81.4 kg
// against a target of 78 kg, counted back from today so "today", the Log weight drawer and the
// page all agree on the day (the drawers read the real clock).
import { isoOf, todayISO } from '../../../lib/format.js'

export const NOOP = () => {}

// Newest first, as the board lists them.
export const KG = [81.4, 81.7, 82.1, 82.6, 83.0, 83.4, 83.6]
const LB = KG.map(w => Math.round(w * 2.20462 * 10) / 10)

const daysAgo = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() - n); return d }

/** The state a Body screen reads: `weights` newest first, one a week from today (or from a week ago when `today` is false). */
export function bodyState({ unit = 'kg', today = true, count = KG.length, target = 78, weighIn = true } = {}) {
  const values = (unit === 'lb' ? LB : KG).slice(0, count)
  const first = today ? 0 : 7
  const bodyweight = values.map((w, i) => {
    const day = daysAgo(first + i * 7)
    // The logging stamp of a weigh-in made at 07:40 on its day.
    const at = new Date(day); at.setHours(7, 40, 0, 0)
    return { d: isoOf(day), w, t: at.getTime() }
  }).reverse()
  return {
    unit, bodyweight, targetW: unit === 'lb' ? Math.round(target * 2.20462) : target,
    weighIn,
  }
}

/** The empty state: nothing logged. */
export const emptyState = (extra = {}) => ({ unit: 'kg', bodyweight: [], targetW: null, weighIn: true, ...extra })

/** The weigh-in the Edit drawer opens on: the second row of the board, a week back. */
export const editEntry = (state = bodyState()) => state.bodyweight.at(-2)

// Me body M2: the Measurements tab's states (me-body.jsx). The board's five tracked measurements,
// counted back from today so the drawers (which read the real clock) agree with the page.
const TRACKED = ['waist', 'chest', 'hips', 'upperArmLeft', 'thighRight']
// [days ago, values in cm]: the waist falls 88 -> 84 over the weeks; the thigh was last measured a
// fortnight before the rest.
const CHECKINS = [
  [78, { waist: 88, chest: 101.5, hips: 100, upperArmLeft: 36, thighRight: 59 }],
  [42, { waist: 86.5, chest: 102, hips: 99, upperArmLeft: 36, thighRight: 58.5 }],
  [16, { thighRight: 58 }],
  [14, { waist: 85.5, chest: 102, hips: 99, upperArmLeft: 36 }],
  [2, { waist: 84, chest: 102.5, hips: 98, upperArmLeft: 36.5 }],
]

/** The state the Measurements tab reads. `tracked` lists the keys switched on; `logged` false leaves no check-in. */
export function measureState({ unit = 'kg', tracked = TRACKED, logged = true, today = false } = {}) {
  const measurements = logged ? CHECKINS.map(([ago, values]) => {
    const day = daysAgo(ago)
    return { d: isoOf(day), t: day.getTime(), ...values }
  }) : []
  // A check-in already made today, for the same-date state.
  if (logged && today) measurements.push({ d: todayISO(), t: Date.now(), waist: 83.5, chest: 102.5, hips: 98 })
  return { unit, bodyweight: [], measurements, customMeasurements: [], measurementEnabled: tracked }
}
