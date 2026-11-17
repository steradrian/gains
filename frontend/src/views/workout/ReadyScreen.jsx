// Ready (board W1.1 Wk1Planned): the session Start workout would begin, before it runs. The
// routines come from `?start=a,b` (openReady), or with none from today's plan. With nothing to
// show it leaves for Training: a `start` that names no routine with exercises goes there, and no
// `start` with nothing planned today also opens the start chooser there.
import { useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { t } from '../../lib/i18n.js'
import { todayISO } from '../../lib/format.js'
import { effectiveRoutineIds } from '../../lib/history.js'
import { nav } from '../../lib/nav.js'
import { back } from '../../lib/use-tab-nav.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import { startChooserSheet, startFromReady } from '../../sheets.jsx'
import Icon from '../../components/Icon.jsx'
import Act from '../../ds/Act.jsx'
import Button from '../../ds/Button.jsx'
import ExerciseThumbRow from '../../ds/ExerciseThumbRow.jsx'
import PhaseProgress from '../../ds/PhaseProgress.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import { isLeaving } from './finish-drawers.js'
import { startIdsOf, useReady } from './use-ready.js'
import './finish.css'

const PART = {
  warmup: { tone: 'warm', name: () => t('Warm-up') },
  main: { tone: 'main', name: () => t('Workout') },
  cooldown: { tone: 'cool', name: () => t('Cool-down') },
}

// Today's planned routines that have exercises, as startOrResume picks them.
const todayIdsOf = S => effectiveRoutineIds(S, todayISO()).filter(id => S.routines.find(r => r.id === id)?.ex?.length)

export default function ReadyScreen() {
  const { search } = useLocation()
  const asked = useMemo(() => startIdsOf(search), [search])
  const todayKey = useStore(s => (asked.length ? '' : todayIdsOf(s.S).join(',')))
  const ids = asked.length ? asked : todayKey ? todayKey.split(',') : []
  const model = useReady(ids)
  const accent = useDsAccent()
  const leaving = isLeaving()
  const listRef = useRef(null)
  const left = useRef(false)

  useEffect(() => {
    if (model || leaving || left.current) return
    left.current = true
    nav('/train', { replace: true })
    if (!asked.length) startChooserSheet()
  }, [model, leaving, asked.length])

  if (leaving || !model) return null

  const phases = model.groups.map(g => ({ tone: PART[g.part].tone, count: g.count, state: 'waiting', name: PART[g.part].name() }))
  // "All exercises" opens nothing new here: the list below is the screen, so it goes there.
  const toList = () => {
    listRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    listRef.current?.focus({ preventScroll: true })
  }

  return (
    <StageScreen accent={accent}>
      <div className="g-ready">
        <div className="g-wtop">
          <Act onClick={() => back()} ariaLabel={t('Close')} className="g-wtop-btn g-glass">
            <Icon name="xmark" className="g-icon" />
          </Act>
          <span className="g-wtop-mid"><span className="g-wtop-title">{model.title}</span></span>
          <span className="g-ready-spacer" aria-hidden="true" />
        </div>
        <PhaseProgress phases={phases} label={t('All exercises')} onOpen={toList} />
        <header className="g-ready-head">
          <h1 className="g-ready-title">{model.title}</h1>
          <p className="g-ready-sub">{model.sub}</p>
        </header>
        <div className="g-ready-start">
          <Button block icon="play" onClick={() => startFromReady(model.ids)}>{t('Start workout')}</Button>
        </div>
        <div className="g-ready-list" ref={listRef} tabIndex={-1}>
          {model.groups.map(g => (
            <section key={g.part} className={'g-ready-group g-ready-' + PART[g.part].tone}>
              <h2 className="g-ready-gh">
                <span className="g-ready-dot" aria-hidden="true" />
                <span className="g-ready-gname">{PART[g.part].name()}</span>
                <span className="g-ready-gcount">{'· ' + g.count}</span>
              </h2>
              <div className="g-glist g-glass">
                {g.rows.map((r, i) => (
                  <ExerciseThumbRow key={r.id + ':' + i} tone="stage" size={48} image={r.image} title={r.name} sub={r.line} first={i === 0} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </StageScreen>
  )
}
