import Icon from '../../../components/Icon.jsx'

// A muscle's glass row on Training load: its shade's dot, the name (and a line under it), the
// value on the end, then the chevron to the muscle page. `spoken` replaces the value for a screen
// reader when the value alone is shorthand ("8/10 · 80%").
export default function LoadRow({ slug, level, title, sub, value, spoken, onClick }) {
  return (
    <button type="button" className="g-glist-row g-load-row" data-muscle-volume={slug} onClick={onClick}>
      <i className={'g-load-dot l' + level} aria-hidden="true" />
      <span className="g-glist-body"><b>{title}</b>{sub && <span>{sub}</span>}</span>
      <span className="g-load-val" aria-hidden={spoken ? 'true' : undefined}>{value}</span>
      {spoken && <span className="g-sr">{spoken}</span>}
      <Icon name="chevronRight" className="g-icon g-glist-chev" />
    </button>
  )
}
