import { useEffect, useState } from 'react'
import AppStage from '../../../ds/AppStage.jsx'
import Settings from '../../../views/Settings.jsx'
import { registerScreens } from '../registry.js'

// Appearance and Background (PR-06 look-m1, boards St1Appearance, St1Background, St1BgSilk): the
// real pages on the app's real stage, as a pushed page (the look at half strength). The looks under
// Today and the Settings root are themes-m2's PR06.L1.* and PR06.L2.* entries. Nothing here is stored.
const onStage = page => () => (
  <>
    <AppStage pushed />
    <div className="g-route" data-shared><Settings page={page} /></div>
  </>
)

// The phone's own "reduce motion" (or "reduce transparency") for as long as the state shows:
// ctx.systemMotion and ctx.systemTransparency read it on render.
function PhoneReduces({ feature, children }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const real = window.matchMedia
    window.matchMedia = q => (q.includes(`prefers-reduced-${feature}`)
      ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
      : real.call(window, q))
    setOn(true)
    return () => { window.matchMedia = real }
  }, [])
  return on ? children : null
}

const mock = S => ({ S: { reduceMotion: false, ...S } })

registerScreens('Settings', [
  { id: 'A1.2', title: 'Appearance', note: 'Cobalt, Classic, System theme. The accent picker is lit on the chosen colour.',
    render: onStage('appearance'), mock: mock({ theme: 'system', accent: 'cobalt', bgLook: 'plain' }) },
  { id: 'A1.2.ink', title: 'Appearance: Ink accent', note: 'Ink, the dark mode\'s default, chosen on purpose.',
    render: onStage('appearance'), mock: mock({ theme: 'dark', accent: 'ink', bgLook: 'bloom', bgIntensity: 0.45 }) },
  { id: 'A1.2.auto', title: 'Appearance: nothing chosen', note: 'No accent and no look stored: the mode\'s default is lit (dark: Ink and Bloom).',
    render: onStage('appearance'), mock: mock({ theme: 'dark', accent: null, bgLook: null }) },
  { id: 'A1.2.motion', title: 'Appearance: Reduce motion locked', note: 'The phone already reduces motion: the switch is on and says why.',
    render: () => <PhoneReduces feature="motion">{onStage('appearance')()}</PhoneReduces>, mock: mock({ theme: 'dark', accent: 'cobalt' }) },
  { id: 'A1.2.transparency', title: 'Appearance: Reduce transparency locked', note: 'The phone already reduces transparency: the switch is on and says why.',
    render: () => <PhoneReduces feature="transparency">{onStage('appearance')()}</PhoneReduces>, mock: mock({ theme: 'dark', accent: 'cobalt' }) },
  { id: 'A1.3', title: 'Background (Classic)', note: 'Classic has no intensity: the slider is replaced by a line.',
    render: onStage('background'), mock: mock({ theme: 'dark', accent: 'cobalt', bgLook: 'plain' }) },
  { id: 'A1.37', title: 'Background with Silk', note: 'The page itself shows the look at inner-page strength; Silk carries the dramatic warning.',
    render: onStage('background'), mock: mock({ theme: 'dark', accent: 'cobalt', bgLook: 'silk', bgIntensity: 0.45 }) },
])
