import Button from '../../ds/Button.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import { t } from '../../lib/i18n.js'
import { planLabelOf } from '../../lib/nutrition/fasting.js'
import FastPlanChips from './FastPlanChips.jsx'

// Fasting is off (board Ea6Off): what turning it on gives, the plan to start with and Turn on.
// The plan chosen here is the one the first fast would use.
export default function FastOffCard({ hours, busy, onPick, onTurnOn }) {
  return <>
    <StageEmpty card={false} illustration="plate" title={t('Fasting is off')}
      body={t('Turn it on to time your fasts, see streaks and get a Fast row on Today and in the + sheet.')} />
    <div className="g-fast-off">
      <FastPlanChips hours={hours} onPick={onPick} tone="stage" isCustom={planLabelOf(hours) === null} />
      <Button block busy={busy} onClick={onTurnOn}>{t('Turn on fasting, {0}', planLabelOf(hours) ?? t('{0} h', hours))}</Button>
    </div>
    <StageNote>{t('Your plan can change any time. Turning fasting off keeps your history.')}</StageNote>
  </>
}
