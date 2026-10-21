import { cx, oneOf } from '../lib/ui-kit.js'

// Tiles of numbers (bundle.js `StatTiles`): each a label, a value and an optional line under it.
// `tone="stage"` turns them to glass with white text for a pushed page on the stage (Week's
// Numbers, boards Sh2Week, Sh2WeekPast). items: [{ key, label, value, sub, tone: 'positive' }].
// `columns` (1 to 3) defaults to the bundle's (as many as there are tiles, at most three); Week
// sets two. The columns are a class (.g-stats-c1 to -c3), not an inline style.
export default function StatTiles({ items, tone = 'light', columns }) {
  oneOf('StatTiles', 'tone', tone, ['light', 'stage'])
  const n = Math.min(Math.max(columns || items.length, 1), 3)
  return (
    <div className={cx('g-stats', 'g-stats-c' + n, tone === 'stage' && 'g-stats-stage')}>
      {items.map(s => (
        <div key={s.key || s.label} className="g-stat">
          <span>{s.label}</span>
          <b>{s.value}</b>
          {s.sub && <span className={s.tone === 'positive' ? 'g-pos' : undefined}>{s.sub}</span>}
        </div>
      ))}
    </div>
  )
}
