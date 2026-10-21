import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../../components/Icon.jsx'
import BodyMap from '../../../ds/BodyMap.jsx'
import ChipGroup from '../../../ds/ChipGroup.jsx'
import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import StageSearchField from '../../../ds/StageSearchField.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import { BODYPARTS, EXDB } from '../../../lib/exercises.js'
import { exCount, fmtNum, todayISO } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { levelsOf } from '../../../lib/muscles.js'
import { useStore } from '../../../store/useStore.js'
import { exerciseDetailSheet } from '../../../sheets.jsx'
import { muscleLoadThisWeek } from '../use-train.js'
import ExerciseRows from './ExerciseRows.jsx'
import FilterChips from './FilterChips.jsx'
import { libraryLine, loggedLine, sentence } from './exercise-lines.js'
import { useExerciseFilters } from './use-exercise-filters.js'
import './exercises.css'

// T6.0 Exercises, /train/exercises: the catalogue and your own exercises, searched and filtered. A
// row opens the exercise's drawer; + makes one of your own (T6.4). Equipment, type and the active
// gym profile's filter live in the filter drawers, Add to my plan in the exercise's drawer.
export default function ExercisesScreen() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const f = useExerciseFilters()
  const ownCount = (S.customEx || []).filter(c => c && c.id).length
  const library = EXDB.length + ownCount
  // Where this week's work went, lit on the small map of the Browse by muscle card.
  const levels = useMemo(() => levelsOf(muscleLoadThisWeek(S, todayISO())), [S.workouts, S.active, S.weekStart])
  const create = () => nav('/train/exercises/new' + (f.q.trim() ? '?name=' + encodeURIComponent(f.q.trim()) : ''))
  const search = t('Search {0} exercises', fmtNum(library))
  const logged = f.logged.map(ex => ({ ex, sub: loggedLine(S, ex) }))
  const rest = f.visible.map(ex => ({ ex, sub: libraryLine(ex) }))
  const similar = f.similar.map(ex => ({ ex, sub: libraryLine(ex) }))
  const empty = !f.total && !f.similar.length

  return (
    <StagePage
      parent="/train"
      largeTitle={t('Exercises')}
      sub={t('{0} in the library · {1} you’ve logged', fmtNum(library), fmtNum(f.loggedCount))}
      actions={[{ icon: 'plus', label: t('Create exercise'), onClick: () => nav('/train/exercises/new') }]}
    >
      <div className="g-xs">
        <div className="g-xs-in">
          <StageSearchField
            placeholder={search} label={search} query={f.q} onChange={f.setQ}
            clearLabel={t('Clear')} count={f.narrowed ? fmtNum(f.total) : undefined} countLabel={exCount(f.total)}
          />
          <ChipGroup tone="stage" scroll label={t('Body part')} value={f.bp} onChange={f.setBp}
            options={[{ value: '', label: t('All') }, ...BODYPARTS.map(b => ({ value: b, label: sentence(t(b)) }))]} />
          <FilterChips f={f} />
        </div>

        {!f.narrowed && (
          <button type="button" className="g-xs-mcard g-xs-card g-glass" onClick={() => nav('/train/exercises/muscles')}>
            <BodyMap tone="stage" width={56} body={S.body} levels={levels} />
            <span className="g-xs-mtext"><b>{t('Browse by muscle')}</b><span>{t('Tap a muscle to see exercises that train it')}</span></span>
            <Icon name="chevronRight" className="g-icon g-xs-mchev" />
          </button>
        )}

        {logged.length > 0 && <StageSection title={t('Your exercises')} action={t('{0} logged', fmtNum(logged.length))} />}
        <ExerciseRows rows={logged} onOpen={exerciseDetailSheet} />

        {rest.length > 0 && (f.searching
          ? <StageSection title={exCount(f.total)} />
          : <StageSection title={t('From the library')} action={t('A to Z')} />)}
        <ExerciseRows rows={rest} onOpen={exerciseDetailSheet} />

        {similar.length > 0 && <StageSection title={f.total ? t('Similar exercises') : t('No exact match. These come close:')} />}
        <ExerciseRows rows={similar} onOpen={exerciseDetailSheet} />

        {empty && <StageEmpty icon="magnifier" title={t('No match')} />}
        {f.hasMore && <button type="button" ref={f.moreRef} className="g-xs-more g-xs-card g-glass" onClick={f.more}>{t('Show more')}</button>}
        {!f.hasMore && (
          <div className="g-xs-card g-glist g-glass">
            <GlassValueRow icon="plus" title={t('Create your own')} sub={t('name + body part, and a photo or video if you like')} onClick={create} />
          </div>
        )}
      </div>
    </StagePage>
  )
}
