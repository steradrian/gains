import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'

// A superset in a routine (board T5.0): its exercises bracketed together under one header line,
// "SUPERSET · 90 S REST AFTER BOTH" (`title`, then `detail`). With `onClick` the header is a
// button (the superset's name and rest), named by `label` when its words alone would not say what
// it does. `className` and `style` land on the group, which a reorder moves as one.
export default function SupersetGroup({ title, detail, onClick, label, className, style, children }) {
  const head = (
    <>
      <Icon name="link" className="g-icon" />
      <span className="g-ssg-t">{title}</span>
      {detail && <span className="g-ssg-d">· {detail}</span>}
    </>
  )
  return (
    <div className={cx('g-ssg', className)} style={style}>
      {onClick
        ? <button type="button" className="g-ssg-h" onClick={onClick} aria-label={label}>{head}<Icon name="pencil" className="g-icon g-ssg-edit" /></button>
        : <div className="g-ssg-h">{head}</div>}
      <div className="g-ssg-rows">{children}</div>
    </div>
  )
}
