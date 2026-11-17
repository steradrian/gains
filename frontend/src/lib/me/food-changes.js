// Journal kind `food-delete`: a diary entry the person removed (components/DiaryItemSheet.jsx
// remove, which keeps its own Undo toast).
//
//   snapshot: { date, item, at, meals, mealName, backUuid }
//             item      the entry as the diary held it (uuid, food identity and name, portion, unit,
//                       quantity, nutrition, meal slot, addedAt, ...)
//             at        its position in the day
//             meals     the day's meal names at the time, mealName the one it was in ('' if its slot
//                       had no name), so Restore can tell whether the meal still exists
//             backUuid  the uuid the in-place Undo would put it back under, so a Restore after that
//                       Undo finds it there and answers `replaced` instead of adding a second one
//   subject:  the food's name          facts: { meal, day, kcal, time }
//
// NutriTrace keeps a removed uuid tombstoned for good, so Restore adds the entry under a new uuid:
// stableUuid('restore|<original>|<attempt>'), the same for the same attempt, so a retry after a
// lost answer is the same entry (the store replaces it in place) and a second Restore finds it and
// adds nothing (it answers ok again). The attempt is the first none of whose uuids the day has tombstoned: after an Undo
// of the Restore (which tombstones its uuid) the next Restore goes as the next attempt. The
// original uuid stays tombstoned, so another device cannot resurrect a stale copy.
//
// If the meal was deleted meanwhile the entry goes back to that day as Snacks and the result says so
// (`fellBack: 'snacks'`). The write is the store's own (restoreItem): it reads the day, merges by
// uuid and sends it like any log, so an entry the server has tombstoned is never written back.
import { mealsOf, nutritionOf, timeOf } from '../nutrition/diary.js'
import { stableUuid } from '../nutrition/again.js'
import { useNutrition } from '../nutrition/store.js'
import { registerRestorer, recordChange } from '../recent-changes.js'

export const FOOD_DELETE = 'food-delete'

const ATTEMPTS = 10
const restoreUuid = (item, attempt) => stableUuid(`restore|${item.uuid}|${attempt}`)

/**
 * Journals the removal of `item` from `date`. `at` is its position in the day, `backUuid` the uuid
 * of the in-place Undo's copy, `settings` NutriTrace's settings (the meal names).
 */
export function recordFoodDelete({ date, item, at = null, backUuid = null, settings = null }) {
  if (!date || !item?.uuid) return null
  const meals = mealsOf(settings).map(m => m.name)
  const mealName = meals[Number(item.meal) || 0] ?? ''
  return recordChange({
    kind: FOOD_DELETE, day: date, subject: item.name || '',
    facts: { meal: mealName, day: date, kcal: Math.round(nutritionOf(item).calories || 0), time: timeOf(item) },
    snapshot: { date, item, at: Number.isInteger(at) && at >= 0 ? at : null, meals, mealName, backUuid },
  })
}

// The day as the store holds it after a fresh read, or null when it could not be read.
async function freshDay(date) {
  const nt = useNutrition.getState()
  await Promise.all([nt.settings.data ? null : nt.loadSettings(), nt.loadDay(date, { force: true })])
  const { settings, days } = useNutrition.getState()
  const day = days[date]
  return settings.data && day?.status === 'ready' ? { settings: settings.data, entry: day.entry } : null
}

const tombstonedItems = entry => new Set((entry?.tombstones || []).filter(x => x?.kind === 'item').map(x => x.uuid))
const hasUuid = (entry, uuid) => (entry?.items || []).some(i => i?.uuid === uuid)

// Where the entry goes now: its own meal if it is still there (by name, so a reordered list finds
// it), else Snacks.
function mealFor(snap, names) {
  const own = Number(snap.item.meal) || 0
  if (snap.mealName) {
    if (names[own] === snap.mealName) return { slot: own, name: snap.mealName }
    const at = names.indexOf(snap.mealName)
    if (at >= 0) return { slot: at, name: snap.mealName }
  }
  const snacks = names.findIndex(n => n.trim().toLowerCase() === 'snacks')
  return { slot: snacks >= 0 ? snacks : names.length - 1, name: 'snacks', fellBack: 'snacks' }
}

export async function restoreFoodChange(snap) {
  if (!snap?.item?.uuid || !snap.date) return { ok: false, reason: 'gone' }
  let day
  try { day = await freshDay(snap.date) } catch { day = null }
  if (!day) return { ok: false, reason: 'error' }
  if (snap.backUuid && hasUuid(day.entry, snap.backUuid)) return { ok: false, reason: 'replaced' }
  const gone = tombstonedItems(day.entry)
  let attempt = 0
  while (attempt < ATTEMPTS && gone.has(restoreUuid(snap.item, attempt))) attempt += 1
  const uuid = restoreUuid(snap.item, attempt)
  const meal = mealFor(snap, mealsOf(day.settings).map(m => m.name))
  const done = { ok: true, where: { day: snap.date, meal: meal.fellBack ? 'snacks' : meal.name }, ...(meal.fellBack ? { fellBack: meal.fellBack } : {}) }
  // Already in the day under this attempt's uuid: an earlier try whose answer was lost. Same entry, nothing added.
  if (hasUuid(day.entry, uuid)) return done
  try {
    await useNutrition.getState().restoreItem(snap.date, { ...snap.item, uuid, meal: meal.slot }, snap.at)
  } catch { return { ok: false, reason: 'error' } }
  return done
}

/** Takes the restored entry out again, through the store's delete (not journalled). */
export async function undoFoodRestore(snap) {
  if (!snap?.item?.uuid || !snap.date) return { ok: false, reason: 'gone' }
  let day
  try { day = await freshDay(snap.date) } catch { day = null }
  if (!day) return { ok: false, reason: 'error' }
  const ours = Array.from({ length: ATTEMPTS }, (_, n) => restoreUuid(snap.item, n)).filter(u => hasUuid(day.entry, u))
  if (!ours.length) return { ok: false, reason: 'gone' }
  try { await useNutrition.getState().removeItems(snap.date, ours) } catch { return { ok: false, reason: 'error' } }
  return { ok: true }
}

registerRestorer(FOOD_DELETE, { restore: restoreFoodChange, undo: undoFoodRestore })
