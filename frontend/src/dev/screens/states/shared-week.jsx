import WeekScreen from '../../../views/shared/WeekScreen.jsx'
import { registerScreens } from '../registry.js'

// The Week page (PR-07 D2, boards Sh2Week, Sh2WeekPast, and PR07Edges' "a week with nothing"): the
// real screen, WeekScreen, given what useWeek() would hand it, in memory only. Taps do nothing here.
// The board's muscle line "Chest and back most, calves least" and "Coach moved it to Mon 19 Oct"
// are left out: useWeek only says what its data backs (week-data.js muscleNoteOf).
const NOOP = () => {}
const food = (kcal, target = 2100) => ({
  logged: kcal > 0, kcal, target, band: Math.abs(kcal - target) <= 150 ? 'on' : kcal > target ? 'over' : 'under',
  protein: 120, proteinTarget: 150, waterMl: 1900,
})
const cell = (iso, dow, workout, f, extra = {}) => ({ iso, dow, date: Number(iso.slice(8)), today: false, future: false, workout, food: f, open: 'day', ...extra })
const last4 = selected => [
  { isoWeek: '2026-W39', start: '2026-09-21', label: '21 Sep', done: 4, planned: 4 },
  { isoWeek: '2026-W40', start: '2026-09-28', label: '28 Sep', done: 3, planned: 4 },
  { isoWeek: '2026-W41', start: '2026-10-05', label: '5 Oct', done: 3, planned: 4 },
  { isoWeek: '2026-W42', start: '2026-10-12', label: '12 Oct', done: 2, planned: 4, current: true },
].map(w => ({ current: false, ...w, selected: w.isoWeek === selected }))
const actions = { openDay: NOOP, openWeek: NOOP }

// The board's today is Sunday 18 Oct: Push A is today, Legs was missed on Friday.
const THIS_WEEK = {
  ...actions,
  isoWeek: '2026-W42', start: '2026-10-12', end: '2026-10-18', current: true, foodOn: true,
  range: '12 to 18 Oct', status: 'This week · 1 day to go',
  ring: { done: 2, planned: 4, today: 'Push A', missed: [{ iso: '2026-10-16', day: 'Fri', name: 'Legs', ids: ['legs'] }], skipped: [] },
  cells: [
    cell('2026-10-12', 'M', 'done', food(2080)),
    cell('2026-10-13', 'T', 'rest', food(1950)),
    cell('2026-10-14', 'W', 'done', food(2100)),
    cell('2026-10-15', 'T', 'rest', food(0)),
    cell('2026-10-16', 'F', 'missed', food(1690)),
    cell('2026-10-17', 'S', 'rest', food(2100)),
    cell('2026-10-18', 'S', 'planned', food(1280), { today: true, open: 'today' }),
  ],
  muscles: { load: {}, levels: { chest: 4, deltoids: 3, triceps: 3, 'upper-back': 3, biceps: 2, trapezius: 2, abs: 1, quadriceps: 0, hamstring: 0, calves: 0, gluteal: 0 } },
  muscleNote: 'Legs not trained yet. Legs was missed on Fri.',
  numbers: {
    streak: { weeks: 6, best: 8 },
    onTarget: { days: 4, of: 6, within: 150 },
    kcal: { avg: 1980, target: 2100 },
    protein: { avg: 118, target: 150 },
    weight: { from: 81.7, to: 81.4, change: -0.3, unit: 'kg' },
    activity: { ms: 9600000, count: 3 },
    volume: { now: 14300, last: 18900, unit: 'kg', change: -0.243 },
    water: { avgMl: 1900, goalMl: 2500 },
  },
  last4: last4('2026-W42'), prev: '2026-W41', next: null,
}

const PAST_WEEK = {
  ...actions,
  isoWeek: '2026-W41', start: '2026-10-05', end: '2026-10-11', current: false, foodOn: true,
  range: '5 to 11 Oct', status: 'Week 41 · complete',
  ring: { done: 3, planned: 4, today: null, missed: [], skipped: [{ iso: '2026-10-11', day: 'Sun', name: 'Pull A', ids: ['pull'] }] },
  cells: [
    cell('2026-10-05', 'M', 'done', food(2040)),
    cell('2026-10-06', 'T', 'rest', food(2100)),
    cell('2026-10-07', 'W', 'done', food(2060)),
    cell('2026-10-08', 'T', 'rest', food(1910)),
    cell('2026-10-09', 'F', 'done', food(2100)),
    cell('2026-10-10', 'S', 'rest', food(2180)),
    cell('2026-10-11', 'S', 'skipped', food(1800)),
  ],
  muscles: { load: {}, levels: { chest: 4, 'upper-back': 4, deltoids: 3, triceps: 3, biceps: 3, quadriceps: 3, hamstring: 2, gluteal: 2, abs: 2, trapezius: 2, calves: 1 } },
  muscleNote: 'Every muscle group trained. Pull A was missed on Sun.',
  numbers: {
    streak: { weeks: 5, best: null },
    onTarget: { days: 6, of: 7, within: 150 },
    kcal: { avg: 2060, target: 2100 },
    protein: { avg: 131, target: 150 },
    weight: { from: 82.1, to: 81.7, change: -0.4, unit: 'kg' },
    activity: { ms: 11100000, count: 4 },
    volume: { now: 18900, last: 17800, unit: 'kg', change: 0.062 },
    water: { avgMl: 2200, goalMl: 2500 },
  },
  last4: last4('2026-W41'), prev: '2026-W40', next: '2026-W42',
}

const EMPTY_WEEK = {
  ...PAST_WEEK,
  isoWeek: '2026-W40', start: '2026-09-28', end: '2026-10-04', range: '28 Sep to 4 Oct', status: 'Week 40 · complete',
  ring: { done: 0, planned: 0, today: null, missed: [], skipped: [] },
  cells: ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']
    .map((iso, i) => cell(iso, 'MTWTFSS'[i], 'rest', null)),
  muscles: { load: {}, levels: {} },
  muscleNote: null,
  numbers: { streak: null, onTarget: null, kcal: null, protein: null, weight: null, activity: null, volume: null, water: null },
  last4: last4('2026-W40'), prev: '2026-W39', next: '2026-W41',
}

registerScreens('Shared: week', [
  { id: 'D2.0', title: 'Week', note: 'This week: 2 of 4 with Push A today, Legs missed on Friday, the Numbers and Last 4 weeks; › is faint.',
    render: () => <WeekScreen week={THIS_WEEK} onBack={NOOP} onTrends={NOOP} /> },
  { id: 'D2.1', title: 'A complete past week', note: 'Week 41: 3 of 4, one skipped on Sunday; volume against the week before; ‹ and › both open.',
    render: () => <WeekScreen week={PAST_WEEK} onBack={NOOP} onTrends={NOOP} /> },
  { id: 'D2.E-empty', title: 'A week with nothing', note: 'The cells and Last 4 weeks still show; every number reads "–" and the ring is empty.',
    render: () => <WeekScreen week={EMPTY_WEEK} onBack={NOOP} onTrends={NOOP} /> },
])
