import { foodPickerSheet } from '../../../components/FoodPickerSheet.jsx'
import { openPlusSheet } from '../../../components/PlusSheet.jsx'
import { fixtureFoods, fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { useDiarySelection } from '../../../lib/nutrition/selection.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { applySheetKeyboard } from '../../../lib/sheet-keyboard.js'
import TodayScreen from '../../../views/today/TodayScreen.jsx'
import { registerScreens } from '../registry.js'
import { both } from './today-fixture.js'

// A drawer's sub-panel (Add to Today with Log food slid in over it) and a drawer with the soft
// keyboard up, over the Today screen (same fixture). The panel is the real thing, pushed the way a
// person pushes it; the keyboard is simulated: the inset an iPhone 15 Pro with its keyboard and
// accessory bar up would report, handed to the same function the app's listener uses
// (lib/sheet-keyboard.js), so the drawer stands on it exactly as it does on a phone.
const nt = {
  user: { id: 'u1', name: 'Alex' },
  api: { 'GET /api/foods': fixtureFoods(), 'GET /api/settings': { ...fixtureSettings(), diaryPromptQuantity: false }, 'GET /api/meals': [] },
}
const today = () => <TodayScreen {...both} />
const reset = () => {
  useNutrition.getState().reset()
  useDiarySelection.getState().setDate(null)
  useDiarySelection.getState().setMeal(1)
}
// 852 pt tall, the keyboard and its accessory bar 380 pt: 472 pt left above them.
const keyboardUp = (height = 472) => applySheetKeyboard({ innerHeight: 852, visualViewport: { height, offsetTop: 0 }, document })

registerScreens('Drawers: sub-panels and keyboard', [
  { id: 'Sh2.0', title: 'Add to Today, Log food pushed', note: 'Log food slid in from the right over the Add menu: a back chevron before its title, the × still closes the lot.', render: today, mock: nt,
    play: async t => { reset(); openPlusSheet('/home'); await t.wait(300); await t.click('Log food'); await t.wait(500) } },
  { id: 'Sh2.1', title: 'Add to Today, menu under the panel', note: 'The Add menu itself, for comparison: no chevron.', render: today, mock: nt,
    play: async t => { reset(); openPlusSheet('/home'); await t.wait(300) } },
  { id: 'Sh2.2', title: 'Log food, keyboard up', note: 'Search focused: the drawer keeps its height, stands on the keyboard, the scrim covers all of the screen behind it.', render: today, mock: nt,
    play: async t => {
      reset(); foodPickerSheet(); await t.wait(300)
      keyboardUp()
      document.querySelector('.g-lf-search input')?.focus()
      await t.wait(200)
    } },
  { id: 'Sh2.3', title: 'Log food, keyboard up in a panel', note: 'The same from inside a panel pushed over the Add menu.', render: today, mock: nt,
    play: async t => {
      reset(); openPlusSheet('/home'); await t.wait(300); await t.click('Log food'); await t.wait(500)
      keyboardUp()
      document.querySelector('.g-bs-pane[data-pos="active"] .g-lf-search input')?.focus()
      await t.wait(200)
    } },
])
