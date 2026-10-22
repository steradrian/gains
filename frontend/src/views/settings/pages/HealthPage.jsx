import { useEffect, useState } from 'react'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { healthStatus, loadHealth, enableHealth, disableHealth, openHealthConnect, onHealthChange } from '../../../lib/health-sync.js'
import { t } from '../../../lib/i18n.js'
import { MOBILE } from '../../../lib/mobile.js'
import { menuSheet } from '../../../sheets.jsx'
import { Section, Row, Switch } from '../../../components/ui.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'

// Android app: writing finished workouts and weigh-ins to Health Connect (#200), the phone's
// own store for health data, where other apps can read them. A fact about this phone, kept in
// its own file (lib/health-sync.js) and not in S, so it never switches on anywhere else. The card
// stays out of the way on a phone without Health Connect, and only points to installing it on
// Android 13 and lower, where it is an app of its own.
function HealthConnectCard({ S, toast }) {
  const [st, setSt] = useState(null)
  const [h, setH] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let gone = false
    Promise.all([healthStatus(), loadHealth()]).then(([s, f]) => { if (!gone) { setSt(s); setH(f) } }).catch(() => {})
    const off = onHealthChange(f => { if (!gone) setH(f) })
    return () => { gone = true; off() }
  }, [])
  if (!st || !h || st.status === 'unsupported') return null

  if (st.status !== 'available') return (
    <Section title={t('Health Connect')}>
      <Row icon="heart" iconTint="var(--red)" title={t('Health Connect')}
        subtitle={st.status === 'update'
          ? t('Update Health Connect to share workouts and weigh-ins with other apps.')
          : t('Install Health Connect to share workouts and weigh-ins with other apps.')}
        accessory="chevron" onClick={() => openHealthConnect().catch(() => {})} />
    </Section>
  )

  const turnOn = async () => {
    setBusy(true)
    try {
      const r = await enableHealth(S)
      if (r.health) setH(r.health)
      else setH(await loadHealth())
      if (r.ok) toast(t('Writing to Health Connect'))
      else toast(r.reason === 'denied' ? t('Health Connect permission not granted') : t('Could not write to Health Connect'))
    } catch { toast(t('Could not write to Health Connect')) }
    setBusy(false)
  }
  const turnOff = removeWritten => async () => {
    setBusy(true)
    try { setH(await disableHealth({ removeWritten })) }
    catch { toast(t('Could not remove it from Health Connect')) }
    setBusy(false)
  }
  // Off can mean two things for what is already there, so it asks; closing the sheet keeps it on.
  const askOff = () => menuSheet({
    title: t('Stop writing to Health Connect?'),
    subtitle: t('What Gains already wrote can stay in Health Connect as your data, or be removed from it.'),
    items: [
      { icon: 'check', label: t('Stop, keep what it wrote'), onClick: turnOff(false) },
      { icon: 'trash', label: t('Stop and remove what it wrote'), danger: true, onClick: turnOff(true) },
    ],
  })

  return (
    <Section title={t('Health Connect')}
      footer={h.on ? t('Workouts and weigh-ins go to Health Connect when you finish or change them. Gains reads nothing back.') : null}>
      <Row icon="heart" iconTint="var(--red)" title={t('Write to Health Connect')}
        subtitle={t('Finished workouts and weigh-ins, from this phone only.')}>
        <Switch checked={!!h.on} disabled={busy} onChange={v => (v ? turnOn() : askOff())} />
      </Row>
      {h.on && h.error === 'permission' && <Row icon="warning" iconTint="var(--orange)"
        title={t('Permission withdrawn. Tap to allow again')} accessory="chevron" onClick={turnOn} />}
      {h.on && <Row icon="list" iconTint="var(--blue)" title={t('Open Health Connect')}
        accessory="chevron" onClick={() => openHealthConnect().catch(() => {})} />}
    </Section>
  )
}

// Health Connect on the Android app (§5 "Connected apps & health").
export default function HealthPage() {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const { android } = useSettingsCtx()
  return MOBILE && android ? <HealthConnectCard S={S} toast={toast} /> : null
}
