import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// Food on Today as a row of tiles that scrolls sideways (bundle.js `MealTiles`). meals:
// [{ icon, name, sub, state, href }]. A tile is glass and says what it holds: `done` carries a
// check (a logged meal), `empty` says so ("Nothing yet"), and `now` is the one solid white tile
// with a + and its call ("Add now"), the meal due. A name wraps to two lines and the line under it
// to as many as it needs, so a number never truncates; the tiles grow with the tallest.
export default function MealTiles({ meals, onPick }) {
  return (
    <div className="g-tiles">
      {meals.map((m, i) => {
        oneOf('MealTiles', 'state', m.state, ['done', 'now', 'empty'])
        const now = m.state === 'now'
        return (
          <Act key={m.name} href={m.href} onClick={() => onPick?.(m, i)} className={cx('g-tile', now ? 'g-tile-now' : 'g-glass')}>
            <span className="g-tile-top">
              <span className="g-tile-ic"><Icon name={m.icon || 'utensils'} className="g-icon" /></span>
              {m.state === 'done' && <span className="g-tile-done" role="img" aria-label={t('Logged')}><Icon name="check" className="g-icon" /></span>}
            </span>
            <span className="g-tile-body">
              <b>{m.name}</b>
              <span>{now && <Icon name="plus" className="g-icon" />}{m.sub}</span>
            </span>
          </Act>
        )
      })}
      <span className="g-tiles-end" aria-hidden="true" />
    </div>
  )
}
