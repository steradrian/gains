import { lookUniformValues } from '../../lib/stage-look/renderer.js'
import { acquireGlassGL, createGlassGL, releaseGlassGL } from './glass-gl.js'
import { KIND, STRENGTH } from './glass-kinds.js'
import { SPRITE_CLASS } from './glass-registry.js'

// Liquid glass, the sprite presenter (plan 2.3, M3): in-flow glass is drawn into canvases that live inside
// their own elements, so scrolling (WKWebView's async scroll included), sticky headers, route slides,
// presence fades, nested scrollers and overflow clips move and cut the glass exactly, because the browser
// composites it with the element. Chrome stays on the fixed presenter's over strip.
//
// One hidden WebGL "atlas" (glass-gl.js in atlas mode) draws every shape that needs a refresh into a packed
// region, evaluated at the element's real viewport position, so the refraction samples the stage that is
// really behind it. Each region is then copied into the element's sprite: `<canvas class="g-lg-sprite">`,
// appended last, aria-hidden, absolutely placed `--lg-m` px outside the element's border box at z-index -1
// (ds.css "Liquid glass: sprites"). The material is the fixed presenter's, shape for shape: same shader,
// same per-kind optics, the press swell and the contact shadow drawn in the sprite (its margin holds the
// shadow), at the fixed presenter's device-pixel ratio unless `cardDpr` lowers the cards'.
//
// Only the refraction's content can lag, and only when the element moves: a scroll refreshes the sprites
// on screen at most 12 times a second plus once exactly 120 ms after it stops, a look tick at most 15
// times a second, a press every frame for the pressed element. A size, kind, material, look or pushed
// change refreshes at once, and so does a stale sprite coming on screen. Sprites are made for shapes up to
// half a viewport away (the engine's read band) and a shape more than a viewport away (the registry's
// `near`) gives its sprite back (`width = height = 0`, removed) and returns to the CSS material.
//
// Copy paths, both kept until M7 (the dev HUD measures them):
//   draw2d: a 2D context per sprite, `drawImage(atlas, sx, sy, sw, sh, 0, 0, sw, sh)`;
//   bitmap: `createImageBitmap(atlas, sx, sy, sw, sh)` then `bitmaprenderer.transferFromImageBitmap`.

export const SPRITE_MARGIN = 4 // CSS px: room for the press swell when the shadow is CSS
export const ATLAS_WIDTH = 2048
export const ATLAS_MAX_BYTES = 8 * 1024 * 1024
export const ATLAS_MAX_HEIGHT = Math.floor(ATLAS_MAX_BYTES / 4 / ATLAS_WIDTH)
export const COPY = Object.freeze({ DRAW: 'draw2d', BITMAP: 'bitmap' })
export const SHADOW = Object.freeze({ SHADER: 'shader', CSS: 'css' })
export const SCROLL_MS = 1000 / 12
export const SETTLE_MS = 120
export const LOOK_MS = 1000 / 15
const PAD = 2 // px between atlas regions
const ROUND = 64 // atlas sizes step, so a slightly larger set doesn't reallocate
const MAX_DPR = 3
const LOOK_MAX_DPR = 2 // StageLook's own cap, as in presenter-fixed.js
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
 * Which sprites refresh this frame (pure). `cands`: [{ hard, pressed, moved, look }]: a change that refreshes
 * at once, a press in flight, the element moved since its last copy, the look ticked since. `clock`:
 * { lastScroll, lastLook, lastMove } in ms. Moved sprites refresh together at most every SCROLL_MS, and all
 * of them once the movement has been still for SETTLE_MS; look-stale ones together at most every LOOK_MS.
 * @returns {{ refresh: number[], scroll: boolean, look: boolean, pending: boolean }} `pending`: a stale sprite
 *   waits for its throttle, so the caller must keep its loop running.
 */
export function planRefresh(cands, clock, now) {
  const scrollDue = now - clock.lastScroll >= SCROLL_MS || now - clock.lastMove >= SETTLE_MS
  const lookDue = now - clock.lastLook >= LOOK_MS
  const refresh = []
  let scroll = false
  let look = false
  let pending = false
  cands.forEach((c, i) => {
    // Only a throttled refresh restarts its throttle: during a fling a sprite comes on screen (a refresh at
    // once) nearly every frame, and if that counted, the sprites already on screen would never refresh.
    const byScroll = c.moved && scrollDue
    const byLook = c.look && lookDue
    if (c.hard || c.pressed || byScroll || byLook) {
      refresh.push(i)
      if (!c.hard && !c.pressed) {
        if (byScroll) scroll = true
        if (byLook) look = true
      }
    } else if (c.moved || c.look) {
      pending = true
    }
  })
  return { refresh, scroll, look, pending }
}

const roundUp = n => Math.max(ROUND, Math.ceil(n / ROUND) * ROUND)

/**
 * @param {{ copy?: 'draw2d' | 'bitmap', cardDpr?: number, shadow?: 'shader' | 'css', now?: () => number,
 *   renderers?: { acquire(): object | null, release(r: object): void, renew(canvas: HTMLCanvasElement): object | null } }} opts
 *   `cardDpr`: the cards' device-pixel cap (3 = the fixed presenter's, so the same material; 2 halves their memory).
 *   `shadow`: 'shader' draws the contact shadow in the sprite (the fixed presenter's); 'css' gives it to the
 *   element's box-shadow through --glass-edge, which is approximate but keeps sprites small.
 *   `renderers`: glass-gl.js's pool (the atlas renderer and its canvas), and a new renderer on the same canvas
 *   after a lost context is restored; tests inject fakes.
 * @returns {{ mount(hooks: { onReady(el: Element): void, onRelease(el: Element): void, onLost(): void, onRestored(): void,
 *     onCopy?(transferMs: number, latencyMs: number): void }): boolean,
 *   draw(shapes: object[], material: object, look: object, ctx: { lookId: string, keep(el: Element): boolean }): { drew: boolean, pending: boolean },
 *   restore(host: Element, canvas: Element): void, isReady(el: Element): boolean, stats(): object, bytes(): number, dispose(): void }}
 * `draw` takes this frame's in-flow shapes, each with its swollen silhouette (x, y, hw, hh, radius) and its
 * element's own box (`box`: x, y, hw, hh), its press and touch. `keep(el)`: the shape is still near, so a
 * sprite missing from this frame's list is kept rather than released.
 */
export function createSpritePresenter({
  copy = COPY.DRAW, cardDpr = MAX_DPR, shadow = SHADOW.SHADER, now = () => performance.now(),
  renderers = { acquire: acquireGlassGL, release: releaseGlassGL, renew: createGlassGL },
} = {}) {
  /** @type {Map<Element, object>} */
  const sprites = new Map()
  const clock = { lastScroll: -Infinity, lastLook: -Infinity, lastMove: -Infinity }
  const last = { drawMs: 0, copyMs: 0, refreshed: 0, pages: 0, skipped: 0, contentLag: 0 }
  let atlas = null
  let gl = null
  let hooks = null
  let copyMode = copy
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
      for (const sp of sprites.values()) { sp.drawn = null; sp.ready = false; sp.gen++ }
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
    if (copyMode === COPY.BITMAP && typeof createImageBitmap !== 'function') copyMode = COPY.DRAW
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

  function attach(sp) {
    const { el, facts } = sp
    const canvas = document.createElement('canvas')
    canvas.className = SPRITE_CLASS
    canvas.setAttribute('aria-hidden', 'true')
    const [bl, bt, br, bb] = facts.borders
    if (bl || bt || br || bb) {
      canvas.style.setProperty('--lg-bl', `${bl}px`)
      canvas.style.setProperty('--lg-bt', `${bt}px`)
      canvas.style.setProperty('--lg-br', `${br}px`)
      canvas.style.setProperty('--lg-bb', `${bb}px`)
    }
    if (facts.static) el.setAttribute('data-lg-static', '')
    el.appendChild(canvas)
    let ctx = copyMode === COPY.BITMAP ? canvas.getContext('bitmaprenderer') : null
    if (!ctx) {
      if (copyMode === COPY.BITMAP) copyMode = COPY.DRAW // no bitmaprenderer here: every sprite copies with drawImage
      ctx = canvas.getContext('2d')
    }
    sp.canvas = canvas
    sp.ctx = ctx
    sp.mode = copyMode
  }

  function release(el) {
    const sp = sprites.get(el)
    if (!sp) return
    sprites.delete(el)
    sp.gen++
    if (sp.canvas) {
      if (sp.mode === COPY.BITMAP) try { sp.ctx?.transferFromImageBitmap(null) } catch { /* already empty */ }
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
    if (sp.mode === COPY.BITMAP) {
      // The snapshot is taken now, in this task (the atlas's buffer is not preserved past it); the transfer
      // lands later, and the resize waits for it, since resizing would blank the sprite in between.
      const gen = ++sp.gen
      const asked = now()
      createImageBitmap(atlas, r.x, r.y, r.w, r.h).then(bmp => {
        if (gen !== sp.gen || !sprites.has(sp.el)) { bmp.close?.(); return }
        const t0 = now()
        if (canvas.width !== r.w || canvas.height !== r.h) { canvas.width = r.w; canvas.height = r.h }
        ctx.transferFromImageBitmap(bmp)
        ready(sp)
        hooks.onCopy?.(now() - t0, now() - asked)
      }, () => {})
      return
    }
    if (canvas.width !== r.w || canvas.height !== r.h) { canvas.width = r.w; canvas.height = r.h }
    ctx.globalCompositeOperation = 'copy' // the region replaces the sprite, transparent pixels included
    ctx.drawImage(atlas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h)
    ready(sp)
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
    const cands = []
    const fresh = []
    for (const s of shapes) {
      if (!canHost(s.el)) continue
      seen.add(s.el)
      let sp = sprites.get(s.el)
      if (!sp) {
        sp = { el: s.el, canvas: null, ctx: null, mode: copyMode, drawn: null, prev: null, ready: false, gen: 0, facts: null, sizeKey: '' }
        sprites.set(s.el, sp)
        fresh.push(sp)
      }
      live.push({ s, sp })
    }
    // Reads for new hosts first, then every write.
    for (const sp of fresh) sp.facts = hostFacts(sp.el)

    let moving = false
    const kept = []
    for (const { s, sp } of live) {
      const kind = s.kind === KIND.CARD ? KIND.CARD : KIND.CONTROL
      const edge = shadow === SHADOW.CSS || sp.facts.clips
      const margin = edge ? SPRITE_MARGIN : shadowMargin(kind, s.box.hw, s.box.hh)
      const dpr = dprFor(kind)
      const w = Math.max(1, Math.round((s.box.hw * 2 + margin * 2) * dpr))
      const h = Math.max(1, Math.round((s.box.hh * 2 + margin * 2) * dpr))
      const sizeKey = `${kind}|${edge}|${margin}|${dpr}|${w}|${h}|${s.box.hw.toFixed(2)}|${s.box.hh.toFixed(2)}|${s.radius.toFixed(2)}`
      if (sp.kind !== kind) { sp.kind = kind; s.el.setAttribute('data-lg-sprite', kind) }
      if (sp.edge !== edge) { sp.edge = edge; if (edge) s.el.setAttribute('data-lg-edge', ''); else s.el.removeAttribute('data-lg-edge') }
      if (sp.margin !== margin) { sp.margin = margin; if (sp.canvas) sp.canvas.style.setProperty('--lg-m', `${margin}px`) }
      Object.assign(sp, { dpr, w, h })
      if (sp.prev && (Math.abs(sp.prev.x - s.box.x) > MOVE_EPS || Math.abs(sp.prev.y - s.box.y) > MOVE_EPS)) moving = true
      sp.prev = { x: s.box.x, y: s.box.y }
      const d = sp.drawn
      const touch = s.touch ? `${s.touch[0].toFixed(1)},${s.touch[1].toFixed(1)}` : ''
      if (sp.skip === sizeKey) continue // larger than the atlas: it keeps the CSS material
      // Scroll and look refreshes are for sprites on screen; one that comes on screen stale refreshes at
      // once, VISIBLE_BAND px before it shows.
      const visible = s.box.y + s.box.hh > -VISIBLE_BAND && s.box.y - s.box.hh < vh + VISIBLE_BAND
        && s.box.x + s.box.hw > -VISIBLE_BAND && s.box.x - s.box.hw < vw + VISIBLE_BAND
      const entering = visible && !sp.visible
      sp.visible = visible
      const moved = !!d && (Math.abs(d.x - s.box.x) > MOVE_EPS || Math.abs(d.y - s.box.y) > MOVE_EPS)
      const lookStale = !!d && d.dyn !== dyn
      kept.push({ s, sp })
      cands.push({
        hard: !d || sp.sizeKey !== sizeKey || d.stat !== ctx.lookId || d.mat !== matKey || (entering && (moved || lookStale)),
        pressed: !!d && (d.press !== s.press || d.touch !== touch),
        moved: visible && moved,
        look: visible && lookStale,
        lag: visible && d ? Math.hypot(d.x - s.box.x, d.y - s.box.y) : 0,
        sizeKey,
        touch,
      })
    }
    if (moving) clock.lastMove = t

    for (const el of [...sprites.keys()]) if (!seen.has(el) && !ctx.keep(el)) release(el)

    const plan = planRefresh(cands, clock, t)
    if (plan.scroll) clock.lastScroll = t
    if (plan.look) clock.lastLook = t
    // What the refraction is off by after this frame: how far each sprite left un-refreshed has moved.
    const refreshed = new Set(plan.refresh)
    last.contentLag = cands.reduce((m, c, i) => (refreshed.has(i) ? m : Math.max(m, c.lag)), 0)
    if (!plan.refresh.length) { last.refreshed = 0; return { drew: false, pending: plan.pending } }

    const jobs = plan.refresh.map(i => ({ ...kept[i], c: cands[i] }))
    const { pages, skipped } = packShelves(jobs.map(j => ({ key: j, w: j.sp.w, h: j.sp.h })))
    for (const j of skipped) j.sp.skip = j.c.sizeKey
    for (const page of pages) {
      for (const { key: j } of page.placed) {
        if (j.sp.canvas) continue
        attach(j.sp)
        j.sp.canvas.style.setProperty('--lg-m', `${j.sp.margin}px`)
      }
    }
    // One atlas size for the whole refresh: grow to fit; shrink only when a refresh of every sprite needs
    // less than half, so a press never reallocates it.
    const needW = Math.min(ATLAS_WIDTH, roundUp(Math.max(0, ...pages.map(p => p.width))))
    const needH = Math.min(ATLAS_MAX_HEIGHT, roundUp(Math.max(0, ...pages.map(p => p.height))))
    const shrink = jobs.length === kept.length && needW * needH * 2 < atlas.width * atlas.height
    const W = shrink ? needW : Math.max(needW, atlas.width)
    const H = shrink ? needH : Math.max(needH, atlas.height)

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
        j.sp.sizeKey = j.c.sizeKey
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

  const bytes = () => {
    let n = atlas ? atlas.width * atlas.height * 4 : 0
    for (const sp of sprites.values()) if (sp.canvas) n += sp.canvas.width * sp.canvas.height * 4
    return n
  }

  const stats = () => ({ ...last, sprites: sprites.size, atlasW: atlas?.width || 0, atlasH: atlas?.height || 0, copy: copyMode })

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
