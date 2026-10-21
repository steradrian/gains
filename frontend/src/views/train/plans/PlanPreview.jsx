import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { exCount, routineCount } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { cx } from '../../../lib/ui-kit.js'
import Button from '../../../ds/Button.jsx'
import ChipGroup from '../../../ds/ChipGroup.jsx'
import ExerciseThumbRow from '../../../ds/ExerciseThumbRow.jsx'
import StageFooter from '../../../ds/StageFooter.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import '../coach-pages.css'
import { fitText, usePlanPreview, weekdayName } from './use-plan-preview.js'

const FIT_OPTIONS = () => [{ value: 'fit', label: t('Fit to my equipment') }, { value: 'written', label: t('As written') }]

// A ready-made plan before it is loaded (T10.1, /train/plans/:id): fitted to a profile or as
// written, the week it makes, its routines, and what loading does to the week you have. `id` is
// the route's, unless the gallery hands one in. An id with no plan goes back to the list.
export default function PlanPreview({ id: given }) {
  const params = useParams()
  const nav = useNavigate()
  const { plan, copy, profiles, profile, fitting, setFitting, setProfile, load } = usePlanPreview(given ?? params.id)
  if (!plan || !copy) return <Navigate to="/train/plans" replace />

  const hasProfile = profiles.length > 0
  const fit = fitText(plan.fit)
  const off = plan.replaces.map(r => r.name).join(', ')
  return (
    <StagePage largeTitle={copy.name} sub={`${copy.about} · ${t('{0} days per week', plan.days)}`}>
      <div className="tcp">
        <div className="tcp-block">
          {/* With no profile to fit to the control is shown off and out of reach (PR02Edges) */}
          <div className={hasProfile ? undefined : 'tcp-off'} inert={hasProfile ? undefined : true}>
            <StageSegmented label={t('Fit to my equipment')} options={FIT_OPTIONS()} value={fitting ? 'fit' : 'written'} onChange={v => setFitting(v === 'fit')} />
          </div>
          {!hasProfile && (
            <p className="tcp-line">
              <button type="button" className="tcp-link" onClick={() => nav('/me/equipment')}>{t('Add an equipment profile to fit a plan to what you own.')}</button>
            </p>
          )}
          {fitting && profiles.length > 1 && (
            <ChipGroup tone="stage" scroll label={t('Fit to this profile')} options={profiles.map(p => ({ value: p.id, label: p.name }))} value={profile?.id} onChange={setProfile} />
          )}
          {fit && <p className="tcp-line">{fit.summary}</p>}
          {fit?.changes.map(c => <p key={c} className="tcp-line">{c}</p>)}
        </div>

        <div className="tcp-block">
          <StageSection title={t('Your week')} />
          <ol className="tcp-week">
            {plan.week.map(({ day, routine }) => (
              <li key={day} className={cx('tcp-cell', !routine && 'tcp-cell-rest')} aria-label={`${weekdayName(day, 'long')}: ${routine || t('Rest')}`}>
                <b aria-hidden="true">{weekdayName(day, 'narrow')}</b>
                <span aria-hidden="true">{routine || t('Rest')}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="tcp-block">
          <StageSection title={routineCount(plan.routines.length)} />
          <div className="g-glist g-glass">
            {plan.routines.map((r, i) => (
              <ExerciseThumbRow key={r.name + i} tone="stage" first={i === 0} title={r.name}
                sub={[r.days.map(d => weekdayName(d, 'short')).join(', '), exCount(r.exercises)].filter(Boolean).join(' · ')} />
            ))}
          </div>
        </div>

        <div className="tcp-note g-glass">
          <b>{t('Replaces your current week')}</b>
          <span>{off ? t('Your routines stay. Off the Plan, still in Routines: {0}.', off) : t('Your routines stay. Only the days change.')}</span>
        </div>
      </div>
      <StageFooter sticky={false}>
        <Button block onClick={load}>{t('Load {0}', copy.name)}</Button>
      </StageFooter>
    </StagePage>
  )
}
