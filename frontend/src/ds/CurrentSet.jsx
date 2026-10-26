import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// The set being worked, on the stage (boards W1.2, W1.32, W1.35, W1.28): its line ("Set 2 of 3",
// "Warm-up set 1 of 2", "Set 2 · editing") with what was done last time on the other side, then
// the fields in one row and, under it, whatever else belongs to the set (the PlateLine, a note).
//
// `fields` is the row's content: normally two SetSteppers (kg and Reps), three for cardio. With
// `bodyweight` a "Load · Body weight · Tap to add weight" tile takes the weight's place in the row
// (`onLoad` / `loadHref` add the weight), and `fields` then holds the Reps stepper. `first` shows
// `firstLabel` ("First time") where `last` ("Last time 80 × 8") would be. `warmup` marks the set
// (a hook for styling and tests; its words are in `setLine`). Every string is the caller's.
export default function CurrentSet({
  setLine, last, first = false, firstLabel, warmup = false,
  bodyweight = false, loadLabel, bodyweightLabel, loadHint, onLoad, loadHref,
  fields, children,
}) {
  const side = first ? firstLabel : last
  return (
    <section className={cx('g-cs', warmup && 'g-cs-warm')} aria-label={setLine}>
      <div className="g-cs-head">
        <b key={setLine} className="g-cs-fade">{setLine}</b>
        {side && <span key={side} className="g-cs-fade">{side}</span>}
      </div>
      <div className="g-cs-row">
        {bodyweight && (
          <Act href={loadHref} onClick={onLoad} className="g-cs-bw g-glass">
            <span className="g-sst-l">{loadLabel}</span>
            <b>{bodyweightLabel}</b>
            <span className="g-sst-h">{loadHint}</span>
          </Act>
        )}
        {fields}
      </div>
      {children}
    </section>
  )
}
