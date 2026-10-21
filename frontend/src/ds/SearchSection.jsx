import { useId } from 'react'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// A section of the search on the stage (bundle.js `SearchSection`, boards Sh0*): an uppercase
// heading, an optional action on its right ("Clear", "See all 4"), and its rows in one glass card.
// `card={false}` leaves the children bare (a best match, a feature card). `groupProps` go onto the
// card (a listbox group's role); the heading names it.
export default function SearchSection({ title, action, onAction, actionHref, card = true, groupProps, children }) {
  const id = useId()
  return (
    <section className="g-ssect g-ssect-stage" aria-labelledby={title ? id : undefined}>
      {(title || action) && <div className="g-ssect-h">
        {title && <h2 id={id}>{title}</h2>}
        {action && <Act href={actionHref} onClick={onAction} className="g-ssect-act">{action}</Act>}
      </div>}
      {card
        ? <div {...groupProps} className={cx('g-scard', 'g-glass', groupProps?.className)} aria-labelledby={groupProps?.role && title ? id : undefined}>{children}</div>
        : children}
    </section>
  )
}
