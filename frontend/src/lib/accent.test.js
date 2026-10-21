// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { cleanHex, sanitizeAccent, accentKey, accentValue, accentPair, applyAccent } from './accent.js'
import { THEMES as PRESETS, contrast } from './themes.js'
import { readFileSync } from 'node:fs'
import { EFFORT_BANDS } from './effort.js'
import { mergeStates } from './sync-merge.js'

// The page, card and nested fills the app draws (index.css --bg, --surface, --surface-2).
const PAGE = {
  dark: { bgs: ['#0c0b0a', '#1c1b19', '#2a2826'], surface2: '#2a2826' },
  light: { bgs: ['#f5f4f1', '#ffffff', '#eeece8'], surface2: '#eeece8' },
}
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255] }
const mix = (hex, to, t) => '#' + rgb(hex).map((v, i) => Math.round(v + (rgb(to)[i] - v) * t).toString(16).padStart(2, '0')).join('')
// The --acc-soft tint of `acc` over `base` (index.css: 16% accent)
const tintOver = (acc, base) => mix(base, acc, 0.16)

// Read from the stylesheet, so a value edited there is the one measured here. The preset accents'
// own contrast is measured per theme below and in themes.test.js.
const CSS = readFileSync('src/index.css', 'utf8') // vitest runs from frontend/
// Light-theme gauge: the track must be visible on the card and page, and each macro arc must read on it.
describe('light --gauge-track (index.css)', () => {
  const light = CSS.slice(CSS.indexOf(':root[data-theme="light"] {'))
  const token = name => light.match(new RegExp(`${name}:\\s*([^;]+);`))[1].trim()
  const resolve = value => {
    const cm = value.match(/^color-mix\(in srgb,\s*var\((--[\w-]+)\)\s*(\d+)%,\s*var\((--[\w-]+)\)\)$/)
    return cm ? mix(resolve(token(cm[3])), resolve(token(cm[1])), Number(cm[2]) / 100) : value
  }
  const track = resolve(token('--gauge-track'))
  it('is at least 1.5:1 against the card and the page', () => {
    for (const name of ['--surface', '--bg']) expect(contrast(track, resolve(token(name))), `${track} on ${name}`).toBeGreaterThanOrEqual(1.5)
  })
  it('sits at least 2:1 under each macro arc', () => {
    for (const name of ['--macro-protein', '--macro-carbs', '--macro-fat']) expect(contrast(resolve(token(name)), track), `${name} on ${track}`).toBeGreaterThanOrEqual(2)
  })
})

describe('--live-ink (index.css)', () => {
  it('the running-workout label (--live-ink) reads in light, also with an orange-hued accent', () => {
    for (const ink of ['#a35800', '#c42d25']) for (const bg of PAGE.light.bgs) expect(contrast(ink, bg), `${ink} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    expect(CSS).toContain('--live-ink:#a35800')
    expect(CSS).toContain('--live-ink:#c42d25')
    // The running workout's text now lives in the live dock (tab-shell.css), no longer on the +.
    expect(readFileSync('src/tab-shell.css', 'utf8')).toMatch(/#timer\.dock \.dock-sub\{[^}]*color:var\(--live-ink\)/)
  })
})

// A theme block's own value of a token (the first `:root {` is dark, `:root[data-theme="light"] {`
// light), as written: '#0c0b0a', 'var(--acc-ink)'.
const tokenIn = (theme, name) => {
  const light = CSS.indexOf(':root[data-theme="light"] {')
  const block = theme === 'light' ? CSS.slice(light, CSS.indexOf('}', light)) : CSS.slice(CSS.indexOf(':root {'), light)
  return block.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim() ?? null
}

describe('the redesign\'s accent-facing tokens, for every theme', () => {
  // The fills a line-art scene sits on: the page, a card, the 96×72 art slot (--surface-2), and the
  // one lit --acc-soft area per scene that every accent stroke touches.
  const sceneFills = (theme, acc) => [...PAGE[theme].bgs, tintOver(acc, PAGE[theme].surface2)]

  it('--acc-graphic is the accent in dark and its ink in light (index.css)', () => {
    expect(tokenIn('dark', 'acc-graphic')).toBe('var(--acc)')
    expect(tokenIn('light', 'acc-graphic')).toBe('var(--acc-ink)')
    // no accent rule overrides it, so a preset gets exactly that
    expect(CSS).not.toMatch(/\[data-accent="[a-z]+"\][^{]*\{[^}]*--acc-graphic/)
    // and applying a theme takes any leftover inline value off
    const el = document.createElement('html')
    el.style.setProperty('--acc-graphic', '#123456')
    applyAccent(el, 'moss', 'dark')
    expect(el.style.getPropertyValue('--acc-graphic')).toBe('')
  })

  for (const theme of ['dark', 'light']) for (const p of PRESETS) {
    it(`${p.id} in ${theme}: the line-art accent clears 3:1 on every fill a scene sits on`, () => {
      const c = theme === 'dark' ? p.dark : p
      // --acc-graphic is the accent in dark and its ink (--acc-ink) in light
      const graphic = theme === 'dark' ? c.fill : c.text
      for (const bg of sceneFills(theme, c.fill)) {
        expect(contrast(graphic, bg), `${graphic} on ${bg}`).toBeGreaterThanOrEqual(3)
      }
    })
    it(`${p.id} in ${theme}: the accent as text (--acc-ink) clears 4.5:1 on the page, the card, the nested fill and the tint over it`, () => {
      const c = theme === 'dark' ? p.dark : p
      for (const bg of [...PAGE[theme].bgs, tintOver(c.fill, PAGE[theme].surface2)]) {
        expect(contrast(c.text, bg), `${c.text} on ${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }

  it('--on-sel on --sel-fill (a selected day or segment) is the page colour on the label colour', () => {
    expect(tokenIn('dark', 'sel-fill')).toBe('var(--label)')
    expect(tokenIn('dark', 'on-sel')).toBe('var(--bg)')
    // neither theme nor any accent redefines them: the pair is the theme's label and page colours
    expect(tokenIn('light', 'sel-fill')).toBe(null)
    expect(tokenIn('light', 'on-sel')).toBe(null)
    expect(CSS).not.toMatch(/\[data-accent="[a-z]+"\][^{]*\{[^}]*--(?:sel-fill|on-sel)/)
  })

  for (const theme of ['dark', 'light']) {
    it(`${theme}: --on-sel reads at least 7:1 on --sel-fill, whatever the accent`, () => {
      const fill = tokenIn(theme, 'label'), ink = tokenIn(theme, 'bg')
      expect(fill).toMatch(/^#[0-9a-f]{6}$/)
      expect(ink).toMatch(/^#[0-9a-f]{6}$/)
      expect(contrast(ink, fill)).toBeGreaterThanOrEqual(7)
    })
  }
})

describe('status colours as text (--yellow-ink, --orange-ink, --green-ink, --red-ink, --blue-ink)', () => {
  const FILL = {
    dark: { yellow: '#ffd60a', orange: '#ff9f0a', green: '#30d158', red: '#ff453a', blue: '#0a84ff', purple: '#bf5af2' },
    light: { yellow: '#ffcc00', orange: '#ff9500', green: '#34c759', red: '#ff3b30', blue: '#007aff', purple: '#af52de' },
  }
  const inkAt = (theme, name) => {
    const light = CSS.indexOf(':root[data-theme="light"] {')
    const block = theme === 'light' ? CSS.slice(light, CSS.indexOf('}', light)) : CSS.slice(0, light)
    const m = block.match(new RegExp(`--${name}-ink: ?(#[0-9a-f]{6})`))
    // a dark ink that is not a hex reads the plain colour (var(--name))
    return m ? m[1] : theme === 'dark' ? FILL.dark[name] : null
  }
  for (const theme of ['dark', 'light']) for (const name of Object.keys(FILL[theme])) {
    it(`${name} in ${theme}: 4.5:1 on the page, the card and the 18% tint over the card`, () => {
      const ink = inkAt(theme, name)
      expect(ink, `--${name}-ink in ${theme}`).toBeTruthy()
      const th = PAGE[theme]
      for (const bg of [...th.bgs, mix(th.bgs[1], FILL[theme][name], 0.18)]) {
        expect(contrast(ink, bg), `${name} ${ink} on ${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    })
    if (name !== 'blue') it(`${name} in ${theme}: 4.5:1 on the effort cell (20% tint over --surface-2)`, () => {
      const th = PAGE[theme]
      expect(contrast(inkAt(theme, name), mix(th.surface2, FILL[theme][name], 0.2))).toBeGreaterThanOrEqual(4.5)
    })
  }
  it('every status effort band has the ink of its own colour', () => {
    for (const b of EFFORT_BANDS.filter(b => b.color !== 'var(--acc-2)')) expect(b.ink, b.color).toBe(b.color.replace(/\)$/, '-ink)'))
  })
  it('the Easy band (accent tint) uses neutral text, since no accent ink clears 4.5:1 on every accent tint', () => {
    expect(EFFORT_BANDS.find(b => b.color === 'var(--acc-2)').ink).toBe('var(--label)')
  })
})

describe('focus ring and inline links', () => {
  it('the focus ring is --acc-ink, which clears 4.5:1 (so 3:1 as a ring) on every fill for every preset', () => {
    expect(CSS).toMatch(/:focus-visible\{outline:2\.5px solid var\(--acc-ink\)/)
  })
  it('links in running text are underlined, not told apart by colour alone', () => {
    expect(CSS).toMatch(/\.sp-version a\{text-decoration:underline/)
  })
})

describe('cleanHex', () => {
  it('takes #rrggbb only, in lowercase', () => {
    expect(cleanHex('#A1b2C3')).toBe('#a1b2c3')
    expect(cleanHex(' #00ff00 ')).toBe('#00ff00')
    for (const bad of ['#abc', 'abcdef', '#abcdeg', '#abcdef00', 'red', 'rgb(1,2,3)', '', null, undefined, 123, {}, ['#abcdef'],
      '#000000;background:url(x)', '#000000}body{display:none', 'var(--x)'])
      expect(cleanHex(bad), String(bad)).toBe(null)
  })
})

describe('sanitizeAccent', () => {
  it('drops a malformed old own colour and keeps a good one', () => {
    expect(sanitizeAccent({ accent: 'custom', accentCustom: '#FF00AA' })).toEqual({ accent: 'custom', accentCustom: '#ff00aa' })
    expect(sanitizeAccent({ accent: 'custom', accentCustom: 'red;}' })).toEqual({ accent: 'custom' })
  })
  it('keeps an unknown preset word (a newer app’s) but not junk', () => {
    expect(sanitizeAccent({ accent: 'mint' }).accent).toBe('mint')
    // junk is "not chosen": the mode's default is drawn
    expect(sanitizeAccent({ accent: '"><script>' }).accent).toBe(null)
    expect(sanitizeAccent({ accent: 42 }).accent).toBe(null)
    expect(sanitizeAccent({ accent: null }).accent).toBe(null)
    expect(sanitizeAccent({ theme: 'dark' })).toEqual({ theme: 'dark' })
  })
})

describe('accentKey / accentValue', () => {
  it('draws a theme or the mode default', () => {
    expect(accentKey({ accent: 'sky' }, 'dark')).toBe('cobalt')
    expect(accentKey({}, 'dark')).toBe('ink')
    expect(accentKey({}, 'light')).toBe('cobalt')
    expect(accentKey({ accent: 'mint' }, 'dark')).toBe('ink')
    expect(accentKey({ accent: 'toString' }, 'light')).toBe('cobalt')
    expect(accentKey({ accent: 'custom' }, 'dark')).toBe('ink')
    expect(accentKey({ accent: 'custom', accentCustom: 'nope' }, 'dark')).toBe('ink')
    expect(accentValue({ accent: 'red', accentCustom: '#123abc' }, 'dark')).toBe('garnet')
  })
  it('a stored own colour (an older build) is drawn as the nearest theme, grey as ink', () => {
    expect(accentValue({ accent: 'custom', accentCustom: '#777777' }, 'light')).toBe('ink')
    expect(accentValue({ accent: 'custom', accentCustom: '#123ABC' }, 'dark')).not.toBe('custom')
  })
})

describe('the native countdown colours', () => {
  it('takes a theme id', () => {
    expect(accentPair('garnet')).toEqual({ accent: '#AD2C3A', ink: '#FFFFFF' })
    expect(accentPair('nonsense', 'light')).toEqual({ accent: '#3157C6', ink: '#FFFFFF' })
    expect(accentPair(undefined, 'dark')).toEqual({ accent: '#2B2A28', ink: '#FFFFFF' })
  })
})

describe('sync of the accent fields', () => {
  const base = { _ts: 1, unit: 'kg', workouts: [], routines: [], bodyweight: [] }
  it('a malformed colour from the other copy is dropped by the merge', () => {
    const mine = { ...base, _ts: 10, accent: 'red' }
    const theirs = { ...base, _ts: 20, accent: 'custom', accentCustom: '#fff;}*{color:red' }
    const out = mergeStates(mine, theirs)
    expect('accentCustom' in out).toBe(false)
    expect(accentValue(out, 'dark')).toBe('ink')
  })
  it('a pick on an older copy still reads as its theme', () => {
    const mine = { ...base, _ts: 10, accent: 'moss', edited: { accent: 10 } }
    const old = { ...base, _ts: 20, accent: 'sky', edited: { accent: 20 } }
    expect(accentValue(mergeStates(mine, old), 'dark')).toBe('cobalt')
  })
})
