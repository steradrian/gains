import { m } from 'motion/react'
import { dateLocale, t } from '../../lib/i18n.js'
import { LIST_CONTAINER, LIST_ITEM } from '../../lib/motion.js'
import { Button } from '../ui.jsx'
import ResultRow from './ResultRow.jsx'

// One group of results (ui-search.md §7): a real h2 with its count, its rows in an inset card
// stepping in 30 ms apart, and "Show all N" under the card when there are more than it shows.
// `status` replaces the rows of a slow source (a skeleton, a note) in the same place.
export default function ResultGroup({ id, title, rows, total = rows.length, onOpen, onShowAll, status }) {
  return (
    <section className="sr-sect" role="group" aria-labelledby={id + '-t'}>
      <div className="sr-sect-h">
        <h2 id={id + '-t'} className="sr-sect-t">{title}</h2>
        {total > 0 && <span className="sr-sect-n">{total.toLocaleString(dateLocale())}</span>}
      </div>
      <div className="sr-card">
        {status || <m.div variants={LIST_CONTAINER} initial="hidden" animate="show">
          {rows.map(r => <m.div key={r.key} variants={LIST_ITEM}><ResultRow r={r} onOpen={onOpen} /></m.div>)}
        </m.div>}
      </div>
      {onShowAll && total > rows.length && <div className="sr-more">
        <Button size="sm" variant="plain" onClick={onShowAll}>{t('Show all {0}', total.toLocaleString(dateLocale()))}</Button>
      </div>}
    </section>
  )
}
