import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'
import Button from './Button.jsx'

const STATES = ['planned', 'running']

// The floating bar above the tab bar (bundle.js `Dock`; AppChrome composes it with the bar). Two
// states. `planned`: the `routine` and a `meta` line, with a primary button (`actionLabel`) that
// starts it. `running`: a pulsing live dot, the `routine` and its `clock` under it (a node, so a
// ticking `<Elapsed>` fits), and, when `actionLabel` is given, a secondary Resume.
//
// The body is one button (or link) when `onOpen` / `openHref` is given, so a tap anywhere on the
// name opens the workout; `openLabel` is the line a screen reader reads first ("Open workout").
// `count` is a big figure at the end of that button (the rest countdown). `progress`, 0 to 1,
// draws the thin bar along the top edge; it moves by transform, so it is not a layout every
// second. `hold` outlines the dock in the accent (a timed hold is running, not a rest).
// `children` sit after the body, in the row of buttons: the rest's +30 and Skip.
//
// `label` names the bar as a landmark when it is given. Every string comes from the caller.
export default function Dock({
  state = 'planned', routine, meta, clock, count, progress, hold = false, label,
  openLabel, onOpen, openHref, actionLabel, onAction, actionHref, children,
}) {
  oneOf('Dock', 'state', state, STATES)
  const running = state === 'running'
  const open = !!(onOpen || openHref)
  const body = (
    <>
      {running && <span className="g-dock-live" aria-hidden="true" />}
      {openLabel && <span className="g-sr">{openLabel}</span>}
      <span className="g-dock-text">
        <b>{routine}</b>
        {(running ? clock : meta) != null && <span className={running ? 'g-dock-clock' : 'g-dock-meta'}>{running ? clock : meta}</span>}
      </span>
      {count != null && <span className="g-dock-count">{count}</span>}
    </>
  )
  return (
    <div className={cx('g-dock', 'g-dock-' + state, hold && 'g-dock-hold')} role={label ? 'region' : undefined} aria-label={label}>
      {progress != null && (
        <div className="g-dock-bar" aria-hidden="true"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }} /></div>
      )}
      {open
        ? <Act href={openHref} onClick={onOpen} className="g-dock-main">{body}</Act>
        : <div className="g-dock-main">{body}</div>}
      {actionLabel && (
        <Button size="sm" variant={running ? 'secondary' : 'primary'} icon={running ? undefined : 'play'} href={actionHref} onClick={onAction}>{actionLabel}</Button>
      )}
      {!!children && <div className="g-dock-acts">{children}</div>}
    </div>
  )
}
