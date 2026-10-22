import { fastChangeStartSheet } from '../../../components/FastChangeStartSheet.jsx'
import { fastStartSheet } from '../../../components/FastStartSheet.jsx'
import { usualStart } from '../../../lib/nutrition/fasting.js'
import { useUI } from '../../../store/useUI.js'
import FastingScreen from '../../../views/fasting/FastingScreen.jsx'
import { registerScreens } from '../registry.js'

// The Fasting page (PR-04 Eat, boards Ea6Fasting to Ea6Ended): the real FastingScreen, given what
// use-fasting-page.js would read, with the clock frozen at a fixed `now` so nothing ticks. The
// two drawers are the real ones, opened over it; the toast is the app's, held open. Everything is
// in memory: the fasting store, the settings and the hub are never touched.
const at = (day, h, m = 0, s = 0) => new Date(2026, 9, day, h, m, s).getTime()
const iso = ms => new Date(ms).toISOString()
const fast = (id, start, end, goal = 16) => ({ id, start_at: iso(start), end_at: end ? iso(end) : null, goal_hours: goal })

const HISTORY = [
  fast(7, at(17, 20, 10), at(18, 12, 20)),
  fast(6, at(16, 19, 30), at(17, 11, 36)),
  fast(5, at(15, 20), at(16, 13, 12)),
  fast(4, at(14, 20), at(15, 12, 30)),
  fast(3, at(13, 20), at(14, 14, 5)),
  fast(2, at(12, 20), at(13, 9)),
  fast(1, at(11, 20), at(12, 8)),
]
const RUNNING = fast(8, at(18, 20), null)
const ENDED = fast(8, at(18, 20), at(19, 12, 12, 45))
const NOOP = () => {}

const screen = over => () => {
  const props = {
    view: 'idle', now: at(18, 20, 4), hour12: false, fast: null, history: HISTORY, hours: 16, busy: false, error: null,
    onRetry: NOOP, onPick: NOOP, onTurnOn: NOOP, onTurnOff: NOOP, onOpenStart: NOOP, onChangeStart: NOOP, onEnd: NOOP, onRemove: NOOP,
    ...over,
  }
  return <FastingScreen {...props} usualStart={usualStart(props.history, props.now)} />
}
const open = fn => async t => { fn(); await t.wait(200) }
const held = (text, withUndo) => async t => {
  useUI.getState().toast(text, withUndo ? { action: 'Undo', onAction: NOOP } : undefined)
  useUI.getState().pauseToast()
  await t.wait(60)
}

const RUN_NOW = at(19, 10, 20, 5)
const REACHED_NOW = at(19, 12, 12, 40)

registerScreens('Eat: fasting', [
  { id: 'E6.0', title: 'Fasting, next fast', note: 'Idle: the next fast, plan chips, Start fast; insights, 14 days, recent fasts.', render: screen() },
  { id: 'E6.1', title: 'Fasting is off', note: 'Pick a plan, Turn on fasting; turning it off keeps the history.', render: screen({ view: 'off', history: [] }) },
  { id: 'E6.2', title: 'Start a fast', note: 'The drawer over the idle page: plan, start time, Ends, Start 16 h fast.', render: screen(),
    play: open(() => fastStartSheet({ now: at(18, 20, 4), hour12: false, initialHours: 16, onStart: async () => null })) },
  { id: 'E6.3', title: 'Fast running', note: 'The clock counts up (frozen at 14:20:05 here), time to go, Change start, End fast.',
    render: screen({ view: 'running', now: RUN_NOW, fast: RUNNING }) },
  { id: 'E6.4', title: 'Change start', note: 'The drawer over the running fast: day and time, Now ends, Move start to 19:30.',
    render: screen({ view: 'running', now: RUN_NOW, fast: RUNNING }),
    play: open(() => fastChangeStartSheet({ fast: { ...RUNNING, start_at: iso(at(18, 19, 30)) }, now: RUN_NOW, hour12: false, onSave: async () => null })) },
  { id: 'E6.5', title: 'Goal reached', note: 'The ring closes in green; 12 min past the goal; only End fast.',
    render: screen({ view: 'running', now: REACHED_NOW, fast: RUNNING }) },
  { id: 'E6.6', title: 'Fast ended', note: 'Back to Next fast; the toast offers Undo for 8 s (held here).',
    render: screen({ now: at(19, 12, 13), history: [ENDED, ...HISTORY] }), play: held('Fast ended: 16h 12m', true) },
])
