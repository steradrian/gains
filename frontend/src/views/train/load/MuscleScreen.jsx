import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../../../store/useStore.js'
import { t } from '../../../lib/i18n.js'
import { EXIDX, figureOf, imgSrc } from '../../../lib/exercises.js'
import { exerciseNameText, fmtDate, fmtNum } from '../../../lib/format.js'
import { MUSCLE_WEEKLY_TARGET } from '../../../lib/muscles.js'
import BodyMap from '../../../ds/BodyMap.jsx'
import ExerciseThumbRow from '../../../ds/ExerciseThumbRow.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StatTiles from '../../../ds/StatTiles.jsx'
import { exerciseDetailSheet } from '../../../sheets.jsx'
import { useTodayDate } from '../../today/use-today.js'
import { isMuscle, muscleName, muscleOf, readyWhen, setsText, useNow } from './use-training-load.js'

const STATE = { fatigued: () => t('Fatigued'), recovering: () => t('Recovering'), ready: () => t('Ready') }

/**
 * T9.6 a muscle (/progress/load/muscle/:slug): its sets this week against the common target, the
 * last 4 weeks, its fatigue with when it is ready again, this week's exercises that trained it, and
 * catalogue exercises for it you have not done ("Try next"). Any exercise opens its drawer. A slug
 * that is no muscle goes back to Training load. `slug` is for the gallery, which has no route.
 */
export default function MuscleScreen({ slug: given }) {
  const nav = useNavigate()
  const params = useParams()
  const slug = given || params.slug
  const S = useStore(s => s.S)
  const today = useTodayDate()
  const now = useNow()
  const known = isMuscle(slug)
  const m = useMemo(() => (known ? muscleOf(S, slug, { now, today }) : null), [known, S, slug, now, today])
  useEffect(() => { if (!known) nav('/progress/load', { replace: true }) }, [known])
  if (!m) return null

  const figure = figureOf(S)
  const until = m.state !== 'ready' ? readyWhen(m.readyAt, now) : null
  const tiles = [
    { label: t('This week'), value: setsText(m.week), sub: t('of {0} to {1}', MUSCLE_WEEKLY_TARGET.min, MUSCLE_WEEKLY_TARGET.max) },
    { label: t('Last 4 weeks'), value: setsText(m.four), sub: t('{0} a week', fmtNum(m.perWeek)) },
    { label: t('Fatigue'), value: Math.round(m.fatigue * 100) + '%', sub: until ? t('rest until {0}', until) : STATE[m.state]() },
  ]
  const thumb = ex => (ex?.img ? imgSrc(ex, figure) : null)

  return (
    <StagePage title={muscleName(slug)} parent="/progress/load">
      <div className="g-load">
        <div className="g-load-card g-glass">
          <BodyMap levels={{ [slug]: 4 }} selected={slug} body={S.body} label={muscleName(slug)} />
        </div>
        <StatTiles tone="stage" items={tiles} />
        <section className="g-load-sec">
          <StageSection title={t('Exercises that trained it')} action={t('This week')} />
          {m.exercises.length ? (
            <div className="g-glist g-glass g-load-list">
              {m.exercises.map((r, i) => {
                const ex = EXIDX[r.id]
                return (
                  <ExerciseThumbRow key={r.id} tone="stage" first={i === 0} image={thumb(ex)}
                    title={ex ? exerciseNameText(ex) : (r.entry.exercise?.n || r.entry.n || r.id)}
                    sub={r.primary
                      ? [setsText(r.sets), r.day && fmtDate(r.day, true)].filter(Boolean).join(' · ')
                      : t('{0} counted · secondary', setsText(r.counted))}
                    onClick={ex ? () => exerciseDetailSheet(ex) : undefined} />
                )
              })}
            </div>
          ) : <p className="g-load-note">{t('Nothing trained it this week yet.')}</p>}
        </section>
        {m.tryNext.length > 0 && (
          <section className="g-load-sec">
            <StageSection title={t('Try next')} />
            <div className="g-glist g-glass g-load-list">
              {m.tryNext.map((ex, i) => (
                <ExerciseThumbRow key={ex.id} tone="stage" first={i === 0} image={thumb(ex)} title={exerciseNameText(ex)}
                  sub={muscleName(slug) + ' · ' + t(ex.eq)} onClick={() => exerciseDetailSheet(ex)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </StagePage>
  )
}
