import Icon from '../components/Icon.jsx'
import Act from './Act.jsx'
import WorkoutThumb from './WorkoutThumb.jsx'

const R = 20
const CIRC = 2 * Math.PI * R

function Neighbour({ item, side, label }) {
  if (!item) return <span className="g-wf-nb g-wf-empty" />
  const chevron = <Icon key="c" name={side === 'prev' ? 'chevronLeft' : 'chevronRight'} className="g-icon g-wf-chev" />
  const pic = <WorkoutThumb key="t" image={item.image} size="md" />
  return (
    <Act href={item.href} onClick={item.onClick} ariaLabel={label} className="g-wf-nb">
      {side === 'prev' ? [chevron, pic] : [pic, chevron]}
    </Act>
  )
}

// The bar at the foot of the running workout (boards W1.0, W1.3, W1.5, W1.24): ‹ the previous
// exercise's picture · "4 of 12 / Workout" · the next one's picture ›, glass over the stage. The
// ‹ › are the way along; they mirror in rtl. The centre opens the map.
//
// Resting (`rest`): the centre becomes the countdown ring with the time ("1:42 / Rest"; press to
// change it) and one row rises above the bar: −15 s, +15 s, pause, Skip.
// After the rest (`ready`): the centre says "Ready / Rest is over" and the row holds +15 s and the
// white Go button (`goText`, "Go · set 2"). Its handlers are `rest.onPlus` and `onGo`/`goHref`.
//
// prev / next: { image, href?, onClick? } (the neighbour, left out at the ends); position ("4 of 12")
// and phase ("Workout") are the centre's two lines. rest: { left, label, progress (0…1 gone),
// paused, clockHref?, onClock?, onMinus?, onPlus?, onPause?, skipHref?, onSkip? }.
// Every string is the caller's: the spoken names (`prevLabel` "Previous: Band pull-apart",
// `nextLabel`, `mapLabel` "All exercises", `navLabel` "Exercises", `clockLabel` "Rest, 1:42 left.
// Change", `minusLabel`, `plusLabel`, `pauseLabel`, `resumeLabel`, `skipLabel`, `goLabel`) and the
// visible ones (`stepText` "15 s", `skipText` "Skip", `goText`, `readyTitle`, `readyLabel`).
export default function WorkoutFooter({
  prev, next, position, phase, mapHref, onMap,
  rest, ready = false, readyTitle, readyLabel, goText, goLabel, goHref, onGo,
  navLabel, prevLabel, nextLabel, mapLabel, clockLabel, minusLabel, plusLabel, pauseLabel, resumeLabel, skipLabel,
  stepText, skipText,
}) {
  let centre
  if (ready) {
    centre = (
      <span className="g-wf-c g-wf-ready">
        <span className="g-wf-ok"><Icon name="check" className="g-icon" /></span>
        <span className="g-wf-rt">
          <b>{readyTitle}</b>
          <span>{readyLabel}</span>
        </span>
      </span>
    )
  } else if (rest) {
    const gone = Math.min(Math.max(rest.progress ?? 0, 0), 1)
    centre = (
      <Act href={rest.clockHref} onClick={rest.onClock} ariaLabel={clockLabel} className="g-wf-c g-wf-rest">
        <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r={R} className="g-wf-trk" />
          <circle cx="24" cy="24" r={R} className="g-wf-arc" style={{ '--c': CIRC, '--o': CIRC * gone }} />
        </svg>
        <span className="g-wf-rt">
          <b>{rest.left}</b>
          <span>{rest.label}</span>
        </span>
      </Act>
    )
  } else {
    centre = (
      <Act href={mapHref} onClick={onMap} ariaLabel={mapLabel} className="g-wf-c">
        <b>{position}</b>
        <span className="g-wf-ph">
          {phase}
          <Icon name="chevronUp" className="g-icon" />
        </span>
      </Act>
    )
  }

  let row = null
  if (ready) {
    row = (
      <div className="g-wf-restrow">
        {rest?.onPlus && (
          <button type="button" className="g-wf-rb g-glass" onClick={rest.onPlus} aria-label={plusLabel}>
            <Icon name="plus" className="g-icon" />
            {stepText}
          </button>
        )}
        <Act href={goHref} onClick={onGo} ariaLabel={goLabel} className="g-wf-rb g-wf-go">{goText}</Act>
      </div>
    )
  } else if (rest) {
    row = (
      <div className="g-wf-restrow">
        <button type="button" className="g-wf-rb g-glass" onClick={rest.onMinus} aria-label={minusLabel}>
          <Icon name="minus" className="g-icon" />
          {stepText}
        </button>
        <button type="button" className="g-wf-rb g-glass" onClick={rest.onPlus} aria-label={plusLabel}>
          <Icon name="plus" className="g-icon" />
          {stepText}
        </button>
        <button type="button" className="g-wf-rb g-glass g-wf-pause" onClick={rest.onPause} aria-label={rest.paused ? resumeLabel : pauseLabel}>
          <Icon name={rest.paused ? 'play' : 'pause'} className="g-icon" />
        </button>
        <Act href={rest.skipHref} onClick={rest.onSkip} ariaLabel={skipLabel} className="g-wf-rb g-wf-skip">{skipText}</Act>
      </div>
    )
  }

  return (
    <div className="g-wf">
      {row}
      <nav className="g-wf-bar" aria-label={navLabel}>
        <Neighbour item={prev} side="prev" label={prevLabel} />
        {centre}
        <Neighbour item={next} side="next" label={nextLabel} />
      </nav>
    </div>
  )
}
