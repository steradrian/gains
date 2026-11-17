import { t } from '../../../lib/i18n.js'
import { writeErrorText } from '../../../lib/nutrition/log-feedback.js'
import { useUI } from '../../../store/useUI.js'

// What My goal's drawers and page say after a write: why it failed, and the toast with Undo.

/** Why a write failed, in words. */
export function failureText(error) {
  if (error?.code === 'busy') return t('Another change is still saving. Try again in a moment.')
  if (error?.code === 'profile-unsupported') return t('Changing this arrives soon')
  return t('Check your connection and try again.')
}

/** The same for a Daily targets save, whose refusals are the diary's own (offline, signed out). */
export const targetsFailureText = error => (error?.code === 'busy' ? failureText(error) : writeErrorText(error))

/** The toast after a save: the new value and Undo for 8 s. A failed Undo says so. */
export function announceSaved(message, res) {
  useUI.getState().toast(message, {
    action: t('Undo'),
    onAction: async () => {
      const back = await res.undo()
      if (!back?.ok) useUI.getState().toast(failureText(null))
    },
  })
}
