import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'
import ExerciseThumbRow from './ExerciseThumbRow.jsx'
import Tag from './Tag.jsx'

// A stack shows at most this many pictures; the meta line says how many exercises there are.
const STACK = 6

// The day's card on a Train tab root (boards T2.0 to T2.14; neither the app's WorkoutCard, a
// finished workout on a Day page, nor the bundle's TrainingCard, a light card, draws this one): a
// status eyebrow, the workout's name and a line about it, then what is in it and what to do.
// `eyebrow` is the status ("Today · planned", "In progress · 24:18", "Rest day", "Mon 19 Oct ·
// planned"); `chip` is a second tag beside it (T2.14's "Planned"). `progress` (0-1) draws the bar a
// running workout has, which the meta line already says in words. What is in it: `thumbs`, a stack
// of catalogue pictures (urls; a null is a dumbbell tile), or `exercises`, rows of
// { name, sub, image, href, onClick } for a read-only day. `actions` are the buttons, in order:
// [{ label, icon, solid, href, onClick }], the white one `solid`, each as wide as the others; the
// ⋯ beside them is there only with `onMenu` or `menuHref`, named `menuLabel` ("Day options"). Every
// tap is optional, and all strings are the caller's.
export default function StageTrainCard({ eyebrow, chip, title, meta, progress, thumbs, exercises, actions = [], onMenu, menuHref, menuLabel }) {
  const stack = thumbs?.slice(0, STACK)
  return (
    <div className="g-tcard g-glass">
      <div className="g-tcard-tags">
        <Tag tone="glass">{eyebrow}</Tag>
        {chip && <Tag tone="glass">{chip}</Tag>}
      </div>
      <div className="g-tcard-head">
        <b>{title}</b>
        {meta && <span>{meta}</span>}
      </div>
      {progress != null && (
        <div className="g-tcard-bar" aria-hidden="true"><i style={{ '--p': Math.min(Math.max(progress, 0), 1) }} /></div>
      )}
      {stack?.length > 0 && (
        <div className="g-tcard-stack" aria-hidden="true">
          {stack.map((src, i) => (
            <span key={i}>
              {src ? <img src={src} alt="" width="44" height="44" loading="lazy" /> : <i><Icon name="dumbbell" className="g-icon" /></i>}
            </span>
          ))}
        </div>
      )}
      {exercises?.length > 0 && (
        <div className="g-tcard-rows">
          {exercises.map((e, i) => (
            <ExerciseThumbRow key={i + e.name} tone="stage" size={40} first={i === 0} title={e.name} sub={e.sub} image={e.image} href={e.href} onClick={e.onClick} />
          ))}
        </div>
      )}
      {(actions.length > 0 || onMenu || menuHref) && (
        <div className={cx('g-tcard-acts', exercises?.length > 0 && 'tight')}>
          {actions.map(a => (
            <Act key={a.label} href={a.href} onClick={a.onClick} className={cx('g-tcard-btn', a.solid && 'solid')}>
              {a.icon && <Icon name={a.icon} className="g-icon" />}
              {a.label}
            </Act>
          ))}
          {(onMenu || menuHref) && (
            <Act href={menuHref} onClick={onMenu} ariaLabel={menuLabel || t('Day options')} className="g-tcard-menu">
              <Icon name="more" className="g-icon" />
            </Act>
          )}
        </div>
      )}
    </div>
  )
}
