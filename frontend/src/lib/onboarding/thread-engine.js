// The thread on screen (motion-onboarding-thread.md §1, §4, "Surviving the real React app"). At
// rest every scene owns its line ([data-thread] = line | blade | check) in its own DOM. When the
// next screen's anchor registers, one overlay path takes the line from where the last one rested
// and hands it to the new anchor: the anchor is hidden while the thread travels and shown again in
// the frame it lands. rAF-driven, so a transition that starts mid-flight starts from the live shape.
//
// The old screen is gone by the time the new one mounts (the router swaps them), so the start is
// `last`: the old anchor measured as it unregistered, still in place.
import { birthPlan, checkP, dOf, evalAt, lineP, planBetween, withFlight } from './thread-geometry.js'

// The path by form, flown white and landed in the anchor's own look.
const planTo = (from, dest) => withFlight(planBetween(from, dest), dest, dest.f)

// New-screen content the line sweeps across mid-glide: held at 0 until it lands, then 160ms in.
const HOLD = '.ob-hd > *, .ob-cap, .ob-controls > *, .ob-pk-read, .ob-ruler, .ob-wheel, .ob-pl-sess, .ob-pl-fit, .ob-pass-t, .ob-pass-s'
// The art starts this long before the thread lands, so it visibly grows from the line.
const LEAD_MS = 120
// When a screen has landed: OnboardingLayout brings it in over 320ms after a 60ms delay.
export const LAND_MS = 380

/**
 * The translation the screen of `el` is in right now, [x, y]: OnboardingLayout slides each screen
 * in, and an anchor that registers while it does (the invite's scene arrives with the check's
 * answer) is measured where it will be at rest, not where the slide has it.
 */
function slideOf(el) {
  const screen = el.closest?.('.ob-screen')
  const tf = screen ? getComputedStyle(screen).transform : 'none'
  if (!tf || tf === 'none' || typeof DOMMatrixReadOnly !== 'function') return [0, 0]
  try {
    const m = new DOMMatrixReadOnly(tf)
    return [m.m41, m.m42]
  } catch { return [0, 0] }
}

/** An anchor's resting shape in viewport coordinates, or null where it cannot be measured. */
export function measureAnchor(el) {
  const own = el?.ownerSVGElement
  const m = typeof el?.getScreenCTM === 'function' ? el.getScreenCTM() : null
  if (!m || !own) return null
  const [sx, sy] = slideOf(el)
  const map = (x, y) => [m.a * x + m.c * y + m.e - sx, m.b * x + m.d * y + m.f - sy]
  const scale = Math.hypot(m.a, m.b)
  const cs = getComputedStyle(el)
  const form = el.getAttribute('data-thread')
  const shape = { form, w: (parseFloat(cs.strokeWidth) || 1.5) * scale, c: cs.stroke, o: 1 }
  // How the thread flies to it: white at the scene's structure weight (the kit's --il-w, 2.5).
  shape.f = {
    w: (parseFloat(cs.getPropertyValue('--il-w')) || 2.5) * scale,
    c: cs.getPropertyValue('--on-stage').trim() || shape.c,
  }
  if (form === 'check') {
    // data-k: the scale the disc pops from, about the viewBox centre, where the check is when the thread lands.
    const n = String(el.getAttribute('data-pts')).split(' ').map(Number), k = Number(el.getAttribute('data-k') || 1)
    const vb = own.viewBox.baseVal, ox = vb.x + vb.width / 2, oy = vb.y + vb.height / 2
    const q = i => map(ox + k * (n[i] - ox), oy + k * (n[i + 1] - oy))
    shape.p = checkP(q(0), q(2), q(4))
    shape.w *= k
  } else {
    const b = el.getBBox(), y = b.y + b.height / 2
    const A = map(b.x, y), B = map(b.x + b.width, y)
    shape.p = lineP(A[0], A[1], B[0], B[1])
  }
  return shape.p.every(Number.isFinite) && hasLength(shape) ? shape : null
}
// A zero-size line (display:none, not laid out) is no place to land.
const hasLength = shape => Math.abs(shape.p[24] - shape.p[0]) + Math.abs(shape.p[25] - shape.p[1]) > 0.5
// Whether an anchor is somewhere else than it was measured: an end off by half a pixel, or its weight.
const moved = (a, b) => [0, 1, 24, 25].some(i => Math.abs(a.p[i] - b.p[i]) > 0.5) || Math.abs(a.w - b.w) > 0.1
const MAX_HOPS = 2

/**
 * How far past a whole CSS pixel the anchor's own <svg> box starts, [x, y]. A browser may paint an
 * SVG root pixel-snapped (Chromium rounds its box to whole CSS px, at every DPR) while
 * getScreenCTM gives the unsnapped place, so a line drawn at the CTM lands up to half a pixel off
 * the line on screen (scripts/thread-handoff-check.mjs). The layer's own <svg> is set at the same
 * offset and its path drawn back by it: whatever the browser does to the one root it does to the
 * other, and the thread is painted where the anchor is.
 */
export function subpixelOf(el) {
  const box = el?.ownerSVGElement?.getBoundingClientRect?.()
  if (!box || !Number.isFinite(box.left) || !Number.isFinite(box.top)) return [0, 0]
  const [sx, sy] = slideOf(el)
  const x = box.left - sx, y = box.top - sy
  return [x - Math.floor(x), y - Math.floor(y)]
}

/**
 * layer(): { svg, path } of ThreadLayer, read when a run starts. blocked(): whether to skip the
 * morph (reduced motion, the keyboard up, a sheet open), when scenes simply show their own lines.
 * clip(el): { top, bottom } of the visible scroll rect for the screen of `el`. onCount(n): how many
 * anchors are registered (the guard test reads it).
 */
export function createThreadEngine({ layer, blocked, clip, onCount = () => {} }) {
  const anchors = new Set()
  let last = null, live = null, run = null, owned = null, fade = null, born = false

  function paint(shape) {
    const { path } = layer()
    path.setAttribute('d', dOf(shape.p))
    path.style.strokeWidth = shape.w.toFixed(2) + 'px'
    path.style.stroke = shape.c
    path.style.opacity = String(shape.o)
  }
  function hideLayer() {
    const { svg } = layer()
    if (!svg) return
    svg.style.visibility = 'hidden'
    svg.style.willChange = ''
  }
  function release() {
    if (owned?.isConnected) owned.removeAttribute('data-thread-claim')
    owned = null
    run = null
    live = null
    hideLayer()
  }
  function claim(el) {
    owned = el
    el.setAttribute('data-thread-claim', '')
    // The thread carries this line in: the scene does not draw it again.
    el.setAttribute('data-thread-carried', '')
  }
  function holdCrossed(from, dest, el, arrive) {
    const screen = el.closest('.ob-screen')
    if (!arrive || !screen) return
    const xs = [], ys = []
    for (const p of [from.p, dest.p]) for (let i = 0; i < 26; i += 2) { xs.push(p[i]); ys.push(p[i + 1]) }
    const pad = Math.max(from.w, dest.w) / 2 + 4
    const l = Math.min(...xs) - pad, r = Math.max(...xs) + pad, t = Math.min(...ys) - pad, b = Math.max(...ys) + pad
    for (const x of screen.querySelectorAll(HOLD)) {
      // Never what holds the anchor itself (the starter's tiles stand on it): held at 0, it would
      // show the line only after the thread had already let go of it.
      if (x.contains(el)) continue
      const q = x.getBoundingClientRect()
      if (!q.height || q.right < l || q.left > r || q.bottom < t || q.top > b) continue
      x.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: arrive, easing: 'linear', fill: 'backwards' })
    }
  }
  // `dest`: the anchor's shape as the plan was made for it; `hops`: how many times this landing
  // has been moved on already.
  // `replan(to)`: the plan again for the anchor where it is on the run's first frame (see frame).
  function start(base, plan, el, dest = null, hops = 0, replan = null) {
    const { svg } = layer()
    if (!svg) return
    if (fade) { fade.cancel(); fade = null }
    const { top, bottom } = clip(el)
    const [sx, sy] = subpixelOf(el)
    svg.style.left = sx + 'px'
    svg.style.top = sy + 'px'
    layer().path?.setAttribute('transform', `translate(${-sx} ${-sy})`)
    svg.style.clipPath = `inset(${Math.max(0, top - sy)}px 0 ${Math.max(0, window.innerHeight - bottom + sy)}px 0)`
    svg.style.visibility = 'visible'
    svg.style.willChange = 'contents'
    live = base
    paint(base)
    let t0 = null, id = 0
    const r = {
      dead: false,
      finish() {
        if (r.dead) return
        r.dead = true
        cancelAnimationFrame(id)
        release()
      },
      cancel() { r.dead = true; cancelAnimationFrame(id); if (run === r) run = null },
    }
    const frame = now => {
      if (r.dead) return
      if (t0 === null) {
        t0 = now
        // The anchor again, once every layout effect of the commit has run: the app scrolls a new
        // route to the top in its own (App.jsx), after this screen registered, so an anchor
        // measured on a screen reached scrolled (the starter's Use this plan) is not where it
        // rests. Flown to as it was measured, the thread would land short and glide a second
        // time, past the moment the Summary's line turns into the ring.
        const at = replan && dest && el.isConnected ? measureAnchor(el) : null
        if (at && moved(dest, at)) {
          plan = replan(at)
          dest = at
          last = at
        }
      }
      const t = now - t0
      if (t >= plan.total) {
        // Landed: the anchor is measured again. One that moved while the thread flew (the screen's
        // header grew above it, a font came in) is glided on to, never handed a line where it is
        // not. Twice at most: an anchor that keeps moving gets the line where it is. A check is
        // left out: it is measured where it sits once its disc has popped (data-k), which it has
        // not yet at landing.
        const at = dest && dest.form !== 'check' && hops < MAX_HOPS && el.isConnected ? measureAnchor(el) : null
        if (at && moved(dest, at)) {
          r.cancel()
          last = at
          start(live, planTo(live, at), el, at, hops + 1)
          return
        }
        // The end shape itself for one frame, then the swap: the last frame painted before the
        // anchor shows is the anchor's shape, not one a few ms short of it.
        if (!r.home) {
          r.home = true
          live = evalAt(base, plan.segs, plan.total)
          paint(live)
          id = requestAnimationFrame(frame)
          return
        }
        r.finish()
        return
      }
      live = evalAt(base, plan.segs, t)
      paint(live)
      id = requestAnimationFrame(frame)
    }
    run = r
    id = requestAnimationFrame(frame)
  }
  /** No morph: the thread steps aside in 100ms and the scenes show their own lines. */
  function abort() {
    if (owned?.isConnected) owned.removeAttribute('data-thread-claim')
    owned = null
    if (!run) return
    run.cancel()
    run = null
    live = null
    const { svg } = layer()
    if (!svg?.animate) { hideLayer(); return }
    fade = svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, easing: 'linear' })
    fade.onfinish = () => { fade = null; hideLayer() }
  }

  /** An anchor arrived. `birth`: the invite's line, drawn out of a dot the first time. Returns the cleanup. */
  function register(el, { birth = false } = {}) {
    anchors.add(el)
    onCount(anchors.size)
    const dest = measureAnchor(el)
    const from = run && live ? live : last
    if (run) { run.cancel(); run = null }
    if (!dest || blocked()) {
      abort()
    } else if (!from) {
      if (birth && !born) {
        born = true
        const plan = birthPlan(dest, dest.f)
        claim(el)
        start(plan.base, plan, el, dest)
      }
    } else {
      const plan = planTo(from, dest)
      claim(el)
      if (plan.arrive) {
        el.ownerSVGElement?.style.setProperty('--lead', Math.max(0, plan.arrive - LEAD_MS) + 'ms')
        holdCrossed(from, dest, el, plan.arrive)
        start(from, plan, el, dest, 0, to => planTo(from, to))
      } else {
        // The floors coincide (the goal-to-weight run): the thread holds the line still, painted
        // where it was, while the new screen fades and slides in under it, and hands it over once
        // the screen has landed.
        start(from, { segs: [], total: LAND_MS, arrive: 0 }, el, dest, 0, to => planTo(from, to))
      }
    }
    if (dest) last = dest
    return () => {
      anchors.delete(el)
      onCount(anchors.size)
      if (owned === el) {
        // Interrupted mid-flight: the next run starts from the shape on screen, not from this
        // anchor at rest.
        const flying = run && live ? live : null
        if (flying) last = flying
        run?.cancel()
        release()
        if (flying) return
      }
      // Measured on the way out, while it is still in place: where the next run starts.
      const rest = !run && el.isConnected ? measureAnchor(el) : null
      if (rest) last = rest
    }
  }

  return {
    register,
    finish() { run?.finish() },
    abort,
  }
}
