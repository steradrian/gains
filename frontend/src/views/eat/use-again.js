import { useEffect, useState } from 'react'
import { todayISO, yesterdayISO } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { againAttempt, againEntries, againItems, againKcal, againLogged } from '../../lib/nutrition/again.js'
import { dayName, toastLogged } from '../../lib/nutrition/log-feedback.js'
import { foodErrorText } from '../../lib/nutrition/foods.js'
import { mealLabels } from '../../lib/nutrition/meal-name.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { useUI } from '../../store/useUI.js'

/**
 * "Yesterday's lunch [Log again]" (board Ea1Eat, edge E1.0): the same meal logged to today in one
 * write when yesterday had `meal` and every entry in it can be logged again (lib/nutrition/again.js),
 * else null and the section is gone. The entries carry uuids that come from the copy itself, so a
 * second tap or a retry is the same entries, and `done` ("Logged") is read off today's diary, not
 * remembered here. Undo removes exactly the entries that write added.
 *
 *   { label, items: [name], kcal, done, ready, busy, log() }
 */
export function useAgain({ settings, meal }) {
  const today = todayISO()
  const yesterday = yesterdayISO()
  const entry = useNutrition(s => s.days[yesterday]?.entry)
  const target = useNutrition(s => s.days[today])
  const [busy, setBusy] = useState(false)

  useEffect(() => { useNutrition.getState().loadDay(yesterday) }, [yesterday])

  const items = againItems(entry, meal)
  if (!items) return null
  const names = mealLabels(settings)
  const label = names[meal] ?? names[0]
  const copy = { from: yesterday, to: today, target: target?.entry }
  // Which attempt is free depends on today's tombstones: nothing is sent before today is read.
  const ready = target?.status === 'ready'
  const attempt = againAttempt(items, copy)

  async function log() {
    if (busy || !ready) return
    setBusy(true)
    const n = useNutrition.getState()
    try {
      const logged = await n.logItems(today, againEntries(items, meal, { from: yesterday, to: today, attempt, n }))
      toastLogged(t('Logged yesterday’s {0} to {1}, {2}', label, dayName(today), label),
        () => useNutrition.getState().removeItems(today, logged.map(i => i.uuid)))
    } catch (e) {
      useUI.getState().toast(foodErrorText(e, { write: true }))
    } finally {
      setBusy(false)
    }
  }

  return { label, items: items.map(i => i.name), kcal: againKcal(items), done: ready && againLogged(items, copy, attempt), ready, busy, log }
}
