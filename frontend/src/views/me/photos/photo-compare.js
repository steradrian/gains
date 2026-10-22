import { fmtNum } from '../../../lib/format.js'
import { t, tn } from '../../../lib/i18n.js'
import { measurementUnit, measurementValue, toMeasurementDisplay } from '../../../lib/measurements.js'
import { daysBetween } from '../../../lib/me/photos.js'

// What Compare shows between two photos (board Me2Compare): the days apart, the weight change and the
// waist change. Every number is read from the state; a side with no weight or no waist reading leaves
// that part out instead of guessing. No JSX.

/** The photos in date order, the earlier one first (a tie keeps the order given). */
export function orderPair(a, b) {
  return a.d <= b.d ? [a, b] : [b, a]
}

/** Compare's starting pair from the photos newest first: the oldest and the newest. Null under two photos. */
export function defaultPair(photos) {
  if (!Array.isArray(photos) || photos.length < 2) return null
  return [photos[photos.length - 1], photos[0]]
}

/**
 * The pair the viewer opens Compare with: `photo` and the nearest older one in `photos` (newest
 * first); the oldest photo has none, so it takes the nearest newer. Null when there is no other photo.
 */
export function pairFor(photos, photo) {
  const list = Array.isArray(photos) ? photos : []
  const i = list.findIndex(p => p.key === photo.key)
  if (i < 0 || list.length < 2) return null
  return orderPair(list[i + 1] || list[i - 1], photo)
}

/** The waist (cm) from the latest measurement on or before `day` that has one, or null. */
export function waistOn(S, day) {
  let best = null
  for (const e of Array.isArray(S?.measurements) ? S.measurements : []) {
    if (!e || typeof e.d !== 'string' || e.d > day) continue
    const cm = measurementValue(e, 'waist')
    if (cm != null && (!best || e.d >= best.d)) best = { d: e.d, cm }
  }
  return best ? best.cm : null
}

const tenth = n => Math.round(n * 10) / 10

/**
 * { days, weight, waist, unit, lengthUnit }: `before` and `after` in date order. `weight` is the
 * change in the profile's weight unit, `waist` in cm (inches with lb); each null when either side
 * has no reading.
 */
export function compareFacts(S, before, after) {
  const unit = S?.unit === 'lb' ? 'lb' : 'kg'
  const weight = before.weight == null || after.weight == null ? null : tenth(after.weight - before.weight)
  const a = waistOn(S, before.d), b = waistOn(S, after.d)
  const waist = a == null || b == null ? null : tenth(toMeasurementDisplay(b, unit) - toMeasurementDisplay(a, unit))
  return { days: daysBetween(before.d, after.d), weight, waist, unit, lengthUnit: measurementUnit(unit) }
}

const signed = n => (n > 0 ? '+' : '') + fmtNum(n)

/** "77 days apart · -3.6 kg · waist -4 cm": the parts there is data for. */
export function compareLine(facts) {
  return [
    facts.days > 0 ? tn('{0} day apart', '{0} days apart', facts.days) : t('Same day'),
    facts.weight == null ? '' : signed(facts.weight) + ' ' + facts.unit,
    facts.waist == null ? '' : t('waist {0}', signed(facts.waist) + ' ' + facts.lengthUnit),
  ].filter(Boolean).join(' · ')
}
