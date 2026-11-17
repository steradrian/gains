import { useMemo } from 'react'
import { t } from '../../../lib/i18n.js'
import { levelsOf } from '../../../lib/muscles.js'
import { fatigueOf } from '../../../lib/recovery.js'
import { FATIGUE_LEVELS } from '../../../lib/recovery-view.js'
import BodyMap from '../../../ds/BodyMap.jsx'
import LoadLegend from './LoadLegend.jsx'
import LoadRow from './LoadRow.jsx'
import { fatigueRows, muscleName, readyLine, recoveryOpts } from './use-training-load.js'

const STATE = { fatigued: () => t('Fatigued'), recovering: () => t('Recovering'), ready: () => t('Ready') }

/**
 * Fatigue (T9.4): how recently each muscle was trained, in fixed bands, the muscles carrying any
 * with their %, and, when a session planned this coming week fits, the line that says so.
 */
export default function LoadFatigue({ S, now, today, onMuscle }) {
  const fatigue = useMemo(() => fatigueOf(S.workouts, now, recoveryOpts(S)), [S.workouts, S.bodyweight, S.unit, now])
  const levels = levelsOf(fatigue, FATIGUE_LEVELS)
  const rows = fatigueRows(fatigue)
  const line = readyLine(S, fatigue, { now, today })
  return (
    <section className="g-load-sec">
      <p className="g-load-note">{t('Fatigue shows how recently each muscle was trained. High means rest.')}</p>
      <div className="g-load-card g-glass">
        <BodyMap levels={levels} body={S.body} onMuscle={onMuscle} />
        <LoadLegend keys={[{ label: t('Fatigued'), level: 4 }, { label: t('Recovering'), level: 2 }, { label: t('Ready'), level: 0 }]} />
      </div>
      {rows.length > 0 ? (
        <div className="g-glist g-glass g-load-list">
          {rows.map(r => <LoadRow key={r.slug} slug={r.slug} level={levels[r.slug] || 0} title={muscleName(r.slug)} sub={STATE[r.state]()}
            value={r.pct + '%'} onClick={() => onMuscle(r.slug)} />)}
        </div>
      ) : <p className="g-load-note">{t('Every muscle is ready.')}</p>}
      {line && <p className="g-load-fit">{line}</p>}
    </section>
  )
}
