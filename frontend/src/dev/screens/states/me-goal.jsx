import { useLayoutEffect } from 'react'
import { useProfileWrites } from '../../../lib/me/goal-writes.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import GoalRoute from '../../../views/me/goal/GoalRoute.jsx'
import { bodyDetailsSheet, goalPickSheet, movementSheet, targetWeightSheet } from '../../../views/me/goal/goal-drawers.jsx'
import { announceSaved } from '../../../views/me/goal/goal-feedback.js'
import { openHow } from '../../../views/me/goal/HowDrawer.jsx'
import { openTargets } from '../../../views/me/goal/TargetsDrawer.jsx'
import { pending } from '../mock-env.js'
import { registerScreens } from '../registry.js'
import { goalMock, goalSettings, goalState } from './me-goal-fixture.js'

// Me > My goal (PR-05 boards Me3Goal, Me3GoalSheet, Me3Target, Me3BodySheet, Me3Movement, Me3Saved and
// the edge rows M3.0): the real GoalRoute reading a mocked store and a mocked NutriTrace (nothing
// persists; a drawer's save answers with nothing). The drawers are the real ones, opened by `play`.
// `live` says whether the hub takes Body details and Daily movement (PROFILE_WRITES_LIVE): the
// gallery shows both, then puts the flag back.
function Frame({ live = true, children }) {
  useLayoutEffect(() => {
    const was = useProfileWrites.getState().live
    useProfileWrites.setState({ live })
    return () => useProfileWrites.setState({ live: was })
  }, [live])
  return children
}
const page = (live = true) => () => <Frame live={live}><GoalRoute /></Frame>

const open = fn => async t => { await t.wait(300); fn(); await t.wait(300) }
// The toast of a saved change, held open (the page already shows the new value).
const saved = async t => {
  await t.wait(300)
  useStore.getState().update(s => { s.targetW = 77 })
  announceSaved('Target weight changed to 77.0 kg', { undo: async () => ({ ok: true }) })
  useUI.getState().pauseToast()
  await t.wait(100)
}
const refused = async t => {
  await t.wait(300)
  goalPickSheet()
  await t.wait(300)
  // A radio row's text is its title and its line together.
  await t.click('Keep my weightEat about what you burn')
  await t.wait(200)
}

const unspecified = goalSettings({ gender: null })
const noWeighIns = () => goalMock({ state: goalState({ weighIns: false }), settings: { ...goalSettings(), weight_kg: undefined } })
const weekdayFat = (() => {
  const s = goalSettings()
  s.goals.fat = { sharedGoal: false, days: [60, 60, 60, 60, 60, 80, 80] }
  return s
})()
const refusing ={ ...goalMock(), api: { 'GET /api/settings': goalSettings(), 'PUT /api/settings': { status: 500, body: { error: 'down' } } } }

registerScreens('Me: goal', [
  { id: 'M3.0', title: 'My goal', note: 'The target ring (3.4 kg to go), the summary, the started line, Goal, Target weight, Body details, Daily movement, the read-only Daily targets with Edit, How this is worked out, and the note on Undo.',
    render: page(), mock: goalMock() },
  { id: 'M3.0r', title: 'My goal, target reached', note: 'Today 77.6 kg against a target of 78: the ring closes and reads Target reached, the row has no distance, and Keep my weight sits under it.',
    render: page(), mock: goalMock({ state: goalState({ now: 77.6 }) }) },
  { id: 'M3.0w', title: 'My goal, no weigh-ins', note: 'The ring is empty and says to log a first weigh-in; no started line. The Target weight drawer still opens.',
    render: page(), mock: noWeighIns() },
  { id: 'M3.0n', title: 'My goal, no NutriTrace', note: 'A build or sign-in with no nutrition: only the ring and the Target weight row.',
    render: page(), mock: goalMock({ signedIn: false }) },
  { id: 'M3.0e', title: 'My goal, did not load', note: 'The settings request failed: the chart scene and Try again.', render: page(), mock: goalMock({ fail: true }) },
  { id: 'M3.0l', title: 'My goal, loading', note: 'The ring and the rows as skeletons.', render: page(), mock: { ...goalMock(), api: { 'GET /api/settings': pending } } },
  { id: 'M3.0p', title: 'My goal, pounds', note: 'A pound profile: weights in lb and the height in feet and inches.', render: page(), mock: goalMock({ state: goalState({ unit: 'lb' }) }) },
  { id: 'M3.0x', title: 'My goal, body skipped at onboarding', note: 'No body details and no targets: Add and Not set on the rows; the Body details and Goal drawers open empty.',
    render: page(), mock: goalMock({ settings: goalSettings({ empty: true }) }) },
  { id: 'M3.1', title: 'Goal', note: 'Lose weight, Keep my weight, Build muscle, each with what it does to the burn. Picking saves at once and closes.',
    render: page(), mock: goalMock(), play: open(goalPickSheet) },
  { id: 'M3.1e', title: 'Goal, the write was refused', note: 'The save failed: the drawer stays open, says so, and keeps the pick.', render: page(), mock: refusing, play: refused },
  { id: 'M3.2', title: 'Target weight', note: 'The field in kg and the pace under it: 3.4 kg to go from 81.4 kg and about how many weeks at the plan\'s rate.',
    render: page(), mock: goalMock(), play: open(targetWeightSheet) },
  { id: 'M3.3', title: 'Body details', note: 'Height, birth year, sex (Male, Female, Prefer not to say) and Save body details; with the hub taking those writes.',
    render: page(), mock: goalMock(), play: open(bodyDetailsSheet) },
  { id: 'M3.3g', title: 'Body details, read-only', note: 'While the hub does not take profile writes: the values, "Changing this arrives soon", no Save.',
    render: page(false), mock: goalMock(), play: open(bodyDetailsSheet) },
  { id: 'M3.3w', title: 'Body details, no weigh-in', note: 'The drawer says the burn estimate needs a weigh-in and offers Log weight.',
    render: page(), mock: noWeighIns(), play: open(bodyDetailsSheet) },
  { id: 'M3.3p', title: 'Body details, pounds', note: 'Height in feet and inches for a pound profile.',
    render: page(), mock: goalMock({ state: goalState({ unit: 'lb' }) }), play: open(bodyDetailsSheet) },
  { id: 'M3.3s', title: 'Body details, prefer not to say', note: 'No sex stored: Prefer not to say is chosen. Saving writes the averaged burn.',
    render: page(), mock: goalMock({ settings: unspecified }), play: open(bodyDetailsSheet) },
  { id: 'M3.4', title: 'Daily movement', note: 'Four levels with their lines; picking saves at once and closes.', render: page(), mock: goalMock(), play: open(movementSheet) },
  { id: 'M3.4g', title: 'Daily movement, read-only', note: 'While the hub does not take profile writes: the current level and "Changing this arrives soon".',
    render: page(false), mock: goalMock(), play: open(movementSheet) },
  { id: 'M3.7', title: 'My goal, saved', note: 'After a change the page shows the new target (77.0 kg, 4.4 kg to go) and the toast offers Undo for 8 s (held here).',
    render: page(), mock: goalMock(), play: saved },

  // Me goal M3
  { id: 'M3.5', title: 'Daily targets', note: 'Fixed / Adaptive / Dynamic with the mode in one line (and why Dynamic is off), Calories, Protein, Carbs, Fat and Water as fields in the person\'s units, Save daily targets, and More options last.',
    render: page(), mock: goalMock(), play: open(openTargets) },
  { id: 'M3.5m', title: 'Daily targets, macros do not add up', note: 'Carbs 100 g: the note names 1,630 kcal against 2,100 kcal and the button sets the carbs to 218 g. Save still works.',
    render: page(), mock: goalMock(), play: async t => { await open(openTargets)(t); await t.type('Carbs', '100') } },
  { id: 'M3.5l', title: 'Daily targets, under 1,200', note: 'A calorie target of 1,100: "Most guidelines suggest at least 1,200 kcal." Save still works.',
    render: page(), mock: goalMock(), play: async t => { await open(openTargets)(t); await t.type('Calories', '1100') } },
  { id: 'M3.5d', title: 'Daily targets, Dynamic without a wearable', note: 'Dynamic was tapped and stayed off: the line under the modes says it needs a connected wearable.',
    render: page(), mock: goalMock(), play: async t => { await open(openTargets)(t); await t.click('Dynamic') } },
  { id: 'M3.5w', title: 'Daily targets, a macro that varies by weekday', note: 'Fat differs by weekday: a read-only row "Varies by weekday" in place of the field, left alone on Save.',
    render: page(), mock: goalMock({ settings: weekdayFat }), play: open(openTargets) },
  { id: 'M3.5g', title: 'Daily targets, discard guard', note: 'Protein edited, then the ×: "Discard changes?" opens as a sub-panel with Keep editing and Discard.',
    render: page(), mock: goalMock(),
    play: async t => {
      await open(openTargets)(t)
      await t.type('Protein', '170')
      document.querySelector('.g-bs-x').click()
      await t.wait(400)
    } },
  { id: 'M3.6', title: 'How this is worked out', note: 'Your burn, the goal factor and the target, then the burn, goal, protein and workouts sentences from the data, and Edit daily targets.',
    render: page(), mock: goalMock(), play: open(openHow) },
  { id: 'M3.6a', title: 'How this is worked out, Adaptive learning', note: 'Adaptive mode with 12 of 21 days: "Adaptive is learning" and the days so far. No Early and no 35-day line, because the data has neither.',
    render: page(), mock: goalMock({ settings: goalSettings({ mode: 'adaptive' }), adaptive: { ready: false, daysAvailable: 12, daysRequired: 21 } }), play: open(openHow) },
  { id: 'M3.6r', title: 'How this is worked out, Adaptive ready', note: 'The estimate and its confidence; the target follows the burn, workouts included.',
    render: page(), mock: goalMock({ settings: goalSettings({ mode: 'adaptive' }), adaptive: { ready: true, daysAvailable: 28, daysRequired: 21, tdee: 2650, confidence: 0.8 } }), play: open(openHow) },
  { id: 'M3.6e', title: 'How this is worked out, Adaptive early', note: 'When the data carries the 35-day figure and there are fewer days: the Early mark and "Firms up at 35 days".',
    render: page(), mock: goalMock({ settings: goalSettings({ mode: 'adaptive' }), adaptive: { ready: true, daysAvailable: 28, daysRequired: 21, daysFull: 35, tdee: 2650, confidence: 0.6 } }), play: open(openHow) },
  { id: 'M3.6d', title: 'How this is worked out, Dynamic', note: 'Dynamic: "Your target follows your burn, workouts included."',
    render: page(), mock: goalMock({ settings: goalSettings({ mode: 'dynamic' }) }), play: open(openHow) },
  { id: 'M3.6n', title: 'How this is worked out, no burn', note: 'No weigh-in or body details: no figures, and a Body details button in their place.',
    render: page(), mock: noWeighIns(), play: open(openHow) },
  { id: 'M3.6t', title: 'How this is worked out, then Edit daily targets', note: 'Edit daily targets slides Daily targets in as a sub-panel; Back returns to this drawer.',
    render: page(), mock: goalMock(), play: async t => { await open(openHow)(t); await t.click('Edit daily targets') } },
])
