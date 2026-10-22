import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import Act from './Act.jsx'
import BottomSheet from './BottomSheet.jsx'

// The confirmation for what Undo cannot take back (bundle.js `ConfirmDrawer`, surface rule R5; board
// W1.46 "Discard 14 sets?"): `body` leads, `items` list what goes (a danger mark each), `note` is
// the quiet line after ("You can still undo for 8 s on Today."), then the danger `confirmLabel`
// and the plain `cancelLabel`, each a button with its handler or a link with its href. `icon` is
// the danger button's (a warning triangle by default).
// With a `title` it is its own drawer (`BottomSheet`; the × is a Cancel like the scrim, Escape and
// Back; opened with `confirmDrawer()` in views/settings/confirm-drawer.js). Without one it is only
// the content, for a drawer that already has its title and ×.
export default function ConfirmDrawer({
  title, body, items = [], note, icon = 'warning', confirmLabel, onConfirm, confirmHref, cancelLabel, onCancel, cancelHref,
}) {
  const content = (
    <div className="g-confirm">
      {body && <p>{body}</p>}
      {items.length > 0 && (
        <ul>
          {items.map((text, i) => <li key={i}><Icon name="xmark" className="g-icon" />{text}</li>)}
        </ul>
      )}
      {note && <p className="g-confirm-note">{note}</p>}
      <Act href={confirmHref} onClick={onConfirm} className="g-btn g-confirm-danger">
        <Icon name={icon} className="g-icon" />{confirmLabel || (title ? t('Delete') : '')}
      </Act>
      <Act href={cancelHref} onClick={onCancel} className="g-btn g-btn-secondary g-btn-block">{cancelLabel || (title ? t('Cancel') : '')}</Act>
    </div>
  )
  if (!title) return content
  return <BottomSheet title={title} type="auto" onClose={onCancel} closeHref={cancelHref}>{content}</BottomSheet>
}
