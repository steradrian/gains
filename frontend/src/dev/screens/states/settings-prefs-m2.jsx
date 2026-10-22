import RemindersScreen from '../../../views/settings/pages/RemindersScreen.jsx'
import { reminderTimeSheet } from '../../../views/settings/pages/reminder-time-sheet.jsx'
import { registerScreens } from '../registry.js'

// Settings prefs m2 (PR-06, boards St1Reminders, St1ReminderTime, St1RemindersInstall,
// St1RemindersBlocked). The real RemindersScreen given what RemindersPage would hand it, because
// the page itself reads this browser's push support and permission, which the gallery can not set.
// Nothing is stored.
const NOOP = () => {}
const master = { on: true, busy: false, onChange: NOOP, sub: 'Rest-timer alerts, even if Gains is closed.' }
const workout = {
  on: true, onChange: NOOP, time: '18:00', names: 'Push A, Legs, Pull A', tz: 'Europe/Zurich', onTime: NOOP,
  sub: "Only sent on days you have a routine planned and haven't logged a workout yet.",
}
const nudge = {
  on: true, onChange: NOOP, tone: 'friendly', onTone: NOOP,
  sub: 'One nudge in the evening of a planned day with nothing logged, between 20:00 and 21:30. After 3 missed days in a row it goes quiet until your next workout.',
}
const screen = (props = {}) => (
  <RemindersScreen kind="ready" line="2 on · they come to you, not to Notifications" master={master} workout={workout}
    nudge={nudge} onCheck={NOOP} onTest={NOOP} {...props} />
)

registerScreens('Settings', [
  { id: 'A1.8', title: 'Reminders', note: 'The push switch, the workout-day reminder with its time, the missed-workout nudge and its tone, this device, and a test.',
    render: () => screen() },
  { id: 'A1.9', title: 'Reminder time drawer', note: 'Hour and minute wheels, the planned days lit from the Plan, Save reminder.',
    render: () => screen(),
    play: async t => {
      reminderTimeSheet({ time: '18:00', days: new Set([1, 3, 5]), lang: 'en', onSave: NOOP })
      await t.wait(300)
    } },
  { id: 'A1.10', title: 'Reminders: not installed', note: 'An iPhone browser tab: three steps to the Home Screen, then check again.',
    render: () => screen({ kind: 'install', line: 'Not installed on this iPhone' }) },
  { id: 'A1.11', title: 'Reminders: blocked', note: 'Permission denied once: how to allow it, Check again, and the note that the reminders are kept.',
    render: () => screen({ kind: 'blocked', line: 'Blocked on this device' }) },
  { id: 'A1.8.nopush', title: 'Reminders: browser without push', note: 'The reminder rows are hidden and the page says reminders work on your phone.',
    render: () => screen({ kind: 'nopush', line: null }) },
])
