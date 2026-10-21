import { useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { addedText, dayName, toastLogged, writeErrorText } from '../lib/nutrition/log-feedback.js'
import { mealDraft } from '../lib/nutrition/meals.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useSheetTarget } from './LoggingTo.jsx'

/**
 * Logging a saved meal or a recipe from its drawer in My foods. The day and meal are the diary's
 * when the drawer opened, kept; the date is passed to the target explicitly, so picking another
 * meal in the drawer never moves the shared diary selection. A draft is built once per meal and
 * servings and kept until it is logged, so Log again after a failure sends the same entries and a
 * save whose answer was lost does not log twice. A meal's entries go in one diary write, all or none.
 *   target  { date, meal, mealName, names, setMeal } (LoggingTo.jsx); `chip` names its day and meal
 *   busy    a write is out
 *   log     (servings = 1) => Promise<boolean>: whether it was logged; a failure is a toast
 */
export function useLibraryLog(entry) {
  const settings = useNutrition(s => s.settings.data)
  const [start] = useState(() => useDiarySelection.getState().target(settings))
  const target = useSheetTarget({ date: start.date, meal: start.meal })
  const [busy, setBusy] = useState(false)
  const drafts = useRef(new Map()).current
  const working = useRef(false)

  async function log(servings = 1) {
    if (!entry || working.current) return false
    working.current = true
    setBusy(true)
    const key = `${target.meal}|${servings}`
    try {
      if (!drafts.has(key)) drafts.set(key, mealDraft(entry, { slot: target.meal, servings }))
      const items = await useNutrition.getState().logMeal(target.date, drafts.get(key))
      drafts.delete(key)
      toastLogged(addedText(target.date, target.mealName, entry.name), () => useNutrition.getState().removeItems(target.date, items.map(i => i.uuid)))
      return true
    } catch (e) {
      if (e?.code === 'invalid') drafts.delete(key)
      useUI.getState().toast(e?.code === 'invalid' ? t('This meal has no ingredients to log.') : writeErrorText(e))
      return false
    } finally {
      working.current = false
      setBusy(false)
    }
  }

  return { target, chip: `${dayName(target.date)} · ${target.mealName}`, busy, log }
}
