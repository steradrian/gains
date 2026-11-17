// Colour maths for the look engine: OKLab/OKLCH, the four-stop art ramp and the per-accent
// theme the shader reads. Ported from the Background Lab (docs/handoffs/assets/pr06-themes/themes-v2.html).

const toLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
export const toSrgb = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
}

export function rgbToHex(rgb) {
  return '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
}

export function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  let H = (Math.atan2(B, A) * 180) / Math.PI
  if (H < 0) H += 360
  return { L, C: Math.hypot(A, B), H }
}

function oklchToLinear(L, C, H) {
  const hr = (H * Math.PI) / 180
  const a = C * Math.cos(hr), b = C * Math.sin(hr)
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3)
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3)
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3)
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const inGamut = lin => lin.every(v => v >= -0.0005 && v <= 1.0005)

// Reduce chroma until the colour fits sRGB (keeps lightness and hue).
export function gamutOklch(L, C, H) {
  H = ((H % 360) + 360) % 360
  let c = Math.max(0, C)
  if (!inGamut(oklchToLinear(L, c, H))) {
    let lo = 0, hi = c
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(oklchToLinear(L, mid, H))) lo = mid; else hi = mid
    }
    c = lo
  }
  const lin = oklchToLinear(L, c, H).map(v => Math.min(1, Math.max(0, v)))
  return { L, C: c, H, lin, rgb: lin.map(toSrgb), get hex() { return rgbToHex(this.rgb) } }
}

const relLum = rgb => {
  const [r, g, b] = rgb.map(toLin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrastRgb = (a, b) => {
  const la = relLum(a), lb = relLum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const fromHex = hex => {
  const k = hexToOklch(hex)
  return gamutOklch(k.L, k.C, k.H)
}

// Where the ramp's four stops sit along the lightness axis (must match `ramp` in the shader).
export const STOPS = [0, 0.34, 0.68, 1]

export const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** The sRGB colour of the art ramp at lightness `x` (0 to 1). `stops` are four gamutOklch() colours. */
export function rampAt(stops, x) {
  let c = stops[0].lin.slice()
  for (let i = 1; i < 4; i++) {
    const t = sstep(STOPS[i - 1], STOPS[i], x)
    c = c.map((v, k) => v + (stops[i].lin[k] - v) * t)
  }
  return c.map(toSrgb)
}

/**
 * What the renderer needs for one accent preset (lib/themes.js) at one intensity: the art ramp,
 * the stage colours, and whether the stage is light (the look then draws deeper, not lighter).
 * The contrast checks of the lab are not needed at runtime.
 */
export function deriveTheme(preset, intensity = 0.45) {
  const sc = preset.stage
  const top = fromHex(sc.stage), end = fromHex(sc.end), glow = fromHex(sc.glow)
  const art = [gamutOklch(Math.max(end.L - 0.08, 0.05), end.C * 0.9, end.H), end, top, gamutOklch(Math.min(glow.L + 0.1, 0.97), glow.C * 0.7, glow.H)]
  if (preset.ink && preset.ink.art) {
    art[0] = fromHex(preset.ink.art[0])
    art[1] = fromHex(preset.ink.art[1])
  }
  const W = gamutOklch(1, 0, 0)
  const light = !!preset.ink || contrastRgb(W.rgb, top.rgb) < 3
  const decor = light && preset.ink && preset.ink.decor ? { c: fromHex(preset.ink.decor[0]), k: preset.ink.decor[1] } : { c: W, k: 1 }
  return {
    id: preset.id,
    intensity,
    art,
    stageTop: top,
    stageEnd: end,
    glow,
    accentLin: hexToRgb(preset.fill).map(toLin),
    tokens: { light, decor },
  }
}
