// Liquid glass numbers for the dev HUD (#/dev/glass, M3's device gate). Each series keeps timestamped
// samples; a summary covers the last `windowMs` of samples *before the newest one*, not of wall time, so
// after a fling stops the HUD keeps showing that fling until the next one. `max` holds since `reset()`.

const CAP = 600 // samples per series: 2 s at 120 Hz, with room

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]

/** @param {{ windowMs?: number }} opts */
export function createStats({ windowMs = 2000 } = {}) {
  /** @type {Map<string, { t: number[], v: number[], max: number }>} */
  const series = new Map()
  const gauges = {}

  const of = name => {
    let s = series.get(name)
    if (!s) { s = { t: [], v: [], max: 0 }; series.set(name, s) }
    return s
  }

  /** Adds one sample (`t` in ms, performance.now() time). */
  function push(name, value, t) {
    if (!Number.isFinite(value)) return
    const s = of(name)
    s.t.push(t)
    s.v.push(value)
    if (s.t.length > CAP) { s.t.shift(); s.v.shift() }
    if (value > s.max) s.max = value
  }

  /** { p50, p95, max, n } over the window ending at the series' newest sample; null with no samples. */
  function summary(name) {
    const s = series.get(name)
    if (!s || !s.t.length) return null
    const end = s.t[s.t.length - 1]
    const vals = []
    for (let i = s.t.length - 1; i >= 0 && end - s.t[i] <= windowMs; i--) vals.push(s.v[i])
    vals.sort((a, b) => a - b)
    return { p50: pct(vals, 0.5), p95: pct(vals, 0.95), max: s.max, n: vals.length }
  }

  const set = (name, value) => { gauges[name] = value }

  function snapshot() {
    const out = { gauges: { ...gauges } }
    for (const name of series.keys()) out[name] = summary(name)
    return out
  }

  function reset() {
    series.clear()
  }

  return { push, summary, set, snapshot, reset }
}
