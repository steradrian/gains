import { useMemo } from 'react'
import { getLang, t } from '../../../lib/i18n.js'
import { EXIDX, figureOf, imgSrc } from '../../../lib/exercises.js'
import { exerciseNameText, fmtDate, fmtNum, isoOf } from '../../../lib/format.js'
import { STRENGTH_FLOOR } from '../../../lib/recovery.js'
import { strengthLiftRows } from '../../../lib/strength-exercises.js'
import Icon from '../../../components/Icon.jsx'
import BodyMap from '../../../ds/BodyMap.jsx'
import ExerciseThumbRow from '../../../ds/ExerciseThumbRow.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import LoadLegend from './LoadLegend.jsx'
import LoadRow from './LoadRow.jsx'
import { muscleName, setsText, sinceText, strengthMuscles } from './use-training-load.js'

/**
 * Strength (T9.5): the retained-strength map and the muscles losing it (kept from the app's page:
 * the board shows only the lifts), then every lift with an estimated 1RM, "Completed" or "Losing
 * strength" with the day it was last done. A lift opens its progress (/progress/strength?ex=).
 */
export default function LoadStrength({ S, now, onMuscle, onLift }) {
  const lang = getLang()
  const st = useMemo(() => strengthMuscles(S, now), [S.workouts, S.bodyweight, S.unit, now])
  const lifts = useMemo(() => strengthLiftRows(S, now), [S.workouts, now, lang])
  const figure = figureOf(S)
  return (
    <section className="g-load-sec">
      <p className="g-load-note">{t('Strength shows retained muscle strength. Train again to reset it.')}</p>
      <div className="g-load-card g-glass">
        <BodyMap levels={st.levels} body={S.body} onMuscle={onMuscle} />
        <LoadLegend less={fmtNum(STRENGTH_FLOOR) + ' ' + t('floor')} more={'1 ' + t('full')} />
      </div>
      {st.losing.length > 0 && (
        <>
          <StageSection title={t('Losing strength')} />
          <div className="g-glist g-glass g-load-list">
            {st.losing.map(m => (
              <LoadRow key={m.slug} slug={m.slug} level={m.level} title={muscleName(m.slug)}
                sub={m.sets90 ? sinceText(m.weeks) : null} value={m.sets90 ? setsText(m.sets90) : sinceText(m.weeks)}
                onClick={() => onMuscle(m.slug)} />
            ))}
          </div>
        </>
      )}
      <StageSection title={t('Est. 1RM')} />
      {lifts.length ? (
        <div className="g-glist g-glass g-load-list">
          {lifts.map((row, i) => {
            const ex = EXIDX[row.id]
            const when = row.lastAt == null ? null : fmtDate(isoOf(new Date(row.lastAt)), true)
            return (
              <ExerciseThumbRow key={row.id} tone="stage" first={i === 0} image={ex?.img ? imgSrc(ex, figure) : null}
                title={ex ? exerciseNameText(ex) : row.name}
                sub={[row.losing ? t('Losing strength') : t('Completed'), when].filter(Boolean).join(' · ')}
                onClick={() => onLift(row.id)}
                trailing={<><span className="g-load-val">{fmtNum(row.est) + ' ' + S.unit}</span><Icon name="chevronRight" className="g-icon g-xrow-chev" /></>} />
            )
          })}
        </div>
      ) : <p className="g-load-note">{t('No exercises with an estimated 1RM yet.')}</p>}
    </section>
  )
}
