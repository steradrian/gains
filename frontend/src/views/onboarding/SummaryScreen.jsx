import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../ds/Button.jsx'
import GlassList from '../../ds/GlassList.jsx'
import StageWeekStrip from '../../ds/StageWeekStrip.jsx'
import Icon from '../../components/Icon.jsx'
import AdjustSheet from '../../components/onboarding/AdjustSheet.jsx'
import DaySheet from '../../components/onboarding/DaySheet.jsx'
import StarterBaseline from '../../components/onboarding/StarterBaseline.jsx'
import StepScreen from '../../components/onboarding/StepScreen.jsx'
import { dateLocale, t, tn } from '../../lib/i18n.js'
import { useOnboarding } from '../../lib/onboarding/contexts.js'
import { bodyComplete, detourOf } from '../../lib/onboarding/flow.js'
import { handOver } from '../../lib/onboarding/handover.js'
import { ACTIVITY_OPTIONS, goalLabel, modeLabel, paceLabel, weekdayName } from '../../lib/onboarding/labels.js'
import { WEEK, nextSession } from '../../lib/onboarding/plans.js'
import { useCount } from '../../lib/onboarding/use-count.js'
import { useFinish } from '../../lib/onboarding/use-finish.js'
import { COUNT, GHOST, RING, useSummaryMotion } from '../../lib/onboarding/use-summary-motion.js'
import { TARGET_SETTINGS, kcalText, useTarget } from '../../lib/onboarding/use-target.js'
import { nutritionAvailable } from '../../lib/nutrition/api.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'

// 6 Summary (boards O2.12–O2.16; fitness-eval motion-onboarding-summary-v2): "You're all set", then
// on the stage the daily target in the ring the thread becomes, beside the goal, its pace and mode,
// with protein, carbs and fat under it; water; the activity chip; this week (the plan's days and
// the next session, or what stands for the plan: the AI coach at work, no plan, food only); and Go
// to Today with Adjust. Without the four body answers there is no target: the dashed ring, "Set
// your target" with Add my details (only the missing steps, then back here), and no water, chip
// or Adjust.
//
// Go to Today finishes the onboarding (lib/onboarding/use-finish.js) and hands over: the ring
// unwinds into the line that lands on Home's hero (lib/onboarding/handover.js). What could not be
// set up stays here, with where to put it right.
const MACROS = () => [
  { key: 'proteinG', label: t('Protein') },
  { key: 'carbsG', label: t('Carbs') },
  { key: 'fatG', label: t('Fat') },
]

/** This week's row: the next session, the AI coach at work, food only, or no plan yet. */
function weekRow(answers) {
  const plan = answers.plan
  if (plan?.kind === 'coach') return { icon: 'messagesSquare', title: t('Your AI coach is on it'), sub: t('A card on Today when it is ready to review') }
  if (answers.trainingDays === 0) return { icon: 'salad', title: t('Just tracking food'), sub: t('Add training any time in Settings') }
  const next = plan?.kind === 'starter' ? nextSession(plan, answers.trainingDays, new Date().getDay()) : null
  if (!next) return { icon: 'listChecks', title: t('No plan yet'), sub: t('Choose a plan any time in Train') }
  const when = next.ahead === 0 ? t('Today') : next.ahead === 1 ? t('Tomorrow') : weekdayName(next.day, dateLocale())
  return {
    icon: 'calendar',
    title: t('Next · {0}', when),
    sub: tn('{1} · {0} exercise', '{1} · {0} exercises', next.session.exercises.length, next.session.name),
  }
}

export default function SummaryScreen() {
  const navigate = useNavigate()
  const { state, act, saveHubStep, go, hub } = useOnboarding()
  const user = useStore(s => s.user)
  const name = user?.name
  const units = useUnits()
  const screen = useRef(null)
  const answers = state.answers
  const full = bodyComplete(answers)
  const target = useTarget(answers, state.uid)
  const targets = full ? target.targets : null
  const kind = full ? 'ring' : 'ghost'
  const starter = answers.plan?.kind === 'starter' && answers.trainingDays > 0 ? answers.plan : null
  const motion = useSummaryMotion(screen, kind, { zeroDays: answers.trainingDays === 0, lit: starter?.weekdays.length ?? 0 })
  // Home's hero has its 1×64 split (the thread's vertical end) only with nutrition, and the ring
  // only turns into that line where there is a target; otherwise the line is a horizontal one.
  const vertical = !!targets && nutritionAvailable(user)
  const { finish, status, setbacks, leave } = useFinish({
    home: () => handOver({ unwind: motion.unwind, go: () => leave('/home'), flat: !vertical }),
  })
  const missing = detourOf(answers)

  // Arriving back from "Add my details": that detour is over (one started here is not).
  const arrivedOnDetour = useRef(!!state.detour)
  useEffect(() => { if (arrivedOnDetour.current) act({ type: 'detour', steps: null }) }, [act])

  const kcal = useCount(targets?.calories ?? null, COUNT.kcal[1], { from: 0, delay: COUNT.kcal[0] })
  const waterMl = targets?.waterMl ?? null
  const waterCount = useCount(waterMl, COUNT.water[1], { from: 0, delay: COUNT.water[0] })

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
          {toTraining && <Button onClick={() => leave('/train')}>{t('Open Training')}</Button>}
          {setbacks.food && <Button variant={toTraining ? 'glass' : 'primary'} onClick={() => leave('/food/goals')}>{t('Open Food goals')}</Button>}
          <Button variant="ghost" onClick={() => leave('/home')}>{t('Go to Today')}</Button>
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
  const adjust = () => useUI.getState().openSheet(close => <AdjustSheet close={close} />)
  const activities = ACTIVITY_OPTIONS()
  const activity = activities.find(o => o.value === answers.activity?.value) || activities[0]
  const day = () => useUI.getState().openSheet(close => (
    <DaySheet value={activity.value} close={close}
      onPick={value => act({ type: 'activity', value })} onDone={() => saveHubStep('body')} />
  ))
  // The CTA is live from the first frame: what is still moving, the thread's flight too, jumps to
  // its end, then it finishes.
  const goHome = () => {
    motion.finishRuns()
    finish()
  }
  const shown = motion.playing ? kcal : targets?.calories
  const water = waterMl != null ? units.waterParts(motion.playing ? waterCount : waterMl) : null
  const locale = dateLocale()
  const row = weekRow(answers)

  return (
    <StepScreen titleId="ob-finish-t"
      title={failed ? t('Your answers could not be saved yet') : name ? t('You’re all set, {0}', name) : t('You’re all set')}
      sub={status === 'busy' ? t('Gains is busy right now. Try again in a moment. Nothing you answered is lost.')
        : failed ? t('Check your connection and try again. Nothing you answered is lost.') : t('Here’s your Today to start with.')}
      stage={<div ref={screen} className="ob-sum">
        {full
          ? <div className="ob-sum-card g-glass">
            <div className="ob-sum-top">
              <span className="ob-sum-dial">
                <svg className="ob-sum-ring" viewBox="0 0 116 116" aria-hidden="true" focusable="false">
                  <circle className="ob-sum-track" cx="58" cy="58" r="46" />
                  <circle className="ob-sum-fg" cx="58" cy="58" r="46" strokeDasharray={RING.toFixed(2)} transform="rotate(180 58 58)" />
                </svg>
                {targets && <span className="ob-sum-mid">
                  <span className="ob-sum-v">{kcalText(shown ?? 0)}</span>
                  <span className="ob-sum-u">{t('kcal a day')}</span>
                </span>}
              </span>
              <dl className="ob-sum-facts">
                <div><dt>{t('Goal')}</dt> <dd>{goalLabel(answers.goal || 'keep')}</dd></div>
                <div><dt>{t('Pace')}</dt> <dd>{paceLabel(TARGET_SETTINGS.pace)}</dd></div>
                <div><dt>{t('Mode')}</dt> <dd>{modeLabel(TARGET_SETTINGS.mode)}</dd></div>
              </dl>
              <StarterBaseline className="ob-sum-line" />
              <span className={vertical ? 'ob-sum-thread' : 'ob-sum-thread flat'} aria-hidden="true" />
            </div>
            {targets && <div className="ob-sum-macros">
              {MACROS().map(m => (
                <div key={m.key} className="ob-sum-mac">
                  <span>{m.label}<span>{t('{0} g', Math.round(targets[m.key] || 0).toLocaleString(locale))}</span></span>
                  <i className="ob-sum-bar" aria-hidden="true" />
                </div>
              ))}
            </div>}
          </div>
          : <div className="ob-sum-card g-glass">
            <div className="ob-sum-top set">
              <svg className="ob-sum-ring set" viewBox="0 0 112 112" aria-hidden="true" focusable="false">
                {/* One Summary is on screen at a time, so its mask's id is its own. */}
                <mask id="ob-sum-ghost-mask">
                  <circle className="ob-sum-ghost-m" cx="56" cy="56" r="44" strokeDasharray={GHOST.toFixed(2)} transform="rotate(180 56 56)" />
                </mask>
                <circle className="ob-sum-ghost" cx="56" cy="56" r="44" mask="url(#ob-sum-ghost-mask)" />
              </svg>
              <span className="ob-sum-set ob-sum-tail">
                <b>{t('Set your target')}</b>
                <span>{t('Add your details and we’ll work out your daily calories.')}</span>
                <Button size="sm" className="ob-sum-add" onClick={details}>{t('Add my details')}</Button>
              </span>
              <StarterBaseline className="ob-sum-line" />
              <span className="ob-sum-thread flat" aria-hidden="true" />
            </div>
          </div>}
        {water && <div className="ob-sum-water">
          <GlassList items={[{ icon: 'droplet', title: t('Water'), sub: t('{0} {1} a day', water.value, water.unit) }]} />
        </div>}
        {full && <div className="ob-sum-tail">
          <button type="button" className="ob-sum-chip g-glass" onClick={day}>
            <Icon name={activity.icon} className="g-icon" />
            <span>{activity.chip} ·</span>
            <b>{t('Change')}</b>
          </button>
        </div>}
        <div className="ob-sum-week">
          <h2 className="ob-sum-h">{t('This week')}</h2>
          {starter && <div className="ob-sum-days">
            <StageWeekStrip days={WEEK.map(d => ({ key: d, label: weekdayName(d, locale, 'short'), lit: starter.weekdays.includes(d) }))} />
          </div>}
          <div className={starter ? 'ob-sum-next' : 'ob-sum-row'}><GlassList items={[row]} /></div>
        </div>
        <p className={full ? 'ob-sum-cap ob-sum-tail' : 'ob-sum-cap plain ob-sum-tail'}>
          {full ? <><Icon name="info" className="g-icon" />{t('Adjusts to you over about 3 weeks')}</> : t('Add your details any time for a daily target')}
        </p>
        <p className="sr-only" role="status">{targets && motion.said ? t('Your daily target is {0} kcal a day', kcalText(targets.calories)) : ''}</p>
      </div>}
      footer={<>
        <Button disabled={status === 'saving' || reading} aria-busy={status === 'saving' || undefined} onClick={goHome}>
          {failed ? t('Try again') : t('Go to Today')}
        </Button>
        {failed
          ? <Button variant="ghost" onClick={() => navigate('/home', { replace: true })}>{t('Finish later')}</Button>
          : full && <Button variant="ghost" onClick={adjust}>{t('Adjust')}</Button>}
      </>} />
  )
}
