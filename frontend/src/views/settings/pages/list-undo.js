import { t } from '../../../lib/i18n.js'
import { writeErrorText } from '../../../lib/nutrition/log-feedback.js'
import { applyListSetting } from '../../../lib/nutrition/use-nt-settings.js'
import { useUI } from '../../../store/useUI.js'

/**
 * The toast after a delete from a list setting (categories, custom units): the Undo writes the list
 * back as the server has it now, with `restore(data)` putting the removed entry where it was
 * (`{ list }` or `{ error }`, lib/nutrition/settings-lists.js). A refusal or a failed write is a
 * toast with the reason, and the entry stays deleted.
 */
export function toastUndoRemove({ message, key, restore, errorText }) {
  useUI.getState().toast(message, {
    action: t('Undo'),
    onAction: async () => {
      try {
        const built = await applyListSetting(key, restore)
        if (built.error) useUI.getState().toast(errorText(built.error))
      } catch (e) {
        useUI.getState().toast(writeErrorText(e))
      }
    },
  })
}
