import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'

// The design system's "Logging to" chip (bundle.js `WhenChip`): the day and meal a log goes to,
// tapped to change them. Today's drawers name it in their header chip (BottomSheet `chip`); this
// is the inline form for the pages that log without a drawer.
export default function WhenChip({ day, meal, onClick }) {
  const where = meal ? day + ', ' + meal : day
  return (
    <button type="button" className="g-chip g-chip-when" onClick={onClick}
      aria-label={meal ? t('Logging to {0}, {1}. Change meal', day, meal) : t('Logging to {0}', day)}>
      <Icon name="calendar" className="g-icon" />
      <span>{t('Logging to')} <b>{where}</b></span>
      <Icon name="chevronDown" className="g-icon" />
    </button>
  )
}
