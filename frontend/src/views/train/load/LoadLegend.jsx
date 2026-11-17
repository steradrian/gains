// The key under a muscle map, in the map's own five shades. Either a ramp, `less` to `more` over
// all five, or `keys`: named shades ("Fatigued", level 4). The map and the rows say the same
// thing in words, so the swatches are hidden from a screen reader.
export default function LoadLegend({ less, more, keys }) {
  if (keys) {
    return (
      <div className="g-load-legend" aria-hidden="true">
        {keys.map(k => <span key={k.label}><i className={'g-load-dot l' + k.level} />{k.label}</span>)}
      </div>
    )
  }
  return (
    <div className="g-load-legend" aria-hidden="true">
      <span>{less}</span>
      {[0, 1, 2, 3, 4].map(l => <i key={l} className={'g-load-dot l' + l} />)}
      <span>{more}</span>
    </div>
  )
}
