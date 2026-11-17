import Icon from '../../components/Icon.jsx'
import { fmtDur } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { lengthOf } from '../../lib/nutrition/fasting.js'
import { dateText, timeText } from './fast-format.js'

// Finished fasts, newest first (board Ea6Fasting): the day, start to end, and how long. Each row
// has a Remove, named by its day, which asks first (the hub keeps no undo for a deleted fast).
export default function FastRecentList({ history, hour12, onRemove }) {
  return (
    <ul className="g-fast-rows g-glass">
      {history.map(f => {
        const start = Date.parse(f.start_at)
        return (
          <li key={f.id} className="g-fast-row">
            <span className="g-fast-row-body">
              <b>{dateText(start)}</b>
              <span>{t('{0} to {1}', timeText(start, hour12), timeText(Date.parse(f.end_at), hour12))}</span>
            </span>
            <span className="g-fast-row-dur">{fmtDur(lengthOf(f))}</span>
            <button type="button" className="g-fast-row-x" onClick={() => onRemove(f)} aria-label={t('Delete fast {0}', dateText(start))}>
              <Icon name="trash" className="g-icon" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
