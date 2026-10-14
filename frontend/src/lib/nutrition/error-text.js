import { t } from '../i18n.js'

/** What to tell the person about a failed NutriTrace call. Never the error's own message: that
 *  is for logs (api.js). */
export function ntErrorText(e) {
  if (e?.code === 'offline') return t('No connection to NutriTrace.')
  if (e?.code === 'timeout') return t('NutriTrace took too long to answer.')
  if (e?.code === 'http' && (e.status === 401 || e.status === 403)) return t('NutriTrace did not accept this.')
  return t('NutriTrace had a problem. Try again.')
}
