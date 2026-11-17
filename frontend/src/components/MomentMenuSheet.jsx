import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import DetailRow from '../ds/DetailRow.jsx'

// The ⋯ of a Trained together moment (board Fr2Group): the one thing to do with it is take it off
// the group. Either person who trained can; it is a second tap after the ⋯, so it asks nothing more.
function MomentMenu({ title, onRemove, close }) {
  return (
    <BottomSheet title={title}>
      <DetailRow icon="trash" title={t('Remove this moment')} sub={t('It goes from the group for both of you')} danger
        onClick={() => { close(); onRemove() }} />
    </BottomSheet>
  )
}

/** Opens the menu for a moment titled `title`; `onRemove` runs once, after the drawer has closed. */
export const momentMenuSheet = (title, onRemove) => useUI.getState().openSheet(close => <MomentMenu title={title} onRemove={onRemove} close={close} />, { variant: 'ds' })
