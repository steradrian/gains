import TodayScreen from '../../../views/today/TodayScreen.jsx'
import { registerScreens } from '../registry.js'
import { TRAINING_ACTIONS, WEEK, both } from './today-fixture.js'

// Today (PR-01, boards T10Today, T11Loading, T12Protein, T1EFood, T1ETraining). Every state is the
// real screen, TodayScreen, given what useToday() would hand it for the board's day (today-fixture.js).
// The drawers and toasts over it are today-drawers.jsx; the variants (T1.9 to T1.15) come with M4b.
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
