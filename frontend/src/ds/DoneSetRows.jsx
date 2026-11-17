import { useLayoutEffect, useRef } from 'react'
import Icon from '../components/Icon.jsx'
import { emerge } from '../lib/use-slide.js'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// The sets already done, one glass row each (boards W1.3, W1.8, W1.36): a tick, the name ("Set 1"),
// the NEW BEST tag when it earned one, and what was done ("80 kg × 8"). Each row is a button named
// by its `label` ("1, 80 kg × 8. Edit") that opens the set to fix it; a warm-up row has a hollow tick.
// Nothing draws for no rows.
//
// rows: [{ n, name, text, label, warmup?, best?, onEdit?, href? }]; `n` is the row's key, `name` and
// `text` what it says, `label` its spoken name. `bestLabel` is the tag's text ("NEW BEST"). Every
// string is the caller's.
//
// `enter` ({ n, y }) is a row that has just been added: it comes out of the viewport height `y`
// (the Done pill's centre) once; ignored when `n` is not among the rows.
export default function DoneSetRows({ rows = [], bestLabel, enter }) {
  const card = useRef(null)
  useLayoutEffect(() => {
    if (!enter) return
    const at = rows.findIndex(r => r.n === enter.n)
    if (at >= 0) emerge(card.current?.children[at], enter.y)
    // Once per `enter`: the rows re-render without being new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enter])
  if (!rows.length) return null
  return (
    <div className="g-dsr g-glass" ref={card}>
      {rows.map(r => (
        <Act key={r.n} href={r.href} onClick={r.onEdit} ariaLabel={r.label} className={cx('g-dsr-row', r.warmup && 'g-dsr-warm')}>
          <span className="g-dsr-tick"><Icon name="check" className="g-icon" /></span>
          <span className="g-dsr-n">{r.name}</span>
          {r.best && (
            <span className="g-dsr-best">
              <Icon name="trophy" className="g-icon" />
              {bestLabel}
            </span>
          )}
          <span className="g-dsr-v">{r.text}</span>
        </Act>
      ))}
    </div>
  )
}
