import Button from '../../ds/Button.jsx'
import { t } from '../../lib/i18n.js'
import { endsAt, planLabelOf } from '../../lib/nutrition/fasting.js'
import FastPlanChips from './FastPlanChips.jsx'
import { dayTimeText, timeText } from './fast-format.js'

// The idle card (board Ea6Fasting): the next fast's start (the clock time the last one began at,
// else now), its plan and when it would end, the plan chips and Start fast, which opens the
// Start drawer.
export default function FastNextCard({ now, hour12, usualStart, hours, onPick, onStart }) {
  const start = usualStart ?? now
  const plan = planLabelOf(hours) ?? t('{0} h', hours)
  return (
    <section className="g-fast-card g-glass" aria-label={t('Next fast')}>
      <span className="g-fast-k">{t('Next fast')}</span>
      <b className="g-fast-big">{usualStart ? timeText(usualStart, hour12) : t('Now')}</b>
      <span className="g-fast-sub">{t('{0} · ends {1}', plan, dayTimeText(endsAt(start, hours), hour12))}</span>
      <FastPlanChips hours={hours} onPick={onPick} tone="stage" isCustom={planLabelOf(hours) === null} />
      <Button block onClick={onStart}>{t('Start fast')}</Button>
    </section>
  )
}
