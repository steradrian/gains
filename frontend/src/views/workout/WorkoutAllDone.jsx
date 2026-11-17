// Every set done (board W1.9): the line, Finish workout and Add another exercise, the session's
// exercises, and Trained today. A row opens that exercise again to fix a set.
import { t } from '../../lib/i18n.js'
import StageSection from '../../ds/StageSection.jsx'
import { finishSheet } from './finish-drawers.js'
import { TrainedMap } from './WorkoutBelow.jsx'

export default function WorkoutAllDone({ view, actions }) {
  const { allDone, trainedSoFar } = view
  return (
    <div className="wk-alldone">
      <h2 className="wk-alldone-t">{allDone.title}</h2>
      <p className="wk-alldone-l">{allDone.line}</p>
      <button type="button" className="wk-done" onClick={finishSheet}>{t('Finish workout')}</button>
      <button type="button" className="wk-act wk-act-wide g-glass" onClick={() => actions.addExercise()}>{t('Add another exercise')}</button>
      <section className="wk-sec">
        <StageSection title={allDone.listTitle} />
        <div className="wk-card g-glass">
          {allDone.rows.map(r => (
            <button key={r.idx} type="button" className="wk-row wk-row-btn" onClick={() => actions.selectEntry(r.idx)}>
              <b>{r.name}</b><span>{r.text}</span>
            </button>
          ))}
        </div>
      </section>
      <TrainedMap {...trainedSoFar} title={allDone.trainedTitle} line={null} />
    </div>
  )
}
