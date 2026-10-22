import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'

// One progress photo in the Photos tab's grid (board Me2Photos): a square with the photo in it, the
// day and, under it, that day's weight. The whole tile is the button that opens the viewer. The
// picture is the caller's (`image`, an <img> it resolved; the tile fills the square with it and
// shows a quiet glass tile while there is none). `missing` is a photo whose file is on no device
// here: the tile says so (`missingLabel`) instead of a broken picture. `label` is the tile's
// spoken name. Every string comes from the caller.
export default function PhotoTile({ image, date, caption, missing = false, missingLabel, label, onClick }) {
  return (
    <button type="button" className={cx('g-ptile', missing && 'g-ptile-missing')} aria-label={label} data-swipe-ignore onClick={onClick}>
      <span className="g-ptile-img g-glass">
        {missing
          ? <span className="g-ptile-gone"><Icon name="image" className="g-icon" />{missingLabel}</span>
          : image}
      </span>
      <span className="g-ptile-date">{date}</span>
      {caption && <span className="g-ptile-cap">{caption}</span>}
    </button>
  )
}
