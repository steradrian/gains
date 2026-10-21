import { useState } from 'react'
import { cx, oneOf } from '../lib/ui-kit.js'

const PAD = 10          // room above and below the line, in the plot's own px
const MAX_ROWS = 62     // the hidden list of points is thinned past this, the last point always kept

// One line with its latest point marked (bundle.js `LineChart`), now with the two things the app's
// chart had: a readout on hover or touch, and a list of the points for a screen reader.
//
// The kit formats nothing. The caller writes what a screen reader hears (`label`, the whole chart
// in a sentence) and, per point, `pointLabels[i]` ("Mon 12 Oct: 96 kg"): the readout and the hidden
// list both use it. Without pointLabels a point reads as its number and `unit`, unformatted.
// `labels` is the axis under the line ("Jul", "Aug"), spread evenly; it is for sighted users only.
//
// The time axis runs left to right in every language (dir="ltr" on the chart), so a trend never
// reads backwards; the numbers and labels inside are the caller's own strings.
export default function LineChart({ values, labels, pointLabels, unit, tone = 'light', color, height = 150, width = 326, label }) {
  oneOf('LineChart', 'tone', tone, ['light', 'stage'])
  const [hover, setHover] = useState(null)
  const n = values.length
  if (n === 0) return null

  const mn = Math.min(...values), mx = Math.max(...values), range = (mx - mn) || 1
  const xs = values.map((_, i) => (n > 1 ? i / (n - 1) : 1))
  const ys = values.map(v => height - PAD - ((v - mn) / range) * (height - PAD * 2))
  const pts = values.map((_, i) => (xs[i] * width).toFixed(1) + ',' + ys[i].toFixed(1))
  const line = pts.join(' ')
  const area = n > 1 ? `M${pts[0]} L${pts.slice(1).join(' L')} L${width},${height} L0,${height} Z` : ''
  const textOf = i => (pointLabels?.[i] ?? String(values[i]) + (unit ? ' ' + unit : ''))

  const at = hover != null && hover < n ? hover : null
  const move = e => {
    const r = e.currentTarget.getBoundingClientRect()
    if (!r.width) return
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    setHover(n > 1 ? Math.round(f * (n - 1)) : 0)
  }

  const step = Math.ceil(n / MAX_ROWS)
  const rows = values.map((_, i) => i).filter(i => i % step === 0)
  if (rows[rows.length - 1] !== n - 1) rows.push(n - 1)

  return (
    <div className={cx('g-chart', 'g-lc', tone === 'stage' && 'g-chart-stage')} dir="ltr" role="group" aria-label={label}
      style={color ? { '--g-lc': color } : undefined}>
      <div className="g-lc-plot" style={{ height }} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)} onPointerCancel={() => setHover(null)}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {area && <path className="g-lc-area" d={area} />}
          {n > 1 && <polyline className="g-lc-line" points={line} />}
          {at != null && <line className="g-lc-cursor" x1={xs[at] * width} x2={xs[at] * width} y1={0} y2={height} />}
        </svg>
        <i className="g-lc-dot" style={{ left: xs[n - 1] * 100 + '%', top: ys[n - 1] }} aria-hidden="true" />
        {at != null && <i className="g-lc-dot g-lc-dot-on" style={{ left: xs[at] * 100 + '%', top: ys[at] }} aria-hidden="true" />}
        {at != null && <span className="g-lc-tip" style={{ '--x': xs[at] * 100 + '%' }} aria-hidden="true">{textOf(at)}</span>}
      </div>
      {labels && labels.length > 0 && <div className="g-lc-x" aria-hidden="true">{labels.map((l, i) => <span key={i}>{l}</span>)}</div>}
      <ul className="g-sr">{rows.map(i => <li key={i}>{textOf(i)}</li>)}</ul>
    </div>
  )
}
