// The accent themes: 25 presets, ported from the Background Lab (docs/handoffs/assets/pr06-themes).
//
// `S.accent` stores one of these ids. Nothing stored is rewritten: ids from before the 25 (lime,
// sky, ... and 'custom') are mapped when read (migrateAccentId), so an older build on another
// device keeps working, and the first pick writes a new id. A profile that never picked (null,
// '' or 'auto', and the old default 'lime') follows the mode: ink in dark, cobalt in light.
//
// Per preset: fill/fillEnd/text/tint/on are the light-theme accent tokens, `dark` the dark-theme
// ones, `stage` the three colours of the stage gradient and glow. blossom, watermelon and peach
// have a light stage, so they carry `ink`, the colours that replace the stage's white
// (ds/tokens.css sets them; the look engine reads `ink.art`).
import { t } from './i18n-core.js'

export const THEMES = [
  { id: 'cobalt', name: 'Cobalt', fill: '#3157C6', fillEnd: '#2342A6', text: '#2342A6', tint: '#E4E9F8', on: '#FFFFFF',
    dark: { fill: '#93A9FF', fillEnd: '#7390F4', text: '#A3B6FF', tint: '#1C2546', on: '#0A1030' },
    stage: { stage: '#3A62D6', end: '#1A2F86', glow: '#8AA4FF' } },
  { id: 'midnight', name: 'Midnight', fill: '#274580', fillEnd: '#163165', text: '#163165', tint: '#E5EAF4', on: '#FFFFFF',
    dark: { fill: '#96B3E7', fillEnd: '#7C9AD1', text: '#A6BFEB', tint: '#1F293C', on: '#0C1422' },
    stage: { stage: '#2A4B88', end: '#0E1F45', glow: '#88A5DA' } },
  { id: 'azure', name: 'Azure', fill: '#006297', fillEnd: '#004C78', text: '#004C78', tint: '#E1ECF5', on: '#FFFFFF',
    dark: { fill: '#74BAF0', fillEnd: '#54A1DB', text: '#8BC5F3', tint: '#112B3F', on: '#021524' },
    stage: { stage: '#0067A0', end: '#00385D', glow: '#7DC6FE' } },
  { id: 'tide', name: 'Tide', fill: '#226E88', fillEnd: '#17566D', text: '#17566D', tint: '#E0EDF1', on: '#FFFFFF',
    dark: { fill: '#6EC2DC', fillEnd: '#4CA7C4', text: '#7FCBE3', tint: '#14303A', on: '#06161C' },
    stage: { stage: '#2A7F9C', end: '#0E3F52', glow: '#7FD3EC' } },
  { id: 'jade', name: 'Jade', fill: '#006959', fillEnd: '#005145', text: '#005145', tint: '#E2EDEA', on: '#FFFFFF',
    dark: { fill: '#7DC3B3', fillEnd: '#5EAA9A', text: '#92CBBE', tint: '#142E29', on: '#041814' },
    stage: { stage: '#006F5F', end: '#003F37', glow: '#8DD5C4' } },
  { id: 'moss', name: 'Moss', fill: '#2C7A55', fillEnd: '#1E6246', text: '#1E6246', tint: '#E3EFE7', on: '#FFFFFF',
    dark: { fill: '#72CB9C', fillEnd: '#52B07F', text: '#7DD3A6', tint: '#173326', on: '#0B1A12' },
    stage: { stage: '#2F8159', end: '#123F2D', glow: '#7FD6A4' } },
  { id: 'sage', name: 'Sage', fill: '#466255', fillEnd: '#334D41', text: '#334D41', tint: '#E7EBE9', on: '#FFFFFF',
    dark: { fill: '#A1B9AE', fillEnd: '#87A195', text: '#AFC3B9', tint: '#222B27', on: '#0F1612' },
    stage: { stage: '#4A685B', end: '#243830', glow: '#B2CBBF' } },
  { id: 'forest', name: 'Forest', fill: '#245333', fillEnd: '#123E22', text: '#123E22', tint: '#E6ECE7', on: '#FFFFFF',
    dark: { fill: '#98BEA1', fillEnd: '#7CA687', text: '#A7C7AE', tint: '#1F2D22', on: '#0C170F' },
    stage: { stage: '#285937', end: '#052613', glow: '#89B092' } },
  { id: 'amber', name: 'Amber', fill: '#8B4E00', fillEnd: '#6E3C00', text: '#6E3C00', tint: '#F3E8DF', on: '#FFFFFF',
    dark: { fill: '#E3A36A', fillEnd: '#CC8949', text: '#E8B182', tint: '#3A230D', on: '#200F01' },
    stage: { stage: '#935200', end: '#502B00', glow: '#FDBB80' } },
  { id: 'ember', name: 'Ember', fill: '#B2502C', fillEnd: '#963C1D', text: '#963C1D', tint: '#F6E6DE', on: '#FFFFFF',
    dark: { fill: '#F2976E', fillEnd: '#DD7C52', text: '#F5A47F', tint: '#3A2016', on: '#1E0D05' },
    stage: { stage: '#C05A33', end: '#6E2810', glow: '#FFA27A' } },
  { id: 'garnet', name: 'Garnet', fill: '#AD2C3A', fillEnd: '#901729', text: '#901729', tint: '#F8E5E4', on: '#FFFFFF',
    dark: { fill: '#FA9090', fillEnd: '#E37375', text: '#FCA1A1', tint: '#421B1C', on: '#26090A' },
    stage: { stage: '#B72F3D', end: '#650E17', glow: '#FF9A9A' } },
  { id: 'wine', name: 'Wine', fill: '#7A243B', fillEnd: '#5F1029', text: '#5F1029', tint: '#F4E6E8', on: '#FFFFFF',
    dark: { fill: '#E79AA7', fillEnd: '#D07E8E', text: '#EBA9B4', tint: '#3B2025', on: '#210C11' },
    stage: { stage: '#822740', end: '#3E0516', glow: '#D98B99' } },
  { id: 'plum', name: 'Plum', fill: '#874070', fillEnd: '#6B2C57', text: '#6B2C57', tint: '#F2E4EC', on: '#FFFFFF',
    dark: { fill: '#E59BC8', fillEnd: '#CC7EAE', text: '#EAA9D0', tint: '#38192C', on: '#1F0915' },
    stage: { stage: '#9A4A80', end: '#4A1638', glow: '#F0A6D2' } },
  { id: 'rose', name: 'Rose', fill: '#A43263', fillEnd: '#871F4E', text: '#871F4E', tint: '#F6E5EA', on: '#FFFFFF',
    dark: { fill: '#F091B2', fillEnd: '#DA7599', text: '#F4A2BD', tint: '#3E1C29', on: '#240A14' },
    stage: { stage: '#AD3568', end: '#5F1333', glow: '#FFBBD1' } },
  { id: 'blush', name: 'Blush', fill: '#8B495C', fillEnd: '#713648', text: '#713648', tint: '#F2E7E9', on: '#FFFFFF',
    dark: { fill: '#DAA0AF', fillEnd: '#C38696', text: '#E0AEBB', tint: '#372228', on: '#1E0E13' },
    stage: { stage: '#924D62', end: '#512531', glow: '#FFC5D4' } },
  // Light stages: pastel, with deep text. `ink` replaces the stage's white for these three only.
  // on2 is an alpha; glass, glassLine, track and decor are [hex, alpha] pairs (decor's second value
  // multiplies the plate rings' opacity).
  { id: 'blossom', name: 'Blossom', fill: '#AA2B58', fillEnd: '#8C1745', text: '#8C1745', tint: '#F8E5E8', on: '#FFFFFF',
    dark: { fill: '#F68EA9', fillEnd: '#E07190', text: '#F9A0B6', tint: '#401B25', on: '#250911' },
    stage: { stage: '#FFC2D1', end: '#FA9EBC', glow: '#FFE5EC' },
    ink: { on: '#561E3C', on2: 0.80, glass: ['#FFFFFF', 0.40], glassLine: ['#FFFFFF', 0.60], track: ['#FFFFFF', 0.55],
      mark: '#AA2B58', cta: '#AA2B58', ctaIcon: '#FFFFFF', decor: ['#FFFFFF', 1.6] } },
  { id: 'watermelon', name: 'Watermelon', fill: '#AF2450', fillEnd: '#910C3D', text: '#910C3D', tint: '#F9E4E7', on: '#FFFFFF',
    dark: { fill: '#FB8CA2', fillEnd: '#E56E88', text: '#FD9EAF', tint: '#421A23', on: '#26080F' },
    stage: { stage: '#FFB3C6', end: '#FB6F92', glow: '#FFE5EC' },
    ink: { on: '#48102B', on2: 0.82, glass: ['#FFFFFF', 0.40], glassLine: ['#FFFFFF', 0.60], track: ['#FFFFFF', 0.55],
      mark: '#94204A', cta: '#94204A', ctaIcon: '#FFFFFF', decor: ['#FFFFFF', 1.5] } },
  { id: 'peach', name: 'Peach cream', fill: '#854B65', fillEnd: '#6C3850', text: '#6C3850', tint: '#F1E7EB', on: '#FFFFFF',
    dark: { fill: '#D5A2B7', fillEnd: '#BD889E', text: '#DBAFC1', tint: '#35232A', on: '#1D0F15' },
    stage: { stage: '#F8F3EA', end: '#FFDBD1', glow: '#FFE5EC' },
    // art: deeper ramp stops so patterns show in mauve on the pale stage
    ink: { on: '#53273C', on2: 0.80, glass: ['#FFFFFF', 0.55], glassLine: ['#B47792', 0.22], track: ['#B47792', 0.20],
      mark: '#8E5470', cta: '#8E5470', ctaIcon: '#FFFFFF', decor: ['#B47792', 1.2], art: ['#C493A9', '#E9BCC3'] } },
  { id: 'peony', name: 'Peony', fill: '#A13566', fillEnd: '#852251', text: '#852251', tint: '#F6E5EA', on: '#FFFFFF',
    dark: { fill: '#EE92B5', fillEnd: '#D7769C', text: '#F1A3C0', tint: '#3D1D2A', on: '#230A14' },
    stage: { stage: '#AA386C', end: '#411358', glow: '#FACCB7' } },
  { id: 'fuchsia', name: 'Fuchsia', fill: '#9E2A8C', fillEnd: '#821572', text: '#821572', tint: '#F5E4F1', on: '#FFFFFF',
    dark: { fill: '#EA8ED7', fillEnd: '#D370C0', text: '#EE9FDD', tint: '#3C1B36', on: '#22081D' },
    stage: { stage: '#A62C94', end: '#5C0B4D', glow: '#F897E3' } },
  { id: 'lilac', name: 'Lilac', fill: '#794C87', fillEnd: '#61396E', text: '#61396E', tint: '#EEE7F0', on: '#FFFFFF',
    dark: { fill: '#C9A3D5', fillEnd: '#B188BE', text: '#D1B0DB', tint: '#312335', on: '#1A0F1D' },
    stage: { stage: '#80508E', end: '#46274D', glow: '#E8C0F5' } },
  { id: 'iris', name: 'Iris', fill: '#6F45B1', fillEnd: '#593294', text: '#593294', tint: '#ECE7F7', on: '#FFFFFF',
    dark: { fill: '#BDA0FA', fillEnd: '#A585E5', text: '#C6AFFB', tint: '#2D2242', on: '#170E27' },
    stage: { stage: '#764ABB', end: '#402168', glow: '#C4A9FF' } },
  { id: 'cocoa', name: 'Cocoa', fill: '#604331', fillEnd: '#4A3020', text: '#4A3020', tint: '#EEE9E6', on: '#FFFFFF',
    dark: { fill: '#C8AC9C', fillEnd: '#B09382', text: '#D0B8AB', tint: '#302721', on: '#19120E' },
    stage: { stage: '#674835', end: '#2F1D10', glow: '#BA9E8E' } },
  { id: 'slate', name: 'Slate', fill: '#465463', fillEnd: '#33404D', text: '#33404D', tint: '#E8EAED', on: '#FFFFFF',
    dark: { fill: '#A8B4C1', fillEnd: '#8E9BA9', text: '#B4BFCA', tint: '#25292E', on: '#111418' },
    stage: { stage: '#4B5A69', end: '#1F2731', glow: '#94A0AD' } },
  { id: 'ink', name: 'Ink', fill: '#2B2A28', fillEnd: '#111111', text: '#111111', tint: '#ECEBE7', on: '#FFFFFF',
    dark: { fill: '#F4F2EE', fillEnd: '#D8D5CF', text: '#F4F2EE', tint: '#2A2926', on: '#111111' },
    stage: { stage: '#2B2A28', end: '#0B0B0A', glow: '#6B6761' } },
]

export const THEME_IDS = THEMES.map(p => p.id)

// An accent nobody picked follows the mode. The light value is a placeholder until the light-mode
// accent is designed: change it here, nowhere else.
export const DEFAULT_ACCENT_BY_MODE = { dark: 'ink', light: 'cobalt' }
export const DEFAULT_THEME = DEFAULT_ACCENT_BY_MODE.light

/** The accent drawn when none was picked, for the resolved mode ('light', anything else is dark). */
export const defaultAccent = mode => DEFAULT_ACCENT_BY_MODE[mode === 'light' ? 'light' : 'dark']

// The page's resolved mode (App.jsx sets html[data-theme]); what callers without a mode in hand get.
const modeNow = () => (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

const BY_ID = new Map(THEMES.map(p => [p.id, p]))

export const isTheme = id => typeof id === 'string' && BY_ID.has(id)
export const themeOf = id => BY_ID.get(isTheme(id) ? id : DEFAULT_THEME)

// Presets from before the 25. Owner decision 2026-10-22 (gains-pr06-settings-shared.md).
const LEGACY = { sky: 'cobalt', teal: 'tide', orange: 'ember', gold: 'amber', red: 'garnet', violet: 'iris', pink: 'rose' }

// --- colour maths (sRGB, OKLCH, WCAG 2) ---
const HEX = /^#[0-9a-f]{6}$/i
const toLin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)

/** OKLCH of a '#rrggbb' colour: { L, C, H } with H in degrees. */
export function hexToOklch(hex) {
  const [r, g, b] = rgbOf(hex).map(toLin)
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

const relLum = hex => { const [r, g, b] = rgbOf(hex).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }

/** WCAG contrast ratio of two '#rrggbb' colours, 1 to 21. */
export function contrast(a, b) {
  const x = relLum(a), y = relLum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

// A custom colour with less chroma than this is a grey (the old isGrey, in OKLCH).
const GREY_CHROMA = 0.04
// The presets a custom hex may land on: the dark-stage ones that have a hue of their own. The
// light stages (blossom, watermelon, peach) and the near-greys (ink, slate, cocoa, sage) would
// win on hue alone and read as the wrong colour.
const HUE_ANCHORS = THEMES
  .filter(p => !p.ink && hexToOklch(p.fill).C >= 0.07)
  .map(p => ({ id: p.id, hue: hexToOklch(p.fill).H }))
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

function nearestByHue(hex) {
  const { C, H } = hexToOklch(hex)
  if (C < GREY_CHROMA) return 'ink'
  let best = HUE_ANCHORS[0]
  for (const a of HUE_ANCHORS) if (hueGap(a.hue, H) < hueGap(best.hue, H)) best = a
  return best.id
}

/**
 * The theme to draw for a stored accent value: a current id is itself, an id from before the 25
 * is mapped, 'custom' goes to the nearest preset by hue (ink when it is a grey). Not chosen (null,
 * undefined, '', 'auto'), 'lime' (the old default, so never a pick) and anything unknown or
 * malformed are auto: the default for `mode`. Pure; nothing stored changes.
 */
export function migrateAccentId(old, customHex, mode = modeNow()) {
  if (isTheme(old)) return old
  if (typeof old === 'string' && Object.hasOwn(LEGACY, old)) return LEGACY[old]
  if (old === 'custom' && typeof customHex === 'string' && HEX.test(customHex.trim())) return nearestByHue(customHex.trim())
  return defaultAccent(mode)
}

/** The theme id to draw for settings `S` in `mode`. Reads only. */
export const accentKey = (S, mode = modeNow()) => migrateAccentId(S?.accent, S?.accentCustom, mode)

/** What the chosen accent is called. */
export const accentLabel = (S, mode) => t(themeOf(accentKey(S, mode)).name)

/** The colour and the text on it for the native rest countdown, as '#rrggbb' (rest-alert.js turns them into ints). */
export function accentPair(v, mode = modeNow()) {
  const p = themeOf(migrateAccentId(v, undefined, mode))
  return { accent: p.fill, ink: p.on }
}

// A switch knob is white; on an accent nearly as light it would vanish, so it gets a hairline ring.
const KNOB_RING = 'rgba(0,0,0,.28)'

/**
 * Puts the theme on the page root: data-accent for the stage and the kit (ds/ds.css), and the
 * app's own accent tokens inline for the resolved `theme` ('light' or 'dark').
 */
export function applyAccent(el, id, theme) {
  const key = isTheme(id) ? id : defaultAccent(theme)
  const p = BY_ID.get(key)
  const c = theme === 'light' ? p : p.dark
  el.dataset.accent = key
  el.style.setProperty('--acc', c.fill)
  el.style.setProperty('--acc-2', c.fillEnd)
  el.style.setProperty('--on-acc', c.on)
  el.style.setProperty('--acc-ink', c.text)
  if (contrast('#ffffff', c.fill) < 1.5) el.style.setProperty('--knob-ring', KNOB_RING)
  else el.style.removeProperty('--knob-ring')
  el.style.removeProperty('--acc-graphic')
}
