import { t } from '../../../lib/i18n.js'
import { writeErrorText } from '../../../lib/nutrition/log-feedback.js'
import { applyListSetting } from '../../../lib/nutrition/use-nt-settings.js'
import { useUI } from '../../../store/useUI.js'

/**
 * The Undo of a deleted list entry: writes `before` back over the setting `key`, but only while the
 * list is still what the delete wrote (`current(data)` equals `after`). Something added or moved
 * since, here or in NutriTrace, is not overwritten; the toast says so instead. `current` reads the
 * list from the settings as the server has them.
 */
export async function restoreList(key, before, after, current) {
  const toast = useUI.getState().toast
  try {
    const built = await applyListSetting(key, data => {
      const now = current(data)
      const same = now.length === after.length && now.every((v, i) => JSON.stringify(v) === JSON.stringify(after[i]))
      return same ? { list: before } : { error: 'stale' }
    })
    if (built.error) toast(t('This changed since, so Undo did not restore it.'))
  } catch (e) {
    toast(writeErrorText(e))
  }
}
