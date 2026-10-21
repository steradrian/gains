import { useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t, tn } from '../../lib/i18n.js'
import { exCount, routineCount } from '../../lib/format.js'
import { nav } from '../../lib/nav.js'
import { importPlan, undoImport } from '../../lib/plan-undo.js'
import { markUndone, undoMarks } from '../../lib/sync-merge.js'
import ExerciseStillImg from '../../components/ExerciseStillImg.jsx'
import Icon from '../../components/Icon.jsx'
import { Switch } from '../../components/ui.jsx'
import Button from '../../ds/Button.jsx'
import GlassValueRow from '../../ds/GlassValueRow.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import { importPlanFile, PLAN_FILE_ACCEPT } from '../../sheets.jsx'

const PLAN = '/train/schedule'

/**
 * Import this plan (T3.7) and land on Routines (T4.4): the routines go in as new ones marked with
 * the plan they came from, the page gives way to /train/routines with
 * `state.imported = { ids, from }` (routines M1 shows them as "Added from {from}"), and the toast
 * counts what was added, with an Undo that takes exactly that away again (lib/plan-undo.js). The
 * Undo marks the weekdays it put back, so another device's edit to one meanwhile still wins.
 */
export function importPlanWithUndo(bundle, { schedule = false } = {}) {
  const before = useStore.getState().S
  let done = null
  useStore.getState().update(s => { done = importPlan(s, bundle, { schedule }) })
  const marks = undoMarks(before, useStore.getState().S)
  const n = done.ids.length
  const from = bundle.name || null
  nav('/train/routines', { replace: true, state: { imported: { ids: done.ids, from } } })
  const text = from ? tn('Added {0} routine from {1}', 'Added {0} routines from {1}', n, from)
    : tn('Added {0} routine to your plan', 'Added {0} routines to your plan', n)
  useUI.getState().toast(text, { action: t('Undo'), onAction: () => useStore.getState().update(s => { undoImport(s, done); markUndone(s, marks) }) })
  return done
}

/**
 * T3.7 Import a plan (board Tr3Import), a pushed page. The picked file arrives parsed in the
 * route's state (sheets/plan.jsx importPlanFile): `bundle`, or `error` when it could not be read,
 * and then nothing has changed. Opened cold, with neither, it goes to the Plan page. The gallery
 * passes `bundle` or `error` itself.
 */
export default function PlanImportPage({ bundle: given, error: givenError }) {
  const { state } = useLocation()
  const fileRef = useRef(null)
  const [schedule, setSchedule] = useState(false)
  const bundle = given ?? state?.bundle ?? null
  const error = givenError ?? state?.error ?? null
  if (!bundle && error == null) return <Navigate to={PLAN} replace />

  const pick = ev => { const f = ev.target.files[0]; ev.target.value = ''; importPlanFile(f) }
  const chooser = <input ref={fileRef} type="file" accept={PLAN_FILE_ACCEPT} onChange={pick} hidden />

  if (!bundle) {
    return (
      <StagePage largeTitle={t('Import a plan')} parent={PLAN}>
        <div className="g-tr3-imp">
          <StageEmpty icon="warning" title={t('Couldn’t read that file.')}
            body={error ? t('Import failed: {0}', error) : t('Nothing in your plan changed.')}
            action={t('Choose another file')} onClick={() => fileRef.current?.click()} />
          {chooser}
        </div>
      </StagePage>
    )
  }

  // The schedule only when the file has weekdays: a one-routine file has none (mergePlan then
  // leaves the week alone anyway).
  const days = bundle.scheduledDays > 0
  const counts = [
    routineCount(bundle.routineCount), exCount(bundle.exerciseCount),
    days && tn('{0} day a week', '{0} days a week', bundle.scheduledDays),
  ].filter(Boolean).join(' · ')
  return (
    <StagePage largeTitle={t('Import a plan')} sub={t('Got a plan from a friend?')} parent={PLAN}>
      <div className="g-tr3-imp">
        <div className="g-glist g-glass">
          <GlassValueRow icon="clipboard" title={bundle.name || counts} sub={bundle.name ? counts : null} static />
        </div>
        {bundle.dropped > 0 && (
          <InlineBanner stage icon="warning" title={t(bundle.dropped === 1
            ? '{0} exercise in the file isn’t in your library and was left out.'
            : '{0} exercises in the file aren’t in your library and were left out.', bundle.dropped)} />
        )}
        {bundle.routines.length > 0 && <>
          <StageSection title={t('Routines in this file')} />
          <div className="g-glist g-glass">
            {bundle.routines.map((r, i) => (
              <div key={r.id ?? i} className="g-glist-row g-gvr g-gvr-static">
                <span className="g-tr3-thumb" aria-hidden="true">
                  <ExerciseStillImg id={r.ex[0]?.id} size="44" fallback={<Icon name="dumbbell" className="g-icon" />} />
                </span>
                <span className="g-glist-body"><b>{r.name || t('Shared routine')}</b><span>{exCount(r.ex.length)}</span></span>
              </div>
            ))}
          </div>
        </>}
        {days && (
          <div className="g-glist g-glass">
            <GlassValueRow static title={t('Use this weekly schedule')} sub={t('Replaces your current Mon–Sun assignments.')}
              trailing={<Switch checked={schedule} onChange={setSchedule} aria-label={t('Use this weekly schedule')} />} />
          </div>
        )}
        {!schedule && <p className="g-tr3-imp-note">{t('These are added as new routines. Nothing you already have is touched.')}</p>}
        <Button block disabled={!bundle.routines.length} onClick={() => importPlanWithUndo(bundle, { schedule: days && schedule })}>{t('Import this plan')}</Button>
      </div>
    </StagePage>
  )
}
