import { t } from '../../../lib/i18n.js'
import '../coach-pages.css'

// What a profile has, as a checklist on a light drawer (T12.1): one row per equipment type, each a
// checkbox that says whether it is ticked. The rows are the radio rows' look (ds RadioRow), but a
// choice of several, so they are checkboxes in a group the caller names. `items` are the catalogue's
// equipment words; `checked` is a Set of them.
export default function EquipmentChecklist({ items, checked, onToggle, label }) {
  return (
    <div role="group" aria-label={label}>
      {items.map(k => {
        const on = checked.has(k)
        return (
          <button key={k} type="button" role="checkbox" aria-checked={on} className="g-radio tcp-check" onClick={() => onToggle(k)}>
            <span className="g-radio-body"><b>{t(k)}</b></span>
            <span className={on ? 'g-radio-mark on' : 'g-radio-mark'} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
