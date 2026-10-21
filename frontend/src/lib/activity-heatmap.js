// The activity heatmap's data, apart from how it is drawn: workouts per local day, five shade
// levels from the busiest days' quartiles, and a year of weeks laid out for ds/Heatmap (byWeek).
// It is what components/Heatmap.jsx did inline; the page words each cell (dates, minutes,
// volume) with t() and hands the cells to the kit.
import { isoOf, weekDayOffset } from './format.js'
import { workoutDay, workoutDuration, workoutVolume } from './history.js'

export const HEATMAP_WEEKS = 53
/** Shade levels `level` takes: 0 (nothing) to 4. Pass 5 to ds/Heatmap's `levels`. */
export const HEATMAP_LEVELS = 5

export const normalizeMetric = value => (value === 'vol' ? 'vol' : 'time')

// Legacy records without entries only have the cached volume. Current records are always
// recomputed from their completed sets, so unit changes and the warm-up/per-side rules stay
// authoritative.
const volumeOf = w => {
  if (Array.isArray(w?.entries)) return Math.max(0, Number(workoutVolume(w)) || 0)
  const volume = Number(w?.vol)
  return Number.isFinite(volume) ? Math.max(0, volume) : 0
}

/** Per local day: how many workouts, their volume, and their minutes. Records with no valid day are left out. */
export function totalsByDay(workouts) {
  const totals = {}
  ;(workouts || []).forEach(w => {
    const day = workoutDay(w)
    if (!day) return
    const a = totals[day] = totals[day] || { n: 0, vol: 0, min: 0 }
    a.n++
    a.vol += volumeOf(w)
    a.min += Math.max(0, Math.round(workoutDuration(w) / 60000))
  })
  return totals
}

const keyOf = metric => (normalizeMetric(metric) === 'vol' ? 'vol' : 'min')

/** The 25th, 50th and 75th percentile of the days that have any of the metric. [0, 0, 0] with none. */
export function levelThresholds(totals, metric) {
  const key = keyOf(metric)
  const sorted = Object.values(totals).map(a => a[key]).filter(v => v > 0).sort((a, b) => a - b)
  const q = p => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0)
  return [q(0.25), q(0.5), q(0.75)]
}

/** 0 for a day with no workout, 1 for a workout with none of the metric (a workout with no end time, under time), then 2 to 4 by quartile. */
export function levelOf(total, metric, thresholds) {
  if (!total) return 0
  const v = total[keyOf(metric)]
  const [t1, t2, t3] = thresholds
  return !v ? 1 : v >= t3 ? 4 : v >= t2 ? 3 : v >= t1 ? 2 : 1
}

/**
 * The year ending in the week of `now`, `weeks` weeks of seven days from the first day of each
 * week (`weekStart`: 1 Monday, 0 Sunday; weekStartOf(S) in lib/format.js).
 *
 * cells: [{ iso, level, n, vol, min, noted, today, future }] in order, 7 a week. `noted` is a day
 * with no workout that `hasNote(iso)` says has a note. months: [{ week, month }], the column where
 * a new month's label goes (month is 0 to 11, for the caller to name). Nothing is formatted here.
 */
export function activityGrid({ workouts, weekStart, metric, now = new Date(), hasNote, weeks = HEATMAP_WEEKS }) {
  const totals = totalsByDay(workouts)
  const thresholds = levelThresholds(totals, metric)
  const today = new Date(now); today.setHours(12, 0, 0, 0)
  const todayIso = isoOf(today)
  const end = new Date(today); end.setDate(today.getDate() - weekDayOffset(today.getDay(), weekStart))
  const start = new Date(end); start.setDate(end.getDate() - (weeks - 1) * 7)

  const cells = [], months = []
  let lastMonth = -1
  for (let wk = 0; wk < weeks; wk++) {
    const colStart = new Date(start); colStart.setDate(start.getDate() + wk * 7)
    const month = colStart.getMonth()
    // A month's label goes over the week its first days fall in; the last two columns have no room for one
    if (month !== lastMonth && colStart.getDate() <= 7 && wk < weeks - 2) months.push({ week: wk, month })
    if (colStart.getDate() <= 7) lastMonth = month
    for (let d = 0; d < 7; d++) {
      const day = new Date(colStart); day.setDate(colStart.getDate() + d)
      const iso = isoOf(day)
      const total = totals[iso]
      cells.push({
        iso,
        level: levelOf(total, metric, thresholds),
        n: total?.n ?? 0,
        vol: total?.vol ?? 0,
        min: total?.min ?? 0,
        noted: !total && !!hasNote?.(iso),
        today: iso === todayIso,
        future: day > today,
      })
    }
  }
  return { cells, months, totals }
}
