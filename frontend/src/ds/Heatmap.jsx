import { useEffect, useRef } from 'react'
import { cx, oneOf } from '../lib/ui-kit.js'

// A grid of days shaded by how much happened (bundle.js `Heatmap`), in two shapes:
//   rows (the DS's): `cols` days to a row, row by row, for a few weeks in a card.
//   byWeek: a year. `values` runs week by week, 7 to a week (the first day of each week first), and
//     each week is a column. It scrolls sideways, starting at the latest week, and `months` puts the
//     axis labels over it: [{ week: columnIndex, label }], the caller's words.
// `values` are levels from 0 up to `levels - 1`: 3 shades (nothing, some, a lot; the DS's) or 5.
// Columns follow the page's direction, so in a right-to-left language the oldest week is at the right.
//
// The kit has no copy. `label` names the grid for a screen reader. `days[i]` says what cell i is:
// { iso, label, today, future, noted }. A cell is a button (aria-label = its `label`) only when
// `onDay` is set and the day has an `iso`; give a day with nothing to open no iso. Without
// `onDay` the grid is one image named by `label`. `legend` is { less, more }, the caller's words.
export default function Heatmap({ values, cols = 7, label, tone = 'light', levels = 3, byWeek, months, days, onDay, legend }) {
  oneOf('Heatmap', 'tone', tone, ['light', 'stage'])
  oneOf('Heatmap', 'levels', levels, [3, 5])
  const scroller = useRef(null)
  const weeks = Math.ceil(values.length / 7)

  // Opens on the latest week. scrollLeft counts from the start edge, which is the right edge in rtl.
  useEffect(() => {
    const el = scroller.current
    if (!byWeek || !el) return
    const rtl = typeof getComputedStyle === 'function' && getComputedStyle(el).direction === 'rtl'
    el.scrollLeft = rtl ? -(el.scrollWidth - el.clientWidth) : el.scrollWidth
  }, [byWeek, weeks])

  const interactive = typeof onDay === 'function'
  const shade = v => Math.max(0, Math.min(levels - 1, v))
  const cells = values.map((v, i) => {
    const d = days?.[i]
    const cls = cx('g-heat-c', 'g-heat-' + shade(v), d?.today && 'g-heat-today', d?.future && 'g-heat-future', d?.noted && 'g-heat-noted')
    if (interactive && d?.iso) {
      return <button key={i} type="button" className={cls} aria-label={d.label} title={d.label} onClick={() => onDay(d.iso)} />
    }
    return <i key={i} className={cls} title={d?.label} />
  })

  return (
    <div className={cx('g-heat', 'g-heat-n' + levels, byWeek && 'g-heat-weeks', tone === 'stage' && 'g-heat-stage g-glass')}
      role={interactive ? 'group' : 'img'} aria-label={label}>
      <div className="g-heat-scroll" ref={scroller}>
        {byWeek && months?.length > 0 && (
          <div className="g-heat-months" aria-hidden="true">
            {months.map(m => <span key={m.week} style={{ gridColumnStart: m.week + 1 }}>{m.label}</span>)}
          </div>
        )}
        <div className="g-heat-grid" style={byWeek ? undefined : { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {cells}
        </div>
      </div>
      {legend && (
        <div className="g-heat-legend">
          {legend.less}
          {Array.from({ length: levels }, (_, k) => <i key={k} className={'g-heat-' + k} aria-hidden="true" />)}
          {legend.more}
        </div>
      )}
    </div>
  )
}
