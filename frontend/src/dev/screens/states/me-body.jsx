import { todayISO } from '../../../lib/format.js'
import { t as say } from '../../../lib/i18n.js'
import { rangeStart } from '../../../lib/progress-range.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import BodyScreen from '../../../views/me/body/BodyScreen.jsx'
import { bodyOf } from '../../../views/me/body/body-data.js'
import { measureOf } from '../../../views/me/body/measure-data.js'
import { manageMeasurementsSheet, measurementLogSheet } from '../../../views/me/body/measure-drawers.jsx'
import { editWeighInSheet, logWeightSheet } from '../../../views/me/body/weigh-in-drawers.jsx'
import { registerScreens } from '../registry.js'
import { NOOP, bodyState, editEntry, emptyState, measureState } from './me-body-fixture.js'

// Me > Body (PR-05 boards Me2Body, Me2LogWeight, Me2EditWeigh, Me2Deleted, Me2Empty and the edge rows
// M2.0, M2.1, M2.4): the real BodyScreen reading a mocked store (nothing persists), so a drawer's save
// or delete shows on the page behind it. The drawers are the real ones, opened by `play`.
function BodyStage({ range = 0, asks, pill, waiting }) {
  const S = useStore(s => s.S)
  const data = bodyOf(S, { from: rangeStart(range), today: todayISO() })
  return (
    <BodyScreen tab="weigh-ins" onTab={NOOP} data={data} range={range} onRange={NOOP}
      waiting={waiting} asks={asks ?? S.weighIn !== false} pill={pill} onLog={logWeightSheet} onOpen={editWeighInSheet} />
  )
}
const page = props => () => <BodyStage {...props} />

// The state a mock lays over the store.
const withS = S => ({ S })
const logIt = async t => { logWeightSheet(); await t.wait(300) }
const heldDeleted = async t => {
  editWeighInSheet(editEntry())
  await t.wait(300)
  await t.click('Delete weigh-in')
  useUI.getState().pauseToast()
  await t.wait(100)
}

registerScreens('Me: body', [
  { id: 'M2.0', title: 'Body, weigh-ins', note: 'The trend card with the Target line, the range, seven weigh-ins with the change from the one before, and the ask before the first workout.',
    render: page(), mock: withS(bodyState()) },
  { id: 'M2.0a', title: 'Body, 1M range', note: '?range=30: the chart and the list follow the range; the change is still against the weigh-in before each.',
    render: page({ range: 30 }), mock: withS(bodyState()) },
  { id: 'M2.0b', title: 'Body, not weighed in today', note: 'The latest weigh-in a week ago: the line reads its date, not "today".',
    render: page(), mock: withS(bodyState({ today: false })) },
  { id: 'M2.0c', title: 'Body, no workout ask', note: 'S.weighIn is false: the footer drops the sentence about the ask before a workout.',
    render: page(), mock: withS(bodyState({ weighIn: false })) },
  { id: 'M2.0d', title: 'Body, pounds', note: 'The same page in lb.', render: page(), mock: withS(bodyState({ unit: 'lb' })) },
  { id: 'M2.0e', title: 'Body, offline', note: 'Offline with a new weigh-in: its row reads Waiting to sync and the pill counts it.',
    render: page({ pill: { state: 'offline', waiting: 1 }, waiting: new Set([todayISO()]) }), mock: withS(bodyState()) },
  { id: 'M2.1', title: 'Log weight', note: 'The weigh-in drawer, titled Log weight, over the page; the last weigh-in a week ago.',
    render: page(), mock: withS(bodyState({ today: false })), play: logIt },
  { id: 'M2.1a', title: 'Log weight, already weighed in today', note: 'The drawer says today has 81.4 kg and that saving replaces it; Undo follows.',
    render: page(), mock: withS(bodyState()), play: logIt },
  { id: 'M2.1b', title: 'Log weight, far from the last', note: 'More than 3 kg from the last weigh-in: a line under the number says so before saving.',
    render: page(), mock: withS(bodyState({ today: false })),
    play: async t => { await logIt(t); await t.type(say('Weight ({0})', 'kg'), '71.2'); await t.wait(60) } },
  { id: 'M2.2', title: 'Edit weigh-in', note: 'A past weigh-in: the value, when it was logged, Save weigh-in and Delete weigh-in.',
    render: page(), mock: withS(bodyState()), play: async t => { editWeighInSheet(editEntry()); await t.wait(300) } },
  { id: 'M2.3', title: 'Body, weigh-in deleted', note: 'Delete weigh-in closes the drawer and the toast offers Undo for 8 s (held here); the row is gone and the next change is against the one before.',
    render: page(), mock: withS(bodyState()), play: heldDeleted },
  { id: 'M2.4', title: 'Body, no weigh-ins', note: 'Nothing logged yet: the chart scene, Log weight, and the ask before the first workout.',
    render: page(), mock: withS(emptyState()) },
  { id: 'M2.4a', title: 'Body, no weigh-ins, no workout ask', note: 'S.weighIn is false: the empty state drops the sentence about the ask.',
    render: page(), mock: withS(emptyState({ weighIn: false })) },
])

// Me body M2: Measurements (boards Me2Measure, Me2LogMeasure, Me2Fields and the M2.5 edge rows). The real
// BodyScreen on its Measurements tab, the real drawers opened by `play`.
function MeasurePage({ range = 0 }) {
  const S = useStore(s => s.S)
  const data = bodyOf(S, { from: rangeStart(range), today: todayISO() })
  const measure = measureOf(S, { from: rangeStart(range) })
  return (
    <BodyScreen tab="measurements" onTab={NOOP} data={data} range={range} onRange={NOOP}
      onLog={logWeightSheet} onOpen={editWeighInSheet}
      measure={measure} onLogMeasure={() => measurementLogSheet()} onChooseMeasure={manageMeasurementsSheet} />
  )
}
const measurePage = props => () => <MeasurePage {...props} />
const logMeasures = async t => { measurementLogSheet(); await t.wait(300) }
const heldToast = async t => { await logMeasures(t); useUI.getState().pauseToast(); await t.wait(100) }

registerScreens('Me: body', [
  { id: 'M2.5', title: 'Measurements', note: 'Five tracked: the chips, the waist with its change since the previous and since the first, its curve, the latest of each, and Log measurements. The board\'s dashed "Your mark" line is left out: no per-measurement goal exists.',
    render: measurePage(), mock: withS(measureState()) },
  { id: 'M2.5a', title: 'Measurements, nothing tracked', note: 'No measurement switched on: the chart scene and Log measurements, which opens on Choose measurements.',
    render: measurePage(), mock: withS(measureState({ tracked: [] })) },
  { id: 'M2.5b', title: 'Measurements, nothing logged yet', note: 'Five tracked, no check-in: the scene and Log measurements.',
    render: measurePage(), mock: withS(measureState({ logged: false })) },
  { id: 'M2.5c', title: 'Measurements, inches', note: 'A pound profile reads the same centimetres in inches.',
    render: measurePage(), mock: withS(measureState({ unit: 'lb' })) },
  { id: 'M2.6', title: 'Log measurements', note: 'The full drawer: today, one field per tracked measurement, Choose measurements, Save measurements. The waist is typed; the rest stay empty.',
    render: measurePage(), mock: withS(measureState()),
    play: async t => { await logMeasures(t); await t.type('Waist', '83.5'); await t.wait(60) } },
  { id: 'M2.6a', title: 'Log measurements, today already measured', note: 'Today has a check-in: the drawer opens that day for editing and the toast says so (held here).',
    render: measurePage(), mock: withS(measureState({ today: true })), play: heldToast },
  { id: 'M2.6b', title: 'Log measurements, nothing tracked', note: 'Nothing tracked: the drawer opens with Choose measurements pushed over it.',
    render: measurePage(), mock: withS(measureState({ tracked: [] })), play: logMeasures },
  { id: 'M2.7', title: 'Choose measurements', note: 'A sub-panel over Log measurements (opened from inside the drawer): Torso, Arms, Legs, Other and Your own, one switch each, Custom measurement, Done.',
    render: measurePage(), mock: withS(measureState()),
    play: async t => { await logMeasures(t); await t.click('Choose measurements'); await t.wait(500) } },
])
