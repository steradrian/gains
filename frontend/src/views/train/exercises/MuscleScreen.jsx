import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import BodyMap from '../../../ds/BodyMap.jsx'
import ChipGroup from '../../../ds/ChipGroup.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import StageSearchField from '../../../ds/StageSearchField.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import { BODYPARTS } from '../../../lib/exercises.js'
import { exCount, fmtNum, todayISO } from '../../../lib/format.js'
import { t, tn } from '../../../lib/i18n.js'
import { MUSCLES, MUSCLE_NAME } from '../../../lib/muscles.js'
import { useStore } from '../../../store/useStore.js'
import { exerciseDetailSheet } from '../../../sheets.jsx'
import { muscleLoadThisWeek } from '../use-train.js'
import ExerciseRows from './ExerciseRows.jsx'
import FilterChips from './FilterChips.jsx'
import { libraryLine, loggedLine, sentence } from './exercise-lines.js'
import { useExerciseFilters } from './use-exercise-filters.js'
import './exercises.css'

// T6.2 By muscle, /train/exercises/muscles?muscle=<slug>: tap a muscle on the map to switch to it,
// then what trains it, the exercises you have logged first. The muscle is in the address (replaced,
// not pushed), so back leaves the page and a reload keeps the muscle.
export default function MuscleScreen() {
  const S = useStore(s => s.S)
  const [params, setParams] = useSearchParams()
  const asked = params.get('muscle')
  const muscle = MUSCLES.includes(asked) ? asked : null
  const f = useExerciseFilters({ muscle })
  const pick = slug => setParams(slug === muscle ? {} : { muscle: slug }, { replace: true })
  const sets = useMemo(
    () => Math.round(muscle ? muscleLoadThisWeek(S, todayISO())[muscle] || 0 : 0),
    [muscle, S.workouts, S.active, S.weekStart],
  )
  const name = muscle ? t(MUSCLE_NAME[muscle]) : ''
  const search = t('Search {0} exercises', fmtNum(f.muscleTotal))
  const rows = [
    ...f.logged.map(ex => ({ ex, sub: loggedLine(S, ex) })),
    ...f.visible.map(ex => ({ ex, sub: libraryLine(ex) })),
  ]
  const similar = f.similar.map(ex => ({ ex, sub: libraryLine(ex) }))

  return (
    <StagePage
      parent="/train/exercises"
      largeTitle={muscle ? name : t('Browse by muscle')}
      sub={muscle ? t('Tap another muscle to switch') : t('Tap a muscle to see exercises that train it')}
    >
      <div className="g-xs">
        {muscle && (
          <div className="g-xs-in">
            <ChipGroup tone="stage" scroll label={t('Body part')} value={f.bp} onChange={f.setBp}
              options={[{ value: '', label: t('All') }, ...BODYPARTS.map(b => ({ value: b, label: sentence(t(b)) }))]} />
          </div>
        )}
        <div className="g-xs-map g-xs-card g-glass">
          <BodyMap tone="stage" width={150} body={S.body} label={t('Muscle map')} selected={muscle} levels={muscle ? { [muscle]: 4 } : {}} onMuscle={pick} />
          {muscle && (
            <div className="g-xs-mcap">
              <b>{name}</b>
              <span>{exCount(f.muscleTotal)} · {tn('{0} set this week', '{0} sets this week', sets)}</span>
            </div>
          )}
        </div>

        {muscle && (
          <>
            <div className="g-xs-in">
              <StageSearchField
                placeholder={search} label={search} query={f.q} onChange={f.setQ}
                clearLabel={t('Clear')} count={f.narrowed ? fmtNum(f.total) : undefined} countLabel={exCount(f.total)}
              />
              <FilterChips f={f} />
            </div>
            <StageSection title={t('Exercises for {0}', name)} />
            <ExerciseRows rows={rows} onOpen={exerciseDetailSheet} />
            {similar.length > 0 && <StageSection title={f.total ? t('Similar exercises') : t('No exact match. These come close:')} />}
            <ExerciseRows rows={similar} onOpen={exerciseDetailSheet} />
            {!f.total && !similar.length && <StageEmpty icon="magnifier" title={t('No match')} />}
            {f.hasMore && <button type="button" ref={f.moreRef} className="g-xs-more g-xs-card g-glass" onClick={f.more}>{t('Show more')}</button>}
          </>
        )}
      </div>
    </StagePage>
  )
}
