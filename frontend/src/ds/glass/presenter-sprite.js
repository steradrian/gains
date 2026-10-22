import { lookUniformValues } from '../../lib/stage-look/renderer.js'
import { acquireGlassGL, createGlassGL, releaseGlassGL } from './glass-gl.js'
import { KIND, STRENGTH } from './glass-kinds.js'
import { SPRITE_CLASS } from './glass-registry.js'

// Liquid glass, the sprite presenter (plan 2.3, M3): in-flow glass is drawn into canvases that live inside
// their own elements, so scrolling (WKWebView's async scroll included), sticky headers, route slides,
// presence fades, nested scrollers and overflow clips move and cut the glass exactly, because the browser
// composites it with the element. Chrome stays on the chrome presenter's strip.
//
// One hidden WebGL "atlas" (glass-gl.js in atlas mode) draws every shape that needs a refresh into a packed
// region, evaluated at the element's real viewport position, so the refraction samples the stage that is
// really behind it. Each region is then copied into the element's sprite: `<canvas class="g-lg-sprite">`,
// appended last, aria-hidden, absolutely placed `--lg-m` px outside the element's border box at z-index -1
// (ds.css "Liquid glass: sprites"). The approved material: the glass shader with the same per-kind
// optics for chrome and sprites, the press swell and the contact shadow drawn in the sprite (its margin
// holds the shadow), at the device-pixel ratio (cards 3x) unless `cardDpr` lowers the cards'.
//
// Only the refraction's content can lag, and only when the element moves: each sprite on screen refreshes
// for a scroll at most 12 times a second plus once exactly 120 ms after the movement stops, for a look tick
// (the engine's look gate, at most 15 Hz) and for a press every frame. A size, kind, material, look or
// pushed change on screen refreshes at once, and a stale sprite coming on screen comes first in the queue.
// Sprites are made for shapes up to half a viewport away (the engine's read band) and a shape more than a
// viewport away (the registry's `near`) gives its sprite back (`width = height = 0`, removed) and returns to
// the CSS material.
//
// The GPU cost is an atlas render plus a copy of its result into each sprite (measured in WebKit: about
// 1-2 ms of GPU per atlas page of two cards at 3x, growing with the atlas size). So while the page scrolls,
// refreshes that can wait are spread over frames: each frame takes the most overdue sprites up to FRAME_PX
// device pixels (always at least one), and the rest stay pending for the next frame. Each sprite keeps its
// own 12 Hz clock, so a screen of sprites refreshes in a steady trickle, not in one heavy frame every 83 ms.
// At rest a look tick refreshes its sprites in one batch, which costs least in total and lets the loop go
// idle until the next tick. The atlas grows to what a frame needs and shrinks back after a second of not
// needing its size.
//
// The copy is a 2D context per sprite and `drawImage(atlas, sx, sy, sw, sh, 0, 0, sw, sh)`: synchronous,
// so a sprite has content in the task that marks its element (R7) and a resize can't blank it. An element
// whose 2D context the browser refuses keeps the CSS material.

export const SPRITE_MARGIN = 4 // CSS px: room for the press swell when the shadow is CSS
export const ATLAS_WIDTH = 2048
export const SPRITE_BUDGET_BYTES = 30 * 1024 * 1024 // sprites plus the atlas at its cap; the worst real screen (Train) uses about 22 MB
export const ATLAS_MAX_BYTES = 8 * 1024 * 1024
export const ATLAS_MAX_HEIGHT = Math.floor(ATLAS_MAX_BYTES / 4 / ATLAS_WIDTH)
export const SHADOW = Object.freeze({ SHADER: 'shader', CSS: 'css' })
export const SCROLL_MS = 1000 / 12
export const SETTLE_MS = 120
export const FRAME_PX = 640 * 1024 // device px of refreshes that can wait, per frame: about one full-width card at 3x
export const SHRINK_MS = 1000
const PAD = 2 // px between atlas regions
const ROUND = 64 // atlas sizes step, so a slightly larger set doesn't reallocate
const MAX_DPR = 3
const LOOK_MAX_DPR = 2 // StageLook's own cap, as in presenter-chrome.js
const MOVE_EPS = 0.1
const VISIBLE_BAND = 80 // px outside the viewport that still counts as on screen (the registry's own band)

// Elements that can't hold a child canvas, or whose children aren't rendered: they keep the CSS material.
const NO_HOST = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'IMG', 'PICTURE', 'VIDEO', 'AUDIO', 'CANVAS', 'IFRAME',
  'OBJECT', 'EMBED', 'BR', 'HR', 'WBR', 'AREA', 'SOURCE', 'TRACK', 'METER', 'PROGRESS'])

/** True for an HTML element that may hold a sprite: never an input, a select, a textarea, an svg or a void element. */
export function canHost(el) {
  return typeof HTMLElement !== 'undefined' && el instanceof HTMLElement && !NO_HOST.has(el.tagName)
}

/**
 * CSS px around a shape that hold its swell and its contact shadow, mirroring glass-gl.js: the shadow box is
 * the shape less 2 px, offset down by 5 (cards) or up to 5 (pressed controls), fading out over its blur.
 */
export function shadowMargin(kind, hw, hh) {
  const blur = kind === KIND.CARD ? 18 : 9 + Math.min(hw, hh) * 0.25
  const off = 5
  const swell = (STRENGTH[kind] || STRENGTH.control).swell
  return Math.ceil(blur - 2 + off + swell) + 1
}

/**
 * Shelf packing, tallest first. `items`: [{ key, w, h }] in device px. Regions never overlap (PAD apart),
 * no page is wider than `width` or taller than `maxHeight`; what doesn't fit one page starts the next, and
 * an item larger than a whole page is `skipped` (its element keeps the CSS material).
 * @returns {{ pages: { width: number, height: number, placed: { key: any, x: number, y: number, w: number, h: number }[] }[], skipped: any[] }}
 */
export function packShelves(items, { width = ATLAS_WIDTH, maxHeight = ATLAS_MAX_HEIGHT, pad = PAD } = {}) {
  const pages = []
  const skipped = []
  let page = null
  let shelf = null
  const sorted = [...items].sort((a, b) => b.h - a.h)
  for (const it of sorted) {
    if (it.w + pad > width || it.h + pad > maxHeight) { skipped.push(it.key); continue }
    if (!page) { page = { width: 0, height: 0, placed: [] }; pages.push(page); shelf = null }
    if (!shelf || shelf.x + it.w + pad > width) {
      const y = shelf ? shelf.y + shelf.h : 0
      if (y + it.h + pad > maxHeight) {
        page = { width: 0, height: 0, placed: [] }
        pages.push(page)
        shelf = { x: 0, y: 0, h: it.h + pad }
      } else {
        shelf = { x: 0, y, h: it.h + pad }
      }
    }
    page.placed.push({ key: it.key, x: shelf.x, y: shelf.y, w: it.w, h: it.h })
    shelf.x += it.w + pad
    page.width = Math.max(page.width, shelf.x)
    page.height = Math.max(page.height, shelf.y + shelf.h)
  }
  return { pages, skipped }
}

/**
 * Which sprites refresh this frame (pure). `cands`: [{ urgent, pressed, soon, moved, look, at, px }]:
 *   `urgent`: on screen with no content yet, or its size, kind, material or look settings changed;
 *   `pressed`: a press in flight; `soon`: stale and about to show (coming on screen, or a new or resized
 *   sprite in the band ahead); `moved` / `look`: on screen and stale by movement / by a look tick;
 *   `at`: when it was last copied (ms); `px`: its device-pixel area.
 * Urgent and pressed sprites refresh this frame whatever they cost. The rest are due when `soon`, when a
 * look tick made them stale, or when they moved and either SCROLL_MS has passed since their own last copy or
 * the movement has `settled` (still for SETTLE_MS). Due sprites share a budget of `budgetPx` device pixels,
 * most urgent first (`soon`, then the oldest copy); a frame with no other work always takes the first, so
 * a sprite larger than the budget still gets its turn and none starves.
 * @returns {{ refresh: number[], pending: boolean }} `pending`: a stale sprite waits (for its own clock or
 *   for room in a later frame), so the caller must keep its loop running.
 */
export function planRefresh(cands, now, { settled = false, budgetPx = FRAME_PX } = {}) {
  const refresh = []
  const queue = []
  let used = 0
  let pending = false
  cands.forEach((c, i) => {
    if (c.urgent || c.pressed) { refresh.push(i); used += c.px || 0; return }
    const due = c.soon || c.look || (c.moved && (settled || now - (c.at ?? -Infinity) >= SCROLL_MS))
    if (due) queue.push(i)
    else if (c.moved) pending = true
  })
  queue.sort((a, b) => (cands[b].soon ? 1 : 0) - (cands[a].soon ? 1 : 0) || (cands[a].at ?? 0) - (cands[b].at ?? 0))
  for (const i of queue) {
    const px = cands[i].px || 0
    if (used === 0 || used + px <= budgetPx) { refresh.push(i); used += px } else pending = true
  }
  return { refresh, pending }
}

const roundUp = n => Math.max(ROUND, Math.ceil(n / ROUND) * ROUND)

/** CSS px a box (centre and half size) lies outside the viewport grown by VISIBLE_BAND; 0 when it counts as on screen. */
export function offscreen(box, vw, vh) {
  const dx = Math.max(0, -VISIBLE_BAND - (box.x + box.hw), box.x - box.hw - (vw + VISIBLE_BAND))
  const dy = Math.max(0, -VISIBLE_BAND - (box.y + box.hh), box.y - box.hh - (vh + VISIBLE_BAND))
  return Math.max(dx, dy)
}

/**
 * @param {{ cardDpr?: number, shadow?: 'shader' | 'css', budget?: number, now?: () => number,
 *   renderers?: { acquire(): object | null, release(r: object): void, renew(canvas: HTMLCanvasElement): object | null } }} opts
 *   `cardDpr`: the cards' device-pixel cap (3 = the approved look; 2 halves their memory).
 *   `shadow`: 'shader' draws the contact shadow in the sprite (the approved look); 'css' gives it to the
 *   element's box-shadow through --glass-edge, which is approximate but keeps sprites small.
 *   `budget`: bytes sprites plus the atlas may hold. An element that would exceed it keeps the CSS material
 *   (per element, like an atlas-skipped one) and is asked again on every draw; the stage is never touched.
 *   `renderers`: glass-gl.js's pool (the atlas renderer and its canvas), and a new renderer on the same canvas
 *   after a lost context is restored; tests inject fakes.
 * @returns {{ mount(hooks: { onReady(el: Element): void, onRelease(el: Element): void, onLost(): void, onRestored(): void }): boolean,
 *   draw(shapes: object[], material: object, look: object, ctx: { lookId: string, keep(el: Element): boolean }): { drew: boolean, pending: boolean },
 *   restore(host: Element, canvas: Element): void, isReady(el: Element): boolean, stats(): object, bytes(): number, dispose(): void }}
 * `draw` takes this frame's in-flow shapes, each with its swollen silhouette (x, y, hw, hh, radius) and its
 * element's own box (`box`: x, y, hw, hh), its press and touch. `keep(el)`: the shape is still near, so a
 * sprite missing from this frame's list is kept rather than released.
 */
export function createSpritePresenter({
  cardDpr = MAX_DPR, shadow = SHADOW.SHADER, budget = SPRITE_BUDGET_BYTES, now = () => performance.now(),
  renderers = { acquire: acquireGlassGL, release: releaseGlassGL, renew: createGlassGL },
} = {}) {
  /** @type {Map<Element, object>} */
  const sprites = new Map()
  let lastMove = -Infinity // when any sprite last moved
  const peak = { w: 0, h: 0, since: -Infinity } // the largest atlas a frame needed since `since` (the shrink window)
  const last = { drawMs: 0, copyMs: 0, refreshed: 0, pages: 0, skipped: 0, contentLag: 0, over: 0 }
  let released = 0 // sprites given back so far: a rise means memory was freed
  let atlas = null
  let gl = null
  let hooks = null
  let matRef = null
  let matKey = ''
  const cleanups = []

  function mount(h) {
    hooks = h
    gl = renderers.acquire()
    if (!gl) return false
    atlas = gl.canvas // detached: only ever read from
    const onLost = e => {
      e.preventDefault() // without it the browser never restores the context
      gl = null
      for (const sp of sprites.values()) { sp.drawn = null; sp.ready = false }
      hooks.onLost()
    }
    const onRestored = () => {
      gl = renderers.renew(atlas)
      if (gl) hooks.onRestored()
    }
    atlas.addEventListener('webglcontextlost', onLost)
    atlas.addEventListener('webglcontextrestored', onRestored)
    cleanups.push(() => {
      atlas.removeEventListener('webglcontextlost', onLost)
      atlas.removeEventListener('webglcontextrestored', onRestored)
    })
    return true
  }

  const dprFor = kind => Math.min(window.devicePixelRatio || 1, kind === KIND.CARD ? Math.min(cardDpr, MAX_DPR) : MAX_DPR)

  // Reads for a new host, done before any write: whether it needs position: relative, its borders (the
  // sprite is placed against the padding box) and whether it clips (a clipped host can't show a shadow
  // drawn outside it, so it takes the CSS shadow).
  function hostFacts(el) {
    const cs = getComputedStyle(el)
    const clipped = v => !!v && v !== 'visible'
    return {
      static: !cs.position || cs.position === 'static',
      clips: clipped(cs.overflowX) || clipped(cs.overflowY),
      borders: [cs.borderLeftWidth, cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth].map(v => parseFloat(v) || 0),
    }
  }

  // A sprite canvas for `sp`, appended to its element; false (nothing appended) when the browser refuses a 2D
  // context, which iOS does under canvas memory pressure: that element keeps the CSS material.
  function attach(sp) {
    const { el, facts } = sp
    const canvas = document.createElement('canvas')
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return false
    canvas.className = SPRITE_CLASS
    canvas.setAttribute('aria-hidden', 'true')
    const [bl, bt, br, bb] = facts.borders
    if (bl || bt || br || bb) {
      canvas.style.setProperty('--lg-bl', `${bl}px`)
      canvas.style.setProperty('--lg-bt', `${bt}px`)
      canvas.style.setProperty('--lg-br', `${br}px`)
      canvas.style.setProperty('--lg-bb', `${bb}px`)
    }
    canvas.style.setProperty('--lg-m', `${sp.margin}px`)
    if (facts.static) el.setAttribute('data-lg-static', '')
    el.appendChild(canvas)
    sp.canvas = canvas
    sp.ctx = ctx2d
    return true
  }

  function release(el) {
    const sp = sprites.get(el)
    if (!sp) return
    sprites.delete(el)
    released++
    if (sp.canvas) {
      sp.canvas.width = 0
      sp.canvas.height = 0
      sp.canvas.remove()
    }
    el.removeAttribute('data-lg-sprite')
    el.removeAttribute('data-lg-static')
    el.removeAttribute('data-lg-edge')
    hooks?.onRelease(el)
  }

  // R5: React removed our canvas (a textContent update wipes every child); put it back, content intact.
  function restore(host, canvas) {
    const sp = sprites.get(host)
    if (sp && sp.canvas === canvas && host.isConnected && !canvas.isConnected) host.appendChild(canvas)
  }

  function ready(sp) {
    if (sp.ready || !sprites.has(sp.el)) return
    sp.ready = true
    hooks.onReady(sp.el)
  }

  function copyInto(sp, r) {
    const { canvas, ctx } = sp
    if (canvas.width !== r.w || canvas.height !== r.h) { canvas.width = r.w; canvas.height = r.h }
    ctx.globalCompositeOperation = 'copy' // the region replaces the sprite, transparent pixels included
    ctx.drawImage(atlas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h)
    ready(sp)
  }

  // Frees at least `bytes` for an element on screen: sprites outside this frame's list first (they are past
  // the read band), then this frame's off-screen ones, farthest first. Those in `live` are marked `evicted`
  // so the draw leaves them on the CSS material this frame. @returns {number} the bytes freed
  function evict(bytes, live) {
    const listed = new Set(live.map(e => e.sp))
    const victims = [
      ...[...sprites.values()].filter(sp => sp.canvas && !listed.has(sp)).map(sp => ({ sp, e: null })),
      ...live.filter(e => e.dist > 0 && e.sp.canvas && !e.evicted).sort((a, b) => b.dist - a.dist).map(e => ({ sp: e.sp, e })),
    ]
    let freed = 0
    for (const { sp, e } of victims) {
      if (freed >= bytes) break
      freed += sp.canvas.width * sp.canvas.height * 4
      if (e) e.evicted = true
      release(sp.el)
    }
    return freed
  }

  // One atlas size for the frame: it grows to fit at once, and shrinks to the largest size a frame needed
  // once a whole SHRINK_MS window needed less than half of it (the copy's cost grows with the atlas size,
  // and a press or a single refresh must never reallocate it).
  function atlasSize(pages, t) {
    const needW = Math.min(ATLAS_WIDTH, roundUp(Math.max(0, ...pages.map(p => p.width))))
    const needH = Math.min(ATLAS_MAX_HEIGHT, roundUp(Math.max(0, ...pages.map(p => p.height))))
    let W = Math.max(needW, atlas.width)
    let H = Math.max(needH, atlas.height)
    peak.w = Math.max(peak.w, needW)
    peak.h = Math.max(peak.h, needH)
    if (t - peak.since >= SHRINK_MS) {
      if (peak.w * peak.h * 2 <= W * H) { W = peak.w; H = peak.h }
      Object.assign(peak, { w: needW, h: needH, since: t })
    }
    return { W, H }
  }

  function draw(shapes, material, look, ctx) {
    const t = now()
    const seen = new Set()
    if (!gl) {
      for (const el of [...sprites.keys()]) if (!ctx.keep(el)) release(el)
      return { drew: false, pending: false }
    }
    if (material !== matRef) { matRef = material; matKey = JSON.stringify(material) }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const lookDpr = Math.min(window.devicePixelRatio || 1, LOOK_MAX_DPR)
    const lv = lookUniformValues({ ...look, w: Math.round(vw * lookDpr), h: Math.round(vh * lookDpr), dpr: lookDpr })
    const dyn = JSON.stringify(lv)

    const live = []
    const fresh = []
    for (const s of shapes) {
      if (!canHost(s.el)) continue
      seen.add(s.el)
      let sp = sprites.get(s.el)
      if (!sp) {
        sp = { el: s.el, canvas: null, ctx: null, drawn: null, prev: null, ready: false, facts: null, sizeKey: '', at: -Infinity }
        sprites.set(s.el, sp)
        fresh.push(sp)
      }
      live.push({ s, sp })
    }
    // Reads for new hosts first, then every write.
    for (const sp of fresh) sp.facts = hostFacts(sp.el)
    const releasedBefore = released
    // Far sprites go first, so the memory budget below already has their room.
    for (const el of [...sprites.keys()]) if (!seen.has(el) && !ctx.keep(el)) release(el)

    // Each element's sprite geometry and how far off screen it is; on-screen elements claim memory first.
    for (const e of live) {
      const { s, sp } = e
      e.kind = s.kind === KIND.CARD ? KIND.CARD : KIND.CONTROL
      e.edge = shadow === SHADOW.CSS || sp.facts.clips
      e.margin = e.edge ? SPRITE_MARGIN : shadowMargin(e.kind, s.box.hw, s.box.hh)
      e.dpr = dprFor(e.kind)
      e.w = Math.max(1, Math.round((s.box.hw * 2 + e.margin * 2) * e.dpr))
      e.h = Math.max(1, Math.round((s.box.hh * 2 + e.margin * 2) * e.dpr))
      e.sizeKey = `${e.kind}|${e.edge}|${e.margin}|${e.dpr}|${e.w}|${e.h}|${s.box.hw.toFixed(2)}|${s.box.hh.toFixed(2)}|${s.radius.toFixed(2)}`
      e.dist = offscreen(s.box, vw, vh)
    }
    live.sort((a, b) => a.dist - b.dist)

    let moving = false
    let over = 0
    // The atlas is reserved at its cap: it can grow after this check, within the same frame.
    let used = spriteBytes() + ATLAS_MAX_BYTES
    const kept = []
    const cands = []
    for (const e of live) {
      const { s, sp } = e
      if (e.evicted) { over++; continue } // gave its room to an element on screen this frame
      const { kind, edge, margin, w, h, sizeKey } = e
      if (sp.kind !== kind) { sp.kind = kind; s.el.setAttribute('data-lg-sprite', kind) }
      if (sp.edge !== edge) { sp.edge = edge; if (edge) s.el.setAttribute('data-lg-edge', ''); else s.el.removeAttribute('data-lg-edge') }
      if (sp.margin !== margin) { sp.margin = margin; if (sp.canvas) sp.canvas.style.setProperty('--lg-m', `${margin}px`) }
      Object.assign(sp, { dpr: e.dpr, w, h })
      if (sp.prev && (Math.abs(sp.prev.x - s.box.x) > MOVE_EPS || Math.abs(sp.prev.y - s.box.y) > MOVE_EPS)) moving = true
      sp.prev = { x: s.box.x, y: s.box.y }
      const d = sp.drawn
      const touch = s.touch ? `${s.touch[0].toFixed(1)},${s.touch[1].toFixed(1)}` : ''
      // Larger than the atlas, or no 2D context for its size: it keeps the CSS material.
      if (sp.skip === sizeKey) continue
      if (w + PAD > ATLAS_WIDTH || h + PAD > ATLAS_MAX_HEIGHT) { sp.skip = sizeKey; continue }
      const visible = e.dist === 0
      // Over the memory budget: an element on screen first takes the room of sprites off screen, farthest
      // first; otherwise this element alone keeps (or goes back to) the CSS material. It is asked again on
      // every draw, so it gets its sprite as soon as others are released.
      if (!sp.canvas || sp.sizeKey !== sizeKey) {
        const own = sp.canvas ? sp.canvas.width * sp.canvas.height * 4 : 0
        const need = w * h * 4
        if (visible && used - own + need > budget) used -= evict(used - own + need - budget, live)
        if (used - own + need > budget) {
          over++
          if (sp.canvas) { release(s.el); used -= own }
          continue
        }
        used += need - own
      }
      // Scroll and look refreshes are for sprites on screen (VISIBLE_BAND px early); one that comes on
      // screen stale is first in the queue.
      const entering = visible && !sp.visible
      sp.visible = visible
      const moved = !!d && (Math.abs(d.x - s.box.x) > MOVE_EPS || Math.abs(d.y - s.box.y) > MOVE_EPS)
      const lookStale = !!d && d.dyn !== dyn
      const changed = !d || sp.sizeKey !== sizeKey || d.stat !== ctx.lookId || d.mat !== matKey
      kept.push(e)
      cands.push({
        urgent: changed && visible,
        pressed: !!d && (d.press !== s.press || d.touch !== touch),
        soon: (changed && !visible) || (entering && (moved || lookStale)),
        moved: visible && moved,
        look: visible && lookStale,
        at: sp.at,
        px: w * h,
        lag: visible && d ? Math.hypot(d.x - s.box.x, d.y - s.box.y) : 0,
        touch,
      })
    }
    if (moving) lastMove = t

    last.over = over
    // The frame budget is for scrolling, where a heavy frame shows as a hitch. At rest (look ticks, the
    // settle refresh) one batch costs least: one atlas render and one copy of it per tick, then idle.
    const settled = t - lastMove >= SETTLE_MS
    const plan = planRefresh(cands, t, { settled, budgetPx: settled ? Infinity : FRAME_PX })
    // Memory was freed while an element waits: draw once more so it can take the room.
    if (over > 0 && released !== releasedBefore) plan.pending = true
    // What the refraction is off by after this frame: how far each sprite left un-refreshed has moved.
    const refreshed = new Set(plan.refresh)
    last.contentLag = cands.reduce((m, c, i) => (refreshed.has(i) ? m : Math.max(m, c.lag)), 0)

    const jobs = []
    for (const i of plan.refresh) {
      const e = kept[i]
      if (!e.sp.canvas && !attach(e.sp)) { e.sp.skip = e.sizeKey; continue }
      jobs.push({ ...e, c: cands[i] })
    }
    if (!jobs.length) { last.refreshed = 0; return { drew: false, pending: plan.pending } }
    const { pages, skipped } = packShelves(jobs.map(j => ({ key: j, w: j.w, h: j.h })))
    for (const j of skipped) j.sp.skip = j.sizeKey
    const { W, H } = atlasSize(pages, t)

    let drawMs = 0
    let copyMs = 0
    for (const page of pages) {
      const glShapes = page.placed.map(({ key: j, x, y }) => {
        const { s, sp } = j
        const bx = s.box.x - s.box.hw - sp.margin
        const by = s.box.y - s.box.hh - sp.margin
        return {
          kind: sp.kind, x: s.x, y: s.y, hw: s.hw, hh: s.hh, radius: s.radius, press: s.press, touch: s.touch,
          centreA: 1, opacity: 1, margin: sp.margin, shadow: !sp.edge,
          clip: [bx, by, s.box.x + s.box.hw + sp.margin, s.box.y + s.box.hh + sp.margin],
          place: [x - bx * sp.dpr, y - by * sp.dpr, sp.dpr],
        }
      })
      const t0 = now()
      gl.draw({ width: vw, height: vh, dpr: Math.min(window.devicePixelRatio || 1, MAX_DPR), stage: [vw, vh], look: lv, material, shapes: glShapes, atlas: { width: W, height: H } })
      const t1 = now()
      for (const { key: j, x, y, w, h } of page.placed) {
        copyInto(j.sp, { x, y, w, h })
        j.sp.sizeKey = j.sizeKey
        j.sp.at = t
        j.sp.drawn = { x: j.s.box.x, y: j.s.box.y, press: j.s.press, touch: j.c.touch, dyn, stat: ctx.lookId, mat: matKey }
      }
      drawMs += t1 - t0
      copyMs += now() - t1
    }
    const drew = pages.length > 0
    Object.assign(last, { drawMs, copyMs, refreshed: jobs.length - skipped.length, pages: pages.length, skipped: skipped.length })
    return { drew, pending: plan.pending }
  }

  const isReady = el => !!sprites.get(el)?.ready

  const spriteBytes = () => {
    let n = 0
    for (const sp of sprites.values()) if (sp.canvas) n += sp.canvas.width * sp.canvas.height * 4
    return n
  }
  const bytes = () => (atlas ? atlas.width * atlas.height * 4 : 0) + spriteBytes()

  const stats = () => ({ ...last, sprites: sprites.size, atlasW: atlas?.width || 0, atlasH: atlas?.height || 0, budget })

  function dispose() {
    for (const el of [...sprites.keys()]) release(el)
    cleanups.forEach(fn => fn())
    cleanups.length = 0
    if (gl) renderers.release(gl)
    gl = null
    atlas = null
  }

  return { mount, draw, restore, isReady, stats, bytes, dispose }
}
