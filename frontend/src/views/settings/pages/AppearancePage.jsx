import { useNavigate } from 'react-router-dom'
import { useStore } from '../../../store/useStore.js'
import { figureOf } from '../../../lib/exercises.js'
import { t } from '../../../lib/i18n.js'
import { DEMO } from '../../../lib/demo.js'
import { MOBILE } from '../../../lib/mobile.js'
import { setRestAccent } from '../../../lib/rest-alert.js'
import { themeOf } from '../../../lib/themes.js'
import { lookLabel } from '../../../lib/stage-look/index.js'
import { useDsAccent } from '../../../lib/use-ds-accent.js'
import { useStageLook } from '../../../lib/use-stage-look.js'
import { haptic as buzz } from '../../../lib/use-haptic.js'
import AccentPicker from '../../../ds/AccentPicker.jsx'
import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import StageSwitch from '../../../ds/StageSwitch.jsx'
import { settingsPath } from '../paths.js'
import SettingsPage from '../SettingsPage.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'

// Each sets the accent, the look and its strength, as the chips of the Background Lab do
// (docs/handoffs/assets/pr06-themes/themes-v2.html, `.theme-chip`).
const READY_MADE = [
  { id: 'princess', name: 'Princess', accent: 'blossom', look: 'florals', intensity: 0.5 },
  { id: 'watermelon', name: 'Watermelon', accent: 'watermelon', look: 'florals', intensity: 0.5 },
  { id: 'peach', name: 'Peach cream', accent: 'peach', look: 'florals', intensity: 0.5 },
  { id: 'snow', name: 'Snow', accent: 'snow', look: 'bloom', intensity: 0.4 },
  { id: 'cream', name: 'Cream', accent: 'cream', look: 'bloom', intensity: 0.4 },
  { id: 'mist', name: 'Mist', accent: 'mist', look: 'bloom', intensity: 0.4 },
]

const THEME_LINES = { dark: 'Dark theme', light: 'Light theme', system: 'System theme' }

export default function AppearancePage() {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const update = useStore(s => s.update)
  const ctx = useSettingsCtx()
  const nav = useNavigate()
  // What is drawn when nothing was chosen: the accent and the look the mode defaults to.
  const accent = useDsAccent()
  const { look, intensity } = useStageLook()
  const theme = S.theme === 'light' || S.theme === 'system' ? S.theme : 'dark'
  const motionLocked = ctx.systemMotion
  const checkIn = S.checkIn !== false
  const figures = [{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]

  const pickAccent = id => {
    update(s => { s.accent = id })
    setRestAccent(id)
  }
  const pickReadyMade = chip => {
    buzz('selection')
    update(s => { s.accent = chip.accent; s.bgLook = chip.look; s.bgIntensity = chip.intensity })
    setRestAccent(chip.accent)
  }

  return (
    <SettingsPage title={t('Appearance')} line={[t(themeOf(accent).name), lookLabel(look), t(THEME_LINES[theme])].join(' · ')}>
      <StageSection title={t('Accent color')} />
      <StageNote>{t('28 colours, each checked for contrast. Tap one: the whole app changes, this page first.')}</StageNote>
      <AccentPicker value={accent} onChange={pickAccent} label={t('Accent color')} />

      <StageSection title={t('Ready-made')} />
      <div className="g-rmchips" role="group" aria-label={t('Ready-made')}>
        {READY_MADE.map(c => {
          const on = accent === c.accent && look === c.look && Math.abs(intensity - c.intensity) < 0.005
          return (
            <button key={c.id} type="button" className="g-rmchip" aria-pressed={on} onClick={() => pickReadyMade(c)}
              style={{ '--sw': `linear-gradient(170deg, var(--${c.accent}-stage), var(--${c.accent}-stage-end))` }}>
              <span className="g-rmchip-sw" aria-hidden="true" />
              {t(c.name)}
            </button>
          )
        })}
      </div>

      <StageSection title={t('Theme')} />
      <div className="g-sblock">
        <StageSegmented label={t('Theme')} value={theme}
          options={[{ value: 'light', label: t('Light') }, { value: 'dark', label: t('Dark') }, { value: 'system', label: t('System') }]}
          onChange={v => update(s => { s.theme = v })} />
      </div>
      <StageNote>{t('Pushed pages and drawers follow it; the stage stays on your accent')}</StageNote>

      <div className="g-sgap" />
      <div className="g-glist g-glass">
        <GlassValueRow icon="image" title={t('Background')} sub={t('Classic plus five looks, in your accent')} value={lookLabel(look)}
          onClick={() => nav(settingsPath('background'))} />
      </div>

      <StageSection title={t('Pictures')} />
      <div className="g-glist g-glass">
        {/* How the muscle map is drawn. The exercise drawings follow it until they are set below. */}
        <GlassValueRow static icon="figureStrength" title={t('Body diagram')}
          trailing={<div className="g-gvr-seg"><StageSegmented label={t('Body diagram')} options={figures} value={S.body === 'female' ? 'female' : 'male'}
            onChange={v => update(s => { s.body = v })} /></div>} />
        {/* Which figure the exercise animations show where both exist (about 940 exercises; the
            rest are drawn once). Only the picture changes: the exercise and its id stay the same,
            so nothing logged is touched, on this device or any other. */}
        <GlassValueRow static icon="figureStrength" title={t('Exercise drawings')}
          sub={t('Where an exercise is drawn on both figures. Your workouts stay exactly as they are.')}
          trailing={<div className="g-gvr-seg"><StageSegmented label={t('Exercise drawings')} options={figures} value={figureOf(S)}
            onChange={v => update(s => { s.exFigure = v })} /></div>} />
      </div>

      <StageSection title={t('On screen')} />
      <div className="g-glist g-glass">
        {/* On top of the device's own setting, which the app always follows (index.css,
            lib/reduced-motion.js): with that on, the switch shows on, locked, and says why. */}
        <GlassValueRow static icon="minimize" title={t('Reduce motion')}
          sub={motionLocked ? t('Follows your phone. Rings appear without drawing in; looks stand still') : t('Turns off animations and slide-ins in this app.')}
          trailing={<StageSwitch label={t('Reduce motion')} checked={motionLocked || S.reduceMotion === true} disabled={motionLocked}
            onChange={v => update(s => { s.reduceMotion = v })} />} />
        {/* iPhone ticks through a hidden native switch under the finger, Android vibrates
            (lib/use-haptic.js); a desktop browser has neither, so the row is not offered there. */}
        {ctx.canHaptic && (
          <GlassValueRow static icon="vibrate" title={t('Haptics')} sub={t('A light tick when a tap saves something, like a set or a weigh-in.')}
            trailing={<StageSwitch label={t('Haptics')} checked={S.haptics !== false} onChange={v => update(s => { s.haptics = v })} />} />
        )}
        {/* Membership QR codes (views/CheckIn.jsx), opened from Training's actions and the + drawer;
            off = neither entry, no route. */}
        <GlassValueRow static icon="qr" title={t('Gym check-in')}
          sub={t('Adds Check in to Training and the + sheet, with your membership QR codes.')}
          trailing={<StageSwitch label={t('Gym check-in')} checked={checkIn} onChange={v => update(s => { s.checkIn = v })} />} />
        {checkIn && <GlassValueRow icon="plus" title={t('Add card')} onClick={() => nav('/train/checkin')} />}
        {/* The bar at the top that says the app is offline, kept local, or not synced (#369, #330).
            Here and not under Server & sync, which a phone kept local never shows. Switching it on
            also brings back the no-server line its × hid (#454). */}
        {!DEMO && (
          <GlassValueRow static icon="cloud" title={t('Show connection status')}
            sub={t('Off: the bar at the top is hidden. A dot on Home still warns when syncing is stuck.')}
            trailing={<StageSwitch label={t('Show connection status')} checked={S.connStatus !== false}
              onChange={v => update(s => { s.connStatus = v; if (v) s.connLocal = true })} />} />
        )}
      </div>
      {!DEMO && !MOBILE && user && <StageNote>{t('synced with your profile')}</StageNote>}
    </SettingsPage>
  )
}
