import { openPlusSheet } from '../../../components/PlusSheet.jsx'
import { fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { useDiarySelection } from '../../../lib/nutrition/selection.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { useUI } from '../../../store/useUI.js'
import DayScreen from '../../../views/shared/DayScreen.jsx'
import { pastWorkoutSheet } from '../../../views/shared/PastWorkoutSheet.jsx'
import { registerScreens } from '../registry.js'
import { DAYS, dayFixture } from './shared-day-fixture.js'

// The Day page (PR-07 D1, boards Sh1Day to Sh1Skipped): the real screen, DayScreen, given what
// useDay() would hand it on the boards' days (shared-day-fixture.js), in memory only. The drawers
// are the real ones, opened the way the page opens them, over the day they belong to: the + sheet
// on a Day page (D1.5) and Add past workout (D1.6, from the mocked plan: Legs on Fridays). The
// toast (D1.7) is the app's real toast, held open.
const NOOP = () => {}
const ALEX = { id: 'u1', name: 'Alex' }
const nutrition = { user: ALEX, api: { 'GET /api/settings': fixtureSettings(), 'GET /api/foods': [], 'GET /api/meals': [] } }
const routine = (id, name, ids) => ({ id, name, emoji: 'dumbbell', ex: ids.map(ex => ({ id: ex, mode: 'reps', sets: 3, reps: 8, weight: 40 })) })
const PLAN = {
  routines: [routine('g-legs', 'Legs', ['0043', '0085', '0739', '0585', '0586']), routine('g-push', 'Push A', ['0025', '0426', '0314', '0334', '0201', '0662']),
    routine('g-pull', 'Pull A', ['0861', '0652', '0027', '0293', '0294', '0313'])],
  week: { 1: ['g-push'], 3: ['g-pull'], 5: ['g-legs'] }, dayPlan: {}, missedSeen: {}, queue: null, active: null,
  workouts: [{ id: 'g-w1', d: '2026-10-05', start: new Date('2026-10-05T18:30:00').getTime(), end: new Date('2026-10-05T19:22:00').getTime(), name: 'Push A', routineIds: ['g-push'], prs: [], entries: [] }],
}

const page = over => () => <DayScreen day={dayFixture(over)} onBack={NOOP} />
const open = fn => async t => { fn(); await t.wait(200) }
// The toast held open, as a person's finger would hold it.
const held = text => async t => {
  useUI.getState().toast(text, { action: 'Undo', onAction: NOOP })
  useUI.getState().pauseToast()
  await t.wait(60)
}

registerScreens('Shared: day', [
  { id: 'D1.0', title: 'Day, Mon 12 Oct', note: 'Push A with its stills and muscles, food on target, water, no weigh-in, the last measurements.', render: page() },
  { id: 'D1.1', title: 'A rest day', note: 'Tue 13 Oct: Rest day with what was next, food under target, the weigh-in.', render: page(DAYS.rest) },
  { id: 'D1.2', title: 'A missed workout', note: 'Fri 16 Oct: Legs was planned; Add past workout or Mark skipped.', render: page(DAYS.missed) },
  { id: 'D1.3', title: 'Nothing logged', note: 'Thu 15 Oct: one line and the three ways to add, the first naming the day.', render: page(DAYS.empty) },
  { id: 'D1.4', title: 'Food tracking off', note: 'Training only: Food is one grey card; no water row.', render: page(DAYS.off) },
  { id: 'D1.5', title: 'Add to Mon 12 Oct', note: 'The + on a Day page: the chip names the day; Add past workout in place of Start.', render: page(),
    mock: nutrition, play: async t => {
      useNutrition.getState().reset()
      openPlusSheet('/train/day/2026-10-12')
      await t.wait(200)
      // The sheet took its day when it opened; the shared selection goes back so no later state sees it.
      useDiarySelection.getState().reset()
    } },
  { id: 'D1.6', title: 'Add past workout', note: 'Over Fri 16 Oct: Legs planned and picked, the routines, start and length.', render: page(DAYS.missed),
    mock: { S: PLAN }, play: open(() => pastWorkoutSheet('2026-10-16')) },
  { id: 'D1.7', title: 'Marked skipped', note: 'Legs reads Skipped; the toast offers Undo for 8 s (held here).', render: page(DAYS.skipped),
    play: held('Marked Legs skipped on Fri 16 Oct') },
])
