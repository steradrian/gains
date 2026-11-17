import { useEffect, useState } from 'react'
import { useStore, DEF } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { localTZ } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { effectiveLang } from '../../../lib/default-lang.js'
import { MOBILE, syncReminder } from '../../../lib/mobile.js'
import { toneOf } from '../../../lib/nudge.js'
import { enablePush, disablePush, sendTestPush, syncPushSubscription } from '../../../lib/push.js'
import RemindersScreen from './RemindersScreen.jsx'
import { plannedRoutineNames, plannedWeekdays, reminderCount } from './reminder-state.js'
import { reminderTimeSheet } from './reminder-time-sheet.jsx'
import { useReminderDevice } from './use-reminder-device.js'

// Reminders (boards St1Reminders to St1RemindersBlocked). One reminder exists today, the
// workout-day one, and the missed-workout nudge that rides on it: both live in S.reminder.
// On the web they go out as push from the server and need this browser's subscription (the master
// switch); on the phone app they are native notifications the store reschedules on every persist,
// so the only thing this page owns there is the OS permission prompt when the switch turns on.
export default function RemindersPage() {
  const S = useStore(s => s.S)
  const config = useStore(s => s.config)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const { kind, recheck } = useReminderDevice()
  const [pushOn, setPushOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const r = S.reminder || DEF.reminder
  const webReady = !MOBILE && kind === 'ready'

  // "On" means the server holds this browser's subscription, not merely that the browser has
  // one: a row the instance dropped (dead send, rebuilt db.json) left the switch on with nothing
  // ever arriving. syncPushSubscription re-registers on the way; if the server cannot be asked
  // (offline), the browser's side is the best answer available.
  useEffect(() => {
    if (!webReady) return
    let gone = false
    syncPushSubscription()
      .then(ok => { if (!gone) setPushOn(ok) })
      .catch(() => navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => { if (!gone) setPushOn(!!sub) }).catch(() => {}))
    return () => { gone = true }
  }, [webReady])

  const setReminder = patch => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), ...patch, tz: localTZ() } })

  const toggleMaster = async v => {
    setBusy(true)
    try {
      if (!v) { await disablePush(); setPushOn(false); toast(t('Notifications off')) }
      else { await enablePush(); setPushOn(true); toast(t('Notifications on')) }
    } catch (e) { toast(e.message || t('Could not change notification settings')) }
    setBusy(false)
    // A refused prompt turns the page into the blocked one.
    recheck()
  }

  const toggleWorkout = async () => {
    const on = !r.on
    if (on && MOBILE) {
      const ok = await syncReminder({ ...S, reminder: { ...r, on: true } }, true)
      if (!ok) { toast(t('Could not change notification settings')); return }
    }
    setReminder({ on })
  }

  const test = async () => {
    try { await sendTestPush(); toast(t('Test sent! Should pop up any second')) }
    catch (e) { toast(e.message || t('Test failed')) }
  }

  const time = r.time || DEF.reminder.time
  const count = reminderCount(S)
  const names = plannedRoutineNames(S)
  const line = count ? t('{0} on · they come to you, not to Notifications', count) : t('Nothing is on')

  return (
    <RemindersScreen
      kind={kind}
      line={kind === 'install' ? t('Not installed on this iPhone') : kind === 'blocked' ? t('Blocked on this device') : kind === 'nopush' ? null : line}
      master={webReady ? { on: pushOn, busy, onChange: toggleMaster, sub: t('Rest-timer alerts, even if Gains is closed.') } : null}
      workout={{
        on: !!r.on,
        onChange: toggleWorkout,
        sub: MOBILE ? t('Reminds you at this time on days that have a routine planned.') : t("Only sent on days you have a routine planned and haven't logged a workout yet."),
        time,
        names: names.length ? names.join(', ') : undefined,
        tz: r.tz,
        onTime: () => reminderTimeSheet({ time, days: plannedWeekdays(S), lang: effectiveLang(S, config), onSave: v => setReminder({ time: v }) }),
      }}
      nudge={{
        on: !!r.nudge,
        onChange: () => setReminder({ nudge: !r.nudge }),
        tone: toneOf(r),
        onTone: v => setReminder({ tone: v }),
        sub: t('One nudge in the evening of a planned day with nothing logged, between 20:00 and 21:30. After 3 missed days in a row it goes quiet until your next workout.'),
      }}
      onCheck={recheck}
      onTest={test}
    />
  )
}
