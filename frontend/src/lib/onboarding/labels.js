// The words for the onboarding's choice values, in the UI language. Literal t() calls, so the
// source-string check sees every key.
import { t } from '../i18n-core.js'

export const experienceLabel = v => ({ new: t('New to lifting'), returning: t('Coming back'), regular: t('Lift regularly') }[v])
export const equipmentLabel = v => ({ gym: t('Full gym'), dumbbells: t('Dumbbells only'), none: t('No equipment') }[v])

export const EXPERIENCE_OPTIONS = () => ['new', 'returning', 'regular'].map(value => ({ value, label: experienceLabel(value) }))
export const EQUIPMENT_OPTIONS = () => ['gym', 'dumbbells', 'none'].map(value => ({ value, label: equipmentLabel(value) }))

// The Summary's target (boards O2.12, O2.12a, O2.12d). "Not sure" is kept as keeping the weight.
export const goalLabel = v => ({ lose: t('Lose weight'), keep: t('Keep my weight'), unsure: t('Keep my weight'), build: t('Build muscle') }[v])
export const paceLabel = v => ({ gentle: t('Gentle'), steady: t('Steady'), faster: t('Faster') }[v])
export const modeLabel = v => ({ adaptive: t('Adaptive'), fixed: t('Fixed') }[v])
export const PACE_OPTIONS = () => ['gentle', 'steady', 'faster'].map(value => ({ value, label: paceLabel(value) }))
export const MODE_OPTIONS = () => ['adaptive', 'fixed'].map(value => ({ value, label: modeLabel(value) }))

/** What a day is mostly: the Summary's chip (its icon and line) and the sheet's choices. */
export const ACTIVITY_OPTIONS = () => [
  { value: 'sitting', icon: 'armchair', chip: t('Assumes a mostly-seated day'), title: t('Mostly sitting'), sub: t('Desk, car, sofa') },
  { value: 'on_feet', icon: 'footprints', chip: t('Assumes a day on your feet'), title: t('On my feet'), sub: t('Shop floor, classroom, lots of walking') },
  { value: 'physical', icon: 'hammer', chip: t('Assumes a day of physical work'), title: t('Physical work'), sub: t('Building site, warehouse, farm') },
]

/** "Monday", "Mon", "M" for a DAYN weekday (0 Sunday), in the UI's date locale. */
export function weekdayName(day, locale, style = 'long') {
  // 2023-01-01 was a Sunday.
  const d = new Date(Date.UTC(2023, 0, 1 + day, 12))
  return d.toLocaleDateString(locale, { weekday: style, timeZone: 'UTC' })
}
