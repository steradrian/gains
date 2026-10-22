import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// A month on the stage, a week to a row (bundle.js `MonthGrid`): the month's title with ‹ ›, a row
// of weekday letters, then the days. A day with a value (0 to 1 and over) carries a small ring;
// one without is dimmed. The kit has no copy and no calendar maths: the caller gives the title,
// the weekday letters in the order its week starts, the `offset` (blank cells before day 1) and
// every spoken name.
//
//   days     [{ day, value, label, iso, href, onClick }]. `label` is the cell's name for a screen
//            reader ("Mon 12 Oct, 2 workouts"). A day is a button when `onDay` is set and it has an
//            `iso` (onDay(iso)), or a link with `href`, or a button with `onClick`; otherwise it is
//            just drawn. Without `label` a tappable day is named by its number.
//   today    the day number to light
//   weekdays seven strings, in display order
//   legend   [{ label, value }]: a ring and its meaning ("Trained"); a value above 1 draws as over
//   onPrev / onNext, prevLabel / nextLabel   a missing handler draws that arrow disabled
//
// Columns follow the page's direction, and the arrows mirror in a right-to-left language.
export default function MonthGrid({ days, title, offset = 0, today, weekdays, legend, onDay, onPrev, onNext, prevLabel, nextLabel }) {
  return (
    <div className="g-mg g-glass" role="group" aria-label={title}>
      <div className="g-mg-top">
        <b aria-live="polite">{title}</b>
        <span>
          <button type="button" className="g-mg-nav" aria-label={prevLabel} disabled={!onPrev} onClick={onPrev}><Icon name="chevronLeft" className="g-icon" /></button>
          <button type="button" className="g-mg-nav" aria-label={nextLabel} disabled={!onNext} onClick={onNext}><Icon name="chevronRight" className="g-icon" /></button>
        </span>
      </div>
      <div className="g-mg-grid">
        {weekdays?.map((w, i) => <span key={i} className="g-mg-head" aria-hidden="true">{w}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={'b' + i} />)}
        {days.map(d => {
          const has = d.value != null
          const on = today === d.day
          const cls = cx('g-mg-cell', on && 'g-mg-on')
          const kids = (
            <span className="g-mg-in">
              {has ? <MiniRing value={d.value} size={36} stroke={3.5} /> : <i className="g-mg-ph" />}
              <b className={has ? undefined : 'g-mg-future'}>{d.day}</b>
            </span>
          )
          const current = on ? 'date' : undefined
          if (d.href) return <a key={d.day} href={d.href} className={cls} aria-label={d.label ?? String(d.day)} aria-current={current}>{kids}</a>
          const press = d.onClick || (onDay && d.iso ? () => onDay(d.iso) : null)
          if (press) return <Act key={d.day} onClick={press} className={cls} ariaLabel={d.label ?? String(d.day)}>{kids}</Act>
          return <span key={d.day} className={cls} role={d.label ? 'img' : undefined} aria-label={d.label} aria-current={current}>{kids}</span>
        })}
      </div>
      {legend?.length > 0 && (
        <div className="g-mg-legend">
          {legend.map(l => <span key={l.label}><MiniRing value={l.value} size={14} stroke={2.5} />{l.label}</span>)}
        </div>
      )}
    </div>
  )
}

function MiniRing({ value, size, stroke }) {
  const r = (size - stroke) / 2, c = size / 2, len = 2 * Math.PI * r
  return (
    <svg className="g-mring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="g-mring-track" cx={c} cy={c} r={r} strokeWidth={stroke} />
      {value > 0 && <circle className={cx('g-mring-val', value > 1.05 && 'g-mring-over')} cx={c} cy={c} r={r} strokeWidth={stroke} strokeDasharray={len} strokeDashoffset={len * (1 - Math.min(value, 1))} />}
    </svg>
  )
}
