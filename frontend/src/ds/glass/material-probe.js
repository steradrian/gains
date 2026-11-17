import { DEFAULT_MATERIAL } from './glass-gl.js'

// Liquid glass material from the CSS tokens (tokens.css --glass-lift, -rim, -spec, -shade). The tokens
// differ per stage and per colour mode, so they are read from a hidden element that sits in a .g-root
// with the stage's accent, and only when the accent or the mode changes, never per frame. The probe's
// `color` is set to each token and read back as computed style, which is always rgb()/rgba() text.

const TOKENS = { lift: '--glass-lift', rim: '--glass-rim', spec: '--glass-spec', shade: '--glass-shade' }
const RGBA = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/

/** "rgba(5, 10, 41, 0.5)" -> [r, g, b, a] in 0..1, or null for anything else (color-mix output, a keyword). */
export function parseRgba(text) {
  const m = RGBA.exec((text || '').trim())
  if (!m) return null
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
  return [+m[1] / 255, +m[2] / 255, +m[3] / 255, a]
}

/**
 * @param {Element} host an element inside the page (the GlassHost root); the probe is appended to it
 * @returns {{ read(accent: string): object, dispose(): void }} read gives DEFAULT_MATERIAL's shape (tint left to the caller)
 * A token that is missing or does not parse keeps the prototype's value.
 */
export function createMaterialProbe(host) {
  const probe = document.createElement('div')
  probe.className = 'g-root gl-probe'
  probe.setAttribute('aria-hidden', 'true')
  host.appendChild(probe)

  function read(accent) {
    probe.setAttribute('data-accent', accent)
    const cs = getComputedStyle(probe)
    const out = { ...DEFAULT_MATERIAL }
    for (const [key, token] of Object.entries(TOKENS)) {
      probe.style.color = ''
      probe.style.color = `var(${token})`
      const c = parseRgba(cs.color)
      if (!c) continue
      out[key] = key === 'lift' || key === 'shade' ? c : c.slice(0, 3)
    }
    return out
  }

  return { read, dispose: () => probe.remove() }
}
