import { useStore } from '../../../store/useStore.js'
import { THEMES } from '../../../lib/themes.js'
import { figureOf } from '../../../lib/exercises.js'
import { t } from '../../../lib/i18n.js'
import { DEMO } from '../../../lib/demo.js'
import { MOBILE } from '../../../lib/mobile.js'
import { setRestAccent } from '../../../lib/rest-alert.js'
import { accentKey, accentLabel } from '../../../lib/accent.js'
import Icon from '../../../components/Icon.jsx'
import { Section, Row, Switch, Segmented } from '../../../components/ui.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'

// The 28 themes as swatches (look-m1 replaces this with the Appearance page's picker).
function AccentSwatches({ S, update }) {
  const key = accentKey(S)
  const pickPreset = k => { update(s => { s.accent = k }); setRestAccent(k) }
  return (
    <div className="swatches" style={{ flexBasis: '100%', paddingInlineStart: 41 }}>
      {THEMES.map(p => (
        <button key={p.id} className={'swatch' + (key === p.id ? ' on' : '')}
          style={{ background: p.fill }} onClick={() => pickPreset(p.id)} aria-label={t(p.name)} />
      ))}
    </div>
  )
}

export default function AppearancePage() {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const update = useStore(s => s.update)
  const ctx = useSettingsCtx()
  return <>
    <Section footer={DEMO || MOBILE || !user ? undefined : t('synced with your profile')}>
      <Row icon="moon" iconTint="var(--indigo)" title={t('Theme')}>
        <Segmented
          className="seg-inline"
          options={[
            { value: 'dark', icon: 'moon', label: t('Dark') },
            { value: 'light', icon: 'sun', label: t('Light') },
            { value: 'system', icon: 'gear', label: t('System') },
          ]}
          value={S.theme || 'dark'}
          onChange={v => update(s => { s.theme = v })}
        />
      </Row>
      <div className="lrow wrap" style={{ rowGap: 12, paddingBottom: 14 }}>
        <span className="lrow-i" style={{ '--tint': 'var(--purple)' }}><Icon name="palette" /></span>
        <span className="lrow-m"><span className="lrow-t">{t('Accent color')}</span></span>
        <span className="lrow-v">{accentLabel(S)}</span>
        <AccentSwatches S={S} update={update} />
      </div>
      {/* How the muscle map is drawn. The exercise drawings follow it until they are set below. */}
      <Row icon="figureStrength" iconTint="var(--teal)" title={t('Body diagram')}>
        <Segmented
          className="seg-inline"
          options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]}
          value={S.body === 'female' ? 'female' : 'male'}
          onChange={v => update(s => { s.body = v })}
        />
      </Row>
      {/* Which figure the exercise animations show where both exist (about 940 exercises; the
          rest are drawn once). Only the picture changes: the exercise and its id stay the same,
          so nothing logged is touched, on this device or any other. */}
      <Row icon="figureStrength" iconTint="var(--teal)" title={t('Exercise drawings')}
        subtitle={t('Where an exercise is drawn on both figures. Your workouts stay exactly as they are.')}>
        <Segmented
          className="seg-inline"
          options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]}
          value={figureOf(S)}
          onChange={v => update(s => { s.exFigure = v })}
        />
      </Row>
      {/* On top of the device's own setting, which the app always follows (index.css,
          lib/reduced-motion.js): with that on, the switch shows on and says where it is set. */}
      <Row icon="minimize" iconTint="var(--blue)" title={t('Reduce motion')}
        subtitle={ctx.systemMotion ? t('On in your device settings, so it is on here too.') : t('Turns off animations and slide-ins in this app.')}>
        <Switch aria-label={t('Reduce motion')} checked={ctx.systemMotion || S.reduceMotion === true} disabled={ctx.systemMotion}
          onChange={v => update(s => { s.reduceMotion = v })} />
      </Row>
      {/* iPhone ticks through a hidden native switch under the finger, Android vibrates
          (lib/use-haptic.js); a desktop browser has neither, so the row is not offered there. */}
      {ctx.canHaptic && (
        <Row icon="vibrate" iconTint="var(--indigo)" title={t('Haptics')} subtitle={t('A light tick when a tap saves something, like a set or a weigh-in.')}>
          <Switch aria-label={t('Haptics')} checked={S.haptics !== false} onChange={v => update(s => { s.haptics = v })} />
        </Row>
      )}
    </Section>
    <Section title={t('On Today')}>
      {/* Membership QR codes (views/CheckIn.jsx), opened from Training's actions and the + drawer;
          off = neither entry, no route. */}
      <Row icon="qr" iconTint="var(--blue)" title={t('Gym check-in')}
        subtitle={t('Adds Check in to Training and the + sheet, with your membership QR codes.')}>
        <Switch checked={S.checkIn !== false} onChange={v => update(s => { s.checkIn = v })} />
      </Row>
      {/* The bar at the top that says the app is offline, kept local, or not synced (#369, #330).
          Here and not under Server & sync, which a phone kept local never shows. Switching it on
          also brings back the no-server line its × hid (#454). */}
      {!DEMO && <Row icon="cloud" iconTint="var(--blue)" title={t('Show connection status')}
        subtitle={t('Off: the bar at the top is hidden. A dot on Home still warns when syncing is stuck.')}>
        <Switch checked={S.connStatus !== false} onChange={v => update(s => { s.connStatus = v; if (v) s.connLocal = true })} />
      </Row>}
    </Section>
  </>
}
