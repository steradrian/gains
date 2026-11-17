import { useState } from 'react'
import { cx, oneOf } from '../lib/ui-kit.js'

const PAD = 14          // room above and below the line, in the plot's own px
const MAX_ROWS = 62     // the hidden list of points is thinned past this, the last point always kept
const DAY = 86400000

const timeOf = iso => new Date(iso + 'T12:00:00').getTime()

// A line over dates (board Me2Body): points sit where their day falls, not evenly spaced, so a gap
// in weighing reads as a gap. `points` is [{ d: 'YYYY-MM-DD', v }], oldest first. `axis` is the dates
// to name under the line, [{ d, text }]; a date outside the points' span is left out. `target` draws
// a dashed line at that value with `targetCaption` over its start, and counts in the scale.
//
// The kit formats nothing. The caller writes what a screen reader hears (`label`), and per point
// `pointLabels[i]` ("Sun 18 Oct: 81.4 kg"): the readout on hover or touch and the hidden list both
// use it. Without them a point reads as its number and `unit`. The time axis runs left to right in
// every language (dir="ltr"). Built beside LineChart, whose chart styles it shares (ds.css).
export default function TrendChart({ points, axis = [], target, targetCaption, pointLabels, unit, label, tone = 'stage', height = 160, width = 326 }) {
  oneOf('TrendChart', 'tone', tone, ['light', 'stage'])
  const [hover, setHover] = useState(null)
  const n = points.length
  if (n === 0) return null

  const times = points.map(p => timeOf(p.d))
  const t0 = times[0], span = (times[n - 1] - t0) || DAY
  const xOf = time => (n > 1 ? Math.min(1, Math.max(0, (time - t0) / span)) : 1)
  const xs = times.map(xOf)
  const hasTarget = typeof target === 'number' && Number.isFinite(target)
  const scale = hasTarget ? [...points.map(p => p.v), target] : points.map(p => p.v)
  const mn = Math.min(...scale), mx = Math.max(...scale), range = (mx - mn) || 1
  const yOf = v => height - PAD - ((v - mn) / range) * (height - PAD * 2)
  const ys = points.map(p => yOf(p.v))
  const pts = points.map((_, i) => (xs[i] * width).toFixed(1) + ',' + ys[i].toFixed(1))
  const area = n > 1 ? `M${pts[0]} L${pts.slice(1).join(' L')} L${width},${height} L0,${height} Z` : ''
  const textOf = i => (pointLabels?.[i] ?? String(points[i].v) + (unit ? ' ' + unit : ''))

  const at = hover != null && hover < n ? hover : null
  const move = e => {
    const r = e.currentTarget.getBoundingClientRect()
    if (!r.width) return
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    // The nearest point by date.
    const time = t0 + f * span
    let best = 0
    times.forEach((tm, i) => { if (Math.abs(tm - time) < Math.abs(times[best] - time)) best = i })
    setHover(best)
  }

  const step = Math.ceil(n / MAX_ROWS)
  const rows = points.map((_, i) => i).filter(i => i % step === 0)
  if (rows[rows.length - 1] !== n - 1) rows.push(n - 1)
  const ticks = axis.filter(a => { const time = timeOf(a.d); return time >= t0 && time <= times[n - 1] })

  return (
    <div className={cx('g-chart', 'g-lc', 'g-tc', tone === 'stage' && 'g-chart-stage')} dir="ltr" role="group" aria-label={label}>
      <div className="g-lc-plot" style={{ height }} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)} onPointerCancel={() => setHover(null)}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {area && <path className="g-lc-area" d={area} />}
          {hasTarget && <line className="g-tc-target" x1={0} x2={width} y1={yOf(target)} y2={yOf(target)} />}
          {n > 1 && <polyline className="g-lc-line" points={pts.join(' ')} />}
          {at != null && <line className="g-lc-cursor" x1={xs[at] * width} x2={xs[at] * width} y1={0} y2={height} />}
        </svg>
        {hasTarget && targetCaption && <span className="g-tc-cap" style={{ top: yOf(target) }}>{targetCaption}</span>}
        <i className="g-lc-dot" style={{ left: xs[n - 1] * 100 + '%', top: ys[n - 1] }} aria-hidden="true" />
        {at != null && <i className="g-lc-dot g-lc-dot-on" style={{ left: xs[at] * 100 + '%', top: ys[at] }} aria-hidden="true" />}
        {at != null && <span className="g-lc-tip" style={{ '--x': xs[at] * 100 + '%' }} aria-hidden="true">{textOf(at)}</span>}
      </div>
      {ticks.length > 0 && (
        <div className="g-tc-x" aria-hidden="true">
          {ticks.map(a => {
            const x = xOf(timeOf(a.d))
            return <span key={a.d} className={cx(x <= 0.02 && 'g-tc-first', x >= 0.98 && 'g-tc-last')} style={{ '--x': x * 100 + '%' }}>{a.text}</span>
          })}
        </div>
      )}
      <ul className="g-sr">{rows.map(i => <li key={i}>{textOf(i)}</li>)}</ul>
    </div>
  )
}
