import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { dateLocale, t } from '../lib/i18n.js'
import { workoutRunning } from '../lib/mode-route.js'
import { switchMode } from '../lib/use-mode-nav.js'
import { bwSheet } from '../sheets.jsx'
import { Row, Section } from './ui.jsx'
import Elapsed from './Elapsed.jsx'

// Nutrition's centre +: one sheet of logging rows, headed by the day they log to. For now it
// holds the rows every Nutrition tab shares; the ones whose screens are not built yet are shown,
// marked as coming, rather than left out — the sheet's shape is the one people will learn.
function PlusSheet({ close }) {
  const S = useStore(s => s.S)
  const live = workoutRunning(S)
  const day = new Date().toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
  const weighIn = () => { close(); bwSheet() }
  const workout = () => { close(); switchMode('train', '/train/workout') }
  return (
    <div className="plus-sheet">
      <div className="plus-sheet-h">
        <span className="plus-sheet-cap">{t('Logging to')}</span>
        <h3>{day}</h3>
      </div>
      <Section>
        <Row icon="scale" title={t('Weigh in')} accessory="chevron" onClick={weighIn} />
        <Row icon="plusCircle" title={t('Water')} value={t('Soon')} className="off" />
        <Row icon="clipboard" title={t('Log food')} value={t('Soon')} className="off" />
        <Row icon="play" title={S.active ? t('Resume workout') : t('Start workout')} accessory="chevron" onClick={workout}>
          {live && <span className="lrow-v plus-sheet-live"><span className="live-dot" aria-hidden="true" /><Elapsed start={S.active.start} /></span>}
        </Row>
      </Section>
    </div>
  )
}

export function openPlusSheet() {
  useUI.getState().openSheet(close => <PlusSheet close={close} />)
}
