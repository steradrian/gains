import { useUI } from '../../store/useUI.js'
import { t } from '../i18n.js'
import { foodErrorText } from './foods.js'
import { writeErrorText } from './log-feedback.js'
import { dropExtras } from './recipe-extras.js'
import { useNutrition } from './store.js'

// Deleting a food, a saved meal or a recipe with an Undo that brings back exactly the record that
// was there (its id, its favourite flag, its category), which a delete sent at once cannot: the hub
// gives a re-created record a new id. So the record leaves the lists at once and the delete is sent
// only when the toast's Undo can no longer be taken (timed out, replaced by another toast, or the
// page going away). A failed delete puts the record back and says so. Logged entries keep their
// own copy of the numbers either way.

const waiting = new Set()

/** Sends every delete still waiting for its Undo, now. */
export function flushDeletes() {
  for (const send of [...waiting]) send()
}

if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('pagehide', flushDeletes)

/**
 * @param {{ kind: 'food' | 'meal', record: object, message: string }} args (`meal` is also a recipe) `record` is the saved
 *   record from the list; `message` is the toast text (it names what went and what stays).
 */
export function deleteWithUndo({ kind, record, message }) {
  const store = useNutrition.getState()
  let over = false
  store.holdOut(kind, record.id)

  const send = async () => {
    waiting.delete(send)
    if (over) return
    over = true
    try {
      await (kind === 'food' ? useNutrition.getState().deleteFood(record.id) : useNutrition.getState().deleteMeal(record.id))
      // A recipe's steps and photo (recipe-extras.js) stay with it until it is really gone.
      if (kind === 'meal' && record.is_recipe) dropExtras(record.id)
    } catch (e) {
      useNutrition.getState().bringBack(kind, record)
      useUI.getState().toast(kind === 'food' ? foodErrorText(e, { write: true }) : writeErrorText(e))
    }
  }
  waiting.add(send)

  useUI.getState().toast(message, {
    action: t('Undo'),
    onAction: () => {
      if (over) return
      over = true
      waiting.delete(send)
      useNutrition.getState().bringBack(kind, record)
    },
    onClose: send,
  })
}
