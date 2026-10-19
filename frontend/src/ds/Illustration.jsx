import { useId, useLayoutEffect, useMemo, useRef } from 'react'
import { useDrawIn } from '../lib/use-draw-in.js'
import { reducedMotion } from '../lib/reduced-motion.js'
import { cx, oneOf } from '../lib/ui-kit.js'
import { SCENES, SCENE_NAMES } from './illustration-scenes.js'

// The draw-in, as bundle.js prepares it: every stroke gets pathLength 1 and a delay 60ms after the
// one before it, in document order (floor, structure, detail, the accent last); the dashed parts,
// lit fills and dots fade in at the end.
function prepDraw(svg) {
  let k = 0
  const out = svg.replace(/<(path|rect|circle)\b([^>]*?)(\/?)>/g, (all, tag, attrs, sl) => {
    const cls = (attrs.match(/class="([^"]*)"/) || [, ''])[1]
    if (!cls) return all
    const stroke = /\b(il|il-acc|il-mute|il-floor)\b/.test(cls) && !/stroke-dasharray/.test(attrs) && !/\bil-lit\b/.test(cls)
    if (stroke) return '<' + tag + attrs.replace(/class="/, 'class="dr ') + ' pathLength="1" style="--d:' + (k++ * 60) + 'ms"' + sl + '>'
    return '<' + tag + attrs.replace(/class="/, 'class="fd ') + sl + '>'
  })
  const end = Math.max(0, (k - 1) * 60) + 480
  return out.replace(/class="fd /g, 'style="--d:' + Math.max(0, end - 200) + 'ms" class="fd ')
}

const MODE_CLASS = { 'il-draw': 'g-ill-draw', 'rm-fade': 'g-ill-fade' }
// The paths a screen can ask for by name (`anchor`): the floor, the one accent, the key's shaft.
const ANCHORS = { floor: '.il-floor', accent: '.il-acc', shaft: '.kshaft' }

// One of the onboarding's line-art scenes. `draw` plays the draw-in every time it mounts (and
// again when `replayKey` changes); `draw="once"`, the one to use in screens, only the first time
// that scene shows in a session (lib/use-draw-in.js), and after that it is simply there. Under
// reduced motion (the device's or the app's) it fades in over 140ms instead. `tone="stage"` is
// the same drawing in white for the stage. Decoration: hidden from screen readers.
//
// What a screen adds for the parts it moves with an answer (README: screen behaviours, not part
// of the scene): `className` and `style` (custom properties only) on the drawing, which the screen's CSS
// reaches the scene's handles with (ss-g, stape, hmark…); `children`, SVG parts drawn over the
// scene in its viewBox; `overlay`, HTML laid over it. `anchor` names one of its paths and
// `anchorRef` gets that element before the screen's own layout effects run (the onboarding's
// thread anchor).
export default function Illustration({ name, draw, replayKey, width, tone, className, style, anchor, anchorRef, overlay, children }) {
  oneOf('Illustration', 'name', name, SCENE_NAMES)
  oneOf('Illustration', 'tone', tone, ['light', 'stage'])
  oneOf('Illustration', 'anchor', anchor, Object.keys(ANCHORS))
  const scene = SCENES[name] || SCENES.plan
  const id = 'g' + useId().replace(/[^\w-]/g, '')
  const once = useDrawIn(draw === 'once' ? 'g-ill:' + name : 'g-ill')
  const mode = draw === 'once' ? once : draw === true ? (reducedMotion() ? 'rm-fade' : 'il-draw') : null
  const raw = scene.svg.replace(/__ID__/g, id)
  const html = mode === 'il-draw' ? prepDraw(raw) : raw
  // One object per drawing: React sets innerHTML again whenever this prop is a new object, which
  // would replace the anchor (and its thread state) on every render of the screen.
  const inner = useMemo(() => ({ __html: html }), [html])
  const art = useRef(null)
  useLayoutEffect(() => {
    if (anchorRef) anchorRef.current = anchor ? art.current?.querySelector(ANCHORS[anchor]) ?? null : null
  }, [anchor, anchorRef, html, replayKey])
  const look = width ? { '--g-ill-w': width + 'px', ...style } : style
  return (
    <div key={replayKey} className={cx('g-ill', tone === 'stage' && 'g-ill-stage', MODE_CLASS[mode], className)} style={look}>
      <svg viewBox={scene.viewBox} aria-hidden="true" focusable="false">
        <g ref={art} className="g-ill-art" dangerouslySetInnerHTML={inner} />
        {children}
      </svg>
      {overlay}
    </div>
  )
}
