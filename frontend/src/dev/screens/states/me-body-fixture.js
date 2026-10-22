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
