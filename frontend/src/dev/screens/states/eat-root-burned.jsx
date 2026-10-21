import { fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { logActivitySheet } from '../../../views/eat/ActivitySheet.jsx'
import BurnedScreen from '../../../views/eat/BurnedScreen.jsx'
import { burnedAmountSheet } from '../../../views/eat/BurnedAmountSheet.jsx'
import { burnedWeekOf, rowOf, viewOf } from '../../../views/eat/burned-data.js'
import { registerScreens } from '../registry.js'

// Burned and Log activity (PR-04 E7, boards Ea7Burned, Ea7Activity and the "A big burn day" row):
// the real screen, BurnedScreen, given what useBurned() would hand it on the boards' week, Mon 12
// to Sun 18 October 2026, in memory only. The drawers are the real ones, opened the way the page
// opens them; the mocked NutriTrace refuses a save (404), so nothing is written.
const ALEX = { id: 'u1', name: 'Alex' }
const TODAY = '2026-10-18'
const DAYS = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', TODAY]
const energy = kcal => kcal.toLocaleString('en') + ' kcal'
const settings = (over = {}) => ({ ...fixtureSettings(), goals: { calories: { min: 2100, max: 2100, sharedGoal: true } }, ...over })

const PUSH = { id: 1, name: 'Push A', kcal: 320, duration_min: 52, source: 'opengym', covered_by: null }
const RUN = { id: 2, name: 'Run', kcal: 410, duration_min: 31, distance: 5.2, source: 'manual', covered_by: null }
const LEGS = { id: 3, name: 'Legs', kcal: 0, duration_min: 61, source: 'opengym', covered_by: null }

// The store's activity record for each day of the week; a day with nothing is a loaded, empty one.
const record = rows => ({ status: 'ready', rows, sum: { effective: rows.reduce((sum, r) => sum + r.kcal, 0) }, error: null })
const week = byDay => Object.fromEntries(DAYS.map(d => [d, record(byDay[d] || [])]))

const row = raw => rowOf(raw, '2026-10-15')
const screen = (byDay, over = {}) => () => {
  const view = viewOf({
    week: burnedWeekOf({ days: DAYS, today: TODAY, activity: week(byDay) }),
    today: TODAY, settings: settings(over), goalInputs: {}, energy,
    onAdd: r => burnedAmountSheet(r, TODAY), onOpen: () => {},
  })
  return <BurnedScreen status="ready" error={null} {...view} onLog={() => logActivitySheet()} />
}
const rows = { [TODAY]: [PUSH], '2026-10-17': [RUN] }
const open = fn => async t => { fn(); await t.wait(300) }
// What the drawer works Burned out from: 81.4 kg on the last weigh-in.
const weighed = { user: ALEX, S: { unit: 'kg', bodyweight: [{ d: '2026-10-17', w: 81.4 }] } }

registerScreens('Eat: burned', [
  { id: 'E7.0', title: 'Burned', note: 'The week’s figure, what it does to the target, rows by day; + opens Log activity.', render: screen(rows) },
  { id: 'E7.0n', title: 'Burned, a workout with no number', note: 'Legs reads 0 kcal and a line says to tap it to add one.',
    render: screen({ ...rows, '2026-10-15': [LEGS] }) },
  { id: 'E7.0a', title: 'Burned, adding a number', note: 'Tapping Legs opens a half drawer with Burned only.',
    render: screen({ ...rows, '2026-10-15': [LEGS] }), play: open(() => burnedAmountSheet(row(LEGS), TODAY)) },
  { id: 'E7.0e', title: 'Burned, nothing this week', note: 'No figure; one line and Log activity.', render: screen({}) },
  { id: 'E7.0g', title: 'Burned, no goal set', note: 'The note drops the target figure.', render: screen(rows, { goals: {} }) },
  { id: 'E7.1', title: 'Log activity', note: 'A run of 31 min prefilled: Burned worked out from 81.4 kg and editable.', render: screen(rows), mock: weighed,
    play: open(() => logActivitySheet({ type: 'run', minutes: 31 })) },
])
