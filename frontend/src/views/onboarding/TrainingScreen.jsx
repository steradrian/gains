import StepScreen from '../../components/onboarding/StepScreen.jsx'
import WeekScene from '../../components/onboarding/scenes/WeekScene.jsx'
import StageDayCount from '../../ds/StageDayCount.jsx'
import StageWeekStrip from '../../ds/StageWeekStrip.jsx'
import { dateLocale, t } from '../../lib/i18n.js'
import { useOnboarding } from '../../lib/onboarding/contexts.js'
import { weekdayName } from '../../lib/onboarding/labels.js'
import { WEEK, suggestedDays } from '../../lib/onboarding/plans.js'
import { useLater } from '../../lib/onboarding/use-later.js'

// 4 Training (§3b; board O2.8): days a week only, 0-6 (the hub takes no more). The suggested days
// light up in the scene and in the week under the keys, Monday first. 0 is "Just tracking food"
// and goes to the end; any other number to the Plan step. A tap moves on (600ms); Skip in the nav
// goes to the end.
const DAYS = [0, 1, 2, 3, 4, 5, 6]

export default function TrainingScreen() {
  const { state, act, saveHubStep, next } = useOnboarding()
  const days = state.answers.trainingDays ?? null
  const later = useLater()
  const pick = (n, { viaKey }) => {
    act({ type: 'training', days: n })
    saveHubStep('training')
    if (!viaKey) later(() => next('training'), 600)
  }
  const locale = dateLocale()
  const suggested = days ? suggestedDays(days) : []
  const caption = days === null ? ''
    : days === 0 ? t('Just tracking food. You can add training any time.')
      : t('Suggested: {0}. Move them later in Plan.', suggested.map(d => weekdayName(d, locale)).join(', '))
  return (
    <StepScreen titleId="ob-days-t" title={t('How often do you train?')} sub={t('Days a week. Pick 0 if you’re only tracking food.')}
      stage={<WeekScene days={days} lit={suggested.map(d => WEEK.indexOf(d))} experience={state.starter?.experience} />} stageSize="md">
      <StageDayCount values={DAYS} value={days} onPick={pick} labelledBy="ob-days-t"
        labelOf={n => (n === 0 ? t('0, just tracking food') : undefined)} />
      <StageWeekStrip days={WEEK.map(d => ({ key: d, label: weekdayName(d, locale, 'short'), lit: suggested.includes(d) }))} />
      <p className="ob-cap ob-days-cap" aria-live="polite">{caption}</p>
    </StepScreen>
  )
}
