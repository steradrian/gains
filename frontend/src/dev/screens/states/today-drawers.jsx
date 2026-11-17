import { foodPickerSheet } from '../../../components/FoodPickerSheet.jsx'
import { nutritionDaySheet } from '../../../components/NutritionDaySheet.jsx'
import { openPlusSheet } from '../../../components/PlusSheet.jsx'
import { todayISO } from '../../../lib/format.js'
import { addedText, toastLogged, waterAddedText } from '../../../lib/nutrition/log-feedback.js'
import { emptyDay, fixtureActivity, fixtureActivitySum, fixtureDay, fixtureFoods, fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { useDiarySelection } from '../../../lib/nutrition/selection.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { bwSheet } from '../../../sheets.jsx'
import { useUI } from '../../../store/useUI.js'
import TodayScreen from '../../../views/today/TodayScreen.jsx'
import { registerScreens } from '../registry.js'
import { both } from './today-fixture.js'

// Today's Nutrition, Log food, Weigh-in and Add drawers (T1.3, T1.4, T1.7, T1.8) and the toasts
// after a log (T1.5, T1.6), over the Today screen of T1.0 (same fixture). Each drawer is the real one, opened the way Today
// opens it; the foods come from the mocked NutriTrace. The toasts are the real toast with the real
// copy, held still so they stay.
const ALEX = { id: 'u1', name: 'Alex' }
const YESTERDAY = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()
const nt = (foods = fixtureFoods()) => ({
  user: ALEX,
  api: { 'GET /api/foods': foods, 'GET /api/settings': { ...fixtureSettings(), diaryPromptQuantity: false }, 'GET /api/meals': [] },
})
// The day the Nutrition drawer reads (useDiaryDay): the diary, its activity and the activity's sum.
const day = (entry = fixtureDay(todayISO())) => {
  const iso = todayISO()
  const mock = nt()
  return {
    ...mock,
    api: {
      ...mock.api,
      ['GET /api/diary/' + iso]: entry,
      ['GET /api/activity/' + iso]: fixtureActivity(iso),
      ['GET /api/activity/sum/' + iso]: fixtureActivitySum(iso),
    },
  }
}
const nutrition = tab => async t => {
  useNutrition.getState().reset()
  nutritionDaySheet({ tab })
  await t.wait(300)
}
const today = () => <TodayScreen {...both} />
const logFood = ({ date = null, meal = 1 } = {}) => async t => {
  useNutrition.getState().reset()
  useDiarySelection.getState().setDate(date)
  useDiarySelection.getState().setMeal(meal)
  foodPickerSheet()
  await t.wait(300)
}
const held = (message) => async t => {
  toastLogged(message, async () => {})
  useUI.getState().pauseToast()
  await t.wait(60)
}

registerScreens('Today: drawers and toasts', [
  { id: 'T1.3', title: 'Nutrition', note: 'See day and the rings; a tab a ring.', render: today, mock: day(), play: nutrition(0) },
  { id: 'T1.3p', title: 'Nutrition, on Protein', note: 'The Protein ring opens its own tab.', render: today, mock: day(), play: nutrition(1) },
  { id: 'T1.3e', title: 'Nutrition, nothing logged', note: 'Every meal has a +; the total reads 0 of the target.', render: today,
    mock: day(emptyDay(todayISO())), play: nutrition(0) },
  { id: 'T1.4', title: 'Log food for Lunch', note: 'Search and sources pinned; a row logs in a tap.', render: today, mock: nt(), play: logFood() },
  { id: 'T1.4e', title: 'Log food, no recent foods', note: 'Recent opens on Suggested foods; Scan leads.', render: today,
    mock: nt(fixtureFoods().map(f => ({ ...f, last_used_at: null }))), play: logFood() },
  { id: 'T1.4p', title: 'Log food to a past day', note: 'The chip names the day and meal.', render: today, mock: nt(), play: logFood({ date: YESTERDAY, meal: 2 }) },
  { id: 'T1.5', title: 'Food added', note: 'Undo for 8 s (held here).', render: today, mock: nt(),
    play: held(addedText(todayISO(), 'Lunch', 'Chicken rice bowl')) },
  { id: 'T1.6', title: 'Water added', note: 'Undo for 8 s (held here).', render: today, mock: nt(),
    play: held(waterAddedText(todayISO(), 250, {})) },
  { id: 'T1.7', title: 'Weigh-in', note: 'A weight 3 kg or more from the last says so under the number.', render: today, mock: nt(),
    play: async t => { bwSheet(); await t.wait(200) } },
  { id: 'T1.8', title: 'Add to Today', note: 'The + in the tab bar: six tiles, then the rest.', render: today, mock: nt(),
    play: async t => { useNutrition.getState().reset(); useDiarySelection.getState().setDate(null); openPlusSheet('/home'); await t.wait(200) } },
])
