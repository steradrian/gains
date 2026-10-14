import { create } from 'zustand'
import { todayISO } from '../format.js'
import { defaultMeal } from './diary.js'

// Where a log goes: the date Home shows (its date strip and calendar) and the meal the + sheet
// names in "Logging to <date> · <meal>". One copy for Home, the + sheet and the Nutrition pages.
//
// `date` null means today, whichever day that is by now, so an app left open overnight logs to
// the new day. `meal` null means "by time of day" (diary.js defaultMeal); a meal picked by hand
// holds for MEAL_PICK_MS, then the clock decides again, so lunch picked at noon does not follow
// you into the evening. Picking a date clears it.

export const MEAL_PICK_MS = 30 * 60 * 1000

export const useDiarySelection = create((set, get) => ({
  date: null,
  meal: null,

  /** The date to show and log to (YYYY-MM-DD). */
  day: () => get().date || todayISO(),
  setDate: iso => set({ date: !iso || iso === todayISO() ? null : iso, meal: null }),
  /** Pick the meal by hand (slot index), or null to go back to the clock. */
  setMeal: (slot, now = Date.now()) => set({ meal: slot == null ? null : { slot: Number(slot), at: now } }),
  /** The meal slot to log to, given NutriTrace's settings. */
  mealFor: (settings, now = new Date()) => {
    const m = get().meal
    if (m && now.getTime() - m.at < MEAL_PICK_MS) return m.slot
    return defaultMeal(settings, now)
  },
  reset: () => set({ date: null, meal: null }),
}))
