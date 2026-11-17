import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'

const TONES = ['main', 'warm', 'cool']
const R = 92
const CIRC = 2 * Math.PI * R

// A timed hold on the stage (boards W1.41, W1.42): the big ring with the side, the time left and
// the line under it, then Pause and Switch side, and a note about what happens at 0:00. `progress`
// (0…1) is how much of the hold has gone, so the arc runs down; the ring is white, or mint with
// `tone="cool"` (peach with "warm") on a cool-down (warm-up) exercise. The countdown itself is the
// caller's: this draws `left` ("0:18") and `detail` ("of 0:30 · round 1 of 2") as given.
//
// `ringLabel` is the ring's spoken name ("Left side, 18 seconds left"; the ring is a timer, not a
// live region, so it is not read out every second). The buttons say `pauseLabel` / `resumeLabel`
// (`paused`) and `switchLabel`; `switchLabel` left out means no Switch side, as for a hold with
// one side. Every string is the caller's.
export default function TimedHold({
  side, left, detail, progress = 0, tone = 'main', ringLabel, paused = false, pauseLabel, resumeLabel, onPause,
  switchLabel, switchHref, onSwitch, note,
}) {
  oneOf('TimedHold', 'tone', tone, TONES)
  const spent = Math.min(Math.max(progress, 0), 1)
  return (
    <div className={cx('g-th', 'g-th-' + tone)}>
      <div className="g-th-ring" role="timer" aria-label={ringLabel}>
        <svg width="210" height="210" viewBox="0 0 210 210" aria-hidden="true">
          <circle cx="105" cy="105" r={R} className="g-th-trk" />
          <circle cx="105" cy="105" r={R} className="g-th-arc" style={{ '--c': CIRC, '--o': CIRC * spent }} />
        </svg>
        <span className="g-th-c">
          {side && <span>{side}</span>}
          <b>{left}</b>
          {detail && <small>{detail}</small>}
        </span>
      </div>
      <div className="g-th-btns">
        <button type="button" className="g-th-b g-glass" onClick={onPause}>
          <Icon name={paused ? 'play' : 'pause'} className="g-icon" />
          {paused ? resumeLabel : pauseLabel}
        </button>
        {switchLabel && (
          <Act href={switchHref} onClick={onSwitch} className="g-th-b g-th-main">
            <Icon name="swap" className="g-icon" />
            {switchLabel}
          </Act>
        )}
      </div>
      {note && <p className="g-th-note">{note}</p>}
    </div>
  )
}
