import { useRef } from 'react'
import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'
import WorkoutThumb from './WorkoutThumb.jsx'

const DOTS = ['done', 'now', 'todo']
// A drag of SWIPE px or more, mostly sideways, is a swipe; anything shorter is a tap.
const SWIPE = 48
const SWALLOW_MS = 300
// A name longer than this is set a size smaller so it keeps to two lines.
const LONG_NAME = 22

// The exercise being worked, on the stage (boards W1.2, W1.32, W1.36, W1.41): the picture (opens
// How to), the name, its meta line, the quiet `plan` line under it when the exercise has one, a dot per set, and ⋯ for the options. Above it the `part`
// eyebrow ("Workout · 1 of 6"), below it the pinned setup `note`. `newToYou` adds the white tag
// `newText` ("New to you · how to"), which opens How to as well.
//
// `onSwipe('prev' | 'next')` makes a sideways swipe on the hero a shortcut for the footer's ‹ ›
// (the arrows stay the way in; the reading direction is read once per gesture, so in rtl a swipe
// towards the start is 'next'). Every string, the spoken names `howLabel` ("Bench press, how to")
// and `moreLabel` ("Bench press, options") and `dotsLabel` ("Set 1 of 3") included, is the caller's.
export default function ExerciseHero({
  image, clip, name, meta, plan, dots = [], dotsLabel, newToYou = false, newText,
  howLabel, howHref, onHow, moreLabel, moreHref, onMore, note, part, onSwipe,
}) {
  const view = useRef(null)
  const gesture = useRef(null)
  // The click a swipe's pointerup is followed by must not press the picture or ⋯ it ended over; it
  // is swallowed for a moment, and a tap after that is a tap again.
  const swallowUntil = useRef(0)

  const down = e => {
    if (!onSwipe || (e.pointerType === 'mouse' && e.button !== 0)) return
    const rtl = !!view.current && getComputedStyle(view.current).direction === 'rtl'
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, rtl }
  }
  const up = e => {
    const g = gesture.current
    gesture.current = null
    if (!g || g.id !== e.pointerId) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(dy) * 1.5) return
    swallowUntil.current = performance.now() + SWALLOW_MS
    const towardsEnd = g.rtl ? dx > 0 : dx < 0
    onSwipe(towardsEnd ? 'next' : 'prev')
  }
  const cancel = () => { gesture.current = null }
  const guardClick = e => {
    if (performance.now() >= swallowUntil.current) return
    swallowUntil.current = 0
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      ref={view}
      className={cx('g-xh', onSwipe && 'g-xh-swipe')}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={cancel}
      onClickCapture={guardClick}
    >
      {part && <p className="g-xh-part">{part}</p>}
      <div className="g-xh-row">
        <Act href={howHref} onClick={onHow} ariaLabel={howLabel} className="g-xh-pic">
          <WorkoutThumb image={image} clip={clip} size="lg" />
          <span className="g-xh-play" aria-hidden="true"><Icon name="play" className="g-icon" /></span>
        </Act>
        <span className="g-xh-b">
          <b className={cx('g-xh-name', (name || '').length > LONG_NAME && 'g-xh-long')}>{name}</b>
          {meta && <span className="g-xh-meta">{meta}</span>}
          {plan && <span className="g-xh-plan">{plan}</span>}
          {dots.length > 0 && (
            <span className="g-xh-dots" role={dotsLabel ? 'img' : undefined} aria-label={dotsLabel} aria-hidden={dotsLabel ? undefined : true}>
              {dots.map((s, i) => <span key={i} className={'g-xh-dot g-xh-' + oneOf('ExerciseHero', 'dots', s, DOTS)} />)}
            </span>
          )}
          {newToYou && (
            <Act href={howHref} onClick={onHow} className="g-xh-new">
              <Icon name="star" className="g-icon" />
              {newText}
            </Act>
          )}
        </span>
        <Act href={moreHref} onClick={onMore} ariaLabel={moreLabel} className="g-xh-more g-glass">
          <Icon name="more" className="g-icon" />
        </Act>
      </div>
      {note && (
        <p className="g-xh-note">
          <Icon name="pin" className="g-icon" />
          {note}
        </p>
      )}
    </div>
  )
}
