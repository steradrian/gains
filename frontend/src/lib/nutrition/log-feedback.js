import { fmtDate, todayISO } from '../format.js'
import { dateLocale, t } from '../i18n.js'
import { useUI } from '../../store/useUI.js'
import { waterOf } from './diary.js'

/** The day a log goes to, as a drawer's chip and a toast name it: Today, else its date. */
export const dayName = date => (date === todayISO() ? t('Today') : fmtDate(date, true))

/** What a log's toast says (board T1.5): where it went, "Added Banana to Today, Lunch", or, with
 *  no one thing to name, "Added to Today, Lunch". */
export const addedText = (date, mealName, what) => (what
  ? t('Added {0} to {1}, {2}', what, dayName(date), mealName)
  : t('Added to {0}, {1}', dayName(date), mealName))

/** The toast after an entry is removed from a day (board Ea8Removed): "Removed Banana from Today, Snacks". */
export const removedText = (date, mealName, what) => t('Removed {0} from {1}, {2}', what, dayName(date), mealName)

/** The toast after water (board T1.6), in the person's water unit: "Added 250 ml of water to Today". */
export function waterAddedText(date, ml, settings) {
  const w = waterOf(ml, settings)
  return t('Added {0} of water to {1}', w.value.toLocaleString(dateLocale()) + ' ' + w.unit, dayName(date))
}

// What a failed write tells the person. The input it came from stays where it was.
export function writeErrorText(e) {
  if (e?.code === 'offline' || e?.code === 'timeout') return t('Not saved: no connection. Try again when you are back online.')
  if (e?.status === 401) return t('Not saved: you are signed out. Sign in and try again.')
  if (e?.code === 'changed') return t('Not saved: this entry changed elsewhere. The diary now shows its latest state.')
  return t('Not saved. Try again.')
}

// What a failed read tells the person.
export function loadErrorText(e) {
  if (e?.code === 'offline' || e?.code === 'timeout') return t('The diary did not load: no connection.')
  if (e?.status === 401) return t('The diary did not load: you are signed out.')
  return t('The diary did not load.')
}

/** The toast after a log or a removal, with an Undo that takes it back. When the Undo fails it says
 *  so and offers Try again, which runs the same `undo` (so it must send the same entries each time). */
export function toastLogged(message, undo) {
  const run = () => {
    undo().catch(e => useUI.getState().toast(writeErrorText(e), { action: t('Try again'), onAction: run, icon: 'warning' }))
  }
  useUI.getState().toast(message, { action: t('Undo'), onAction: run })
}
