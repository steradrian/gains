import { cx } from '../lib/ui-kit.js'

// Planned sets per muscle against a target band (board Tr3Plan "Weekly muscle volume"; the
// bundle's BalanceBar is one bar against one target, so this is a list of them with a band). Each
// row is the muscle and its value as text, then a bar: amber under the band's low end, white from
// it. The band (`target: [low, high]`) is drawn on every track. The scale runs to a third past the
// band's top, or to the biggest value. `rows` are `{ key, name, sets, value }`, `value` the text
// ("10 sets"); `note` is the line under them. Strings come from the caller; the bars are drawing
// only, since each row says its value in words.
export default function VolumeBars({ rows = [], target = [10, 12], note }) {
  const [low, high] = target
  const max = Math.max(high * 4 / 3, ...rows.map(r => r.sets))
  const pct = v => Math.round(v / max * 1000) / 10 + '%'
  return (
    <div className="g-vbars g-glass">
      <ul className="g-vbars-list">
        {rows.map(r => (
          <li key={r.key} className="g-vbar">
            <div className="g-vbar-top"><span>{r.name}</span><span className="g-vbar-val">{r.value}</span></div>
            <div className="g-vbar-track" aria-hidden="true" style={{ '--w': pct(r.sets), '--lo': pct(low), '--hi': pct(high) }}>
              <i className={cx('g-vbar-fill', r.sets < low && 'low')} />
              <b className="g-vbar-band" />
            </div>
          </li>
        ))}
      </ul>
      {note && <p className="g-vbars-note">{note}</p>}
    </div>
  )
}
