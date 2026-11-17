import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'

const STATES = ['done', 'missed', 'today', 'planned', 'rest']

// The week on the stage with one mark a day (bundle.js `StageWeekStrip` in its marks form, board
// T1ETraining): done a white disc with a check, missed an amber ring with an ×, today a white ring,
// planned a glass disc, rest a small dot. The app's StageWeekStrip is onboarding's (O2.8), so this
// one keeps the bundle's classes under its own name. days: [{ key, dow, state, label, href,
// onClick }]; `label` is the day in words ("Monday, done"), and a day is a link or a button only
// with somewhere to go.
export default function StageWeekMarks({ days, label }) {
  return (
    <div className="g-wk g-glass" role="group" aria-label={label || t('This week')}>
      {days.map(d => {
        oneOf('StageWeekMarks', 'state', d.state, STATES)
        const kids = <><span className="g-wk-dow" aria-hidden="true">{d.dow}</span><Mark state={d.state} /></>
        return d.href || d.onClick
          ? <Act key={d.key} href={d.href} onClick={d.onClick} ariaLabel={d.label} className="g-wk-cell">{kids}</Act>
          : <span key={d.key} className="g-wk-cell" role="img" aria-label={d.label}>{kids}</span>
      })}
    </div>
  )
}

function Mark({ state }) {
  if (state === 'done') return <span className="g-wk-m g-wk-done"><Icon name="check" className="g-icon" /></span>
  if (state === 'missed') return <span className="g-wk-m g-wk-missed"><Icon name="xmark" className="g-icon" /></span>
  if (state === 'rest') return <span className="g-wk-m g-wk-rest"><i /></span>
  return <span className={'g-wk-m g-wk-' + state} />
}
