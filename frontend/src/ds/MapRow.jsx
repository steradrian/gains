import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'

const STATES = ['done', 'now', 'todo']
const TONES = ['warm', 'main', 'cool']

// One exercise in the workout map (bundle.js `MapRow`; boards W1.37, W1.23, W1.45): the still, the
// name, a line under it, and where it stands on the right: a tick when `done`, the `nowLabel` pill
// ("Set 2 of 3") when `now`, an empty ring when `todo`. `stateLabel` is what a screen reader
// hears for the mark ("Done", "Up next"), since the mark itself is a picture. The row opens with
// `onClick` or `href`; with neither it is plain text.
//
// `superset` "a" or "b" draws the bracket down the start edge (a: from the middle down, b: from
// the top to the middle) so two rows read as a pair. `tone` "warm" or "cool" adds the phase dot
// at the start edge (the workout itself has none).
//
// `handle` adds the drag handle, a button of its own at the end: `handleLabel` names it ("Move
// Bench press"), Arrow Up and Down call `onMove(-1)` / `onMove(1)` (the keyboard's way to
// reorder), and a pointer press calls `onDragStart(event)` (MapDrawer runs the drag; `data-nodrag`
// keeps the sheet's own pull-down from taking the gesture). `lifted` is
// the row held mid-drag: raised on a shadow, a little tilted. Every string comes from the caller.
export default function MapRow({
  image, name, sub, state = 'todo', nowLabel, stateLabel, superset, tone, href, onClick,
  handle = false, handleLabel, onMove, onDragStart, lifted = false,
}) {
  oneOf('MapRow', 'state', state, STATES)
  oneOf('MapRow', 'tone', tone, TONES)
  oneOf('MapRow', 'superset', superset, ['a', 'b'])
  const tap = !!(href || onClick)
  const mark = state === 'done'
    ? <span className="g-mr-done"><Icon name="check" className="g-icon" />{stateLabel && <span className="g-sr">{stateLabel}</span>}</span>
    : state === 'now'
      ? <span className="g-mr-now">{nowLabel}</span>
      : <span className="g-mr-todo">{stateLabel && <span className="g-sr">{stateLabel}</span>}</span>
  const kids = (
    <>
      {image
        ? <img className="g-mr-img" src={image} alt="" width="48" height="48" loading="lazy" />
        : <span className="g-mr-ph"><Icon name="dumbbell" className="g-icon" /></span>}
      <span className="g-mr-b"><b>{name}</b>{sub && <span>{sub}</span>}</span>
      {mark}
    </>
  )
  const key = e => {
    const dir = { ArrowUp: -1, ArrowDown: 1 }[e.key]
    if (!dir || !onMove) return
    e.preventDefault()
    onMove(dir)
  }
  return (
    <div className={cx('g-mr', state === 'now' && 'g-mr-cur', superset && 'g-mr-ss-' + superset, lifted && 'g-mr-lifted')} data-mr="">
      {superset && <span className="g-mr-br" aria-hidden="true" />}
      {tone && tone !== 'main' && <span className={cx('g-mr-dot', 'g-mr-dot-' + tone)} aria-hidden="true" />}
      {tap
        ? <Act href={href} onClick={onClick} className="g-mr-main">{kids}</Act>
        : <div className="g-mr-main">{kids}</div>}
      {handle && (
        <button type="button" className="g-mr-grip" aria-label={handleLabel} onKeyDown={key} data-nodrag=""
          onPointerDown={e => { if (e.pointerType !== 'mouse' || e.button === 0) onDragStart?.(e) }}>
          <Icon name="grip" className="g-icon" />
        </button>
      )}
    </div>
  )
}
