import { useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { THEMES } from '../lib/themes.js'
import { DEFAULT_INTENSITY, LOOKS, lookLabel } from '../lib/stage-look/index.js'
import { useDsAccent } from '../lib/use-ds-accent.js'
import Button from './Button.jsx'
import DevGlassHud from './DevGlassHud.jsx'
import DevGlassScroll from './DevGlassScroll.jsx'
import GlassActions from './GlassActions.jsx'
import GlassHost from './GlassHost.jsx'
import { readPref, writePref } from './glass/glass-prefs.js'
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
// Liquid glass presenters (M3's device gate): the HUD switches in-flow glass between the fixed canvas and
// per-element sprites (the choice is stored, so the app follows it) and shows the engine's numbers; the
// scroll test is what to fling. The sprite options (copy path, card DPR, shadow) are the choices that could
// change cost or material, so each is a switch here; Compare draws the same card and disc under both
// presenters side by side; Stage only draws the glass shader's stage over the right half of the real one.
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
const COPIES = [{ key: 'draw2d', label: 'drawImage' }, { key: 'bitmap', label: 'Bitmap' }]
const DPRS = [{ key: '3', label: 'Cards 3x' }, { key: '2', label: 'Cards 2x' }]
const SHADOWS = [{ key: 'shader', label: 'Shadow GL' }, { key: 'css', label: 'Shadow CSS' }]

function Toggle({ label, on, onClick }) {
  return <Button variant="glass" size="sm" data-glass={FLAT} onClick={onClick} aria-pressed={String(on)}>{label}</Button>
}

function Choice({ label, options, value, onPick }) {
  return (
    <div className="gl-bar" role="group" aria-label={label}>
      {options.map(o => <Toggle key={o.key} label={o.label} on={o.key === value} onClick={() => onPick(o.key)} />)}
    </div>
  )
}

// The same card and disc under each presenter, side by side (Compare on). The disc counts taps: React
// rewrites its text with textContent, which wipes the sprite, so it also shows the re-append (R5).
function CompareRow() {
  const [count, setCount] = useState(0)
  return (
    <div className="gl-compare">
      {['fixed', 'sprite'].map(p => (
        <div key={p} className="gl-compare-col" data-lg-compare={p}>
          <span className="gl-compare-k">{p === 'fixed' ? 'Fixed' : 'Sprite'}</span>
          <div className="g-glass gl-card gl-card-short"><b>Card</b><span>Same shape</span></div>
          <div className="gl-disc-row">
            <button type="button" className="g-glass gl-disc" aria-label="Disc"><Icon name="droplet" className="g-icon" /></button>
            <button type="button" className="g-glass gl-disc" aria-label={`Count ${count}`} onClick={() => setCount(c => c + 1)}>{count}</button>
          </div>
        </div>
      ))}
    </div>
  )
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
  const [presenter, setPresenter] = useState(() => readPref('presenter'))
  const [copy, setCopy] = useState(() => readPref('copy'))
  const [cardDpr, setCardDpr] = useState(() => readPref('cardDpr'))
  const [shadow, setShadow] = useState(() => readPref('shadow'))
  const [compare, setCompare] = useState(false)
  const [stageOnly, setStageOnly] = useState(false)
  const rootRef = useRef(null)
  const statsRef = useRef(null)
  const gl = mode === 'gl'
  const stored = (name, set) => value => { set(value); writePref(name, value); setStatus(null) }
  const options = `${presenter}, ${copy === 'bitmap' ? 'bitmap' : 'drawImage'}, cards ${cardDpr}x, shadow ${shadow === 'css' ? 'CSS' : 'GL'}${compare ? ', compare on (numbers include both)' : ''}`

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
      {gl && (
        <GlassHost
          groundRef={rootRef} look={look} accent={accent} pushed={pushed} intensity={DEFAULT_INTENSITY} motion={motion} onStatus={setStatus}
          presenter={presenter} copy={copy} cardDpr={Number(cardDpr)} shadow={shadow} compare={compare} stageOnly={stageOnly}
          watchdog={false} statsRef={statsRef}
        />
      )}
      {gl && <DevGlassHud statsRef={statsRef} presenter={presenter} onPresenter={stored('presenter', setPresenter)} options={options} status={status} />}
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
          <Choice label="Sprite copy path" options={COPIES} value={copy} onPick={stored('copy', setCopy)} />
          <Choice label="Card pixel ratio" options={DPRS} value={cardDpr} onPick={stored('cardDpr', setCardDpr)} />
          <Choice label="Sprite shadow" options={SHADOWS} value={shadow} onPick={stored('shadow', setShadow)} />
          <div className="gl-bar" role="group" aria-label="Checks">
            <Toggle label="Compare" on={compare} onClick={() => setCompare(v => !v)} />
            <Toggle label="Stage only" on={stageOnly} onClick={() => setStageOnly(v => !v)} />
          </div>
          <p className="gl-note">{note}</p>
          {compare && <CompareRow />}

          <StageHeader initial="A" placeholder="Search food" unread={2} settingsHref="#/dev/glass" searchHref="#/dev/glass" bellHref="#/dev/glass" />
          <GlassActions items={ACTIONS} />

          <div className="gl-content">
            <StageSection title="Up next" />
            <GlassRow onClick={NOOP} eyebrow="Rest day" title="Recover" sub="Next: Legs, tomorrow" trailing="chev" />
            <StageSection title="Food" />
            <MealTiles meals={MEALS} />
          </div>

          <DevGlassScroll />

          <div className="gl-spacer" aria-hidden="true" />
          <div className={raised ? 'gl-dock gl-dock-raised' : 'gl-dock'}><GlassTabBar current={tab} onChange={setTab} onPlus={NOOP} /></div>
        </div>
      </div>
    </div>
  )
}
