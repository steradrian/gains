import { useUI } from '../../../store/useUI.js'
import FeaturesScreen from '../../../views/settings/pages/FeaturesScreen.jsx'
import GymPassPage from '../../../views/settings/pages/GymPassPage.jsx'
import UnitsPage from '../../../views/settings/pages/UnitsPage.jsx'
import { formulaSheet, languageSheet } from '../../../views/settings/pages/units-sheets.jsx'
import { registerScreens } from '../registry.js'

// Settings prefs m1 (PR-06, boards St1Units, St1Language, St1Formula, St1GymPass, St1Features,
// St1FoodOff). Units and Gym check-in are the real pages over a mocked profile; Features is the
// real FeaturesScreen given the rows FeaturesPage would hand it, so no hub is needed. Nothing here
// is stored: the gallery lays the mock S over the store in memory only.
const NOOP = () => {}
const PROFILE = { unit: 'kg', lang: 'en', wdec: 1, oneRmFormula: 'epley', speedUnit: 'kmh' }
const CARD = { gymCards: [{ id: 'g1', label: 'World Class Bucharest', value: '2041 7788 0193', fmt: 'qrcode' }], lastGymCardId: 'g1' }

const on = (extra = {}) => ({ on: true, ...extra })
const track = ({ food = true } = {}) => ({
  training: { on: true, onChange: NOOP },
  food: { on: food, onChange: NOOP },
  activity: on({ onChange: NOOP }),
})
const fasting = { on: false, onChange: NOOP }
const water = { on: true, onChange: NOOP }
const link = (title, sub) => ({ key: title, icon: 'slider', title, sub, value: 'Off', onClick: NOOP })
const LINKS = [
  link('Show time logged', 'Diary and meals'),
  link('Show activity under meals', 'Diary and meals'),
  link('Collapse completed exercises', 'Workout screen'),
  link('Beep when a barcode scans', 'Foods and scanning'),
]
const features = (props = {}) => (
  <FeaturesScreen title="Features" line="Training, Food, Activity · Fasting off" track={track()} fasting={fasting}
    coach={{ soon: true, onOpen: NOOP }} water={water} links={LINKS} {...props} />
)

registerScreens('Settings', [
  { id: 'A1.5', title: 'Units and language', note: 'Language, English names, weight unit and decimals, the 1RM formula, speed.',
    render: () => <UnitsPage />, mock: { S: PROFILE } },
  { id: 'A1.6', title: 'Language drawer', note: 'A half drawer: one radio row per language, choosing applies and closes.',
    render: () => <UnitsPage />, mock: { S: PROFILE }, play: async t => { languageSheet(); await t.wait(300) } },
  { id: 'A1.7', title: '1RM formula drawer', note: 'Each formula with the same example set; only the estimate changes.',
    render: () => <UnitsPage />, mock: { S: PROFILE }, play: async t => { formulaSheet(); await t.wait(300) } },
  { id: 'A1.4', title: 'Gym check-in', note: 'The card name, its QR on a white plate, and the Card rows. Remove has Undo, not a confirm.',
    render: () => <GymPassPage />, mock: { S: CARD } },
  { id: 'A1.12', title: 'Features', note: 'What you track, the features that start off, and a link row for every other switch that starts off.',
    render: () => features() },
  { id: 'A1.13', title: 'Food turned off', note: 'The row reads "Off · your diary is kept" and the toast offers Undo for 8 s (held open here).',
    render: () => features({ line: 'Training, Activity · Food off', track: track({ food: false }), fasting: null, water: null }),
    play: async t => {
      useUI.getState().toast('Stopped tracking food. Your diary is kept', { action: 'Undo', onAction: NOOP })
      await t.wait(200)
      useUI.getState().pauseToast()
    } },
])
