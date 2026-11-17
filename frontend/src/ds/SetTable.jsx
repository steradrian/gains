import Icon from '../components/Icon.jsx'
import { NumberField } from '../components/ui.jsx'
import { cx } from '../lib/ui-kit.js'

// The sets of one exercise as a table (boards T5.5): a header, a row each, Add set at the foot.
// `columns` are the four headers (Set, Reps, Weight, Rest, or what the mode calls them) and every
// row holds one cell for each. A cell is one of
//   { value, onChange, label, decimal, min }  a number field, named for a screen reader by `label`
//                                              ("Set 2 reps"); `min` holds once the field is left
//   { text, muted }                            plain text
//   { text, label, onClick, muted }            a button (the rest wheel)
//   null                                       nothing to enter ("–")
// and may carry `aux: { text, label, pressed, onClick }`, a small toggle after it (Max).
// `remove` on a row is its remove-set button, `add` the Add set button below. Every word comes from
// the caller: a mode with one value for all its sets passes one summary row.
function Cell({ cell }) {
  if (!cell) return <span className="g-sett-na" aria-hidden="true">–</span>
  let main
  if (cell.onClick) {
    main = <button type="button" className={cx('g-sett-btn', cell.muted && 'g-sett-muted')} aria-label={cell.label} onClick={cell.onClick}>{cell.text}</button>
  } else if (cell.onChange) {
    const min = cell.min
    main = (
      <span className="g-sett-num" onBlur={min != null ? () => { if ((+cell.value || 0) < min) cell.onChange(min) } : undefined}>
        <NumberField value={cell.value} decimal={!!cell.decimal} onChange={cell.onChange} aria-label={cell.label} />
      </span>
    )
  } else {
    main = <span className={cx('g-sett-t', cell.muted && 'g-sett-muted')}>{cell.text}</span>
  }
  if (!cell.aux) return main
  return (
    <span className="g-sett-with">
      {main}
      <button type="button" className="g-sett-aux" aria-label={cell.aux.label} aria-pressed={!!cell.aux.pressed} onClick={cell.aux.onClick}>{cell.aux.text}</button>
    </span>
  )
}

export default function SetTable({ columns = [], rows = [], add, label }) {
  const removable = rows.some(r => r.remove)
  const grid = removable ? ' g-sett-rm' : ''
  return (
    <div className="g-sett">
      <div role="table" aria-label={label}>
        <div className={'g-sett-row g-sett-head' + grid} role="row">
          {columns.map((c, i) => <span key={i} role="columnheader">{c}</span>)}
          {removable && <span aria-hidden="true" />}
        </div>
        {rows.map(r => (
          <div key={r.key} className={'g-sett-row' + grid} role="row">
            {(r.cells || []).map((cell, i) => <div key={i} role="cell"><Cell cell={cell} /></div>)}
            {removable && (
              <div role="cell">
                {r.remove && <button type="button" className="g-sett-rmbtn" aria-label={r.remove.label} onClick={r.remove.onClick}><Icon name="trash" className="g-icon" /></button>}
              </div>
            )}
          </div>
        ))}
      </div>
      {add && <button type="button" className="g-sett-add" disabled={add.disabled} onClick={add.onClick}><Icon name="plus" className="g-icon" />{add.label}</button>}
    </div>
  )
}
