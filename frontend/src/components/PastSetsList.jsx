import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { bestSetIndex } from '../lib/exercise-history.js'
import { fmtDate, fmtNum, fmtVol } from '../lib/format.js'
import { setLabel } from '../lib/history.js'
import { t, tn } from '../lib/i18n.js'
import { speedUnitOf } from '../lib/speed.js'
import { cx } from '../lib/ui-kit.js'
import Icon from './Icon.jsx'
import './past-sets.css'

const PAGE = 20

// What you did on one exercise, session by session and set by set (T7.1 Past sets): a card per
// session with its day, the routine it was in, "Set 1  82.5 kg × 6" for each work set, a "New best"
// mark on the set that beat the best before it, and the volume and estimated 1RM under them. It is
// the page's History view and the body of the mid-workout history drawer, so the two never differ.
// `history` is exerciseHistory(S, exId, { limit: Infinity }); the caller computes it once and
// shares it. `tone` is "stage" on the page (glass cards) and "light" in the drawer. With `onOpen`
// each card is a button that gets the session's id.
export default function PastSetsList({ exId, history, tone = 'stage', onOpen }) {
  const S = useStore(s => s.S)
  const [shown, setShown] = useState(PAGE)
  const speedUnit = speedUnitOf(S)
  const light = tone === 'light'

  if (!history.total) return <p className={cx('g-ps-empty', light && 'g-ps-light')}>{t('No sessions logged yet')}</p>

  const tail = s => [
    s.volume > 0 && t('Volume') + ' ' + fmtVol(s.volume, S.unit),
    s.e1rm != null && t('Est. 1RM') + ' ' + fmtNum(s.e1rm) + ' ' + S.unit,
  ].filter(Boolean).join(' · ')

  const card = s => {
    const best = s.pr ? bestSetIndex(s, history.metric) : -1
    const foot = tail(s)
    return <>
      <span className="g-ps-head">
        <b>{fmtDate(s.d, true)}</b>
        {s.name && <span>{s.name}</span>}
        {onOpen && <Icon name="chevronRight" className="g-icon g-ps-chev" />}
      </span>
      <ol className="g-ps-sets">
        {s.sets.map((set, i) => <li key={i}>
          <span>{t('Set {0}', i + 1)}</span>
          <b>{setLabel(exId, set, s.target, speedUnit)}</b>
          {i === best && <span className="g-ps-pr">{t('New best')}</span>}
        </li>)}
      </ol>
      {foot && <span className="g-ps-tail">{foot}</span>}
    </>
  }

  const cls = cx('g-ps-card', !light && 'g-glass')
  return (
    <div className={cx('g-ps', light && 'g-ps-light')}>
      <p className="g-ps-count">{tn('{0} session', '{0} sessions', history.total)}</p>
      <ol className="g-ps-list">
        {history.sessions.slice(0, shown).map(s => <li key={s.id}>
          {onOpen
            ? <button type="button" className={cls} onClick={() => onOpen(s.id)}>{card(s)}</button>
            : <div className={cls}>{card(s)}</div>}
        </li>)}
      </ol>
      {history.sessions.length > shown && (
        <button type="button" className={cx('g-ps-more', !light && 'g-glass')} onClick={() => setShown(n => n + PAGE)}>{t('Show more')}</button>
      )}
    </div>
  )
}
