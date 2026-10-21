import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ACCENT_BY_MODE, DEFAULT_THEME, THEMES, THEME_IDS, accentKey, accentPair, applyAccent, contrast, defaultAccent,
  hexToOklch, isTheme, migrateAccentId,
} from './themes.js'

const CSS_DIR = process.cwd() + '/src/ds/'
const tokens = readFileSync(CSS_DIR + 'tokens.css', 'utf8')
const dsCss = readFileSync(CSS_DIR + 'ds.css', 'utf8')
const DARK_AT = tokens.indexOf(':root[data-theme="dark"] .g-root {')
const light = tokens.slice(0, DARK_AT)
const dark = tokens.slice(DARK_AT)

describe('THEMES', () => {
  it('is the 25 presets, unique, in the lab order with ink last', () => {
    expect(THEMES).toHaveLength(25)
    expect(new Set(THEME_IDS).size).toBe(25)
    expect(THEME_IDS[0]).toBe('cobalt')
    expect(THEME_IDS.at(-1)).toBe('ink')
  })

  it.each(THEMES.map(p => [p.id, p]))('%s: the text on the accent reads at 4.5:1 in both themes', (_id, p) => {
    expect(contrast(p.on, p.fill)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p.dark.on, p.dark.fill)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES.filter(p => !p.ink).map(p => [p.id, p]))('%s: white on the top of the dark stage reads at 4.5:1', (_id, p) => {
    expect(contrast('#ffffff', p.stage.stage)).toBeGreaterThanOrEqual(4.5)
  })

  it('the three light stages carry their own ink and no other theme does', () => {
    expect(THEMES.filter(p => p.ink).map(p => p.id)).toEqual(['blossom', 'watermelon', 'peach'])
  })
})

describe('defaults by mode', () => {
  it('is ink in dark and cobalt in light, one constant', () => {
    expect(DEFAULT_ACCENT_BY_MODE).toEqual({ dark: 'ink', light: 'cobalt' })
    expect(defaultAccent('dark')).toBe('ink')
    expect(defaultAccent('light')).toBe('cobalt')
    expect(defaultAccent(undefined)).toBe('ink')
    expect(DEFAULT_THEME).toBe('cobalt')
  })

  it('an accent nobody picked follows the mode', () => {
    for (const accent of [undefined, null, '', 'auto']) {
      expect(accentKey({ accent }, 'dark'), String(accent)).toBe('ink')
      expect(accentKey({ accent }, 'light'), String(accent)).toBe('cobalt')
    }
    expect(accentKey({}, 'dark')).toBe('ink')
    expect(accentKey(undefined, 'light')).toBe('cobalt')
  })

  it('the old default (lime) was never a pick, so it follows the mode too', () => {
    expect(accentKey({ accent: 'lime' }, 'dark')).toBe('ink')
    expect(accentKey({ accent: 'lime' }, 'light')).toBe('cobalt')
  })

  it('a pick is the same in both modes', () => {
    for (const accent of ['moss', 'plum', 'cobalt', 'ink']) {
      expect(accentKey({ accent }, 'dark')).toBe(accent)
      expect(accentKey({ accent }, 'light')).toBe(accent)
    }
  })

  it('does not write anything', () => {
    const S = Object.freeze({ accent: 'lime' })
    expect(() => accentKey(S, 'dark')).not.toThrow()
    expect(S.accent).toBe('lime')
  })
})

describe('migrateAccentId', () => {
  it.each([
    ['sky', 'cobalt'], ['teal', 'tide'], ['orange', 'ember'], ['gold', 'amber'],
    ['red', 'garnet'], ['violet', 'iris'], ['pink', 'rose'],
  ])('maps the old %s to %s', (old, id) => {
    expect(migrateAccentId(old, undefined, 'dark')).toBe(id)
    expect(migrateAccentId(old, undefined, 'light')).toBe(id)
  })

  it('maps every new id to itself', () => {
    for (const id of THEME_IDS) expect(migrateAccentId(id, undefined, 'dark')).toBe(id)
  })

  it('unknown and malformed values are auto', () => {
    for (const bad of ['mint', 'toString', '__proto__', '"><script>', 42, {}, []]) {
      expect(migrateAccentId(bad, undefined, 'dark'), String(bad)).toBe('ink')
      expect(migrateAccentId(bad, undefined, 'light'), String(bad)).toBe('cobalt')
    }
  })

  it('custom with no usable colour is auto', () => {
    for (const hex of [undefined, 'nope', '#abc', 'red;}', '#12345g']) expect(migrateAccentId('custom', hex, 'light')).toBe('cobalt')
  })

  it('a custom grey is ink', () => {
    for (const hex of ['#808080', '#ffffff', '#000000', '#777777']) expect(migrateAccentId('custom', hex, 'light')).toBe('ink')
  })

  it('a custom colour lands on a preset of its own hue', () => {
    const hue = id => hexToOklch(THEMES.find(p => p.id === id).fill).H
    const gap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }
    for (const hex of ['#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#ff375f', '#ff453a', '#40c8e0', '#ffd60a']) {
      const id = migrateAccentId('custom', hex, 'dark')
      expect(isTheme(id), hex).toBe(true)
      expect(gap(hue(id), hexToOklch(hex).H), `${hex} -> ${id}`).toBeLessThan(40)
    }
  })
})

describe('accentPair', () => {
  it('is the fill and the text on it, as hex for the native alert', () => {
    expect(accentPair('garnet')).toEqual({ accent: '#AD2C3A', ink: '#FFFFFF' })
    expect(accentPair('sky')).toEqual({ accent: '#3157C6', ink: '#FFFFFF' })
    expect(accentPair(undefined, 'dark')).toEqual({ accent: '#2B2A28', ink: '#FFFFFF' })
    expect(accentPair('nonsense', 'light')).toEqual({ accent: '#3157C6', ink: '#FFFFFF' })
  })
})

describe('applyAccent', () => {
  it('puts the id and the resolved theme tokens on the element', () => {
    const el = document.createElement('html')
    applyAccent(el, 'moss', 'light')
    expect(el.dataset.accent).toBe('moss')
    expect(el.style.getPropertyValue('--acc')).toBe('#2C7A55')
    expect(el.style.getPropertyValue('--acc-ink')).toBe('#1E6246')
    applyAccent(el, 'moss', 'dark')
    expect(el.style.getPropertyValue('--acc')).toBe('#72CB9C')
    expect(el.style.getPropertyValue('--on-acc')).toBe('#0B1A12')
  })

  it('an unknown id draws the mode default, never the value', () => {
    const el = document.createElement('html')
    applyAccent(el, 'url(x)', 'dark')
    expect(el.dataset.accent).toBe('ink')
    applyAccent(el, undefined, 'light')
    expect(el.dataset.accent).toBe('cobalt')
  })

  it('rings the switch knob on an accent nearly as light as the knob, and takes it off again', () => {
    const el = document.createElement('html')
    applyAccent(el, 'ink', 'dark')
    expect(el.style.getPropertyValue('--knob-ring')).not.toBe('')
    applyAccent(el, 'cobalt', 'dark')
    expect(el.style.getPropertyValue('--knob-ring')).toBe('')
  })
})

describe('the tokens', () => {
  it.each(THEME_IDS)('%s has its tokens in the light and dark blocks and a data-accent rule', id => {
    for (const name of ['stage', 'stage-end', 'glow', 'fill', 'fill-end', 'text', 'tint', 'on']) expect(light, `--${id}-${name}`).toContain(`--${id}-${name}:`)
    for (const name of ['fill', 'fill-end', 'text', 'tint', 'on']) expect(dark, `--${id}-${name} (dark)`).toContain(`--${id}-${name}:`)
    expect(dsCss).toContain(`.g-root[data-accent="${id}"]`)
  })

  it('every theme token equals the preset in lib/themes.js', () => {
    const get = (block, name) => block.match(new RegExp(`--${name}: (#[0-9A-Fa-f]{6});`))?.[1].toUpperCase()
    for (const p of THEMES) {
      expect(get(light, `${p.id}-stage`), p.id).toBe(p.stage.stage)
      expect(get(light, `${p.id}-fill`), p.id).toBe(p.fill)
      expect(get(dark, `${p.id}-fill`), p.id).toBe(p.dark.fill)
      expect(get(dark, `${p.id}-on`), p.id).toBe(p.dark.on)
    }
  })

  it('the stage roles default to today\'s white, and only the light stages override them', () => {
    for (const role of ['stage-mark', 'stage-cta', 'stage-decor']) expect(light).toContain(`--${role}: #FFFFFF;`)
    expect(light).toContain('--stage-decor-k: 1;')
    expect(light).toContain('--on-stage-cta: var(--accent-stage-end);')
    const overrides = [...dsCss.matchAll(/\.g-root\.g-root\[data-accent="(\w+)"\] \{ --on-stage:/g)].map(m => m[1])
    expect(overrides).toEqual(['blossom', 'watermelon', 'peach'])
  })

  // The round do-now button and the footer pill: --on-stage-cta on --stage-cta, resolved from the
  // token files as written. Neither role is redefined by the dark block, so both modes read the same.
  const hexOf = (block, name) => block.match(new RegExp(`--${name}: (#[0-9A-Fa-f]{6});`))?.[1]
  const ctaPair = id => {
    const override = dsCss.match(new RegExp(`\\.g-root\\.g-root\\[data-accent="${id}"\\] \\{[^}]*\\}`))?.[0]
    if (override) return { bg: hexOf(light, `${id}-ink-cta`), label: hexOf(light, `${id}-ink-cta-icon`) }
    return { bg: hexOf(light, 'stage-cta'), label: hexOf(light, `${id}-stage-end`) }
  }

  it('neither CTA role is redefined for dark mode', () => {
    expect(dark).not.toMatch(/--(?:on-)?stage-cta:/)
    expect(dark).not.toMatch(/--[a-z]+-stage-end:/)
  })

  it.each(['light', 'dark'])('%s: the label on the CTA reads at 4.5:1 for all 25 accents, light stages included', () => {
    for (const id of THEME_IDS) {
      const { bg, label } = ctaPair(id)
      expect(bg && label, id).toBeTruthy()
      expect(contrast(label, bg), `${id}: ${label} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('the marks and buttons drawn on the stage read the roles, not the stage white', () => {
    expect(dsCss).toMatch(/\.g-sring-val \{ stroke: var\(--stage-mark\)/)
    expect(dsCss).toMatch(/\.g-sfoot \.g-btn-primary, \.g-sfoot \.g-stage-cta \{ background: var\(--stage-cta\); color: var\(--on-stage-cta\)/)
    expect(dsCss).toMatch(/\.g-stage-rings \{[^}]*stroke: var\(--stage-decor\)/)
  })
})
