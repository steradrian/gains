// What the Body page's Measurements tab shows, worked out from the state (board Me2Measure). No UI:
// the screen words and formats it. Changes are rounded to the one decimal the page shows.
import { enabledMeasurementFields, measurementSeries, measurementUnit } from '../../../lib/measurements.js'

const round1 = n => Math.round(n * 10) / 10

/**
 * `from`: where the range starts, in ms (0 for All; lib/progress-range.js rangeStart).
 *
 *   count     how many measurements are tracked (switched on)
 *   lastDay   the newest day any tracked measurement was logged, or null
 *   empty     nothing tracked, or nothing logged yet
 *   fields    one per tracked measurement, in the order of the Choose drawer:
 *     key, label, custom   the label is the field's own name; the screen translates a built-in one
 *     unit                 '%' for body fat, else cm or in
 *     latest               { d, v } the newest reading, or null
 *     change               latest against the reading before it, or null
 *     since                { d, change } latest against the very first reading (its day), or null
 *                          when there are fewer than three readings (it would repeat `change`)
 *     points               the readings in range, oldest first, [{ d, v }]
 */
export function measureOf(S, { from = 0 } = {}) {
  const unitOf = key => (key === 'bodyFat' ? '%' : measurementUnit(S?.unit))
  const fields = enabledMeasurementFields(S || {}).map(f => {
    const all = measurementSeries(S, f.key)
    const last = all.at(-1) || null
    const prev = all.at(-2)
    const first = all[0]
    return {
      key: f.key, label: f.label, custom: !!f.custom, unit: unitOf(f.key),
      latest: last ? { d: last.d, v: last.y } : null,
      change: last && prev ? round1(last.y - prev.y) : null,
      since: last && first && all.length > 2 ? { d: first.d, change: round1(last.y - first.y) } : null,
      points: all.filter(p => p.t >= from).map(p => ({ d: p.d, v: p.y })),
    }
  })
  const lastDay = fields.reduce((day, f) => (f.latest && (!day || f.latest.d > day) ? f.latest.d : day), null)
  return { count: fields.length, lastDay, empty: !fields.length || !lastDay, fields }
}

/** The tracked measurement to show first: Waist when tracked, else the first one with a reading, else the first. */
export function firstKey(data) {
  return (data.fields.find(f => f.key === 'waist' && f.latest) || data.fields.find(f => f.latest) || data.fields[0])?.key || null
}
