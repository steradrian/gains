// One option of a choice where exactly one applies, on a light drawer (bundle.js `RadioRow`: the
// Plan day choices, a fasting plan, units). The caller wraps the rows in a group it names:
// `<div role="radiogroup" aria-label={…}>`. Choosing applies at once (no Save button), and the
// mark fills when `selected`, announced as checked. `href` makes it a link, `onClick` a button;
// `tabIndex` lets the group make only its selected row a tab stop.
export default function RadioRow({ title, sub, selected = false, href, onClick, tabIndex }) {
  const kids = (
    <>
      <span className="g-radio-body"><b>{title}</b>{sub && <span>{sub}</span>}</span>
      <span className={selected ? 'g-radio-mark on' : 'g-radio-mark'} aria-hidden="true" />
    </>
  )
  if (href) {
    return <a href={href} onClick={onClick} className="g-radio" role="radio" aria-checked={selected} tabIndex={tabIndex}>{kids}</a>
  }
  return <button type="button" onClick={onClick} className="g-radio" role="radio" aria-checked={selected} tabIndex={tabIndex}>{kids}</button>
}
