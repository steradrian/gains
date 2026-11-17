import { t } from '../../lib/i18n.js'
import { MODE_OPTIONS, PACE_OPTIONS } from '../../lib/onboarding/labels.js'
import { TARGET_SETTINGS } from '../../lib/onboarding/use-target.js'
import { SheetActions, SheetHeader } from '../sheet-layout.jsx'
import { Button, Segmented } from '../ui.jsx'

// The Summary's Adjust (board O2.12a, in the app's own sheet until the light drawer comes
// app-wide): the target's pace and whether it adapts. Shown, not changed: the hub's onboarding
// contract has no pace and always starts the goal Adaptive (use-target.js TARGET_SETTINGS), so the
// other choices are there to read and cannot be picked.
const readOnly = (options, value) => options.map(o => ({ ...o, disabled: o.value !== value }))

export default function AdjustSheet({ close }) {
  return <>
    <SheetHeader title={t('Adjust your target')} onClose={close} />
    <div className="ob-slbl" aria-hidden="true">{t('Pace')}</div>
    <Segmented ariaLabel={t('Pace')} options={readOnly(PACE_OPTIONS(), TARGET_SETTINGS.pace)} value={TARGET_SETTINGS.pace} onChange={() => {}} />
    <div className="ob-slbl ob-slbl-next" aria-hidden="true">{t('Mode')}</div>
    <Segmented ariaLabel={t('Mode')} options={readOnly(MODE_OPTIONS(), TARGET_SETTINGS.mode)} value={TARGET_SETTINGS.mode} onChange={() => {}} />
    <p className="ob-sheet-text ob-sheet-gap">{t('Adaptive starts from this number and adjusts to your logs over about 3 weeks. Fixed keeps it where you set it.')}</p>
    <SheetActions>
      <Button variant="primary" onClick={close}>{t('Done')}</Button>
    </SheetActions>
  </>
}
