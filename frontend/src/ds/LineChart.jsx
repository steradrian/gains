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
//
// `invert` puts the smallest value at the top, for a scale that counts down as it gets harder (reps
// in reserve: 0 is the hardest set), so up still reads as "harder". It applies to `series` too.
//
// Two optional extras, for the exercise pages:
// - `marks`: one entry per point, 0 to 1 or null. A mark is a second reading carried by the point's
//   own dot, bigger and more solid the nearer 1 (effort on a top-set line). Say it in `pointLabels`.
// - `series`: [{ values, color }], each the length of `values` with null where that line has no
//   point (one line per set number). `values` then only anchors the readout and the scale spans
//   every series; the first line is drawn widest and underneath, so lines that share their values
//   show as nested stripes. The latest-point dot and the area are not drawn for it.
export default function LineChart({ values, series, marks, labels, pointLabels, unit, tone = 'light', color, height = 150, width = 326, label, invert = false }) {
  oneOf('LineChart', 'tone', tone, ['light', 'stage'])
  const [hover, setHover] = useState(null)
  const n = values.length
  if (n === 0) return null

  const multi = Array.isArray(series) && series.length > 0
  const scale = multi ? series.flatMap(s => s.values).filter(v => v != null) : values
  const mn = Math.min(...scale), mx = Math.max(...scale), range = (mx - mn) || 1
  const xs = values.map((_, i) => (n > 1 ? i / (n - 1) : 1))
  const yOf = v => {
    const f = (v - mn) / range
    return invert ? PAD + f * (height - PAD * 2) : height - PAD - f * (height - PAD * 2)
  }
  const ys = values.map(yOf)
  const pts = values.map((_, i) => (xs[i] * width).toFixed(1) + ',' + ys[i].toFixed(1))
  const line = pts.join(' ')
  const area = n > 1 && !multi ? `M${pts[0]} L${pts.slice(1).join(' L')} L${width},${height} L0,${height} Z` : ''
  // A series' runs of consecutive points; a lone point is drawn by its dot.
  const runs = vals => {
    const out = []
    let run = []
    vals.forEach((v, i) => {
      if (v == null) { if (run.length) out.push(run); run = []; return }
      run.push((xs[i] * width).toFixed(1) + ',' + yOf(v).toFixed(1))
    })
    if (run.length) out.push(run)
    return out.filter(r => r.length > 1)
  }
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
    <div className={cx('g-chart', 'g-lc', tone === 'stage' && 'g-chart-stage g-glass')} dir="ltr" role="group" aria-label={label}
      style={color ? { '--g-lc': color } : undefined}>
      <div className="g-lc-plot" style={{ height }} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)} onPointerCancel={() => setHover(null)}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {area && <path className="g-lc-area" d={area} />}
          {n > 1 && !multi && <polyline className="g-lc-line" points={line} />}
          {multi && series.map((s, k) => runs(s.values).map((r, j) => (
            <polyline key={k + ':' + j} className="g-lc-series" points={r.join(' ')}
              style={{ '--g-s': s.color, '--g-sw': 2 + (series.length - 1 - k) * 2.4 + 'px' }} />
          )))}
          {at != null && <line className="g-lc-cursor" x1={xs[at] * width} x2={xs[at] * width} y1={0} y2={height} />}
        </svg>
        {multi && series.map((s, k) => s.values.map((v, i) => v == null ? null : (
          <i key={k + ':' + i} className="g-lc-sdot" aria-hidden="true"
            style={{ left: xs[i] * 100 + '%', top: yOf(v), '--g-s': s.color, '--g-sw': 2 + (series.length - 1 - k) * 2.4 + 'px' }} />
        )))}
        {marks && marks.map((m, i) => m == null ? null : (
          <i key={'m' + i} className="g-lc-mark" aria-hidden="true"
            style={{ left: xs[i] * 100 + '%', top: ys[i], '--g-m': 5 + m * 6 + 'px', '--g-mo': 0.3 + m * 0.7 }} />
        ))}
        {!multi && <i className="g-lc-dot" style={{ left: xs[n - 1] * 100 + '%', top: ys[n - 1] }} aria-hidden="true" />}
        {at != null && <i className="g-lc-dot g-lc-dot-on" style={{ left: xs[at] * 100 + '%', top: ys[at] }} aria-hidden="true" />}
        {at != null && <span className="g-lc-tip" style={{ '--x': xs[at] * 100 + '%' }} aria-hidden="true">{textOf(at)}</span>}
      </div>
      {labels && labels.length > 0 && <div className="g-lc-x" aria-hidden="true">{labels.map((l, i) => <span key={i}>{l}</span>)}</div>}
      <ul className="g-sr">{rows.map(i => <li key={i}>{textOf(i)}</li>)}</ul>
    </div>
  )
}
