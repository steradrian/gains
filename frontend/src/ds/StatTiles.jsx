import { cx, oneOf } from '../lib/ui-kit.js'

// A row of two or three tiles, each a label, a value and an optional line under it (bundle.js
// `StatTiles`). `tone="stage"` is the glass version for a pushed page on the stage. The caller
// formats the values and the line: the kit only lays them out. items: [{ label, value, sub,
// tone: 'positive' }]; more than three items wrap onto a second row of three.
export default function StatTiles({ items, tone = 'light' }) {
  oneOf('StatTiles', 'tone', tone, ['light', 'stage'])
  return (
    <div className={cx('g-stats', 'g-stats-' + Math.min(items.length, 3), tone === 'stage' && 'g-stats-stage')}>
      {items.map(s => (
        <div key={s.label} className="g-stat">
          <span>{s.label}</span>
          <b>{s.value}</b>
          {s.sub && <span className={s.tone === 'positive' ? 'g-pos' : undefined}>{s.sub}</span>}
        </div>
      ))}
    </div>
  )
}
