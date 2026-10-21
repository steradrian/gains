import { useStore } from '../../../store/useStore.js'
import { t } from '../../../lib/i18n.js'
import { weekStartOf, MONDAY, SUNDAY } from '../../../lib/format.js'
import { scheduleModeOf, chooseRotation, chooseFixedWeek } from '../../../lib/rotation.js'
import { queueOf } from '../../../lib/queue.js'
import { starterPlanSheet } from '../../../sheets.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import SettingRow from '../SettingRow.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { confirmDrawer } from '../confirm-drawer.js'

// Schedule (board St1Schedule, A1.17). Fixed week or Rotation is the one switch Plan shares
// (lib/rotation.js chooseRotation / chooseFixedWeek, the same keys); leaving a running loop asks
// first, as Plan does. A planner's own queue (no rotationId, or one that doesn't match the saved
// rotation here) is not this app's to switch off or overwrite: the How you train row says so and
// offers no switch.
export default function SchedulePage() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const liveQ = queueOf(S)
  const externalQ = !!liveQ && (!S.rotation || liveQ.rotationId !== S.rotation.id)
  const mode = scheduleModeOf(S)
  const weekStart = weekStartOf(S)
  const modeLabel = mode === 'rotation' ? t('Rotation') : t('Fixed Week')

  const setMode = v => {
    if (v === mode) return
    if (v === 'rotation') { update(s => { chooseRotation(s) }); return }
    if (!liveQ) { update(s => { chooseFixedWeek(s) }); return }
    confirmDrawer({
      title: t('Back to a fixed week?'),
      body: t('The loop stops. Your weekdays stay as they are, and the loop is saved for later.'),
      icon: 'calendar',
      confirmLabel: t('Use Fixed Week'),
      onConfirm: () => update(s => { chooseFixedWeek(s) }),
    })
  }

  return (
    <SettingsPage title={t('Schedule')} line={modeLabel + ' · ' + (weekStart === SUNDAY ? t('Sunday') : t('Monday'))}>
      <div className="set-body">
        <div className="g-glist g-glass">
          {externalQ
            ? <SettingRow icon="repeat" title={t('How you train')} sub={t('Your planner manages the week, so it can’t be switched here.')} value={t('Rotation') + ' · ' + t('Externally managed')} />
            : <SettingRow icon="repeat" title={t('How you train')} sub={t('Fixed week: days of the week. Rotation: A, B, C in a loop')}
              below={<StageSegmented label={t('How you train')} value={mode === 'rotation' ? 'rotation' : 'week'}
                options={[{ value: 'week', label: t('Fixed Week') }, { value: 'rotation', label: t('Rotation') }]} onChange={setMode} />} />}
          {/* Monday or Sunday: the Plan list, the Home strip, the calendar grid and every "this week"
              total follow it. Stored as a getDay() index (see lib/format.js). */}
          <SettingRow icon="calendar" title={t('Week starts on')} sub={t('The rail, Week pages and the Plan')}
            below={<StageSegmented label={t('Week starts on')} value={weekStart}
              options={[{ value: MONDAY, label: t('Monday') }, { value: SUNDAY, label: t('Sunday') }]} onChange={v => update(s => { s.weekStart = v })} />} />
        </div>

        <StageSection variant="label" title={t('Start again')} />
        <div className="g-glist g-glass">
          <SettingRow icon="clipboard" title={t('Load starter plan')} sub={t('Starters you can edit afterwards')} onClick={starterPlanSheet} />
        </div>
        <StageNote>{t('Switching to Rotation keeps your routines and history; only the calendar changes.')}</StageNote>
      </div>
    </SettingsPage>
  )
}
