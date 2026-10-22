import ExerciseStillImg from '../components/ExerciseStillImg.jsx'
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
// running workout has, which the meta line already says in words. What is in it: `stills`, a stack
// of the exercises' own pictures (exercise ids, each drawn by ExerciseStillImg, so a custom
// exercise shows its own), or `thumbs`, a stack of urls (a null is a dumbbell tile; the kit's
// samples), or `exercises`, rows of { id, name, sub, image, href, onClick } for a read-only day
// (`id` draws the exercise's picture, `image` is a url). `actions` are the buttons, in order:
// [{ label, icon, solid, href, onClick }], the white one `solid`, each as wide as the others; the
// ⋯ beside them is there only with `onMenu` or `menuHref`, named `menuLabel` ("Day options"). Every
// tap is optional, and all strings are the caller's.
export default function StageTrainCard({ eyebrow, chip, title, meta, progress, stills, thumbs, exercises, actions = [], onMenu, menuHref, menuLabel }) {
  const stack = stills?.length
    ? stills.slice(0, STACK).map(id => <ExerciseStillImg id={id} size="44" />)
    : thumbs?.slice(0, STACK).map(src => (src ? <img src={src} alt="" width="44" height="44" loading="lazy" /> : <i><Icon name="dumbbell" className="g-icon" /></i>))
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
          {stack.map((slot, i) => <span key={i}>{slot}</span>)}
        </div>
      )}
      {exercises?.length > 0 && (
        <div className="g-tcard-rows">
          {exercises.map((e, i) => (
            <ExerciseThumbRow key={i + e.name} tone="stage" size={40} first={i === 0} title={e.name} sub={e.sub} stillId={e.id} image={e.image} href={e.href} onClick={e.onClick} />
          ))}
        </div>
      )}
      {(actions.length > 0 || onMenu || menuHref) && (
        <div className={cx('g-tcard-acts', exercises?.length > 0 && 'tight')}>
          {actions.map(a => (
            <Act key={a.label} href={a.href} onClick={a.onClick} className={cx('g-tcard-btn', a.solid ? 'solid' : 'g-glass')}>
              {a.icon && <Icon name={a.icon} className="g-icon" />}
              {a.label}
            </Act>
          ))}
          {(onMenu || menuHref) && (
            <Act href={menuHref} onClick={onMenu} ariaLabel={menuLabel || t('Day options')} className="g-tcard-menu g-glass">
              <Icon name="more" className="g-icon" />
            </Act>
          )}
        </div>
      )}
    </div>
  )
}
