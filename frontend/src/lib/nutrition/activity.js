import { lastBW } from '../history.js'
import { NtApi } from './api.js'
import { useNutrition } from './store.js'

// Eat root m3: the Burned page and the Log activity drawer's side of the activity record. The rows
// themselves come from the store (loadActivity); this writes one and reads the store back.

/** The kinds of activity the drawer offers, with the MET each is worked out from (compendium
 *  values for a steady effort: running about 6 mph, cycling 12 to 14 mph, laps, a match, a class). */
export const ACTIVITY_TYPES = [
  { id: 'run', met: 9.8 },
  { id: 'ride', met: 7.5 },
  { id: 'swim', met: 8 },
  { id: 'football', met: 7 },
  { id: 'class', met: 5 },
  { id: 'other', met: 4 },
]
export const DEFAULT_MINUTES = 30
export const MAX_MINUTES = 360

/** A body weight in kg and its label in the person's unit, from the latest weigh-in; null without one. */
export function bodyWeightOf(S) {
  const last = S?.bodyweight?.length ? lastBW(S) : null
  const w = Number(last?.w)
  if (!(w > 0)) return null
  const unit = S.unit === 'lb' ? 'lb' : 'kg'
  return { kg: unit === 'lb' ? w / 2.2046226218 : w, shown: w, unit }
}

/** kcal for `minutes` of `type` at `kg`: MET x kg x hours, to the nearest 5. Null without a weight
 *  or a duration, so nothing is made up. */
export function estimateKcal({ type, kg, minutes }) {
  const met = ACTIVITY_TYPES.find(x => x.id === type)?.met
  if (!met || !(kg > 0) || !(minutes > 0)) return null
  return Math.round((met * kg * minutes) / 60 / 5) * 5
}

/** A typed amount as a number, or null for empty, zero, negative or not a number. */
export function parseAmount(text) {
  const n = Number(String(text).replace(',', '.'))
  return String(text).trim() !== '' && Number.isFinite(n) && n > 0 ? n : null
}

async function refresh(date) {
  const n = useNutrition.getState()
  const settings = await n.loadSettings()
  await n.loadActivity(date, settings?.manualActivityPolicy)
}

/** Writes a manual activity (`kcal` always kcal, `distance` km) and reloads that day's record, so
 *  Burned, Today and the Day page read it. Throws the write's error; nothing is kept then. */
export async function saveActivity({ date, name, kcal, minutes, distance = null }) {
  await NtApi.createActivity(date, { name, kcal, duration_min: minutes, distance })
  await refresh(date)
}

/** Adds the Burned number to a row that has none (a workout from before Burned was turned on). */
export async function setActivityKcal(row, kcal) {
  await NtApi.updateActivity(row.id, { kcal })
  await refresh(row.date)
}
