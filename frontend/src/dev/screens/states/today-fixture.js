// What useToday() would hand TodayScreen for the board's day, shared by the Today states and the
// drawers and toasts held over it (today.jsx, today-drawers.jsx): Ana has eaten 860 of 2,100 kcal,
// Push A is planned, 1.25 of 2.5 L of water.
export const NOOP = () => {}

export const RINGS = [
  { key: 'energy', name: 'Calories', icon: 'flame', top: 'Left today', big: '1,240', unit: 'of 2,100 kcal', value: 860, max: 2100, pill: '320 burned · 860 eaten' },
  { key: 'proteins', name: 'Protein', icon: 'utensils', top: 'Protein left', big: '58', unit: 'g of 150 g', value: 92, max: 150, pill: '92 g eaten' },
  { key: 'carbohydrates', name: 'Carbs', icon: 'utensils', top: 'Carbs left', big: '126', unit: 'g of 230 g', value: 104, max: 230, pill: '104 g eaten' },
  { key: 'fat', name: 'Fat', icon: 'utensils', top: 'Fat left', big: '39', unit: 'g of 70 g', value: 31, max: 70, pill: '31 g eaten' },
]
const FOOD_ACTIONS = [
  { icon: 'utensils', label: 'Log food', onClick: NOOP },
  { icon: 'scanBarcode', label: 'Scan', onClick: NOOP },
  { icon: 'droplet', label: 'Water', onClick: NOOP },
  { icon: 'scale', label: 'Weigh-in', onClick: NOOP },
]
export const TRAINING_ACTIONS = [
  { icon: 'play', label: 'Start', onClick: NOOP },
  { icon: 'chartLine', label: 'Activity', onClick: NOOP },
  { icon: 'scale', label: 'Weigh-in', onClick: NOOP },
  { icon: 'calendar', label: 'Plan', onClick: NOOP },
]
const UP_NEXT = { eyebrow: 'Training today', title: 'Push A', sub: '6 exercises', trailing: 'play', onClick: NOOP }
export const MEALS = [
  { slot: 0, icon: 'sunrise', name: 'Breakfast', sub: '420 kcal', state: 'done' },
  { slot: 1, icon: 'sun', name: 'Lunch', sub: 'Add now', state: 'now' },
  { slot: 2, icon: 'moon', name: 'Dinner', sub: 'Nothing yet', state: 'empty' },
  { slot: 3, icon: 'apple', name: 'Snacks', sub: '440 kcal', state: 'done' },
]
export const WATER = { value: 1.25, target: 2.5, step: 0.25, label: '1.25 of 2.5 L', onAdd: NOOP }
export const WEEK = [
  ['M', 'Monday', 'done'], ['T', 'Tuesday', 'rest'], ['W', 'Wednesday', 'done'], ['T', 'Thursday', 'today'],
  ['F', 'Friday', 'planned'], ['S', 'Saturday', 'rest'], ['S', 'Sunday', 'planned'],
].map(([dow, day, state]) => ({ key: day, dow, state, label: day + ', ' + state }))

const HEADER = { initial: 'Ana', placeholder: 'Search', unread: 2, onSettings: NOOP, onBell: NOOP, onSearch: NOOP }
export const both = {
  profile: 'both', status: 'known', error: null, header: HEADER, searching: false, saved: null, away: null, firstSteps: null, nextPending: false,
  rings: RINGS, onRing: NOOP, actions: FOOD_ACTIONS, upNext: UP_NEXT,
  meals: MEALS, onMeal: NOOP, onSeeDay: NOOP, water: WATER, week: null,
}
