import { useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import Button from '../../ds/Button.jsx'
import { Thumb } from '../../components/Media.jsx'
import FitSheet from '../../components/onboarding/FitSheet.jsx'
import StarterBaseline from '../../components/onboarding/StarterBaseline.jsx'
import StepScreen from '../../components/onboarding/StepScreen.jsx'
import { exerciseNameText } from '../../lib/format.js'
import { dateLocale, t, tn } from '../../lib/i18n.js'
import { useOnboarding } from '../../lib/onboarding/contexts.js'
import { pathOf } from '../../lib/onboarding/flow.js'
import { equipmentLabel, experienceLabel, weekdayName } from '../../lib/onboarding/labels.js'
import { WEEK, moveSession, sessionMark, starterSessions, templateFor } from '../../lib/onboarding/plans.js'
import { starterFor } from '../../lib/onboarding/state.js'
import { useUI } from '../../store/useUI.js'

// 5a Starter preview (board O2.10): the plan's name, the week as seven glass tiles with each
// session's mark on its day (tap a session, then a free day to move it there), the selected
// session's exercises, and "Fitted to: Full gym, Lift regularly · Change" (O2.10f). Use this plan
// → the end. The tiles stand on the line the thread lands on (UI decision 2).
const LETTERS = 'ABCDEF'
const NAME = () => ({
  'full-body-2': t('Two-day full body'), 'full-body': t('Full body starter'), 'upper-lower': t('Upper / lower'),
  'upper-lower-ppl': t('Upper / lower, then push / pull / legs'), 'ppl-6': t('Push / pull / legs, twice'),
})

export default function StarterScreen() {
  const { state, act, saveHubStep, go } = useOnboarding()
  const days = state.answers.trainingDays
  const fresh = !state.starter || state.starter.templateId !== templateFor(days) || state.starter.weekdays.length !== days
  const plan = fresh ? starterFor(days, state.starter) : state.starter
  useEffect(() => { if (days && fresh) act({ type: 'starter', patch: starterFor(days, state.starter) }) }, [days, fresh, act, state.starter])
  const sessions = useMemo(() => starterSessions(days, plan.equipment), [days, plan.equipment])
  if (!days) return <Navigate to={pathOf('training')} replace />

  const locale = dateLocale()
  const sel = Math.min(plan.sel, sessions.length - 1)
  const tap = day => act({ type: 'starter', patch: moveSession(plan.weekdays, sel, day) })
  const fit = () => useUI.getState().openSheet(close => (
    <FitSheet experience={plan.experience} equipment={plan.equipment} close={close}
      onChange={patch => act({ type: 'starter', patch })} />
  ))
  const use = () => {
    act({ type: 'plan', plan: { kind: 'starter', templateId: plan.templateId, weekdays: plan.weekdays, equipment: plan.equipment, experience: plan.experience } })
    saveHubStep('plan')
    go('finish')
  }
  const name = days === 1 ? t('One-day full body') : NAME()[plan.templateId]
  const session = sessions[sel]
  return (
    <StepScreen titleId="ob-starter-t" title={t('Your starter plan')}
      sub={tn('Picked for {0} day a week. Move a session to another day if you like.', 'Picked for {0} days a week. Move a session to another day if you like.', days)}
      footer={<Button onClick={use}>{t('Use this plan')}</Button>}>
      <div className="ob-pl-head">
        <div className="ob-pl-name">{name}</div>
        <div className="ob-pl-meta">{tn('{0} workout a week', '{0} workouts a week', days)}</div>
      </div>
      <div className="ob-pl-days" role="group" aria-label={t('Training days')}>
        {WEEK.map(d => {
          const i = plan.weekdays.indexOf(d)
          const label = i >= 0
            ? t('{0}, session {1}, {2}', weekdayName(d, locale), LETTERS[i], sessions[i]?.name) + (i === sel ? ', ' + t('selected') : '')
            : t('{0}, rest day. Move {1} here', weekdayName(d, locale), session?.name)
          return <button key={d} type="button" className="ob-pday" aria-pressed={i === sel} aria-label={label} onClick={() => tap(d)}>
            {weekdayName(d, locale, 'short')}
          </button>
        })}
        {plan.weekdays.map((d, i) => (
          <span key={i} className={i === sel ? 'ob-pill sel' : 'ob-pill'} style={{ '--d': WEEK.indexOf(d) }} aria-hidden="true">
            <b>{sessionMark(sessions[i]?.name, i)}</b>
          </span>
        ))}
        <StarterBaseline />
      </div>
      {session && <div className="ob-pl-sess g-glass" aria-live="polite">
        <div className="ob-pl-st">{session.name} · {weekdayName(plan.weekdays[sel], locale)}</div>
        {session.exercises.map((e, k) => (
          <div key={k} className="ob-exr">
            {e.ex ? <Thumb ex={e.ex} /> : <span className="thumb" aria-hidden="true" />}
            <span className="ob-exr-t">
              <span className="ob-exn">{e.ex ? exerciseNameText(e.ex) : e.id}</span>
              <span className="ob-exs">{t('{0} × {1}', e.sets, e.reps)}</span>
            </span>
          </div>
        ))}
      </div>}
      <p className="ob-pl-fit">
        <span>{t('Fitted to: {0}, {1}', equipmentLabel(plan.equipment), experienceLabel(plan.experience))} ·</span>
        <button type="button" className="ob-link" onClick={fit}>{t('Change')}</button>
      </p>
    </StepScreen>
  )
}
