import { todayISO } from '../../../lib/format.js'
import { t as say } from '../../../lib/i18n.js'
import { fixtureSettings } from '../../../lib/nutrition/fake-nutritrace.js'
import { toastLogged, waterAddedText } from '../../../lib/nutrition/log-feedback.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { useUI } from '../../../store/useUI.js'
import { dailyTargetsSheet } from '../../../views/eat/DailyTargetsSheet.jsx'
import EatScreen from '../../../views/eat/EatScreen.jsx'
import { registerScreens } from '../registry.js'
import { FEW, OVER, base, hero, rail } from './eat-root-fixture.js'

// Eat (PR-04 E1, boards Ea1Eat, Ea1Again, Ea1Water, Ea1Off, Ea1Targets and the edge rows E1.0): the
// real screen, EatScreen, given what useEat() would hand it on the boards' day, Sunday 18 October
// 2026, in memory only. The toasts are the app's real toast with the real copy, held open; the
// Daily targets drawer is the real one over the invitation, reading a mocked NutriTrace.
const ALEX = { id: 'u1', name: 'Alex' }
const eat = (props = {}) => () => <EatScreen {...base} {...props} />
const held = message => async t => {
  toastLogged(message, async () => {})
  useUI.getState().pauseToast()
  await t.wait(60)
}
// The settings the drawer prefills from: the board's 2,100 kcal, 150 g protein, 230 g carbs, 70 g fat, 2.5 L.
const targetsMock = {
  user: ALEX,
  api: {
    'GET /api/settings': {
      ...fixtureSettings(),
      goals: { calories: { min: 2100, max: 2100, sharedGoal: true }, proteins: { max: 150 }, carbohydrates: { max: 230 }, fat: { max: 70 } },
      waterGoalMl: 2500,
    },
  },
}

registerScreens('Eat: root', [
  { id: 'E1.0', title: 'Eat', note: 'The rail with a ring a day (Tue over: amber), the week ring, four actions, Yesterday’s lunch, Your food.', render: eat() },
  { id: 'E1.0a', title: 'Eat, yesterday’s lunch logged', note: 'The row reads Logged; the toast offers Undo for 8 s (held here).', render: eat({ again: { ...base.again, done: true } }),
    play: held(say('Logged yesterday’s {0} to {1}, {2}', 'Lunch', say('Today'), 'Lunch')) },
  { id: 'E1.0w', title: 'Eat, water added', note: '+250 ml to Today with Undo for 8 s (held here).', render: eat(), play: held(waterAddedText(todayISO(), 250, {})) },
  { id: 'E1.0f', title: 'Eat, fewer than 3 logged days', note: 'Two days logged: the hero says only what they back; the rest of the rail is bare rings.',
    render: eat({ rail: rail(FEW), hero: hero(FEW), again: null }) },
  { id: 'E1.0o', title: 'Eat, days over target', note: 'A day over its goal turns amber on the rail and the average ring; no red, no copy.',
    render: eat({ rail: rail(OVER), hero: hero(OVER) }) },
  { id: 'E1.0n', title: 'Eat, nothing to log again', note: 'No Yesterday’s lunch and no Burned row (activity off): the Again section is gone.',
    render: eat({ again: null, library: base.library.filter(r => r.key !== 'burned') }) },
  { id: 'E1.0l', title: 'Eat, loading', note: 'The ring and the actions as skeletons.', render: eat({ status: 'loading' }) },
  { id: 'E1.0u', title: 'Eat, no nutrition here', note: 'A build or sign-in with no nutrition behind it.', render: eat({ status: 'unavailable' }) },
  { id: 'E1.2', title: 'Food tracking off', note: 'An invitation, never a blank tab.', render: eat({ status: 'off' }) },
  { id: 'E1.3', title: 'Daily targets', note: 'Half drawer over the invitation, prefilled; Start tracking food saves.', render: eat({ status: 'off' }), mock: targetsMock,
    play: async t => { useNutrition.getState().reset(); dailyTargetsSheet(); await t.wait(300) } },
])
