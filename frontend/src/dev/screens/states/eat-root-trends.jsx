import { dayTargetOf } from '../../../lib/day-route.js'
import { foodTrendsOf, monthOf } from '../../../lib/nutrition/trends.js'
import MonthScreen from '../../../views/eat/MonthScreen.jsx'
import TrendsScreen from '../../../views/eat/TrendsScreen.jsx'
import { registerScreens } from '../registry.js'

// Eat's Month and Food trends (PR-04 root-m2, boards Ea1Month, Ea3Trends, Ea3Few and PR04Edges'
// "A day over target", "Fewer than 3 logged days", "Fasting off"): the real screens, given what
// monthOf and foodTrendsOf make of a diary held in memory here, never saved. The board's today is
// Sunday 18 Oct 2026 with a goal of 2,100 kcal and 150 g of protein. Taps do nothing.
const NOOP = () => {}
const TODAY = '2026-10-18'
const FIRST = '2026-09-01'

const SETTINGS = {
  calorieGoalMode: 'fixed',
  goals: {
    calories: { sharedGoal: true, max: 2100 },
    proteins: { sharedGoal: true, max: 150 },
    carbohydrates: { sharedGoal: true, max: 230 },
    fat: { sharedGoal: true, max: 70 },
  },
}

const day = (date, kcal) => ({
  date, water: [],
  items: [{ uuid: 'i-' + date, meal: 0, name: 'Food', quantity: 1, nutrition: {
    calories: kcal, proteins: Math.round(kcal * 0.065), carbohydrates: Math.round(kcal * 0.11), fat: Math.round(kcal * 0.032),
  } }],
})

// October as the board draws it: 13 days on target, 9 and 13 Oct over, 6 and 12 Oct under.
const OCTOBER = [2050, 1980, 2100, 2000, 2150, 1500, 2020, 2080, 2400, 1990, 2060, 1450, 2380, 2100, 2080, 1960, 2100]
const octDay = (n, kcal) => day(`2026-10-${String(n).padStart(2, '0')}`, kcal)
const SEPTEMBER = Array.from({ length: 30 }, (_, i) => day(`2026-09-${String(i + 1).padStart(2, '0')}`, 1900 + ((i + 1) * 97) % 380))
const DAYS = [...SEPTEMBER, ...OCTOBER.map((kcal, i) => octDay(i + 1, kcal)), octDay(18, 1280)]
// One over day only, for "A day over target".
const ONE_OVER = [...SEPTEMBER, ...OCTOBER.map((kcal, i) => octDay(i + 1, kcal > 2200 && i !== 8 ? 2100 : kcal)), octDay(18, 1280)]

const month = days => monthOf({
  month: '2026-10', days, settings: SETTINGS, weekStart: 1,
  openOf: iso => dayTargetOf(iso, { today: TODAY, first: FIRST }),
})
const trends = (range, days = DAYS) => foodTrendsOf({ days, settings: SETTINGS, range, today: TODAY })

const FASTING = { avgHours: 15 + 40 / 60, streak: 5, longestHours: 18 + 5 / 60, longestDay: '2026-10-14' }
const screen = (range, { fasting = null, days } = {}) => (
  <TrendsScreen data={trends(range, days)} fasting={fasting} onRange={NOOP} onBack={NOOP} onTargets={NOOP} onFasting={NOOP} onDay={NOOP} onLog={NOOP} />
)

registerScreens('Eat: Month and trends', [
  { id: 'E1.1', title: 'Month', note: 'October so far: 13 of 17 days on target, two over (amber, no words), today lit, days ahead dim.',
    render: () => <MonthScreen data={month(DAYS)} today={TODAY} weekStart={1} onPrev={NOOP} onNext={undefined} onBack={NOOP} onDay={NOOP} /> },
  { id: 'E1.1-over', title: 'A day over target', note: 'Only 9 Oct is over: its ring is amber with no copy; the tile says Over 1 day.',
    render: () => <MonthScreen data={month(ONE_OVER)} today={TODAY} weekStart={1} onPrev={NOOP} onNext={undefined} onBack={NOOP} onDay={NOOP} /> },
  { id: 'E3.0', title: 'Food trends, 7 days', note: 'Averages, the calories chart against the 2,100 kcal line with today still open, macros against their targets, fasting and the days.',
    render: () => screen(7, { fasting: FASTING }) },
  { id: 'E3.0-30', title: 'Food trends, 30 days', note: 'A bar is a week\'s daily average.',
    render: () => screen(30, { fasting: FASTING }) },
  { id: 'E3.0-90', title: 'Food trends, 90 days', note: 'Thirteen weekly bars; weeks before the first log are empty.',
    render: () => screen(90, { fasting: FASTING }) },
  { id: 'E3.0-nofast', title: 'Food trends, fasting off', note: 'No Fasting block, and nothing says it is missing.',
    render: () => screen(7) },
  { id: 'E3.1', title: 'Trends, under 3 days', note: 'One logged day: a count to 3 and Log food, no charts.',
    render: () => screen(7, { days: [octDay(17, 2100), octDay(18, 1280)] }) },
])
