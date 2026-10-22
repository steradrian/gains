import { useEffect, useState } from 'react'
import { t } from '../lib/i18n.js'
import { useDsAccent } from '../lib/use-ds-accent.js'
import StageBackground from './StageBackground.jsx'
import StageEmpty from './StageEmpty.jsx'

// The app is portrait-only. The native shells lock it; iOS Safari and home-screen web apps ignore
// the lock, so on a phone held sideways this covers the app with a stage and one line. The app
// stays mounted underneath, so nothing is lost when the phone turns back.
//
// Which way the phone is held comes from the device, not from the viewport: with the on-screen
// keyboard open the viewport shrinks (Android's adjustResize) and turns wider than tall in
// portrait, which a CSS `orientation: landscape` query reads as a sideways phone and would cover
// the form being typed in. ds.css only keeps the cover to short, touch screens.

/** True when the device itself is held sideways. */
export function deviceLandscape() {
  const type = globalThis.screen?.orientation?.type
  if (typeof type === 'string') return type.startsWith('landscape')
  // Safari before 16.4 has only the legacy angle: 90 or -90 is sideways.
  if (typeof globalThis.orientation === 'number') return Math.abs(globalThis.orientation) === 90
  const { width, height } = globalThis.screen || {}
  return width > height
}

export default function LandscapeCover() {
  const accent = useDsAccent()
  const [landscape, setLandscape] = useState(deviceLandscape)
  useEffect(() => {
    const update = () => setLandscape(deviceLandscape())
    const orientation = globalThis.screen?.orientation
    orientation?.addEventListener?.('change', update)
    globalThis.addEventListener('orientationchange', update)
    return () => {
      orientation?.removeEventListener?.('change', update)
      globalThis.removeEventListener('orientationchange', update)
    }
  }, [])
  if (!landscape) return null
  return (
    <div className="g-root g-landscape-cover" data-accent={accent}>
      <StageBackground>
        <StageEmpty illustration="dumbbell" card={false} title={t('Turn your phone upright')} body={t('Gains works in portrait.')} />
      </StageBackground>
    </div>
  )
}
