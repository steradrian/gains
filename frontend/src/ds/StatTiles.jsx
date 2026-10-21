import { cx, oneOf } from '../lib/ui-kit.js'

// Tiles of numbers (bundle.js `StatTiles`): each a label, a value and an optional line under it.
// `tone="stage"` turns them to glass with white text for a pushed page on the stage (Week's
// Numbers, boards Sh2Week, Sh2WeekPast). items: [{ key, label, value, sub, tone: 'positive' }].
// `columns` defaults to the bundle's (as many as there are tiles, at most three); Week sets two.
export default function StatTiles({ items, tone = 'light', columns }) {
  oneOf('StatTiles', 'tone', tone, ['light', 'stage'])
  const n = columns || Math.min(items.length, 3)
  return (
    <div className={cx('g-stats', tone === 'stage' && 'g-stats-stage')} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
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
