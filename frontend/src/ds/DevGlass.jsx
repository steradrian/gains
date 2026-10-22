import { useRef, useState } from 'react'
import { THEMES } from '../lib/themes.js'
import { DEFAULT_INTENSITY, LOOKS, lookLabel } from '../lib/stage-look/index.js'
import { useDsAccent } from '../lib/use-ds-accent.js'
import Button from './Button.jsx'
import GlassActions from './GlassActions.jsx'
import GlassHost from './GlassHost.jsx'
import GlassRow from './GlassRow.jsx'
import GlassTabBar from './GlassTabBar.jsx'
import MealTiles from './MealTiles.jsx'
import StageHeader from './StageHeader.jsx'
import StageLook from './StageLook.jsx'
import { StageArt } from './StageBackground.jsx'
import StageSection from './StageSection.jsx'
import './glass-lab.css'

// The liquid-glass tuning page (#/dev/glass, dev server only, App.jsx): the hero glass (the header's
// search pill and discs, the quick-action discs, the tab bar with its lit-tab lens and its +) and the
// subtler Up next row and food tiles, on a stage of your choosing: any of the 28 accents, any look,
// moving or still, on a pushed page or not. The mode switch compares the WebGL glass (GL) with the
// frosted CSS fallback (CSS) and the nearly solid Reduce Transparency fill (Reduced).
// English only, like #/dev/kit.
const MODES = [
  { key: 'gl', label: 'GL' },
  { key: 'css', label: 'CSS' },
  { key: 'reduced', label: 'Reduced' },
]
const NOTES = {
  gl: 'Refraction over the real stage, one WebGL pass. Press a disc, the pill or the bar.',
  fallback: 'WebGL is unavailable here: the frosted CSS fallback.',
  css: 'The frosted CSS fallback: a flat fill with a blur.',
  reduced: 'Reduce Transparency: a nearly solid fill.',
}
const NOOP = () => {}
const ACTIONS = [
  { icon: 'utensils', label: 'Log food', onClick: NOOP },
  { icon: 'scanBarcode', label: 'Scan', onClick: NOOP },
  { icon: 'scale', label: 'Weigh-in', onClick: NOOP },
  { icon: 'droplet', label: 'Water', onClick: NOOP },
]
const MEALS = [
  { icon: 'sunrise', name: 'Breakfast', sub: '420 kcal', state: 'done' },
  { icon: 'moon', name: 'Dinner', sub: 'Nothing yet', state: 'empty' },
]
const FLAT = 'flat' // the page's own controls keep their CSS fill

function Toggle({ label, on, onClick }) {
  return <Button variant="glass" size="sm" data-glass={FLAT} onClick={onClick} aria-pressed={String(on)}>{label}</Button>
}

export default function DevGlass() {
  const initialAccent = useDsAccent()
  const [accent, setAccent] = useState(initialAccent)
  const [look, setLook] = useState('bloom')
  const [mode, setMode] = useState('gl')
  const [motion, setMotion] = useState(true)
  const [pushed, setPushed] = useState(false)
  const [tab, setTab] = useState('today')
  const [raised, setRaised] = useState(false)
  const [status, setStatus] = useState(null)
  const rootRef = useRef(null)
  const gl = mode === 'gl'

  const pick = key => { setMode(key); setStatus(null) }
  const fallback = mode === 'reduced' || status === 'reduced' ? 'gl-liquid gl-fallback gl-frostier' : 'gl-liquid gl-fallback'
  const material = gl ? (status === 'webgl' ? 'gl-liquid gl-webgl' : status ? fallback : 'gl-liquid') : fallback
  const note = NOTES[gl ? (status === 'webgl' || !status ? 'gl' : status === 'reduced' ? 'reduced' : 'fallback') : mode]
  return (
    <div className="g-root gl-dev" data-accent={accent} ref={rootRef}>
      {/* AppStage, with the stage's inputs taken from this page instead of the store. */}
      <div className="g-root g-app-stage" data-accent={accent} data-pushed={pushed || undefined} aria-hidden="true">
        <StageArt />
        <StageLook look={look} intensity={DEFAULT_INTENSITY} pushed={pushed} motion={motion} accent={accent} />
      </div>
      {gl && <GlassHost groundRef={rootRef} look={look} accent={accent} pushed={pushed} intensity={DEFAULT_INTENSITY} motion={motion} onStatus={setStatus} />}
      <div className="g-route" data-shared="">
        <div className={`g-stage gl-page ${material}`}>
          <div className="gl-bar" role="group" aria-label="Material">
            {MODES.map(m => (
              <Button key={m.key} variant="glass" size="sm" data-glass={FLAT} onClick={() => pick(m.key)} aria-pressed={String(m.key === mode)}>{m.label}</Button>
            ))}
          </div>
          <div className="gl-bar" role="group" aria-label="Stage">
            <select className="gl-select" aria-label="Stage" value={accent} onChange={e => setAccent(e.target.value)}>
              {THEMES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="gl-select" aria-label="Look" value={look} onChange={e => setLook(e.target.value)}>
              {LOOKS.map(id => <option key={id} value={id}>{lookLabel(id)}</option>)}
            </select>
          </div>
          <div className="gl-bar" role="group" aria-label="Options">
            <Toggle label="Motion" on={motion} onClick={() => setMotion(v => !v)} />
            <Toggle label="Pushed" on={pushed} onClick={() => setPushed(v => !v)} />
            <Toggle label="Bar over rings" on={raised} onClick={() => setRaised(v => !v)} />
          </div>
          <p className="gl-note">{note}</p>

          <StageHeader initial="A" placeholder="Search food" unread={2} settingsHref="#/dev/glass" searchHref="#/dev/glass" bellHref="#/dev/glass" />
          <GlassActions items={ACTIONS} />

          <div className="gl-content">
            <StageSection title="Up next" />
            <GlassRow onClick={NOOP} eyebrow="Rest day" title="Recover" sub="Next: Legs, tomorrow" trailing="chev" />
            <StageSection title="Food" />
            <MealTiles meals={MEALS} />
          </div>

          <div className="gl-spacer" aria-hidden="true" />
          <div className={raised ? 'gl-dock gl-dock-raised' : 'gl-dock'}><GlassTabBar current={tab} onChange={setTab} onPlus={NOOP} /></div>
        </div>
      </div>
    </div>
  )
}
