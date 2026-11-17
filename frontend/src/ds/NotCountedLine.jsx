import Icon from '../components/Icon.jsx'
import Act from './Act.jsx'

// The dashed line that stands in the progression line's place when the exercise, or the whole
// workout, is kept out of progression (boards W1.50, W1.51): "Not counted for progression today"
// with Undo. A routine that keeps its exercises out by itself has nothing to undo, so the line
// draws without the button (no `onUndo`). `undoLabel` is the button's spoken name; every string is
// the caller's.
export default function NotCountedLine({ text, undoText, undoLabel, onUndo, href }) {
  if (!text) return null
  return (
    <div className="g-nc">
      <Icon name="chartLineSlash" className="g-icon" />
      <span className="g-nc-text">{text}</span>
      {(onUndo || href) && <Act href={href} onClick={onUndo} ariaLabel={undoLabel} className="g-nc-undo">{undoText}</Act>}
    </div>
  )
}
