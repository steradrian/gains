import { cx, oneOf } from '../lib/ui-kit.js'

const LABEL_ROW = 20   // the strip under the bars that holds their short labels, in px

// Rounded bars with a short label under each, one drawn at full strength and the rest dimmed, and
// an optional dashed target line (bundle.js `BarChart`). Seven to twelve bars; no axes.
//
// The kit formats nothing. `label` is the caller's sentence for the whole chart. A chart that
// needs more than that for a screen reader passes `barLabels[i]` ("Week of 12 Oct: 14 t"), a
// hidden list with one line per bar; without it the chart is one image with `label` as its name.
// Bars run left to right in every language, like LineChart's time axis.
export default function BarChart({ values, labels, highlight, target, color, height = 150, label, barLabels, tone = 'light' }) {
  oneOf('BarChart', 'tone', tone, ['light', 'stage'])
  const top = Math.max(...values, target || 1)
  const listed = Array.isArray(barLabels) && barLabels.length > 0
  return (
    <div className={cx('g-chart', 'g-bars-card', tone === 'stage' && 'g-chart-stage')} dir="ltr"
      role={listed ? 'group' : 'img'} aria-label={label} style={color ? { '--g-bar': color } : undefined}>
      <div className="g-bars" style={{ height: height + LABEL_ROW }} aria-hidden={listed ? 'true' : undefined}>
        {target > 0 && <span className="g-bars-target" style={{ bottom: LABEL_ROW + (target / top) * height }} />}
        {values.map((v, i) => (
          <span key={i} className="g-bar">
            <span className="g-bar-col" style={{ height }}>
              <i className={cx(highlight != null && highlight !== i && 'g-bar-dim')} style={{ height: Math.max((v / top) * height, 3) }} />
            </span>
            <small>{labels?.[i]}</small>
          </span>
        ))}
      </div>
      {listed && <ul className="g-sr">{barLabels.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  )
}
