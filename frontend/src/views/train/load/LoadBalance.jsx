import { useState } from 'react'
import { t } from '../../../lib/i18n.js'
import { fmtDate } from '../../../lib/format.js'
import { loadOfWeeklyPlan } from '../../../lib/muscles.js'
import Icon from '../../../components/Icon.jsx'
import BodyMap from '../../../ds/BodyMap.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import LoadLegend from './LoadLegend.jsx'
import LoadRow from './LoadRow.jsx'
import { balanceOf, muscleName, ROWS, rowValue } from './use-training-load.js'

const PERIOD_TITLE = { 30: () => t('Last 30 days'), 90: () => t('Last 90 days'), 0: () => t('All time') }

/**
 * Balance (T9.0, T9.2, T9.3): where the sets went in a week (stepped back with the arrows; this
 * one read against the plan) or the last 30 or 90 days, or ever. Hard sets narrows a window to the
 * sets taken near failure, offered only when the window has rated sets. The map and every row
 * open the muscle (T9.6), as do the muscles not trained.
 */
export default function LoadBalance({ S, now, today, onMuscle }) {
  const [win, setWin] = useState(7)
  const [weekOffset, setWeekOffset] = useState(0)
  const [hard, setHard] = useState(false)
  const [expanded, setExpanded] = useState(false)

  if (!S.workouts.length && !Object.keys(loadOfWeeklyPlan(S)).length) {
    return <StageEmpty illustration="dumbbell" title={t('No workouts yet')} body={t('Log a workout and the muscles it worked light up here.')} />
  }

  const b = balanceOf(S, { win, weekOffset, hard, now, today })
  const shown = expanded ? b.rows : b.rows.slice(0, ROWS)
  const changeWeek = step => { setWeekOffset(o => Math.min(0, o + step)); setExpanded(false) }
  const changeWin = v => { setWin(v); setExpanded(false) }

  return (
    <section className="g-load-sec" data-weekly-volume-comparison={b.weekly || undefined} data-week={b.week || undefined}>
      <p className="g-load-cap">{t('Muscle balance')} · {b.hard ? t('by hard sets') : t('by sets worked')}</p>
      <StageSegmented label={t('Period')} value={win} onChange={changeWin}
        options={[{ value: 7, label: t('Week') }, { value: 30, label: '30d' }, { value: 90, label: '90d' }, { value: 0, label: t('All') }]} />
      {b.weekly ? (
        <div className="g-load-nav">
          <button type="button" className="g-load-arrow g-glass" aria-label={t('Previous week')} onClick={() => changeWeek(-1)}>
            <Icon name="chevronLeft" className="g-icon" />
          </button>
          <span className="g-load-period"><b>{t('Week of {0}', fmtDate(b.week))}</b>{b.vsPlan && <small>{t('This week')}</small>}</span>
          <button type="button" className="g-load-arrow g-glass" aria-label={t('Next week')} disabled={weekOffset === 0} onClick={() => changeWeek(1)}>
            <Icon name="chevronRight" className="g-icon" />
          </button>
        </div>
      ) : (
        <div className="g-load-nav">
          <span className="g-load-period"><b>{PERIOD_TITLE[win]()}</b></span>
          {b.rated && (
            <div className="g-cgroup g-cgroup-stage">
              <button type="button" className={'g-cchip' + (b.hard ? ' on' : '')} aria-pressed={b.hard} onClick={() => setHard(h => !h)}>{t('Hard sets')}</button>
            </div>
          )}
        </div>
      )}
      <div className="g-load-card g-glass">
        <BodyMap levels={b.levels} body={S.body} onMuscle={onMuscle} />
        <LoadLegend less={t('Less')} more={t('More')} />
      </div>
      {b.empty ? <StageEmpty illustration="calendar" title={t('No workouts in this period yet.')} /> : (
        <>
          <div className="g-glist g-glass g-load-list">
            {shown.map(r => {
              const v = rowValue(r, b.vsPlan)
              return <LoadRow key={r.slug} slug={r.slug} level={r.level} title={muscleName(r.slug)} value={v.value} spoken={v.spoken} onClick={() => onMuscle(r.slug)} />
            })}
          </div>
          {b.rows.length > ROWS && (
            <button type="button" className="g-load-more" aria-expanded={expanded} onClick={() => setExpanded(x => !x)}>
              {t(expanded ? 'Show less' : 'Show more')}<Icon name={expanded ? 'chevronUp' : 'chevronDown'} className="g-icon" />
            </button>
          )}
          {b.missed.length > 0 ? (
            <div className="g-load-missed">
              <h3>{b.hard ? t('No hard sets in this period') : t('Not trained in this period')}</h3>
              <div className="g-cgroup g-cgroup-stage">
                {b.missed.map(m => <button key={m} type="button" className="g-cchip" onClick={() => onMuscle(m)}>{muscleName(m)}</button>)}
              </div>
            </div>
          ) : b.worked.length > 0 && (
            <p className="g-load-note">{b.hard
              ? t('Every muscle group got at least one hard set in this period.')
              : t('Every muscle group got some work in this period.')}</p>
          )}
        </>
      )}
    </section>
  )
}
