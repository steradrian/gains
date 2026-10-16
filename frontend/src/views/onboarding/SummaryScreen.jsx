import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui.jsx'
import { HeroMacros, HeroStatus } from '../../components/tab-kit.jsx'
import StarterBaseline from '../../components/onboarding/StarterBaseline.jsx'
import StepScreen from '../../components/onboarding/StepScreen.jsx'
import SummarySheet from '../../components/onboarding/SummarySheet.jsx'
import { dateLocale, t } from '../../lib/i18n.js'
import { useOnboarding } from '../../lib/onboarding/contexts.js'
import { bodyComplete, detourOf } from '../../lib/onboarding/flow.js'
import { handOver } from '../../lib/onboarding/handover.js'
import { weekdayName } from '../../lib/onboarding/labels.js'
import { starterSessions } from '../../lib/onboarding/plans.js'
import { useCount } from '../../lib/onboarding/use-count.js'
import { useFinish } from '../../lib/onboarding/use-finish.js'
import { COUNT, GHOST, RING_C, useSummaryMotion } from '../../lib/onboarding/use-summary-motion.js'
import { kcalText, useTarget } from '../../lib/onboarding/use-target.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'

// 6 Summary (ux-onboarding §3b; fitness-eval motion-onboarding-summary-v2): "You're all set", then
// the hero Home will show, built from Home's own kit: the training status line, the daily target
// in the ring the thread becomes, water, protein/carbs/fat, the goal with Adjust, and the activity
// chip. HeroStatus variant="target" is the kit's hero, never a copy (onboarding-guards.test.jsx);
// only the ring is the Summary's own. Without the four body answers there is no target: an open
// ghost arc, "Add my details" (only the missing steps, then back here), and the default water.
//
// Go to Home finishes the onboarding (lib/onboarding/use-finish.js) and hands over: the ring
// unwinds into the line that lands on Home's hero (lib/onboarding/handover.js). What could not be
// set up stays here, with where to put it right.
const DEFAULT_WATER_ML = 2000
const ACTIVITY_CHIP = () => ({
  sitting: t('Assumes a mostly seated day'),
  on_feet: t('Assumes a day on your feet'),
  physical: t('Assumes a day of physical work'),
})
const GOAL_LINE = () => ({
  lose: t('Lose weight'), keep: t('Keep my weight'), unsure: t('Keep my weight'), build: t('Build muscle'),
})

/** The status line: the first session, food only, the AI coach at work, or no plan yet. */
function statusOf(answers, go) {
  const days = answers.trainingDays
  const plan = answers.plan
  if (plan?.kind === 'coach') return { glyph: 'messagesSquare', eyebrow: t('AI coach is building your plan') }
  if (days === 0) return { glyph: 'utensils', eyebrow: t('Just tracking food') }
  if (days == null) return { glyph: 'dumbbell', eyebrow: t('No training yet'), link: { label: t('Add training'), onClick: () => go('training') } }
  if (plan?.kind === 'starter') {
    const sessions = starterSessions(days, plan.equipment)
    const today = new Date().getDay()
    const ahead = d => (d - today + 7) % 7
    const i = plan.weekdays.reduce((best, d, k) => (ahead(d) < ahead(plan.weekdays[best]) ? k : best), 0)
    const day = plan.weekdays[i]
    const when = ahead(day) === 0 ? t('Today') : weekdayName(day, dateLocale(), 'short')
    return { glyph: 'play', eyebrow: t('First session · {0} · {1}', sessions[i]?.name ?? '', when) }
  }
  return { glyph: 'listChecks', eyebrow: t('No plan yet'), link: { label: t('Choose a plan'), onClick: () => go('plan') } }
}

export default function SummaryScreen() {
  const navigate = useNavigate()
  const { state, act, saveHubStep, go, hub } = useOnboarding()
  const name = useStore(s => s.user?.name)
  const units = useUnits()
  const screen = useRef(null)
  const answers = state.answers
  const full = bodyComplete(answers)
  const target = useTarget(answers, state.uid)
  const targets = full ? target.targets : null
  const kind = full ? 'ring' : 'ghost'
  const motion = useSummaryMotion(screen, kind)
  const { finish, status, setbacks, leave } = useFinish({
    home: () => handOver({ unwind: motion.unwind, go: () => leave('/home'), flat: !targets }),
  })
  const missing = detourOf(answers)

  // Arriving back from "Add my details": that detour is over (one started here is not).
  const arrivedOnDetour = useRef(!!state.detour)
  useEffect(() => { if (arrivedOnDetour.current) act({ type: 'detour', steps: null }) }, [act])

  const kcal = useCount(targets?.calories ?? null, COUNT.kcal[1], { from: 0, delay: COUNT.kcal[0] })
  const waterMl = targets?.waterMl ?? DEFAULT_WATER_ML
  const waterCount = useCount(waterMl, COUNT.water[1], { from: 0, delay: COUNT.water[0] })
  const water = units.waterParts(motion.playing ? waterCount : waterMl)

  if (setbacks) {
    const lines = [
      setbacks.plan && t('Your plan couldn’t be set up. Pick one in Training.'),
      setbacks.training && t('Training didn’t take your answers. Add your weight and a plan there.'),
      setbacks.food && t('Food didn’t take your targets. Set them in Food goals.'),
    ].filter(Boolean)
    const toTraining = setbacks.plan || setbacks.training
    return (
      <StepScreen key="setbacks" titleId="ob-finish-t" title={t('Not everything could be set up')} sub={lines.join(' ')}
        stage={<div className="ob-fin-art"><StarterBaseline className="ob-fin-line" /></div>}
        footer={<>
          {toTraining && <Button variant="primary" onClick={() => leave('/train')}>{t('Open Training')}</Button>}
          {setbacks.food && <Button variant={toTraining ? 'tinted' : 'primary'} onClick={() => leave('/food/goals')}>{t('Open Food goals')}</Button>}
          <Button variant="plain" onClick={() => leave('/home')}>{t('Go to Home')}</Button>
        </>} />
    )
  }

  const failed = status === 'error' || status === 'busy'
  // The hub's answer on this tab is still on its way (a reload): whether a plan is stored there
  // is not known yet, so nothing is finished before it is.
  const reading = hub === 'loading'
  const details = () => {
    act({ type: 'detour', steps: missing })
    go(missing[0])
  }
  const openSheet = which => useUI.getState().openSheet(close => (
    <SummarySheet which={which} answers={answers} close={close} onPick={v => {
      if (which === 'goal') { act({ type: 'goal', goal: v }); saveHubStep('goal') }
      else { act({ type: 'activity', value: v }); saveHubStep('body') }
    }} />
  ))
  // The CTA is live from the first frame: what is still moving jumps to its end, then it finishes.
  const goHome = () => {
    motion.finishRuns()
    finish()
  }
  const shown = motion.playing ? kcal : targets?.calories
  const ring = <>
    <StarterBaseline className="ob-sum-line" />
    <svg className="ob-sum-ring" viewBox="0 0 168 168" aria-hidden="true" focusable="false">
      <circle className="ob-sum-track" cx="84" cy="84" r="80" />
      {kind === 'ring'
        ? <circle className="ob-sum-fg" cx="84" cy="84" r="80" strokeDasharray={RING_C.toFixed(2)} transform="rotate(180 84 84)" />
        : <circle className="ob-sum-ghost" cx="84" cy="84" r="80" strokeDasharray={`${GHOST.toFixed(2)} ${RING_C.toFixed(2)}`}
          transform="translate(0 168) scale(1 -1) rotate(180 84 84)" />}
    </svg>
    <span className={kind === 'ring' ? 'ob-sum-thread' : 'ob-sum-thread flat'} aria-hidden="true" />
  </>
  const goal = answers.goal || 'keep'
  const activity = answers.activity?.value || 'sitting'

  return (
    <StepScreen titleId="ob-finish-t"
      title={failed ? t('Your answers could not be saved yet') : name ? t('You’re all set, {0}', name) : t('You’re all set')}
      sub={status === 'busy' ? t('Gains is busy right now. Try again in a moment. Nothing you answered is lost.')
        : failed ? t('Check your connection and try again. Nothing you answered is lost.') : t('Here’s your Home to start with.')}
      stage={<div ref={screen} className="ob-sum">
        <HeroStatus variant="target" {...statusOf(answers, go)} ring={ring}
          value={targets ? kcalText(shown ?? 0) : null} unit={targets ? t('kcal a day') : undefined}
          metrics={[{ label: t('Water'), value: water.value, unit: water.unit, sub: targets ? t('a day') : t('default') }]}>
          {targets && <HeroMacros targets={{ proteins: targets.proteinG, carbohydrates: targets.carbsG, fat: targets.fatG }} />}
          {targets && <p className="hero-c ob-sum-tail">
            {t('{0} · Adaptive, adjusts to your logs over about 3 weeks', GOAL_LINE()[goal])}
            <Button variant="plain" size="sm" onClick={() => openSheet('goal')}>{t('Adjust')}</Button>
          </p>}
          {targets && <Button className="ob-sum-tail" variant="tinted" size="sm" shape="pill" onClick={() => openSheet('activity')}>
            {ACTIVITY_CHIP()[activity]} · {t('Change')}
          </Button>}
          {!full && <Button className="ob-sum-tail" variant="tinted" size="sm" onClick={details}>{t('Add my details')}</Button>}
        </HeroStatus>
        <p className="sr-only" role="status">{targets && motion.said ? t('Your daily target is {0} kcal a day', kcalText(targets.calories)) : ''}</p>
      </div>}
      footer={<>
        <Button variant="primary" disabled={status === 'saving' || reading} aria-busy={status === 'saving' || undefined} onClick={goHome}>
          {failed ? t('Try again') : t('Go to Home')}
        </Button>
        {failed && <Button variant="plain" onClick={() => navigate('/home', { replace: true })}>{t('Finish later')}</Button>}
      </>} />
  )
}
