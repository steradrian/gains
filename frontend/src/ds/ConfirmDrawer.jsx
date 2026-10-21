import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import Act from './Act.jsx'
import BottomSheet from './BottomSheet.jsx'

// The only confirm in Gains (bundle.js `ConfirmDrawer`, surface rule R5): for what Undo cannot take
// back (remove the last way to sign in, sign out everywhere, start over, delete the account).
// It lists what goes (`items`), puts the destructive button first and Cancel under it. Everything
// else in the app is a switch or an Undo toast. Drawn alone it is still and open (the catalogue);
// opened with `confirmDrawer()` (views/settings/confirm-drawer.js) it is a drawer in the sheet
// frame, and the × is a Cancel like the scrim, Escape and Back. Strings come from the caller; the
// buttons say what they do ("Remove passkey", never OK).
export default function ConfirmDrawer({
  title, body, items = [], note, icon = 'warning', confirmLabel, onConfirm, confirmHref, cancelLabel, onCancel, cancelHref,
}) {
  return (
    <BottomSheet title={title} type="auto" onClose={onCancel} closeHref={cancelHref}>
      <div className="g-confirm">
        {body && <p>{body}</p>}
        {items.length > 0 && (
          <ul>
            {items.map(item => <li key={item}><Icon name="xmark" className="g-icon" />{item}</li>)}
          </ul>
        )}
        {note && <p className="g-confirm-note">{note}</p>}
        <Act href={confirmHref} onClick={onConfirm} className="g-btn g-confirm-danger">
          <Icon name={icon} className="g-icon" />{confirmLabel || t('Delete')}
        </Act>
        <Act href={cancelHref} onClick={onCancel} className="g-btn g-btn-secondary g-btn-block">{cancelLabel || t('Cancel')}</Act>
      </div>
    </BottomSheet>
  )
}
