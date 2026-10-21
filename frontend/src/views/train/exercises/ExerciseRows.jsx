import Icon from '../../../components/Icon.jsx'
import ExerciseThumbRow from '../../../ds/ExerciseThumbRow.jsx'
import { exerciseNameText } from '../../../lib/format.js'
import { isFav } from '../../../lib/favourites.js'
import { t } from '../../../lib/i18n.js'
import { useStore } from '../../../store/useStore.js'
import { pictureOf } from '../use-train.js'

// Exercises as rows in one glass card (boards T6.0, T6.2): the still, the name, a line under it.
// `rows` are `{ ex, sub }`; a tap opens the exercise (`onOpen`). A favourite carries a star, named
// for a screen reader, ahead of its name.
export default function ExerciseRows({ rows, onOpen }) {
  const S = useStore(s => s.S)
  if (!rows.length) return null
  return (
    <div className="g-xs-card g-xr g-glass">
      {rows.map(({ ex, sub }, i) => (
        <ExerciseThumbRow
          key={ex.id}
          tone="stage"
          first={i === 0}
          image={pictureOf(S, ex.id)}
          title={<>{isFav(S, ex.id) && <span className="g-xr-star" role="img" aria-label={t('Favourite')}><Icon name="starFill" className="g-icon" /></span>}{exerciseNameText(ex)}</>}
          sub={sub}
          onClick={() => onOpen(ex)}
        />
      ))}
    </div>
  )
}
