import { foodPickerSheet } from '../../../components/FoodPickerSheet.jsx'
import { todayISO } from '../../../lib/format.js'
import { addedText, toastLogged, waterAddedText } from '../../../lib/nutrition/log-feedback.js'
import { fixtureFoods, fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { useDiarySelection } from '../../../lib/nutrition/selection.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { bwSheet } from '../../../sheets.jsx'
import { useUI } from '../../../store/useUI.js'
import Home from '../../../views/Home.jsx'
import { registerScreens } from '../registry.js'

// Today's Log food and Weigh-in drawers (T1.4, T1.7) and the toasts after a log (T1.5, T1.6),
// over Today. Each drawer is the real one, opened the way Today opens it; the foods come from the
// mocked NutriTrace. The toasts are the real toast with the real copy, held still so they stay.
const ALEX = { id: 'u1', name: 'Alex' }
const YESTERDAY = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()
const nt = (foods = fixtureFoods()) => ({
  user: ALEX,
  api: { 'GET /api/foods': foods, 'GET /api/settings': { ...fixtureSettings(), diaryPromptQuantity: false }, 'GET /api/meals': [] },
})
const today = () => <Home />
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
])
