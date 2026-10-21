import { useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'

const STATES = ['today', 'done', 'noted', 'missed', 'rest', 'planned', 'plain']
// A drag shorter than SLOP is still a tap; one of SWIPE or more turns the page.
const SLOP = 8
const SWIPE = 48

// What the cell says under its date: the first word of the workout ("Push A" reads "Push").
const tagOf = d => d.tag ?? (d.name ? d.name.split(/\s+/)[0] : '')

// The week rail of a tab root on the stage (boards T2.0, T2.3, T2.14; bundle.js `StageWeekStrip`
// is the Eat/Train mark strip, which the boards do not draw here): seven cells, each its day
// letter, its number, one mark and the workout. `weeks` is an array of weeks of days, `week` the
// index shown, `onWeek(i)` asks for another, and both ends are the caller's (`canBack`,
// `canForward`: the data decides where the rail stops). Swiping turns the page with pointer events
// (a drag past 48px); the title row has ‹ › for the keyboard. ‹ is drawn only away from `home`
// (the index of this week, as the boards do), but stays a tab stop there so earlier weeks do not
// need a swipe.
// A day: { iso, dow, date, state, label, name | tag, href }. `state` is today, done, noted, missed,
// rest, planned or plain (before the first workout: no mark); `label` is the whole day in words,
// which the caller writes ("Mon 19 Oct, Legs"). A day with `disabled` is dimmed and cannot be
// tapped (the Day page's days before the first log). `selected` is a day's `iso`, and `onSelect(day)`
// fires for every tap; a day with `href` is a link as well. The week's `title` ("This week") is the
// caller's too, and so are the two arrows' names.
export default function StageDayRail({
  weeks = [], week = 0, onWeek, selected, onSelect, title, action, actionHref, onAction,
  canBack, canForward, home = 0, backLabel, forwardLabel,
}) {
  const last = Math.max(weeks.length - 1, 0)
  const at = Math.min(Math.max(week, 0), last)
  const back = (canBack ?? true) && at > 0
  const forward = (canForward ?? true) && at < last
  const view = useRef(null)
  const gesture = useRef(null)
  const blockClick = useRef(false)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  // The pages do not change while a finger drags the track, so a move re-renders the track only.
  // A page is keyed by its first day, so it keeps its cells when the caller's first week moves.
  const pages = useMemo(() => weeks.map((days, i) => (
    <div key={days[0]?.iso ?? i} className="g-rail-page" role="group" aria-label={i === at ? title : undefined} inert={i !== at}>
      {days.map(d => {
        oneOf('StageDayRail', 'state', d.state, STATES)
        const tag = tagOf(d)
        return (
          <Act
            key={d.iso ?? d.dow + d.date}
            href={d.href}
            onClick={() => onSelect?.(d)}
            ariaLabel={d.label}
            pressed={d.href ? undefined : d.iso === selected}
            disabled={d.href ? undefined : d.disabled}
            className={cx('g-rd', d.iso === selected && 'on', d.state === 'today' && 'now')}
          >
            <span className="g-rd-dow" aria-hidden="true">{d.dow}</span>
            <b aria-hidden="true">{d.date}</b>
            <i className={cx('g-rd-dot', 'g-rd-' + d.state)} aria-hidden="true" />
            <span className="g-rd-tag" aria-hidden="true">{tag}</span>
          </Act>
        )
      })}
    </div>
  )), [weeks, at, title, selected, onSelect])

  const go = i => { if (i !== at) onWeek?.(i) }
  // dx is towards the next week when the finger moves against the reading direction
  const towardsNext = (g, dx) => (g.rtl ? dx > 0 : dx < 0)
  const allowed = (g, dx) => (towardsNext(g, dx) ? forward : back)

  const down = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // The reading direction is read once per gesture, not on every move.
    const rtl = !!view.current && getComputedStyle(view.current).direction === 'rtl'
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, live: false, rtl }
  }
  const move = e => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const dx = e.clientX - g.x
    if (!g.live) {
      if (Math.abs(dx) < SLOP) return
      if (Math.abs(e.clientY - g.y) > Math.abs(dx)) { gesture.current = null; return }
      g.live = true
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setDragging(true)
    }
    g.dx = dx
    // an end with no page beyond it gives a little, so it feels like an end
    setDrag(allowed(g, dx) ? dx : dx * 0.25)
  }
  const end = (e, cancelled) => {
    const g = gesture.current
    gesture.current = null
    if (!g?.live) return
    // the click that follows a drag is not a tap
    blockClick.current = true
    setTimeout(() => { blockClick.current = false }, 0)
    setDragging(false)
    setDrag(0)
    if (!cancelled && Math.abs(g.dx) >= SWIPE && allowed(g, g.dx)) go(at + (towardsNext(g, g.dx) ? 1 : -1))
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  // Both arrows are always there, so a keyboard step to the last week keeps focus on the arrow
  // instead of dropping it to the page. At an end it is aria-disabled, not disabled: a browser
  // moves focus off a button that becomes disabled.
  const arrow = (dir, label, can) => (
    <button
      type="button"
      className={cx('g-rail-btn', dir < 0 && at === home && 'g-rail-quiet')}
      aria-label={label}
      aria-disabled={can ? undefined : 'true'}
      onClick={() => { if (can) go(at + dir) }}
    >
      <Icon name={dir < 0 ? 'chevronLeft' : 'chevronRight'} className="g-icon" />
    </button>
  )

  return (
    <div className="g-rail">
      <div className="g-rail-top">
        <span className="g-rail-title" aria-live="polite">{title}</span>
        <span className="g-rail-nav">
          {action && (
            <Act href={actionHref} onClick={onAction} className="g-rail-act">
              {action}
              <Icon name="chevronRight" className="g-icon" />
            </Act>
          )}
          {arrow(-1, backLabel || t('Previous week'), back)}
          {arrow(1, forwardLabel || t('Next week'), forward)}
        </span>
      </div>
      <div
        ref={view}
        className="g-rail-view"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={e => end(e, false)}
        onPointerCancel={e => end(e, true)}
        onClickCapture={e => { if (blockClick.current) { e.preventDefault(); e.stopPropagation() } }}
      >
        <div className={cx('g-rail-track', dragging && 'drag')} style={{ '--week': at, '--drag': drag + 'px' }}>
          {pages}
        </div>
      </div>
    </div>
  )
}
