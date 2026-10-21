import Button from '../../ds/Button.jsx'
import StageAlert from '../../ds/StageAlert.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import { t } from '../../lib/i18n.js'
import { fastingStats, recentDays } from '../../lib/nutrition/fasting.js'
import FastDaysChart from './FastDaysChart.jsx'
import FastInsightTiles from './FastInsightTiles.jsx'
import FastNextCard from './FastNextCard.jsx'
import FastOffCard from './FastOffCard.jsx'
import FastRecentList from './FastRecentList.jsx'
import FastRunCard from './FastRunCard.jsx'

const RECENT_SHOWN = 20

// The Fasting page (boards Ea6Fasting, Ea6Off, Ea6Running, Ea6Reached): pure, given what the hook
// (use-fasting-page.js) read and a `now`, so the gallery can freeze the clock.
// `view`: 'unavailable' | 'loading' | 'settings-error' | 'fasts-error' | 'off' | 'idle' | 'running'.
// `error` is a failed write's sentence, `onRetry` reloads what did not load.
export default function FastingScreen({
  view, now, hour12, fast, history, hours, usualStart, busy, error, onRetry,
  onPick, onTurnOn, onTurnOff, onOpenStart, onChangeStart, onEnd, onRemove,
}) {
  const alert = error && <StageAlert key={error}>{error}</StageAlert>
  let body
  if (view === 'unavailable') {
    body = <StageEmpty illustration="plan" title={t('Fasting lives in the web app')} body={t('Sign in on the web app to track your fasts.')} />
  } else if (view === 'loading') {
    body = <StageNote>{t('Loading…')}</StageNote>
  } else if (view === 'settings-error' || view === 'fasts-error') {
    body = <StageAlert action={t('Try again')} onAction={onRetry}>{view === 'settings-error' ? t('Your settings did not load.') : t('Your fasts did not load.')}</StageAlert>
  } else if (view === 'off') {
    body = <>{alert}<FastOffCard hours={hours} busy={busy} onPick={onPick} onTurnOn={onTurnOn} /></>
  } else {
    const running = view === 'running'
    const stats = fastingStats(history, fast, now)
    const goal = running ? fast.goal_hours : hours
    body = <>
      {alert}
      {running
        ? <FastRunCard fast={fast} now={now} hour12={hour12} busy={busy} onChangeStart={onChangeStart} onEnd={onEnd} />
        : <FastNextCard now={now} hour12={hour12} usualStart={usualStart} hours={hours} onPick={onPick} onStart={onOpenStart} />}
      {history.length > 0 ? <>
        <StageSection title={t('Insights')} />
        <FastInsightTiles stats={stats} history={history} />
        <StageSection title={t('Fasting hours, last 14 days')} />
        <FastDaysChart days={recentDays(history, fast, now)} goalHours={goal} />
        <StageSection title={t('Recent fasts')} />
        <FastRecentList history={history.slice(0, RECENT_SHOWN)} hour12={hour12} onRemove={onRemove} />
      </> : <StageNote>{t('Your insights show after your first fast.')}</StageNote>}
      <div className="g-fast-foot">
        <Button variant="ghost" onClick={onTurnOff}>{t('Turn off fasting')}</Button>
        <StageNote>{t('Turning fasting off keeps your history.')}</StageNote>
      </div>
    </>
  }
  return <StagePage title={t('Fasting')} parent="/food"><div className="g-fast">{body}</div></StagePage>
}
