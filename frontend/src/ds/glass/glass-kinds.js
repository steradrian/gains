// Liquid glass kinds: how thick each kind of glass is, which kind an element is, and how a pressed
// shape swells. Pure, so the registry, the shader source and the tests all read one table.

export const KIND = Object.freeze({ CONTROL: 'control', BAR: 'bar', LENS: 'lens', TINT: 'tint', CARD: 'card', FLAT: 'flat' })

// Optics per kind (the approved prototype's numbers). `id` is the shader's kind number; `bezel` and
// `D` are CSS px (rim band width, how far it looks outward); `shadow` is the contact shadow's alpha;
// `swell` is px of growth at full press; `rim` scales the lit-arc specular; `pressD` lets a press
// deepen the bezel. `flat` has no row: it is CSS only.
export const STRENGTH = Object.freeze({
  control: { id: 0, bezel: 12, D: 10, shadow: 0.12, swell: 3.5, rim: 1, pressD: true },
  bar: { id: 1, bezel: 14, D: 12, shadow: 0.24, swell: 1.2, rim: 1, pressD: true },
  lens: { id: 2, bezel: 12, D: 6, shadow: 0, swell: 6, rim: 0.12, pressD: false },
  tint: { id: 3, bezel: 12, D: 10, shadow: 0.12, swell: 3, rim: 1, pressD: true },
  card: { id: 4, bezel: 10, D: 6, shadow: 0.08, swell: 2, rim: 0.7, pressD: false },
})

const LENSED = new Set(Object.keys(STRENGTH))
export const MIN_SIDE = 32
export const INTERACTIVE = 'button, a[href], [role="button"], label[role="search"]'

/** Chrome kinds draw in the over canvas, above the page; the rest draw under it. */
export const isChrome = kind => kind === KIND.BAR || kind === KIND.LENS || kind === KIND.TINT

export const isInteractive = el => el.matches(INTERACTIVE)

/**
 * The kind of one glass element. `parentKind` is the kind of the nearest lensed glass ancestor, or null.
 * An explicit data-glass wins; otherwise: `.g-btn-glass` is a control, `.g-glass` is a control when it is
 * a button, link or search label and a card when not; under 32px on a side, or a card in a card, is flat.
 */
export function glassKind(el, parentKind = null) {
  const explicit = el.dataset?.glass
  if (explicit === KIND.FLAT || LENSED.has(explicit)) return explicit
  let kind
  if (el.classList.contains('g-btn-glass')) kind = KIND.CONTROL
  else if (el.classList.contains('g-glass')) kind = isInteractive(el) ? KIND.CONTROL : KIND.CARD
  else return KIND.FLAT
  const r = el.getBoundingClientRect()
  if (Math.min(r.width, r.height) < MIN_SIDE) return KIND.FLAT
  if (kind === KIND.CARD && parentKind === KIND.CARD) return KIND.FLAT
  return kind
}

/**
 * A shape's silhouette with the press applied: it swells on the spring, a lens also stretches along
 * its path (`stretch`, px) and never crosses its bar's rim (`bar`: { left, right, height }).
 * `reduced` skips the swell and the stretch. `s`: { kind, x, y, hw, hh, radius }.
 */
export function swollen(s, press, { reduced = false, stretch = 0, bar = null } = {}) {
  let { x, hw, hh } = s
  const { y, kind } = s
  const lens = kind === KIND.LENS
  if (lens) {
    hw += stretch
    hh -= stretch * 0.25
  }
  const swell = reduced ? 0 : STRENGTH[kind].swell * press
  hw += swell
  hh += lens ? swell * 1.25 : swell
  if (lens && bar) {
    const pad = 6
    hh = Math.min(hh, bar.height / 2 - pad)
    const left = Math.max(x - hw, bar.left + pad)
    const right = Math.min(x + hw, bar.right - pad)
    x = (left + right) / 2
    hw = (right - left) / 2
  }
  const radius = lens ? Math.min(hw, hh) : Math.min(s.radius + swell, hw, hh)
  return { x, y, hw, hh, radius }
}
