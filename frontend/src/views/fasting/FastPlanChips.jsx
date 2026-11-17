import ChipGroup from '../../ds/ChipGroup.jsx'
import { PLANS } from '../../lib/nutrition/fasting.js'
import { t } from '../../lib/i18n.js'

const CUSTOM = 'custom'

// The built-in plans as one choice (14:10 to OMAD). `custom` adds a Custom chip, lit while
// `isCustom`; the caller then shows its own hours field.
export default function FastPlanChips({ hours, onPick, tone = 'stage', custom = false, isCustom = false, onCustom }) {
  const options = [
    ...PLANS.map(p => ({ value: p.hours, label: p.label })),
    ...(custom ? [{ value: CUSTOM, label: t('Custom') }] : []),
  ]
  return <ChipGroup tone={tone} label={t('Plan')} options={options} value={isCustom ? CUSTOM : hours}
    onChange={v => (v === CUSTOM ? onCustom?.() : onPick(v))} />
}
