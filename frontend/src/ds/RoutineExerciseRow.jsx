import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'

// One exercise of a routine in its editor (boards T5.0, Tr5RoutinePull, Tr5RoutineLegs): the
// ExerciseThumbRow on glass (its `g-xrow g-xrow-stage` look), with the sub line ("4 × 6–8 · 80 kg")
// and a progression line under it ("Up 2.5 kg when every set hits 8"). The picture, name and lines
// are one button, `onOpen` (the exercise's settings); it carries `data-row-open` so a long press on
// it still picks the row up in a list that reorders by dragging.
//
// In reorder mode the caller passes `moveUp` and `moveDown` ({ label, title, disabled, onClick }:
// the keyboard's way to move it) and `handle` ({ title }), a grip for a mouse to drag by
// (`data-drag-handle`; hidden from a screen reader, which has the buttons). `badge` ({ text, label })
// is the place in a superset ("A1"), `warning` the text of an equipment warning, `note` the
// exercise's own note. Every word, spoken or shown, comes from the caller.
export default function RoutineExerciseRow({ image, title, sub, line, note, badge, warning, onOpen, moveUp, moveDown, handle }) {
  const tools = !!(moveUp || moveDown || handle)
  return (
    <div className={cx('g-rx', tools && 'g-rx-ordering')}>
      <button type="button" className="g-xrow g-xrow-stage g-rx-open" data-row-open onClick={onOpen}>
        {badge && <span className="g-rx-pos" aria-label={badge.label}>{badge.text}</span>}
        {image
          ? <img src={image} alt="" width="52" height="52" loading="lazy" draggable={false} />
          : <span className="g-xrow-ph"><Icon name="dumbbell" className="g-icon" /></span>}
        <span className="g-xrow-b">
          <b>{title}</b>
          {sub && <span>{sub}</span>}
          {line && <span className="g-rx-prog">{line}</span>}
          {note && <span className="g-rx-note">{note}</span>}
        </span>
        {warning && <span className="g-rx-warn" title={warning}><Icon name="warning" className="g-icon" /><span className="g-sr">{warning}</span></span>}
        {!tools && <Icon name="chevronRight" className="g-icon g-xrow-chev" />}
      </button>
      {tools && (
        <span className="g-rx-tools">
          {moveUp && (
            <button type="button" className="g-rx-btn" aria-label={moveUp.label} title={moveUp.title || moveUp.label} disabled={moveUp.disabled} onClick={moveUp.onClick}>
              <Icon name="chevronUp" className="g-icon" />
            </button>
          )}
          {moveDown && (
            <button type="button" className="g-rx-btn" aria-label={moveDown.label} title={moveDown.title || moveDown.label} disabled={moveDown.disabled} onClick={moveDown.onClick}>
              <Icon name="chevronDown" className="g-icon" />
            </button>
          )}
          {handle && <span className="g-rx-handle" data-drag-handle aria-hidden="true" title={handle.title}><Icon name="grip" className="g-icon" /></span>}
        </span>
      )}
    </div>
  )
}
