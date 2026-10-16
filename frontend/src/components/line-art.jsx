import { useId } from 'react'
import { cx, oneOf } from '../lib/ui-kit.js'
import { useDrawIn } from '../lib/use-draw-in.js'

// Line art in place of photos, in the onboarding's one language (fitness-eval
// ui-onboarding-round2 §1, ui-redesign-components §3): two strokes (--il-w, --il-w-d), three inks
// (structure --label-2, data --acc-graphic, context --label-3), the floor in --sep, --surface to
// occlude and --acc-soft for the one lit area. Flat views, no figures or faces, no text in the
// svg (an HTML caption says the number), at most 8 paths and 3 accent ones. Each scene is a pure
// function of its state, drawn in once a session (lib/use-draw-in.js). Sized for the 96×72 art
// slot (--art-w × --art-h), 1:1.

// A path that draws in: its order in the scene, back to front, accent last.
const at = i => ({ pathLength: 1, style: { '--i': i } })
const FLOOR = <path className="il-floor" d="M8 64H88" {...at(0)} />

// The week's routine as a plan card: a row per day (three at most), the next one lit. No routine:
// a dashed card with a +. Not scheduled: the rows muted.
function routine({ days = 0, next = null, scheduled = true }) {
  if (!days) {
    return <>
      {FLOOR}
      <rect className="il il-mute il-dash" x="24" y="8" width="48" height="52" rx="6" />
      <path className="il-acc" d="M48 26v16M40 34h16" {...at(1)} />
    </>
  }
  const rows = Math.min(3, days)
  return <>
    {FLOOR}
    <rect className="il il-occ" x="24" y="8" width="48" height="52" rx="6" {...at(1)} />
    {next != null && next < rows && <rect className="il-lit" x="28" y={14 + 12 * next} width="40" height="12" rx="3" {...at(2)} />}
    {Array.from({ length: rows }, (_, i) => {
      const y = 20 + 12 * i
      return <path key={i} className={i === next ? 'il-acc' : cx('il-d', !scheduled && 'il-mute')}
        d={`M32 ${y}h8M33 ${y - 3}v6M39 ${y - 3}v6M44 ${y}h20`} {...at(3 + i)} />
    })}
  </>
}

// Mobility without a figure: a mat on the floor and a stopwatch whose accent arc is the session's
// length out of an hour.
function mobility({ minutes = 0 }) {
  const m = Math.max(0, Math.min(60, minutes))
  return <>
    {FLOOR}
    <rect className="il" x="12" y="56" width="56" height="6" rx="3" {...at(1)} />
    <circle className="il il-lit" cx="64" cy="32" r="18" {...at(2)} />
    <path className="il" d="M64 10v4M60 10h8" {...at(3)} />
    {m > 0 && <path className="il-acc il-data" d="M64 14a18 18 0 1 1 0 36a18 18 0 1 1 0-36" pathLength="60" strokeDasharray={`${m} 60`} />}
  </>
}

// The weighing scale from above: a tape behind a fixed accent needle, moved to the latest weight.
// No weigh-in: the tape muted, no needle.
const KG_FROM = 30, KG_TO = 250, U = 2   // the tape: 2 units a kilo, a tall tick every 5
const TAPE = Array.from({ length: KG_TO - KG_FROM + 1 }, (_, i) => `M${i * U} ${i % 5 ? 24 : 20}V28`).join('')
function scale({ kg = null }, clip) {
  const x = kg == null ? 48 : 48 - U * (Math.max(KG_FROM, Math.min(KG_TO, kg)) - KG_FROM)
  return <>
    {FLOOR}
    <rect className="il il-occ" x="20" y="8" width="56" height="56" rx="14" {...at(1)} />
    <clipPath id={clip}><rect x="32" y="16" width="32" height="14" rx="4" /></clipPath>
    <rect className="il-d il-lit" x="32" y="16" width="32" height="14" rx="4" {...at(2)} />
    <g clipPath={`url(#${clip})`}>
      <path className={cx('il-d', kg == null && 'il-mute')} d={TAPE} transform={`translate(${x} 0)`} />
    </g>
    {kg != null && <path className="il-acc" d="M48 17v12" {...at(3)} />}
  </>
}

// What an exercise is done with, for a thumbnail that has no picture: barbell, dumbbell, cable,
// machine or the mat for bodyweight. Never a figure.
export const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight']
/** The equipment scene for an exercise's `eq` ('body weight', 'smith machine', 'kettlebell'…). */
export function equipmentOf(eq = '') {
  const e = String(eq).toLowerCase()
  if (/barbell|landmine|smith|trap bar|ez/.test(e)) return 'barbell'
  if (/dumbbell|kettlebell|macebell|clubbell/.test(e)) return 'dumbbell'
  if (/cable|band|rope/.test(e)) return 'cable'
  if (/machine|lever|sled/.test(e)) return 'machine'
  return 'bodyweight'
}
function equipment({ eq = 'bodyweight' }) {
  const kind = oneOf('LineArt', 'eq', eq, EQUIPMENT)
  return <>
    {FLOOR}
    {kind === 'barbell' && <>
      <path className="il" d="M10 40H86" {...at(1)} />
      <rect className="il il-occ" x="18" y="26" width="6" height="28" rx="2" {...at(2)} />
      <rect className="il il-occ" x="72" y="26" width="6" height="28" rx="2" {...at(3)} />
    </>}
    {kind === 'dumbbell' && <>
      <path className="il" d="M32 40H64" {...at(1)} />
      <rect className="il il-occ" x="24" y="30" width="8" height="20" rx="2" {...at(2)} />
      <rect className="il il-occ" x="64" y="30" width="8" height="20" rx="2" {...at(3)} />
    </>}
    {kind === 'cable' && <>
      <path className="il" d="M20 8H76M48 8v2" {...at(1)} />
      <circle className="il il-occ" cx="48" cy="16" r="6" {...at(2)} />
      <path className="il-d" d="M48 22V50M38 50H58" {...at(3)} />
    </>}
    {kind === 'machine' && <>
      <path className="il" d="M24 64V12H72V64" {...at(1)} />
      <rect className="il il-occ" x="36" y="40" width="24" height="6" rx="2" {...at(2)} />
      <path className="il-d" d="M40 40V22M24 28H72" {...at(3)} />
    </>}
    {kind === 'bodyweight' && <rect className="il" x="12" y="56" width="72" height="6" rx="3" {...at(1)} />}
  </>
}

// A plate from above between a fork and a knife, a quarter of it lit in the accent: Nutrition
// with nothing to show (the phone build, a guest).
function plate() {
  return <>
    {FLOOR}
    <circle className="il il-occ" cx="48" cy="36" r="22" {...at(1)} />
    <circle className="il-d il-lit" cx="48" cy="36" r="14" {...at(2)} />
    <path className="il" d="M12 12v10M16 12v10M20 12v10M12 22a4 4 0 0 0 8 0M16 26v32" {...at(3)} />
    <path className="il" d="M80 12v46M80 12c5 5 5 14 0 18" {...at(4)} />
    <path className="il-acc" d="M48 22a14 14 0 0 1 14 14" {...at(5)} />
  </>
}

// A chart with nothing in it: two axes standing on the floor, a dashed flat line, the accent dot
// where it would start.
function chart() {
  return <>
    {FLOOR}
    <path className="il" d="M22 10V64H84" {...at(1)} />
    <path className="il il-mute il-dash" d="M30 40H80" />
    <circle className="il-acc" cx="30" cy="40" r="3" {...at(2)} />
  </>
}

// The empty states' own drawings: each is one fixed picture of "nothing here yet", standing on the
// floor. The first five are the onboarding scenes ported to 96×72 (their geometry, none of their
// overlays or state); the rest are drawn in the same language.

// A rounded rect as path data, so several can share one path.
const rr = (x, y, w, h, r) =>
  `M${x + r} ${y}H${x + w - r}a${r} ${r} 0 0 1 ${r} ${r}V${y + h - r}a${r} ${r} 0 0 1 -${r} ${r}H${x + r}a${r} ${r} 0 0 1 -${r} -${r}V${y + r}a${r} ${r} 0 0 1 ${r} -${r}Z`

// The onboarding's tear-off calendar (Born): the pad with its page edges behind, the band unlit,
// one of its two rings in the accent.
function calendar() {
  return <>
    {FLOOR}
    <path className="il-d il-mute" d="M76 22V59" {...at(1)} />
    <path className="il-d il-mute" d="M73 17V62" {...at(2)} />
    <rect className="il il-occ" x="22" y="12" width="48" height="52" rx="6" {...at(3)} />
    <path className="il il-mute" d="M22 24H70" {...at(4)} />
    <path className="il" d="M34 8v8" {...at(5)} />
    <path className="il-acc" d="M58 8v8" {...at(6)} />
  </>
}

// The onboarding's week of day tiles (Training), five at this width and all muted; the middle one
// dashed with an accent + in it.
const WEEK_TILES = [0, 1, 3, 4].map(i => rr(9.5 + 16 * i, 26, 13, 38, 3.5)).join('')
function week() {
  return <>
    {FLOOR}
    <path className="il il-d il-mute" d={WEEK_TILES} {...at(1)} />
    <rect className="il-d il-mute il-dash" x="41.5" y="26" width="13" height="38" rx="3.5" />
    <path className="il-acc" d="M48 41v8M44 45h8" {...at(2)} />
  </>
}

// The onboarding's envelope (Invite), closed and with no letter: its seams muted, the flap's edge
// in the accent.
function envelope() {
  return <>
    {FLOOR}
    <rect className="il il-occ" x="18" y="24" width="60" height="40" rx="5" {...at(1)} />
    <path className="il-d il-mute" d="M20 62L41 45M76 62L55 45" {...at(2)} />
    <path className="il-acc" d="M21 27L48 47L75 27" {...at(3)} />
  </>
}

// The onboarding's key on its ring (Name), lying on the floor: the bow dashed, with no initial, the
// ring in the accent.
function key() {
  return <>
    {FLOOR}
    <path className="il il-d" d="M22 52H28" {...at(1)} />
    <circle className="il il-mute il-dash" cx="40" cy="52" r="12" />
    <path className="il" d="M52 52H84" {...at(2)} />
    <path className="il il-d" d="M64 52v8h4v-3h4v3h4v-3h4v3h4V52" {...at(3)} />
    <circle className="il-acc" cx="16" cy="52" r="6" {...at(4)} />
  </>
}

// The onboarding's coach (Plan): the speech bubble in the accent round a dashed card, three dots.
function coach() {
  return <>
    {FLOOR}
    <rect className="il-d il-mute il-dash" x="24" y="15" width="48" height="36" rx="4" />
    <rect className="il-acc" x="18" y="10" width="60" height="46" rx="8" {...at(1)} />
    <path className="il-acc" d="M28 56l-5 8l13-8" {...at(2)} />
    <path className="il-acc" d="M41 45a1 1 0 1 0 2 0a1 1 0 1 0-2 0M47 45a1 1 0 1 0 2 0a1 1 0 1 0-2 0M53 45a1 1 0 1 0 2 0a1 1 0 1 0-2 0" {...at(3)} />
  </>
}

// Nothing matched: a magnifier over a dashed list card with two muted rows, a glint on the lens.
function search() {
  return <>
    {FLOOR}
    <rect className="il il-mute il-dash" x="14" y="12" width="44" height="52" rx="6" />
    <path className="il-d il-mute" d="M22 26H46M22 36H40" {...at(1)} />
    <path className="il" d="M70 50L80 60" {...at(2)} />
    <circle className="il il-occ" cx="62" cy="42" r="12" {...at(3)} />
    <path className="il-acc" d="M54 42a8 8 0 0 1 8-8" {...at(4)} />
  </>
}

// A rotation with nothing in it: three small plan cards on a dashed loop, an accent arrow along it
// closing the loop.
const ROTATION_CARDS = [[41, 13], [13, 43], [69, 43]].map(([x, y]) => rr(x, y, 14, 18, 3)).join('')
const ROTATION_ROWS = [[41, 13], [13, 43], [69, 43]].map(([x, y]) => `M${x + 4} ${y + 6}h6M${x + 4} ${y + 11}h4`).join('')
function rotation() {
  return <>
    {FLOOR}
    <path className="il-d il-mute il-dash" d="M16 42a32 20 0 1 0 64 0a32 20 0 1 0-64 0" />
    <path className="il il-occ" d={ROTATION_CARDS} {...at(1)} />
    <path className="il-d il-mute" d={ROTATION_ROWS} {...at(2)} />
    <path className="il-acc" d="M16.5 38.5A32 20 0 0 1 34.5 23.9M29.8 22.1L34.5 23.9L31.5 27.9" {...at(3)} />
  </>
}

// No favourites: a plan card whose rows are dashed, an accent star outline on the top row.
function favourites() {
  return <>
    {FLOOR}
    <rect className="il il-occ" x="24" y="8" width="48" height="56" rx="6" {...at(1)} />
    <path className="il-d il-mute il-dash" d="M44 22H64M32 35H64M32 48H64" />
    <path className="il-acc" d="M34 16.5L35.4 20.1L39.2 20.3L36.3 22.7L37.2 26.4L34 24.4L30.8 26.4L31.7 22.7L28.8 20.3L32.6 20.1Z" {...at(2)} />
  </>
}

// No photos: two upright frames side by side, the second dashed; the first holds a muted sun and
// an accent skyline of hills. Never a figure.
function photo() {
  return <>
    {FLOOR}
    <rect className="il il-mute il-dash" x="52" y="18" width="30" height="46" rx="4" />
    <rect className="il il-occ" x="14" y="18" width="30" height="46" rx="4" {...at(1)} />
    <circle className="il-d il-mute" cx="34" cy="29" r="3" {...at(2)} />
    <path className="il-acc" d="M18 54L26 44L31 50L34 47L40 54" {...at(3)} />
  </>
}

// No measurements: a tape measure's case (thumb lock on top, hub and its pin) with the tape run out
// of it along the floor, muted ticks, the end tab in the accent.
function tape() {
  return <>
    {FLOOR}
    <rect className="il-d" x="46" y="58" width="36" height="6" rx="1" {...at(1)} />
    <path className="il-d il-mute" d="M58 58v3M62 58v2M66 58v3M70 58v2M74 58v3M78 58v2" {...at(2)} />
    <path className="il" d="M22 24v-5h12v5" {...at(3)} />
    <rect className="il il-occ" x="12" y="24" width="42" height="40" rx="10" {...at(4)} />
    <path className="il-d" d="M24 44a9 9 0 1 0 18 0a9 9 0 1 0-18 0M31.5 44a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0" {...at(5)} />
    <path className="il-acc" d="M82 54V64" {...at(6)} />
  </>
}

// Foods with nothing to show: a lidded jar with a lit band for its label and an apple beside it,
// the apple's stem and leaf in the accent.
function pantry() {
  return <>
    {FLOOR}
    <rect className="il il-occ" x="16" y="22" width="36" height="42" rx="7" {...at(1)} />
    <rect className="il-d il-lit" x="20" y="34" width="28" height="16" rx="2" {...at(2)} />
    <rect className="il il-occ" x="19" y="14" width="30" height="8" rx="2" {...at(3)} />
    <path className="il" d="M68 47C64 44 58 45 58 53C58 59 62 64 65 64C66 64 67 63 68 63C69 63 70 64 71 64C74 64 78 59 78 53C78 45 72 44 68 47Z" {...at(4)} />
    <path className="il-acc" d="M68 47C68 44 69 42 70 41M70 43c2-4 6-4 7-3c-1 3-4 4-7 3Z" {...at(5)} />
  </>
}

// Fasting with nothing to show: a clock face, the fasting window (two thirds of the day) an accent
// arc round its rim, a fork leaning on it.
function fasting() {
  return <>
    {FLOOR}
    <circle className="il il-occ" cx="40" cy="42" r="22" {...at(1)} />
    <path className="il-d il-mute" d="M40 24v3M58 42h-3M40 60v-3M22 42h3" {...at(2)} />
    <path className="il-d" d="M40 42V31M40 42h8" {...at(3)} />
    <path className="il" d="M80 16v10M84 16v10M88 16v10M80 26a4 4 0 0 0 8 0M84 30V64" transform="rotate(-16 84 64)" {...at(4)} />
    <path className="il-acc" d="M40 20A22 22 0 1 1 20.95 53" {...at(5)} />
  </>
}

// Recovery with nothing to show: a watch standing on its strap, an accent heart-rate trace across
// the face.
function recovery() {
  return <>
    {FLOOR}
    <rect className="il" x="38" y="6" width="20" height="58" rx="4" {...at(1)} />
    <rect className="il il-occ" x="28" y="16" width="40" height="40" rx="10" {...at(2)} />
    <path className="il-d" d="M68 31h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" {...at(3)} />
    <path className="il-acc" d="M33 37H40L43 30L47 44L51 33L53 37H63" {...at(4)} />
  </>
}

const SCENES = {
  routine, mobility, scale, equipment, plate, chart,
  calendar, week, envelope, key, coach, search, rotation, favourites, photo, tape, pantry, fasting, recovery,
}
export const LINE_ART_SCENES = Object.keys(SCENES)

// The empty states' illustrations (<EmptyState illustration>): a name, the scene it draws and the
// state it is drawn in, which is that scene's empty drawing. A new name is a new entry here, and
// line-art.test.jsx holds its scene to the rules above. ui-guards G9 reads these keys.
export const ILLUSTRATIONS = {
  scale: { scene: 'scale', state: { kg: null } },
  routine: { scene: 'routine', state: { days: 0 } },
  plate: { scene: 'plate', state: {} },
  barbell: { scene: 'equipment', state: { eq: 'barbell' } },
  dumbbell: { scene: 'equipment', state: { eq: 'dumbbell' } },
  chart: { scene: 'chart', state: {} },
  calendar: { scene: 'calendar', state: {} },
  week: { scene: 'week', state: {} },
  envelope: { scene: 'envelope', state: {} },
  key: { scene: 'key', state: {} },
  coach: { scene: 'coach', state: {} },
  search: { scene: 'search', state: {} },
  rotation: { scene: 'rotation', state: {} },
  favourites: { scene: 'favourites', state: {} },
  photo: { scene: 'photo', state: {} },
  tape: { scene: 'tape', state: {} },
  pantry: { scene: 'pantry', state: {} },
  fasting: { scene: 'fasting', state: {} },
  recovery: { scene: 'recovery', state: {} },
}

// drawKey: what "drawn in once a session" is counted per; the scene's name by default, an
// illustration's own name for an empty state (two names on one scene each get their first time).
export function LineArt({ scene, state = {}, className, drawKey }) {
  oneOf('LineArt', 'scene', scene, LINE_ART_SCENES)
  const clip = useId()
  const draw = useDrawIn(drawKey ?? 'line-art:' + scene)
  return (
    <svg className={cx('lineart', draw, className)} viewBox="0 0 96 72" aria-hidden="true" focusable="false" data-scene={scene}>
      {SCENES[scene](state, clip)}
    </svg>
  )
}
