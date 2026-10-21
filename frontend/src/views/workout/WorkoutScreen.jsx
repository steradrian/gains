// The running workout on /train/workout (PR-03 boards W1.0 to W1.44): full screen on the stage, no
// tab bar. Everything it shows comes from useWorkout().view and every tap goes to its actions or to
// the drawer openers (drawers.js, finish-drawers.js). The top bar minimises (Back does the same,
// and neither discards), the phase bar opens the map, the focus area is the exercise being worked,
// below the fold its history and the muscles so far, and the footer is the way along, the rest and
// Ready. The bar toast says what just finished or a new best, about 4 s each, one at a time.
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { nav } from '../../lib/nav.js'
import { back } from '../../lib/use-tab-nav.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import { fmtRest } from '../../lib/duration.js'
import { addRoutineToSessionSheet, exitWorkoutEdit, finishWorkout, workoutDetailSheet } from '../../sheets.jsx'
import Elapsed from '../../components/Elapsed.jsx'
import BarToast from '../../ds/BarToast.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import PhaseProgress from '../../ds/PhaseProgress.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import WorkoutFooter from '../../ds/WorkoutFooter.jsx'
import WorkoutTopBar from '../../ds/WorkoutTopBar.jsx'
import { restWheelSheet, workoutMapSheet } from './drawers.js'
import { cooldownOfferSheet, discardSheet, finishSheet } from './finish-drawers.js'
import { useWorkout } from './use-workout.js'
import { markOffered } from './workout-actions.js'
import WorkoutAllDone from './WorkoutAllDone.jsx'
import WorkoutBelow from './WorkoutBelow.jsx'
import WorkoutFocus from './WorkoutFocus.jsx'
import './workout.css'

// How long a bar toast stays (boards W1.2, W1.7, W1.8, W1.39).
export const BAR_TOAST_MS = 4000
// The rest row's step (owner question 17).
const REST_STEP = 15

/** The editor's ×: the save prompt, then the saved workout's own drawer in History (owner question 16). */
const closeEditor = () => {
  const id = useStore.getState().S.active?.editingWorkoutId
  exitWorkoutEdit(() => {
    nav('/train/history')
    const w = useStore.getState().S.workouts?.find(x => x.id === id)
    if (w) workoutDetailSheet(w)
  })
}

export default function WorkoutScreen() {
  const accent = useDsAccent()
  const { view, actions } = useWorkout()
  const timer = useUI(s => s.timer)
  // Every set done shows the W1.9 summary; `peek` is an exercise opened from it to fix a set.
  const [peek, setPeek] = useState(false)
  const finished = !!view?.allDone
  useEffect(() => { if (finished) setPeek(false) }, [finished])

  // The cool-down offer, once (W1.40): marked as offered as it opens.
  const offer = view?.offer
  useEffect(() => {
    if (offer !== 'cooldown') return
    markOffered('cooldown')
    cooldownOfferSheet()
  }, [offer])

  // The other side of a timed per-side hold starts on its own when the switch pause runs out.
  const lastKind = useRef(null)
  const current = view?.current
  useEffect(() => {
    const was = lastKind.current
    lastKind.current = timer?.kind || null
    if (was !== 'switch' || timer || useUI.getState().work || !current?.timed) return
    const set = useStore.getState().S.active?.entries?.[current.idx]?.sets?.[current.i]
    if (set?.side === 'R' && !set.done) actions.startTimed(current.idx, current.i)
  }, [timer])

  // One bar toast at a time, the older first; each goes after BAR_TOAST_MS.
  const toast = view ? [view.takeover && { kind: 'takeover', ...view.takeover }, view.newBest && { kind: 'newBest', ...view.newBest }]
    .filter(Boolean).sort((a, b) => a.id - b.id)[0] || null : null
  useEffect(() => {
    if (!toast) return
    const tm = setTimeout(() => actions.takeEvent(toast.kind), BAR_TOAST_MS)
    return () => clearTimeout(tm)
  }, [toast?.id])

  if (!view) return null
  const { top, progress, hero, rest, footer, editing, empty, allDone } = view
  const showAllDone = !!allDone && !peek && !editing
  const status = top.offline ? (top.offline.waiting != null ? t('Offline · {0} waiting', top.offline.waiting) : t('Offline')) : null
  // An empty freestyle session has nothing to finish: its pill is Discard (W1.30).
  const discards = empty && !useStore.getState().S.active?.routineIds?.length
  const finish = editing ? finishWorkout : discards ? discardSheet : finishSheet
  const resting = !!rest && !rest.ready
  const restFooter = rest ? {
    left: fmtRest(Math.max(0, rest.left)), label: rest.shown, progress: rest.progress, paused: rest.paused,
    onClock: restWheelSheet,
    onMinus: () => useUI.getState().addRest(-REST_STEP),
    onPlus: () => useUI.getState().addRest(REST_STEP),
    onPause: () => (rest.paused ? useUI.getState().resumeRest() : useUI.getState().pauseRest()),
    onSkip: () => useUI.getState().stopRest(),
  } : null
  const neighbour = item => (item ? { image: item.image, onClick: () => { setPeek(true); actions.selectEntry(item.idx) } } : null)

  const onToast = () => {
    const ev = toast
    actions.takeEvent(ev.kind)
    if (ev.kind === 'newBest') {
      // Trend leaves the workout, which minimises it. The toast sits under any open drawer, so a
      // tap on it never navigates from under one.
      nav('/progress/strength?ex=' + encodeURIComponent(ev.exId))
    } else actions.backTo(ev.backTo)
  }

  return (
    <StageScreen accent={accent}>
      <div className="wk">
        <WorkoutTopBar
          title={editing ? top.dateLine : top.name}
          clock={editing ? null : top.start ? <Elapsed start={top.start} /> : top.dateLine}
          status={status}
          closeIcon={editing} closeLabel={t('Close editor')} onClose={closeEditor}
          minimiseLabel={t('Minimise')} onMinimise={() => back()}
          finishLabel={top.finishLabel} onFinish={finish}
        />
        <div className="wk-body">
          {editing && (
            <div className="wk-gut">
              <InlineBanner stage icon="pencil" title={t('Editing a saved workout')} body={t('Date and duration stay as they were. No rest timers while you edit.')} />
            </div>
          )}
          {!empty && (
            <div className="wk-phase">
              <PhaseProgress phases={progress.phases} index={progress.run.index} done={progress.run.done} partial={progress.run.partial}
                label={progress.label} onOpen={workoutMapSheet} />
              {view.review?.back && (
                <button type="button" className="wk-back g-glass" onClick={() => actions.selectEntry(view.review.back.idx)}>{view.review.back.short}</button>
              )}
            </div>
          )}

          {empty && (
            <div className="wk-gut">
              <StageEmpty icon="plusCircle" title={t('Pick as you go')} body={t('Add an exercise and log it here. Each one you add joins the bar at the top.')}
                action={t('Add exercise')} onClick={() => actions.addExercise()}
                actions={[{ label: t('Bring a routine in'), onClick: addRoutineToSessionSheet }]} />
            </div>
          )}
          {showAllDone && <WorkoutAllDone view={view} actions={{ ...actions, selectEntry: idx => { setPeek(true); actions.selectEntry(idx) } }} />}
          {!empty && !showAllDone && hero && (
            <>
              {allDone && !editing && (
                <button type="button" className="wk-back wk-back-all g-glass" onClick={() => setPeek(false)}>{allDone.title}</button>
              )}
              <WorkoutFocus key={hero.idx} view={view} actions={actions} />
              {!editing && <WorkoutBelow view={view} />}
            </>
          )}
        </div>

        {toast && (
          <BarToast placement={resting || rest?.ready ? 'rest' : 'footer'} icon={toast.kind === 'newBest' ? 'trophy' : 'check'} message={toast.text}
            actionLabel={toast.kind === 'newBest' ? t('Trend') : toast.backTo != null ? t('Back') : undefined} onAction={onToast} />
        )}
        {!empty && (
          <WorkoutFooter
            prev={neighbour(footer.prev)} next={neighbour(footer.next)} position={view.position} phase={view.phaseLabel} onMap={workoutMapSheet}
            rest={rest?.ready ? { onPlus: restFooter.onPlus } : resting ? restFooter : null}
            ready={!!rest?.ready} readyTitle={rest?.ready || undefined} readyLabel={t('Rest is over')}
            goText={rest?.go || t('Go')} goLabel={t('Start the next set')} onGo={() => useUI.getState().stopRest()}
            navLabel={t('Exercises')} prevLabel={footer.prev?.say} nextLabel={footer.next?.say} mapLabel={t('All exercises')}
            clockLabel={rest ? t('{0}, {1} left. Change', rest.label, fmtRest(Math.max(0, rest.left))) : undefined}
            minusLabel={t('15 seconds less')} plusLabel={t('15 seconds more')} pauseLabel={t('Pause rest')} resumeLabel={t('Resume rest')}
            skipLabel={t('Skip rest')} stepText={t('15 s')} skipText={t('Skip')}
          />
        )}
      </div>
    </StageScreen>
  )
}
