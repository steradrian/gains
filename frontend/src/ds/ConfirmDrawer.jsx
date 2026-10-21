import Icon from '../components/Icon.jsx'
import Act from './Act.jsx'

// The confirmation a drawer holds where Undo cannot reverse the action (bundle.js `ConfirmDrawer`;
// board W1.46 "Discard 14 sets?"). The content of a `BottomSheet` (which owns the title and the
// ×): `body` leads, `items` list what goes (a danger mark each), `note` is the quiet line after
// ("You can still undo for 8 s on Today."), then the danger `confirmLabel` and the plain
// `cancelLabel`, each a button with its handler or a link with its href. `icon` is the danger
// button's (a warning triangle by default). Every string comes from the caller.
export default function ConfirmDrawer({ body, items = [], note, icon = 'warning', confirmLabel, onConfirm, confirmHref, cancelLabel, onCancel, cancelHref }) {
  return (
    <div className="g-confirm">
      {body && <p>{body}</p>}
      {items.length > 0 && (
        <ul>
          {items.map((text, i) => <li key={i}><Icon name="xmark" className="g-icon" />{text}</li>)}
        </ul>
      )}
      {note && <p className="g-confirm-note">{note}</p>}
      <Act href={confirmHref} onClick={onConfirm} className="g-btn g-confirm-danger">
        <Icon name={icon} className="g-icon" />{confirmLabel}
      </Act>
      <Act href={cancelHref} onClick={onCancel} className="g-btn g-btn-secondary g-btn-block">{cancelLabel}</Act>
    </div>
  )
}
