import { useEffect, useRef } from 'react'
import { useStore } from '../../../store/useStore.js'
import { ACCENTS, ACCENT_NAMES } from '../../../lib/format.js'
import { figureOf } from '../../../lib/exercises.js'
import { t } from '../../../lib/i18n.js'
import { DEMO } from '../../../lib/demo.js'
import { MOBILE } from '../../../lib/mobile.js'
import { setRestAccent } from '../../../lib/rest-alert.js'
import { CUSTOM, accentKey, accentLabel, adjustedIn, applyAccent, cleanHex, inkOn, isGrey } from '../../../lib/accent.js'
import Icon from '../../../components/Icon.jsx'
import { Section, Row, Switch, Segmented } from '../../../components/ui.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'

/**
 * The presets, then one swatch for a colour of the user's own (lib/accent.js). With no colour
 * of their own yet it is a rainbow ring, and a tap opens the system colour picker straight away.
 * Once there is one it is filled with it: a tap picks it again (it is kept while a preset is
 * chosen), and a tap on it while it is the accent opens the picker to change it. The picker is
 * the native <input type="color"> laid over the swatch, so the tap that opens it is the user's
 * own, which iOS Safari and the Android WebView both want.
 */
// How long the colour picker has to rest before a colour is saved, when the browser sends no
// `change` at the end (it should, once the picker closes).
const OWN_COLOR_SETTLE_MS = 400

function AccentSwatches({ S, update }) {
  const key = accentKey(S)
  const own = cleanHex(S.accentCustom)
  const onCustom = key === CUSTOM
  const pickPreset = k => { update(s => { s.accent = k }); setRestAccent(k) }
  const pickOwn = hex => {
    const c = cleanHex(hex)
    if (!c || (onCustom && c === own)) return
    update(s => { s.accent = CUSTOM; s.accentCustom = c })
    setRestAccent(c)
  }
  // The picker sends a colour for every step of a drag (React's onChange is the `input` event).
  // Those only repaint the page; the colour is saved, synced and sent to the native countdown
  // once: on the picker's `change`, after it has rested a moment, or when Settings closes.
  const inputRef = useRef(null)
  const pending = useRef(null)
  const timer = useRef(0)
  const pickOwnRef = useRef(pickOwn)
  pickOwnRef.current = pickOwn
  const commit = () => {
    clearTimeout(timer.current)
    const c = pending.current
    pending.current = null
    if (c) pickOwnRef.current(c)
  }
  const preview = hex => {
    const c = cleanHex(hex)
    if (!c) return
    const de = document.documentElement
    applyAccent(de, c, de.dataset.theme)
    pending.current = c
    clearTimeout(timer.current)
    timer.current = setTimeout(commit, OWN_COLOR_SETTLE_MS)
  }
  const hasInput = !(own && !onCustom)
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const onChange = () => { pending.current = cleanHex(el.value) || pending.current; commit() }
    el.addEventListener('change', onChange)
    return () => el.removeEventListener('change', onChange)
  }, [hasInput]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => commit, []) // eslint-disable-line react-hooks/exhaustive-deps
  // The input is not controlled (React would put the saved colour back after every drag step);
  // a colour changed elsewhere (sync, another tab) is put in by hand.
  useEffect(() => {
    if (!pending.current && inputRef.current) inputRef.current.value = own || '#30d158'
  }, [own])
  const ownLabel = t('Your own color')
  const grey = own && isGrey(own)
  const notes = own && onCustom ? [
    adjustedIn(own, 'dark') && (grey ? t('Greys show lighter in dark mode, so buttons don’t look switched off.') : t('A touch lighter in dark mode, so you can still read it.')),
    adjustedIn(own, 'light') && (grey ? t('Greys show darker in light mode, so buttons don’t look switched off.') : t('A touch darker in light mode, so you can still read it.')),
  ].filter(Boolean) : []
  return <>
    <div className="swatches" style={{ flexBasis: '100%', paddingInlineStart: 41 }}>
      {Object.entries(ACCENTS).map(([k, c]) => (
        <button key={k} className={'swatch' + (key === k ? ' on' : '')}
          style={{ background: c }} onClick={() => pickPreset(k)} aria-label={t(ACCENT_NAMES[k] || k)} />
      ))}
      {!hasInput
        ? <button className="swatch swatch-own" style={{ background: own }} onClick={() => pickOwn(own)} aria-label={ownLabel} />
        : <span className={'swatch swatch-own' + (own ? ' on' : ' unset')} style={own ? { background: own, color: inkOn(own) } : undefined}>
          {own ? <Icon name="pencil" /> : <Icon name="plus" />}
          <input ref={inputRef} type="color" className="swatch-input" defaultValue={own || '#30d158'}
            onChange={e => preview(e.target.value)}
            aria-label={own ? t('Change your own color') : t('Pick your own color')} />
        </span>}
    </div>
    {notes.map(n => <span key={n} className="lrow-s swatch-note" style={{ flexBasis: '100%', paddingInlineStart: 41 }}>{n}</span>)}
  </>
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
