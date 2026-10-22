// Below the fold of the running workout (boards W1.0, W1.6, W1.32, W1.41): on a timed exercise
// what comes next in its part; the exercise's last 3 times with All, its best and e1RM, or the
// first-time block; then Trained so far with the muscle map.
import { exerciseHistorySheet } from '../../sheets.jsx'
import BodyMap from '../../ds/BodyMap.jsx'
import StageSection from '../../ds/StageSection.jsx'

export function TrainedMap({ title, line, levels, less, more }) {
  return (
    <section className="wk-sec">
      <StageSection title={title} />
      <div className="wk-card g-glass">
        {line && <p className="wk-card-line">{line}</p>}
        <BodyMap levels={levels} tone="stage" />
        <p className="wk-legend" aria-hidden="true">
          <span>{less}</span>
          <i className="wk-legend-bar" />
          <span>{more}</span>
        </p>
      </div>
    </section>
  )
}

export default function WorkoutBelow({ view }) {
  const { history, upNext, trainedSoFar, hero } = view
  return (
    <div className="wk-below">
      {upNext && (
        <section className="wk-sec">
          <StageSection title={upNext.title} />
          <div className="wk-card g-glass">
            {upNext.rows.map(r => (
              <p key={r.idx} className="wk-row"><b>{r.name}</b><span>{r.text}</span></p>
            ))}
          </div>
        </section>
      )}
      {history && (
        <section className="wk-sec">
          <StageSection title={history.title} action={history.rows.length ? history.allLabel : undefined}
            onAction={history.rows.length ? () => exerciseHistorySheet(hero.exId) : undefined} />
          <div className="wk-card g-glass">
            {history.first && <p className="wk-card-line">{history.first}</p>}
            {history.rows.map(r => (
              <p key={r.id} className="wk-row"><span>{r.date}</span><b><bdi dir={r.dir}>{r.text}</bdi></b></p>
            ))}
            {history.best && (
              <p className="wk-row wk-best"><b><bdi dir={history.bestDir}>{history.best}</bdi></b>{history.bestSub && <span>{history.bestSub}</span>}</p>
            )}
          </div>
        </section>
      )}
      <TrainedMap {...trainedSoFar} />
    </div>
  )
}
