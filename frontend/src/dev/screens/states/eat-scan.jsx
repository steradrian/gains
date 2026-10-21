import { diaryItemSheet } from '../../../components/DiaryItemSheet.jsx'
import { scanSheet } from '../../../components/ScanSheet.jsx'
import { typeBarcodeSheet } from '../../../components/scan/ScanTypeSheet.jsx'
import { todayISO } from '../../../lib/format.js'
import { removedText, toastLogged } from '../../../lib/nutrition/log-feedback.js'
import { emptyDay, fixtureFoods, fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { useDiarySelection } from '../../../lib/nutrition/selection.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { useUI } from '../../../store/useUI.js'
import TodayScreen from '../../../views/today/TodayScreen.jsx'
import { registerScreens } from '../registry.js'
import { both, NOOP } from './today-fixture.js'

// A logged entry and the Scan overlay (PR-04 Eat logging, boards Ea8Entry, Ea8Removed, Ea9*), over
// the Today screen of T1.0 (same fixture). Each is the real component, opened the way the app opens
// it. The camera is a static dark placeholder (`preview`: no getUserMedia here) and the found
// product is handed to the overlay rather than looked up; the entry is a banana in memory. Nothing
// is saved: no Save, Remove or Log is pressed from here.
const ALEX = { id: 'u1', name: 'Alex' }
const ISO = todayISO()
const at = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString() }

const BANANA = {
  uuid: 'g-banana', meal: 3, addedAt: at(16, 40), name: 'Banana', brand: '', portion: 120, unit: 'g', quantity: 1,
  nutrition: { calories: 105, proteins: 1.3, carbohydrates: 27, fat: 0.4 }, food_server_id: 52,
}
const YOGURT = {
  name: 'Greek yogurt 10%', brand: 'Olympus', portion: 150, unit: 'g',
  nutrition: { calories: 189, proteins: 9, carbohydrates: 6, fat: 15 },
}
const mock = () => ({
  user: ALEX,
  api: {
    'GET /api/foods': fixtureFoods(), 'GET /api/settings': { ...fixtureSettings(), diaryPromptQuantity: true }, 'GET /api/meals': [],
    ['GET /api/diary/' + ISO]: { ...emptyDay(ISO), items: [BANANA] },
  },
})

const today = () => <TodayScreen {...both} />
const open = async (t, preview) => {
  useNutrition.getState().reset()
  useDiarySelection.getState().setDate(null)
  useDiarySelection.getState().setMeal(1)
  await useNutrition.getState().loadSettings()
  scanSheet({ date: ISO, meal: 1, mealName: 'Lunch', preview })
  await t.wait(250)
}
const held = message => async t => {
  toastLogged(message, async () => {})
  useUI.getState().pauseToast()
  await t.wait(60)
}

registerScreens('Eat: logged entry and Scan', [
  { id: 'Ea8Entry', title: 'A logged entry', note: 'Opened from a day\'s diary: amount, servings, time and meal; Remove or Save.', render: today, mock: mock(),
    play: async t => {
      useNutrition.getState().reset()
      await useNutrition.getState().loadSettings()
      diaryItemSheet({ date: ISO, item: BANANA })
      await t.wait(250)
    } },
  { id: 'Ea8Removed', title: 'Entry removed', note: 'Undo for 8 s (held here).', render: today, mock: mock(),
    play: held(removedText(ISO, 'Snacks', 'Banana')) },
  { id: 'Ea9Scan', title: 'Scan a barcode', note: 'The dark camera, a frame and line, Type the barcode.', render: today, mock: mock(),
    play: t => open(t, { step: { id: 'scan' } }) },
  { id: 'Ea9Looking', title: 'Scan, looking it up', note: 'The code read; your foods first, then Open Food Facts.', render: today, mock: mock(),
    play: t => open(t, { step: { id: 'looking', code: '5201054012345' } }) },
  { id: 'Ea9Found', title: 'Scan, found', note: 'Energy and macros, Save food, Log to Lunch.', render: today, mock: mock(),
    play: t => open(t, { step: { id: 'found', code: '5201054012345', food: YOGURT } }) },
  { id: 'Ea9NotFound', title: 'Scan, not found', note: 'Create food with this barcode, Scan again.', render: today, mock: mock(),
    play: t => open(t, { step: { id: 'miss', code: '5941234567899' } }) },
  { id: 'Ea9Denied', title: 'Scan, camera blocked', note: 'How to allow it; Type the barcode or Try again.', render: today, mock: mock(),
    play: t => open(t, { step: { id: 'scan' }, camera: 'denied' }) },
  { id: 'Ea9Type', title: 'Scan, type the barcode', note: 'A drawer over the overlay; Look up is on once the digits are a barcode.', render: today, mock: mock(),
    play: async t => {
      await open(t, { step: { id: 'scan' } })
      typeBarcodeSheet({ onLookUp: NOOP })
      await t.wait(250)
      await t.type('Barcode', '5941234567899')
    } },
])
