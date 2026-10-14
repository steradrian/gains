import { useEffect, useState } from 'react'
import { t, dateLocale } from '../lib/i18n.js'
import { fmtDur } from '../lib/format.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { confirmSheet } from '../sheets.jsx'
import { nutritionAvailable } from '../lib/nutrition/api.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { hitGoal, lengthOf } from '../lib/nutrition/fasting.js'
import { setFastingEnabled, useFasting } from '../lib/nutrition/use-fasting.js'
import { writeErrorText } from '../lib/nutrition/log-feedback.js'
import FastCard from '../components/FastCard.jsx'
import FastInsights from '../components/FastInsights.jsx'
import Icon from '../components/Icon.jsx'
import SubHeader from '../components/SubHeader.jsx'
import { Button, Row, Section } from '../components/ui.jsx'

const HISTORY_SHOWN = 20

function HistoryRow({ fast }) {
  const when = new Date(fast.start_at).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
  const remove = () => confirmSheet({
    title: t('Remove this fast?'),
    message: t('The {0} fast on {1} is deleted from your history.', fmtDur(lengthOf(fast)), when),
    confirmText: t('Remove'),
    danger: true,
    onConfirm: () => useFasting.getState().remove(fast.id).catch(e => useUI.getState().toast(writeErrorText(e))),
  })
  return <Row icon={hitGoal(fast) ? 'checkCircle' : 'timer'} iconTint={hitGoal(fast) ? 'var(--green)' : 'var(--grey)'}
    title={fmtDur(lengthOf(fast))} subtitle={`${when} · ${t('Goal {0} h', fast.goal_hours)}`}>
    <button type="button" className="iconbtn" onClick={remove} aria-label={t('Remove this fast ({0})', when)}><Icon name="trash" /></button>
  </Row>
}

// Fasting (ia-proposal §3, a row of the Nutrition hub): start and end a fast on a plan, the time
// fasted and left, the history and the insights. NutriTrace keeps the fasts; whether the tracker
// is on is its `fastingEnabled` setting.
export default function Fasting() {
  const user = useStore(s => s.user)
  const available = nutritionAvailable(user)
  const settings = useNutrition(s => s.settings)
  const { status, history } = useFasting()
  const on = settings.data?.fastingEnabled === true
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState(null)

  useEffect(() => {
    if (!available) return
    useNutrition.getState().loadSettings()
  }, [available])
  useEffect(() => {
    if (available && on) useFasting.getState().load()
  }, [available, on])

  const turn = async next => {
    setSwitching(true)
    setSwitchError(null)
    try {
      await setFastingEnabled(next)
    } catch (e) {
      setSwitchError(writeErrorText(e))
    }
    setSwitching(false)
  }

  const header = <SubHeader title={t('Fasting')} />

  if (!available) {
    return <div>
      {header}
      <div className="card"><div className="empty">
        <div className="ico"><Icon name="timer" /></div>
        <strong>{t('Fasting lives in the web app')}</strong>
        <div>{t('Sign in on the web app to track your fasts.')}</div>
      </div></div>
    </div>
  }

  if (!settings.data && (settings.status === 'loading' || settings.status === 'idle')) {
    return <div>{header}<div className="muted small fp-note" role="status">{t('Loading…')}</div></div>
  }
  if (!settings.data) {
    return <div>{header}<div className="card"><div className="nt-error small" role="alert">{t('Your settings did not load.')}</div>
      <Button variant="tinted" onClick={() => useNutrition.getState().loadSettings({ force: true })}>{t('Try again')}</Button></div></div>
  }

  if (!on) {
    return <div>
      {header}
      <div className="card"><div className="empty">
        <div className="ico"><Icon name="timer" /></div>
        <strong>{t('Fasting is off')}</strong>
        <div>{t('Track intermittent fasting: pick a plan, see the time fasted and left, and keep a history.')}</div>
      </div>
      {switchError && <div className="nt-error small" role="alert">{switchError}</div>}
      <Button variant="primary" onClick={() => turn(true)} disabled={switching}>{t('Turn on fasting')}</Button></div>
    </div>
  }

  return <div>
    {header}
    {status === 'error' && <div className="card"><div className="nt-error small" role="alert">{t('Your fasts did not load.')}</div>
      <Button variant="tinted" onClick={() => useFasting.getState().load({ force: true })}>{t('Try again')}</Button></div>}
    {status === 'loading' && <div className="muted small fp-note" role="status">{t('Loading…')}</div>}
    {status === 'ready' && <>
      <FastCard />
      <FastInsights />
      {history.length > 0 && <Section title={t('History')}>
        {history.slice(0, HISTORY_SHOWN).map(f => <HistoryRow key={f.id} fast={f} />)}
      </Section>}
      <div className="fast-off">
        {switchError && <div className="nt-error small" role="alert">{switchError}</div>}
        <Button variant="ghost" className="dim" onClick={() => turn(false)} disabled={switching}>{t('Turn off fasting')}</Button>
      </div>
    </>}
  </div>
}
