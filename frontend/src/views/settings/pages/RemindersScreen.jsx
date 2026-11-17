import { t } from '../../../lib/i18n.js'
import { NUDGE_TONES } from '../../../lib/nudge.js'
import Button from '../../../ds/Button.jsx'
import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import SettingRow from '../SettingRow.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { Card, SwitchRow } from './prefs-rows.jsx'

const toneLabel = k => (k === 'guilt' ? t('Guilt trip') : k === 'drill' ? t('Drill sergeant') : t('Friendly'))

function Steps({ steps }) {
  return (
    <Card>
      {steps.map(([icon, title, sub]) => <GlassValueRow key={title} static icon={icon} title={title} sub={sub} />)}
    </Card>
  )
}

function CheckButton({ label, onClick }) {
  return <div className="g-sp-card g-sp-act"><Button variant="glass" block onClick={onClick}>{label}</Button></div>
}

function Install({ onCheck }) {
  return <>
    <StageSection title={t('Add Gains to your Home Screen first')} />
    <StageNote>{t('On iPhone, only installed apps can send notifications. It takes 10 seconds and you stay signed in.')}</StageNote>
    <StageSection title={t('In Safari')} />
    <Steps steps={[
      ['share', t('1. Tap Share'), t('The square with an arrow, at the bottom')],
      ['plus', t('2. Add to Home Screen'), t("Scroll down the list if you don't see it")],
      ['smartphone', t('3. Open Gains from the icon'), t('Then come back here and turn reminders on')],
    ]} />
    <CheckButton label={t("I've done it, check again")} onClick={onCheck} />
  </>
}

function Blocked({ onCheck }) {
  return <>
    <StageSection title={t('Notifications are blocked for Gains')} />
    <StageNote>{t("You said no once, so this device won't ask again. Turn them back on in its settings.")}</StageNote>
    <StageSection title={t('On this device')} />
    <Steps steps={[
      ['gear', t("1. Open the device's notification settings")],
      ['magnifier', t('2. Find Gains in the list')],
      ['check', t('3. Allow notifications'), t('Then come back; Gains checks by itself')],
    ]} />
    <CheckButton label={t('Check again')} onClick={onCheck} />
    <StageNote>{t('Your reminders are kept. They start again as soon as notifications are allowed.')}</StageNote>
  </>
}

function Ready({ master, workout, nudge, onTest }) {
  const showReminders = !master || master.on
  return <>
    {master && (
      <Card>
        <SwitchRow icon="bell" title={t('Push notifications')} sub={master.sub} checked={master.on} disabled={master.busy} onChange={master.onChange} />
      </Card>
    )}
    {!showReminders && <StageNote>{t('Turn on push notifications to get workout reminders.')}</StageNote>}
    {showReminders && <>
      <StageSection title={t('Training')} />
      <Card>
        <SwitchRow icon="calendar" title={t('Workout day reminder')} sub={workout.sub} checked={workout.on} onChange={workout.onChange} />
        {workout.on && <GlassValueRow icon="clock" title={t('Reminder time')} sub={workout.names} value={workout.time} onClick={workout.onTime} />}
        {workout.on && <SwitchRow icon="bell" title={t('Nudge me when I skip a planned workout')} sub={nudge.sub} checked={nudge.on} onChange={nudge.onChange} />}
        {workout.on && nudge.on && (
          <SettingRow icon="chat" title={t('Nudge tone')} sub={t('How the nudge is worded')}
            below={<StageSegmented label={t('Nudge tone')} value={nudge.tone} onChange={nudge.onTone}
              options={NUDGE_TONES.map(k => ({ value: k, label: toneLabel(k) }))} />} />
        )}
      </Card>
      {workout.on && workout.tz && <StageNote>{t('Timezone: {0} (auto-detected, updates if you travel).', workout.tz)}</StageNote>}
      {master && <>
        <StageSection title={t('Devices')} />
        <Card>
          <GlassValueRow static icon="smartphone" title={t('This device')} sub={t('Gets every reminder above')} value={t('On')} />
        </Card>
        <CheckButton label={t('Send test notification')} onClick={onTest} />
      </>}
    </>}
  </>
}

/**
 * The Reminders page on the stage (boards St1Reminders, St1RemindersInstall, St1RemindersBlocked),
 * presentational: `kind` is one of ready, install, blocked, nopush (reminder-state.js); `master`
 * is the web push switch (absent on the phone app, which schedules its own), `workout` and `nudge`
 * the reminder rows. The container wires the store.
 */
export default function RemindersScreen({ kind, line, master, workout, nudge, onCheck, onTest }) {
  return (
    <SettingsPage title={t('Reminders')} line={line}>
      {kind === 'install' && <Install onCheck={onCheck} />}
      {kind === 'blocked' && <Blocked onCheck={onCheck} />}
      {kind === 'nopush' && (
        <StageEmpty illustration="bell" card={false} title={t('Reminders work on your phone')}
          body={t('This browser has no push notifications. Open Gains on your phone to turn reminders on.')} />
      )}
      {kind === 'ready' && <Ready master={master} workout={workout} nudge={nudge} onTest={onTest} />}
    </SettingsPage>
  )
}
