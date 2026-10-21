import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// A row with the exercise's catalogue still, on a white rounded tile (bundle.js `ExerciseThumbRow`;
// boards T2.14, T5.0, T6.0, T8.1): where a list of exercises shows. `tone="stage"` is for glass
// lists; `size` is the picture's pixels, and 44 or less draws the small row the today card holds
// (the dumbbell tile without a picture is 52, or 40 when small). `first={false}` adds the rule
// above. A row is a link or a button only with `href` or `onClick`, and then ends in a chevron
// unless `trailing` says otherwise. WorkoutCard's exercise lines are its own (they sit in that
// card's padding and read bigger), so they are not this. `pressed` makes a button row a toggle (a
// picker that takes several: the row says whether it is chosen).
export default function ExerciseThumbRow({ image, size = 52, title, sub, href, onClick, trailing, first = true, tone = 'light', pressed }) {
  const tap = !!(href || onClick)
  const kids = (
    <>
      {image
        ? <img src={image} alt="" width={size} height={size} loading="lazy" />
        : <span className="g-xrow-ph"><Icon name="dumbbell" className="g-icon" /></span>}
      <span className="g-xrow-b"><b>{title}</b>{sub && <span>{sub}</span>}</span>
      {trailing ?? (tap && <Icon name="chevronRight" className="g-icon g-xrow-chev" />)}
    </>
  )
  const className = cx('g-xrow', tone === 'stage' && 'g-xrow-stage', size <= 44 && 'g-xrow-sm', !first && 'g-xrow-line')
  return tap ? <Act href={href} onClick={onClick} className={className} pressed={pressed}>{kids}</Act> : <div className={className}>{kids}</div>
}
