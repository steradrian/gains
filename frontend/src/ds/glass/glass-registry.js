import { glassKind, isInteractive, KIND } from './glass-kinds.js'

// Liquid glass registry: which elements under a ground are glass, and what each one costs to read.
// A MutationObserver keeps the shape set, a ResizeObserver and class changes re-read the cached facts
// (kind, corner radius, inset, clip ancestor, route layer), an IntersectionObserver keeps `near`.
// `read()` is the per-frame call: rects first, batched, no writes in between.

export const SELECTOR = '.g-glass, .g-btn-glass, [data-glass]'
const ATTRS = ['class', 'data-glass', 'data-glass-inset', 'hidden', 'open', 'inert']
const OFFSCREEN = 80
const NO_BAR = null
const MARK = 'data-lg-on'

// The element's corner radius in px (a % or a pill radius clamps to a capsule).
function cornerOf(el, hw, hh) {
  const raw = getComputedStyle(el).borderTopLeftRadius
  const cap = Math.min(hw, hh)
  if (!raw || raw.endsWith('%')) return cap
  const r = parseFloat(raw)
  return Number.isFinite(r) && r > 0 ? Math.min(r, cap) : cap
}

// An empty computed value (a style engine with no cascade) is the initial value: visible, opaque.
const clips = v => !!v && v !== 'visible'
const opacityOf = el => {
  const o = parseFloat(getComputedStyle(el).opacity)
  return Number.isNaN(o) ? 1 : o
}

// The nearest ancestor below the ground that clips its children (overflow other than visible).
function clipAncestor(el, ground) {
  for (let p = el.parentElement; p && p !== ground; p = p.parentElement) {
    const cs = getComputedStyle(p)
    if (clips(cs.overflowX) || clips(cs.overflowY)) return p
  }
  return null
}

/**
 * @param {Element} ground the root the glass lives under (the stage's .g-root)
 * @param {{ onChange?: (reason: string) => void, exclude?: string }} opts
 *   `exclude`: a selector for subtrees that are never lensed (sheets, the search overlay); they keep the CSS material.
 *   `include`: when set, only shapes inside a match of this selector are taken (the app's ground is the body).
 * Shapes that are drawn carry `data-lg-on` once `setMarked(true)` is called (the host does it with the first
 * draw), which is what ds.css "Liquid glass" keys the transparent fill on.
 */
export function createRegistry(ground, { onChange = () => {}, exclude = '#modal-root, .search-ov', include = '' } = {}) {
  /** @type {Map<Element, object>} */
  const shapes = new Map()
  let marked = false
  const hasIO = typeof IntersectionObserver === 'function'
  const hasRO = typeof ResizeObserver === 'function'

  const io = hasIO ? new IntersectionObserver(entries => {
    let moved = false
    for (const e of entries) {
      const s = shapes.get(e.target)
      if (s && s.near !== e.isIntersecting) { s.near = e.isIntersecting; moved = true }
    }
    if (moved) onChange('near')
  }, { rootMargin: '50%' }) : null

  const facts = (el, parentKind) => {
    const kind = glassKind(el, parentKind)
    if (kind === KIND.FLAT) return null
    const r = el.getBoundingClientRect()
    const bar = kind === KIND.LENS ? el.parentElement?.closest('[data-glass="bar"]') : null
    return {
      kind,
      radius: cornerOf(el, r.width / 2, r.height / 2),
      inset: +(el.dataset.glassInset || 0),
      clipEl: clipAncestor(el, ground),
      layerEl: el.closest('.g-route'),
      barEl: bar || null,
      pressable: kind !== KIND.CARD || isInteractive(el),
    }
  }

  // Re-reads the cached facts of one shape; false when it has gone flat and must be dropped.
  const refresh = el => {
    const s = shapes.get(el)
    if (!s) return true
    const next = facts(el, s.parentKind)
    if (!next) return false
    Object.assign(s, next)
    return true
  }

  const ro = hasRO ? new ResizeObserver(entries => {
    let dropped = false
    for (const e of entries) if (!refresh(e.target)) { drop(e.target); dropped = true }
    onChange(dropped ? 'dom' : 'resize')
  }) : null

  function drop(el) {
    shapes.delete(el)
    el.removeAttribute(MARK)
    io?.unobserve(el)
    ro?.unobserve(el)
  }

  function scan(dirty = null) {
    const next = new Map()
    for (const el of ground.querySelectorAll(SELECTOR)) {
      if (exclude && el.closest(exclude)) continue
      if (include && !el.closest(include)) continue
      if (el.closest('[hidden]')) continue
      const parent = el.parentElement?.closest(SELECTOR)
      const parentKind = (parent && next.get(parent)?.kind) || null
      let s = shapes.get(el)
      if (!s || dirty?.has(el) || s.parentKind !== parentKind) {
        const f = facts(el, parentKind)
        if (!f) continue
        s = s ? Object.assign(s, f, { parentKind }) : { el, near: true, parentKind, ...f }
      }
      next.set(el, s)
    }
    for (const el of [...shapes.keys()]) if (!next.has(el)) drop(el)
    for (const [el, s] of next) {
      if (shapes.has(el)) continue
      shapes.set(el, s)
      if (marked) el.setAttribute(MARK, '')
      io?.observe(el)
      ro?.observe(el)
    }
  }

  const mo = new MutationObserver(records => {
    const dirty = new Set()
    for (const r of records) if (r.type === 'attributes') dirty.add(r.target)
    scan(dirty)
    onChange('dom')
  })
  mo.observe(ground, { subtree: true, childList: true, attributes: true, attributeFilter: ATTRS })
  scan()

  /**
   * The shapes to draw this frame, as plain data: centre and half size (the inset trimmed off each side),
   * corner radius, opacity (the element's times its route layer's), the clip rect of its clipping ancestor
   * and, for a lens, its bar's rect. Shapes far outside the viewport and invisible ones are left out.
   */
  function read() {
    const rects = new Map()
    const rectOf = el => {
      let r = rects.get(el)
      if (!r) { r = el.getBoundingClientRect(); rects.set(el, r) }
      return r
    }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const out = []
    // All reads, no writes: one layout.
    const layerOpacity = new Map()
    for (const s of shapes.values()) {
      if (!s.near) continue
      const r = rectOf(s.el)
      if (r.width < 1 || r.height < 1 || r.bottom < -OFFSCREEN || r.top > vh + OFFSCREEN || r.right < -OFFSCREEN || r.left > vw + OFFSCREEN) continue
      let opacity = opacityOf(s.el)
      if (s.layerEl) {
        let lo = layerOpacity.get(s.layerEl)
        if (lo === undefined) { lo = opacityOf(s.layerEl); layerOpacity.set(s.layerEl, lo) }
        opacity *= lo
      }
      if (opacity < 0.01) continue
      const c = s.clipEl && rectOf(s.clipEl)
      const b = s.barEl ? rectOf(s.barEl) : NO_BAR
      out.push({
        el: s.el,
        kind: s.kind,
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        hw: r.width / 2 - s.inset,
        hh: r.height / 2,
        radius: s.radius,
        opacity,
        clip: c ? [c.left, c.top, c.right, c.bottom] : null,
        bar: b ? { left: b.left, right: b.right, height: b.height } : null,
        pressable: s.pressable,
      })
    }
    return out
  }

  /** Marks (or unmarks) every shape as drawn; shapes found later follow the flag. */
  function setMarked(flag) {
    marked = flag
    for (const el of shapes.keys()) {
      if (flag) el.setAttribute(MARK, '')
      else el.removeAttribute(MARK)
    }
  }

  function dispose() {
    setMarked(false)
    mo.disconnect()
    io?.disconnect()
    ro?.disconnect()
    shapes.clear()
  }

  return { shapes, read, scan, setMarked, dispose }
}
