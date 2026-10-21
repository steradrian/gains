import TodayScreen from '../../../views/today/TodayScreen.jsx'
import { registerScreens } from '../registry.js'

// Today (PR-01, boards T10Today, T11Loading, T12Protein, T1EFood, T1ETraining). Every state is the
// real screen, TodayScreen, given what useToday() would hand it for the board's day: Ana has eaten
// 860 of 2,100 kcal, Push A is planned, 1.25 of 2.5 L of water. The drawers (T1.3 to T1.8) and
// the variants (T1.9 to T1.15) come with M4b and M5.
const NOOP = () => {}

const RINGS = [
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
const TRAINING_ACTIONS = [
  { icon: 'play', label: 'Start', onClick: NOOP },
  { icon: 'chartLine', label: 'Activity', onClick: NOOP },
  { icon: 'scale', label: 'Weigh-in', onClick: NOOP },
  { icon: 'calendar', label: 'Plan', onClick: NOOP },
]
const UP_NEXT = { eyebrow: 'Training today', title: 'Push A', sub: '6 exercises', trailing: 'play', onClick: NOOP }
const MEALS = [
  { slot: 0, icon: 'sunrise', name: 'Breakfast', sub: '420 kcal', state: 'done' },
  { slot: 1, icon: 'sun', name: 'Lunch', sub: 'Add now', state: 'now' },
  { slot: 2, icon: 'moon', name: 'Dinner', sub: 'Nothing yet', state: 'empty' },
  { slot: 3, icon: 'apple', name: 'Snacks', sub: '440 kcal', state: 'done' },
]
const WATER = { value: 1.25, target: 2.5, step: 0.25, label: '1.25 of 2.5 L', onAdd: NOOP }
const WEEK = [
  ['M', 'Monday', 'done'], ['T', 'Tuesday', 'rest'], ['W', 'Wednesday', 'done'], ['T', 'Thursday', 'today'],
  ['F', 'Friday', 'planned'], ['S', 'Saturday', 'rest'], ['S', 'Sunday', 'planned'],
].map(([dow, day, state]) => ({ key: day, dow, state, label: day + ', ' + state }))

const HEADER = { initial: 'Ana', placeholder: 'Search', unread: 2, onSettings: NOOP, onBell: NOOP, onSearch: NOOP }
const both = {
  profile: 'both', loading: false, error: null, header: HEADER, searching: false,
  rings: RINGS, onRing: NOOP, actions: FOOD_ACTIONS, upNext: UP_NEXT,
  meals: MEALS, onMeal: NOOP, onSeeDay: NOOP, water: WATER, week: null,
}

registerScreens('Today', [
  { id: 'T1.0', title: 'Today', note: 'Food and training: the rings, the actions, Up next, Food and Water.',
    render: () => <TodayScreen {...both} /> },
  { id: 'T1.1', title: 'Loading', note: 'The diary is still on its way: the ring, the actions and the sections as glass.',
    render: () => <TodayScreen {...both} loading rings={[]} /> },
  { id: 'T1.2', title: 'Protein', note: 'The rings opened on their second page.',
    render: () => <TodayScreen {...both} ring={1} /> },
  { id: 'T1.E-food', title: 'Food-only profile', note: 'No Up next and no Plan; the four food actions stay.',
    render: () => <TodayScreen {...both} profile="food" upNext={null} /> },
  { id: 'T1.E-training', title: 'Training-only profile', note: 'One ring for the week; the week strip replaces Food and Water.',
    render: () => <TodayScreen {...both} profile="training"
      rings={[{ key: 'workouts', name: 'Workouts', icon: 'dumbbell', top: 'This week', big: '2', unit: 'of 4 workouts', value: 2, max: 4, pill: 'Push A today' }]}
      actions={TRAINING_ACTIONS} meals={null} water={null} week={{ days: WEEK, label: '2 of 4 done' }} /> },
])
