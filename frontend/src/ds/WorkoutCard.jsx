import { Fragment } from 'react'
import ExerciseStillImg from '../components/ExerciseStillImg.jsx'
import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import Act from './Act.jsx'
import BodyMap from './BodyMap.jsx'
import Tag from './Tag.jsx'

// A workout as it appears on a Day page, in History and in the summary (bundle.js `WorkoutCard`):
// the header opens the workout, a small muscle map shows what it trained (`levels`, `body`, with
// `muscles` and `summary` beside it), and each exercise has its catalogue picture and the sets as
// done. exercises: [{ id, name, sets, image, newBest, href, onClick }]: `id` draws the exercise's
// picture (ExerciseStillImg, so a custom exercise shows its own), `image` is a url for a sample.
// Never edits sets: that is the workout drawer. A header or an exercise with neither `href` nor
// `onClick` is only said.
function Line({ href, onClick, className, children }) {
  return href || onClick
    ? <Act href={href} onClick={onClick} className={className}>{children}</Act>
    : <div className={className}>{children}</div>
}

export default function WorkoutCard({ name, meta, badge, href, onClick, levels, body, muscles, summary, exercises = [] }) {
  const opens = !!(href || onClick)
  return (
    <div className="g-wcard g-glass">
      <Line href={href} onClick={onClick} className="g-wcard-head">
        <span className="g-wcard-t"><b>{name}</b>{meta && <span>{meta}</span>}</span>
        {badge && <Tag tone="glass">{badge}</Tag>}
        {opens && <Icon name="chevronRight" className="g-icon" />}
      </Line>
      {(levels || muscles) && (
        <div className="g-wcard-map">
          {levels && <BodyMap levels={levels} body={body} width={70} />}
          <span>{muscles && <b>{muscles}</b>}{summary}</span>
        </div>
      )}
      {exercises.map((e, i) => (
        <Line key={i + e.name} href={e.href} onClick={e.onClick} className="g-wcard-ex">
          {e.id
            ? <ExerciseStillImg id={e.id} fallback={<span className="g-lead"><Icon name="dumbbell" className="g-icon" /></span>} />
            : e.image
              ? <img src={e.image} alt="" loading="lazy" />
              : <span className="g-lead"><Icon name="dumbbell" className="g-icon" /></span>}
          <span className="g-wcard-exb"><b>{e.name}</b>{e.sets && <span>{e.sets}</span>}</span>
          {e.newBest && <Tag tone="glass">{t('New best')}</Tag>}
        </Line>
      ))}
    </div>
  )
}
