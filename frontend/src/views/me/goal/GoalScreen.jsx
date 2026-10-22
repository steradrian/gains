import { t } from '../../../lib/i18n.js'
import Button from '../../../ds/Button.jsx'
import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import StageRing from '../../../ds/StageRing.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import './goal.css'

// My goal (board Me3Goal, with Me3Saved, the Target reached edge and the empty and error states), a
// pushed page on the stage at /me/goal: the target ring, the summary line, then the goal, the target
// weight, the body details, the movement and the daily targets as glass rows. Every row that can
// change opens a drawer (goal-drawers.jsx). It draws what useGoal() and goalViewOf() give it.
//
//   status    'loading' | 'error' | 'ready' | 'no-nutrition' (only the ring and the Target weight row)
//   view      goalViewOf() (null while loading or on error)
//   keeping   Keep my weight is saving
//   on...     the drawers; onKeep (Target reached), onRetry (the error state)
export default function GoalScreen({ status, view, keeping, onGoal, onTarget, onBody, onMovement, onTargets, onHow, onKeep, onRetry }) {
  if (status === 'error') {
    return (
      <StagePage largeTitle={t('My goal')} parent="/me">
        <StageEmpty card={false} illustration="chart" title={t('Goals did not load.')} action={t('Try again')} onClick={onRetry} />
      </StagePage>
    )
  }
  if (status === 'loading' || !view) {
    return (
      <StagePage largeTitle={t('My goal')} parent="/me">
        <div className="mg-page" aria-busy="true">
          <div className="mg-ring"><StageRing loading /></div>
          <i className="g-skel mg-sk" />
          <i className="g-skel mg-sk" />
          <i className="g-skel mg-sk" />
        </div>
      </StagePage>
    )
  }

  const full = status === 'ready'
  const row = (r, onClick, extra) => <GlassValueRow title={r.title} sub={r.sub} value={r.value} onClick={onClick} {...extra} />
  return (
    <StagePage largeTitle={t('My goal')} sub={view.summary || undefined} parent="/me">
      <div className="mg-page">
        <div className="mg-ring"><StageRing {...view.ring} /></div>
        {view.started && <p className="mg-started">{view.started}</p>}

        {full && <div className="g-glist g-glass">{row(view.goal, onGoal)}</div>}
        <div className="g-glist g-glass">{row(view.target, onTarget)}</div>
        {view.canKeep && full && <Button block variant="glass" busy={keeping} onClick={onKeep}>{t('Keep my weight')}</Button>}

        {full && <>
          <section>
            <StageSection title={t('Body details')} />
            <div className="g-glist g-glass">
              {row(view.height, onBody)}
              {row(view.birthYear, onBody)}
              {row(view.sex, onBody)}
            </div>
          </section>
          <div className="g-glist g-glass">{row(view.movement, onMovement)}</div>
          <section>
            <StageSection title={t('Daily targets')} action={t('Edit')} onAction={onTargets} />
            <div className="g-glist g-glass">
              {row(view.calories, undefined, { static: true })}
              {row(view.protein, undefined, { static: true })}
              {row(view.carbs, undefined, { static: true })}
              {row(view.fat, undefined, { static: true })}
              {row(view.water, undefined, { static: true })}
            </div>
          </section>
          <div className="g-glist g-glass"><GlassValueRow title={t('How this is worked out')} onClick={onHow} /></div>
          <StageNote>{t('Every change here can be undone for 8 s, and stays in Recent changes for 7 days.')}</StageNote>
        </>}
      </div>
    </StagePage>
  )
}
