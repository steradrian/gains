import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'
import Button from './Button.jsx'

const TONES = ['warm', 'cool']

// The offer of a warm-up before the first set or a cool-down after the last (bundle.js
// `PhaseOfferSheet`; boards W1.31 and W1.40). The content of a `BottomSheet` (which owns the title
// and the ×): the phase tag in its light tint (`tone` warm or cool, its words in `tag`, such as
// "Warm-up · 3"), a `body` line, the `items` it holds (still, name and line each), then the start
// button and the skip button under it, each with a handler or an href. Every string comes from
// the caller.
export default function PhaseOfferSheet({ tone = 'cool', tag, body, items = [], startLabel, onStart, startHref, skipLabel, onSkip, skipHref }) {
  oneOf('PhaseOfferSheet', 'tone', tone, TONES)
  return (
    <div className="g-offer">
      {tag && <span className={cx('g-offer-tag', 'g-offer-' + tone)}>{tag}</span>}
      {body && <p>{body}</p>}
      {items.length > 0 && (
        <ul className="g-offer-list">
          {items.map((it, i) => (
            <li key={i} className="g-offer-row">
              {it.image
                ? <img src={it.image} alt="" width="48" height="48" loading="lazy" />
                : <span className="g-offer-ph"><Icon name="dumbbell" className="g-icon" /></span>}
              <span className="g-offer-t"><b>{it.name}</b>{it.sub && <small>{it.sub}</small>}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="g-offer-foot">
        <Button block href={startHref} onClick={onStart}>{startLabel}</Button>
        <Button block variant="secondary" href={skipHref} onClick={onSkip}>{skipLabel}</Button>
      </div>
    </div>
  )
}
