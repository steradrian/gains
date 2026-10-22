// The My goal states (me-goal.jsx): the board's man, male, 182 cm, born 1994, light movement, losing
// weight from 85.0 kg to a target of 78 kg, 2,100 kcal fixed. His weigh-ins are counted back from
// today so the page and the drawers (which read the real clock) agree on the day.
import { isoOf, todayISO } from '../../../lib/format.js'

const daysAgo = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() - n); return isoOf(d) }
const LB = kg => Math.round(kg * 2.20462 * 10) / 10

// [days ago, kg]: 85.0 at the start, 81.4 now.
const WEIGH_INS = [[81, 85], [60, 84.1], [40, 83.2], [21, 82.5], [7, 81.9], [0, 81.4]]

/** The state the screen reads. `now` is today's weight (kg); `weighIns` false leaves none; `target` null removes it. */
export function goalState({ unit = 'kg', now = 81.4, weighIns = true, target = 78 } = {}) {
  const w = kg => (unit === 'lb' ? LB(kg) : kg)
  const bodyweight = weighIns
    ? WEIGH_INS.map(([ago, kg]) => ({ d: daysAgo(ago), w: w(ago === 0 ? now : kg) }))
    : []
  return { unit, bodyweight, targetW: target == null ? null : unit === 'lb' ? Math.round(LB(target)) : target }
}

/** GET /api/settings: the profile and the targets NutriTrace holds for him. `gender` unset is "prefer not to say". */
export function goalSettings({ gender = 'male', empty = false, factor = 0.8, mode = 'fixed' } = {}) {
  if (empty) return { calorieGoalMode: 'fixed', goals: {}, mealNames: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] }
  return {
    ...(gender ? { gender } : {}),
    dob: '1994-07-01', height_cm: 182, weight_kg: 90, activity: 'light', tdee: 2473,
    calorieGoalMode: mode, calorieGoalFactor: factor, waterGoalMl: 2500,
    mealNames: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
    goals: {
      calories: { max: 2100, sharedGoal: true },
      proteins: { max: 150, sharedGoal: true },
      carbohydrates: { max: 230, sharedGoal: true },
      fat: { max: 70, sharedGoal: true },
    },
  }
}

const ALEX = { id: 'u1', name: 'Alex' }

/** A state's mock: a signed-in person, his settings (writes answer with nothing, so a save changes nothing real), his weigh-ins. */
export const goalMock = ({ state = goalState(), settings = goalSettings(), signedIn = true, fail = false, adaptive = null } = {}) => ({
  user: signedIn ? ALEX : null,
  S: state,
  api: {
    'GET /api/settings': fail ? { status: 500, body: { error: 'down' } } : settings,
    'PUT /api/settings': {},
    // Adaptive's estimate (the How drawer asks in Adaptive mode); a call with no entry is a 404, an estimate that did not load.
    ...(adaptive ? { 'GET /api/goals/adaptive-tdee': adaptive } : null),
  },
})
