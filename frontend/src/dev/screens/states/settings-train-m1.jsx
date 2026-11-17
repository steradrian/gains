import FineTunePage from '../../../views/settings/pages/FineTunePage.jsx'
import SchedulePage from '../../../views/settings/pages/SchedulePage.jsx'
import WorkoutPage from '../../../views/settings/pages/WorkoutPage.jsx'
import { openRestTimerSheet } from '../../../views/settings/pages/rest-timer-sheet.jsx'
import { registerScreens } from '../registry.js'

// Settings, Training: Workout screen, its Rest timer drawer, Fine-tuning and Schedule (boards
// St1Workout, St1RestTimer, St1FineTune, St1Schedule), the real pages over a profile with a few
// settings made. Taps stay in memory (mock-env.js).
const S = { restSec: 90, restPauseSec: 20, effort: 'rir', sound: true, vibrate: true, workoutView: 'cards', gifSize: 'full', weekStart: 1 }
const rotation = {
  scheduleMode: 'rotation',
  routines: [{ id: 'g-a', name: 'Push A', emoji: null, ex: [] }, { id: 'g-b', name: 'Pull A', emoji: null, ex: [] }],
  rotation: { id: 'g-r1', sequence: ['g-a', 'g-b'], label: 'Rotation' },
}

registerScreens('Settings', [
  { id: 'A1.14', title: 'Workout screen', note: 'Layout tiles, effort, the rest timer, what happens when a rest ends, and the Fine-tuning row.',
    path: '/me/workout', render: () => <WorkoutPage />, mock: { S } },
  { id: 'A1.15', title: 'Rest timer (drawer)', note: 'Live: every tap writes. 15 s steps, four presets, Done only closes.',
    path: '/me/workout', render: () => <WorkoutPage />, mock: { S },
    play: async t => { openRestTimerSheet(); await t.wait(300) } },
  { id: 'A1.16', title: 'Fine-tuning', note: 'Planned sessions start from, timed sets, and the buttons on the workout screen.',
    path: '/me/advanced', render: () => <FineTunePage />, mock: { S } },
  { id: 'A1.17', title: 'Schedule', note: 'Fixed week: How you train, Week starts on, Load a starter plan.',
    path: '/me/schedule', render: () => <SchedulePage />, mock: { S } },
  { id: 'A1.17.rotation', title: 'Schedule, Rotation', note: 'Rotation chosen: the same page with the loop mode lit.',
    path: '/me/schedule', render: () => <SchedulePage />, mock: { S: { ...S, ...rotation } } },
])
