// The search overlay's motion, copied verbatim from bearmenu (fitness-eval ui-search.md §10):
// @bearmenu/ui lib/motion.ts, the overlay's own constants (search-overlay.tsx), the city pill's
// icon swap and motion-icon.tsx. Plain objects, no `motion` import, so the main bundle can read
// them; the `motion` engine itself only loads with the search chunk.

import { onReducedMotion, reducedMotion } from './reduced-motion.js'

// ─── Primitives ──────────────────────────────────────────────────────────────

export const duration = {
  instant: 0.12,
  quick: 0.18,
  standard: 0.26,
  deliberate: 0.36,
  narrative: 0.5,
  exitQuick: 0.11,
  exitStandard: 0.21,
}

export const ease = {
  enter: [0.0, 0.0, 0.2, 1.0],
  standard: [0.4, 0.0, 0.2, 1.0],
  exit: [0.55, 0.0, 1.0, 0.45],
}

// ─── Springs ─────────────────────────────────────────────────────────────────

export const springSnappy = { type: 'spring', damping: 30, stiffness: 380 }
export const springSmooth = { type: 'spring', damping: 30, stiffness: 220 }
export const springSoft = { type: 'spring', damping: 35, stiffness: 140 }
/** @deprecated use `springSoft`; bearmenu keeps the alias. */
export const springGentle = springSoft

// ─── The overlay (search-overlay.tsx) ────────────────────────────────────────

/** Delay before content animates in after the surface is visible. */
export const CONTENT_ENTER_DELAY = 0.11
export const SURFACE_SPRING = { type: 'spring', damping: 22, stiffness: 260, mass: 0.9 }
export const CONTENT_SPRING = { type: 'spring', damping: 20, stiffness: 220, mass: 0.9 }
export const SURFACE_EXIT_DURATION = 0.18
export const CONTENT_EXIT_DURATION = 0.12
export const EXIT_EASE = [0.55, 0, 1, 0.45]
export const SURFACE_EXIT = { duration: SURFACE_EXIT_DURATION, ease: EXIT_EASE }
export const CONTENT_EXIT = { duration: CONTENT_EXIT_DURATION, ease: EXIT_EASE }

// ─── The avatar ↔ close swap (city-pill.tsx): 13.5% overshoot, kept on purpose ──

export const ICON_SWAP_SPRING = { type: 'spring', damping: 18, stiffness: 280 }

// ─── Animated icons (motion-icon.tsx) ────────────────────────────────────────

/** A gesture is a performance with beats: a tween with explicit `times`. */
export const beats = (times, d = 0.62) => ({ duration: d, times, ease: 'easeInOut' })
/** Leaving is not a performance: it returns the glyph, firmly and fast. */
export const returnTransition = { type: 'spring', stiffness: 320, damping: 26 }
/** The longest gesture in the set, with a little room. */
export const GESTURE_MS = 700
/** How long a performed-but-not-active glyph keeps its end pose before snapping to rest. */
export const HOLD_GRACE_MS = 900

// ─── Reduced motion ──────────────────────────────────────────────────────────

export const REDUCED = { duration: 0.15 }

// ─── Archetypes and variants (lib/motion.ts) ─────────────────────────────────

export const archetype = {
  surfaceOpen: { ...springSmooth },
  surfaceClose: { duration: duration.exitStandard, ease: ease.exit },
  listReveal: { ...springSoft },
  listRevealStagger: 0.04,
  listRevealMaxItems: 8,
  contentSwap: { duration: duration.quick, ease: ease.standard },
  contentSwapExit: { duration: duration.exitQuick, ease: ease.exit },
  edgeEnter: { ...springSmooth },
  edgeExit: { duration: duration.exitStandard, ease: ease.exit },
  pressResponse: { duration: duration.instant, ease: ease.enter },
  indicatorMorph: { ...springSnappy },
  imageEnter: { duration: 0.3, ease: ease.standard },
}

export const stagger = { tight: 0.03, standard: 0.04, loose: 0.06 }

export const contentSwapVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: archetype.contentSwap },
  exit: { opacity: 0, y: -4, transition: archetype.contentSwapExit },
}

export const skeletonSwapVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: archetype.contentSwap },
  exit: { opacity: 0, transition: archetype.contentSwapExit },
}

// The result lists (search-results-sections.tsx): every group starts at once, its rows 30 ms apart.
export const LIST_CONTAINER = { hidden: {}, show: { transition: { staggerChildren: 0.03, delayChildren: 0 } } }
export const LIST_ITEM = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: springGentle } }

// ═══ The app's own enter and exit (fitness-eval spec-motion-enter-exit.md) ═══════════════════════
// Everything above is the search overlay's and stays its own. What follows is what sheets, the
// toast and (later) rows and panels animate with, through components/presence.jsx. The CSS custom
// properties are the source of truth (index.css and ui-kit.css); these are the same values as
// numbers for the Web Animations API, and motion.tokens.test.js keeps the two in step.

/** Durations in ms: --fast, --med, --slow, --exit-fast, --exit, --exit-slow, --rm. */
export const MS = { fast: 140, med: 220, slow: 340, exitFast: 100, exit: 160, exitSlow: 260, rm: 120 }
/** --ease (enters, and sheets both ways), --ease-io (state changes), --ease-exit (small exits). */
export const EASE = {
  ease: 'cubic-bezier(.32,.72,0,1)',
  io: 'cubic-bezier(.65,0,.35,1)',
  exit: 'cubic-bezier(.55,0,1,.45)',
}
/** --shift-xs, --shift-sm, --shift-md, --shift-x in px. */
export const SHIFT = { xs: 4, sm: 8, md: 16, x: 24 }

// A preset is what one element does on the way in and on the way out: keyframes, a duration and an
// easing per phase, and `rm`, what it does instead when the app keeps still (opacity only, --rm,
// linear: less motion, not no feedback). An exit with one keyframe starts from wherever the element
// is, so a sheet let go halfway down leaves from there. A phase a preset has no entry for is not
// animated; `rm: null` means no motion at all under reduced motion.
const FADE_RM = {
  enter: { keyframes: [{ opacity: 0 }, { opacity: 1 }], ms: MS.rm, easing: 'linear' },
  exit: { keyframes: [{ opacity: 0 }], ms: MS.rm, easing: 'linear' },
}
export const PRESETS = {
  // The sheet rises over --slow and leaves on the curve it came in on; the extra 32px clears its shadow.
  sheet: {
    enter: { keyframes: [{ transform: 'translateY(100%)' }, { transform: 'none' }], ms: MS.slow, easing: EASE.ease },
    exit: { keyframes: [{ transform: 'translateY(calc(100% + 32px))' }], ms: MS.exitSlow, easing: EASE.ease },
    rm: FADE_RM,
  },
  // Its scrim, on the same timing; the blur is held, only the opacity moves.
  backdrop: {
    enter: { keyframes: [{ opacity: 0 }, { opacity: 1 }], ms: MS.slow, easing: EASE.ease },
    exit: { keyframes: [{ opacity: 0 }], ms: MS.exitSlow, easing: EASE.ease },
    rm: FADE_RM,
  },
  // A sheet replaced by the next in the same tap fades where it stands: sliding it down while the
  // next one slides up would be two surfaces crossing.
  sheetSwap: {
    exit: { keyframes: [{ opacity: 0 }], ms: MS.exitFast, easing: EASE.exit },
    rm: FADE_RM,
  },
  toast: {
    enter: { keyframes: [{ opacity: 0, transform: `translateY(${SHIFT.sm}px)` }, { opacity: 1, transform: 'none' }], ms: MS.med, easing: EASE.ease },
    exit: { keyframes: [{ opacity: 0, transform: `translateY(${SHIFT.xs}px)` }], ms: MS.exit, easing: EASE.exit },
    rm: FADE_RM,
  },
  // A toast that replaces the one showing: the pill stays and acknowledges the new text.
  nudge: {
    enter: { keyframes: [{ transform: 'scale(.96)' }, { transform: 'none' }], ms: MS.fast, easing: EASE.ease },
    rm: null,
  },
}

// The driver is the seam tests use: the default is the element's own animate(), and a test hands
// in one that records the calls and resolves when it says so. Without either (happy-dom, an old
// engine) nothing animates and everything that waits on an exit is told at once.
const nativeDriver = { animate: (el, keyframes, options) => el.animate(keyframes, options) }
let driver = nativeDriver
export function setMotionDriver(next) { driver = next || nativeDriver }
export const canAnimate = el => !!el && (driver !== nativeDriver || typeof el.animate === 'function')

/** The step `preset` takes for `phase` now: the reduced one when the app keeps still. */
export function motionStep(preset, phase) {
  return (reducedMotion() ? preset.rm : preset)?.[phase] || null
}

// What is running, so that the app being told to keep still mid-flight ends it at once
// (spec §3.4): WAAPI ignores the CSS rule that stops everything else.
const running = new Set()
let watching = false
const track = anim => {
  running.add(anim)
  const done = () => running.delete(anim)
  anim.finished?.then(done, done)
  if (!watching) {
    watching = true
    onReducedMotion(() => { for (const a of [...running]) a.finish?.() })
  }
  return anim
}

/** Plays `preset`'s `phase` on `el`. Returns the Animation, or null when nothing was played. An
 *  exit holds its last frame until the element is gone. */
export function play(el, preset, phase) {
  if (!canAnimate(el)) return null
  const step = motionStep(preset, phase)
  if (!step) return null
  return track(driver.animate(el, step.keyframes, {
    duration: step.ms, easing: step.easing, fill: phase === 'exit' ? 'forwards' : 'none',
  }))
}

/** Stops `anim` where it is: the element keeps that frame as its own style, so what plays next
 *  starts from it rather than jumping. */
export function hold(anim) {
  try { anim.commitStyles?.() } catch { /* not rendered: there is no frame to keep */ }
  anim.cancel?.()
}

const KEYFRAME_META = new Set(['offset', 'easing', 'composite'])
/** Takes back what hold() left on `el` as its own style: every property `preset` animates. */
export function unhold(el, preset) {
  const steps = [preset.enter, preset.exit, preset.rm?.enter, preset.rm?.exit]
  for (const frame of steps.flatMap(step => step?.keyframes || [])) {
    for (const prop of Object.keys(frame)) {
      if (!KEYFRAME_META.has(prop)) el.style.removeProperty(prop.replace(/[A-Z]/g, c => '-' + c.toLowerCase()))
    }
  }
}
