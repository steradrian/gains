import NutritionGoals from '../../../views/NutritionGoals.jsx'
import { registerScreens } from '../registry.js'
import { goalMock, goalSettings } from './me-goal-fixture.js'

// Eat > Daily targets (/food/goals): the real Goals page over NutriTrace's settings answered from
// memory, here for the targets by day. A week built on training: heavier on Mon, Wed and Sat.
// Day numbers follow Date#getDay (0 = Sunday); nothing is kept on Save (mock-env.js).
const page = () => <NutritionGoals />
const open = async t => { await t.wait(400) }

const byDay = (calories, protein, carbs, fat) => {
  const s = goalSettings()
  const entry = (days, key = 'max') => ({ sharedGoal: false, days, [key]: Math.round(days.reduce((a, b) => a + b, 0) / 7) })
  s.goals = { calories: entry(calories), proteins: entry(protein), carbohydrates: entry(carbs), fat: entry(fat) }
  return s
}
// Sun Mon Tue Wed Thu Fri Sat
const week = byDay([1900, 2400, 2000, 2400, 2000, 2000, 2500], [150, 170, 150, 170, 150, 150, 170], [180, 290, 200, 290, 200, 200, 300], [60, 75, 65, 75, 65, 65, 80])

registerScreens('Eat: daily targets by day', [
  { id: 'G1', title: 'Targets, the same every day', note: 'One target on all seven days: the fields at the top set every day, and Targets by day shows today with the same numbers.',
    render: page, mock: goalMock(), play: open },
  { id: 'G2', title: 'Targets, different by day', note: 'A training week: the fields at the top are blank under "Varies by weekday"; Targets by day shows the picked day\'s calories and macros.',
    render: page, mock: goalMock({ settings: week }), play: open },
  { id: 'G3', title: 'Targets, Saturday picked', note: 'Saturday picked in the day strip: its own calories and macros, the other days untouched.',
    render: page, mock: goalMock({ settings: week }), play: async t => { await open(t); await t.click('Sat'); await t.wait(200) } },
  { id: 'G4', title: 'Targets, one day edited', note: 'Monday raised by a step: it differs from the other days now, so the fields at the top read "Varies by weekday" and Save goals is on.',
    render: page, mock: goalMock(), play: async t => { await open(t); await t.click('Mon'); document.querySelector('[aria-label="Increase Daily target Monday"]').click(); await t.wait(200) } },
  { id: 'G5', title: 'Targets, Adaptive mode', note: 'In Adaptive the day strip edits the fallback target for each day; the day\'s target follows the burn.',
    render: page, mock: goalMock({ settings: goalSettings({ mode: 'adaptive' }) }), play: open },
])
