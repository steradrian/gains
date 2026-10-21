import { useNavigate } from 'react-router-dom'
import { useStore } from '../../../store/useStore.js'
import { t } from '../../../lib/i18n.js'
import { weekStartOf, MONDAY, SUNDAY } from '../../../lib/format.js'
import { scheduleModeOf } from '../../../lib/rotation.js'
import { queueOf } from '../../../lib/queue.js'
import { starterPlanSheet } from '../../../sheets.jsx'
import { Section, Row, Segmented } from '../../../components/ui.jsx'

export default function SchedulePage() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  // A planner's own queue (no rotationId, or one that doesn't match the saved rotation here) is
  // not this app's to switch off or overwrite: the How you train row says so.
  const liveQ = queueOf(S)
  const externalQ = !!liveQ && (!S.rotation || liveQ.rotationId !== S.rotation.id)
  const mode = scheduleModeOf(S)
  const modeLabel = externalQ ? t('Rotation') + ' · ' + t('Externally managed') : mode === 'rotation' ? t('Rotation') : t('Fixed Week')
  return <>
    <Section>
      {/* Fixed Week or Rotation is chosen on Training › Schedule, next to the week or the loop
          it changes (§5): this row says which it is and goes there. */}
      <Row icon="repeat" iconTint="var(--orange)" title={t('How you train')} value={modeLabel}
        accessory="chevron" onClick={() => nav('/train/schedule')} />
      {/* Monday or Sunday: the Plan list, the Home strip, the calendar grid and every "this
          week" total follow it. Stored as a getDay() index (see lib/format.js). */}
      <Row icon="calendar" iconTint="var(--orange)" title={t('Week starts on')}>
        <Segmented className="seg-inline"
          options={[{ value: MONDAY, label: t('Monday') }, { value: SUNDAY, label: t('Sunday') }]}
          value={weekStartOf(S)} onChange={v => update(s => { s.weekStart = v })} />
      </Row>
    </Section>
    <Section>
      <Row icon="clipboard" iconTint="var(--green)" title={t('Load starter plan')} accessory="chevron" onClick={starterPlanSheet} />
    </Section>
  </>
}
