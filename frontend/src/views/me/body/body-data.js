// What the Body page's Weigh-ins tab shows, worked out from the state (boards Me2Body, Me2Empty).
// No UI: the screen words and formats it. A change is rounded to the one decimal the page shows.
import { weighInTime } from '../../../lib/bodyweight.js'
import { syncFingerprint } from '../../../lib/sync-changes.js'

const round1 = n => Math.round(n * 10) / 10
const DAY_MS = 86400000

const dayShift = (iso, days) => {
  const at = new Date(iso + 'T12:00:00Z').getTime() + days * DAY_MS
  return new Date(at).toISOString().slice(0, 10)
}

/** The weigh-ins with a day and a weight, oldest first. */
export const validWeighIns = S => (Array.isArray(S?.bodyweight) ? S.bodyweight : [])
  .filter(b => b && typeof b.d === 'string' && Number(b.w) > 0)
  .slice()
  .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))

/**
 * `from`: where the range starts, in ms (0 for All; lib/progress-range.js rangeStart). `today`: the
 * iso day.
 *
 *   latest       the newest weigh-in, { d, w, today } or null
 *   weekChange   latest against the last weigh-in 7 or more days before it; null when there is none
 *   periodChange latest in range against the first in range; null with fewer than two
 *   target       S.targetW or null
 *   toTarget     { kind: 'lose' | 'gain' | 'reached', amount } or null
 *   points       the range's weigh-ins for the chart, oldest first, [{ d, w }]
 *   rows         the range's weigh-ins newest first, [{ d, w, t, change, today }], `change` against the
 *                weigh-in before it (outside the range too), null for the very first
 */
export function bodyOf(S, { from = 0, today } = {}) {
  const all = validWeighIns(S)
  const unit = S?.unit === 'lb' ? 'lb' : 'kg'
  if (!all.length) return { empty: true, unit, latest: null, weekChange: null, periodChange: null, target: null, toTarget: null, points: [], rows: [], count: 0 }
  const last = all.at(-1)
  const latest = { d: last.d, w: last.w, today: last.d === today }
  const weekAgo = dayShift(last.d, -7)
  const base = all.filter(b => b.d <= weekAgo).at(-1)
  const weekChange = base ? round1(last.w - base.w) : null
  const inRange = all.filter(b => weighInTime(b) >= from)
  const periodChange = inRange.length > 1 ? round1(inRange.at(-1).w - inRange[0].w) : null
  const target = Number(S?.targetW) > 0 ? Number(S.targetW) : null
  let toTarget = null
  if (target) {
    const diff = round1(target - last.w)
    toTarget = diff === 0 ? { kind: 'reached', amount: 0 } : { kind: diff < 0 ? 'lose' : 'gain', amount: Math.abs(diff) }
  }
  const index = new Map(all.map((b, i) => [b.d, i]))
  const rows = inRange.map(b => {
    const prev = all[index.get(b.d) - 1]
    return { d: b.d, w: b.w, t: b.t, change: prev ? round1(b.w - prev.w) : null, today: b.d === today }
  }).reverse()
  return {
    empty: false, unit, latest, weekChange, periodChange, target, toTarget,
    points: inRange.map(b => ({ d: b.d, w: b.w })), rows, count: rows.length,
  }
}

/** `count` iso days spread evenly from the first point's day to the last's, for the chart's axis. */
export function axisDates(points, count = 4) {
  if (points.length < 2) return []
  const first = points[0].d, last = points.at(-1).d
  const span = Math.round((new Date(last + 'T12:00:00Z') - new Date(first + 'T12:00:00Z')) / DAY_MS)
  if (span < 1) return []
  const k = Math.min(count, span + 1)
  const out = Array.from({ length: k }, (_, i) => dayShift(first, Math.round((i * span) / (k - 1))))
  return [...new Set(out)]
}

/** Days whose weigh-in differs from the copy the server last agreed with (`fp`, lib/sync-changes.js syncFingerprint). */
export function waitingDays(S, fp) {
  if (!fp || typeof fp !== 'object') return []
  const now = syncFingerprint(S).b || {}
  const was = fp.b || {}
  return Object.keys(now).filter(d => now[d] !== was[d])
}
