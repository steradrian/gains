import { describe, expect, it } from 'vitest'
import { dsAccentFor } from './ds-accent.js'
import { ACCENTS } from './format.js'

const custom = hex => ({ accent: 'custom', accentCustom: hex })

// '#rrggbb' at full saturation and mid lightness for a hue in degrees
function hueHex(h) {
  const x = 1 - Math.abs(((h / 60) % 2) - 1)
  const [r, g, b] = h < 60 ? [1, x, 0] : h < 120 ? [x, 1, 0] : h < 180 ? [0, 1, x] : h < 240 ? [0, x, 1] : h < 300 ? [x, 0, 1] : [1, 0, x]
  return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}

describe('dsAccentFor', () => {
  it.each([
    ['sky', 'cobalt'],
    ['lime', 'moss'],
    ['teal', 'tide'],
    ['orange', 'ember'],
    ['red', 'ember'],
    ['gold', 'ember'],
    ['violet', 'plum'],
    ['pink', 'plum'],
  ])('maps the %s preset to %s', (accent, expected) => {
    expect(dsAccentFor({ accent })).toBe(expected)
  })

  it('maps every app preset (none is left to the fallback)', () => {
    for (const accent of Object.keys(ACCENTS)) {
      expect(['cobalt', 'moss', 'tide', 'ember', 'plum']).toContain(dsAccentFor({ accent }))
    }
  })

  it('puts a custom colour that is a preset where that preset goes', () => {
    for (const [accent, hex] of Object.entries(ACCENTS)) {
      expect(dsAccentFor(custom(hex))).toBe(dsAccentFor({ accent }))
    }
  })

  // The boundaries sit halfway between the presets' hues that map to different colours:
  // gold 50 / lime 135 (92), lime / teal 189 (162), teal / sky 210 (199), sky / violet 277 (244),
  // pink 348 / red 3 (356).
  it.each([
    [0, 'ember'], [30, 'ember'], [91, 'ember'],
    [94, 'moss'], [120, 'moss'], [160, 'moss'],
    [165, 'tide'], [190, 'tide'], [198, 'tide'],
    [201, 'cobalt'], [225, 'cobalt'], [242, 'cobalt'],
    [246, 'plum'], [300, 'plum'], [354, 'plum'],
    [358, 'ember'], [359, 'ember'],
  ])('takes a custom colour of hue %i to %s', (hue, expected) => {
    expect(dsAccentFor(custom(hueHex(hue)))).toBe(expected)
  })

  it('takes a custom grey to ink, however light or dark', () => {
    for (const hex of ['#808080', '#ffffff', '#000000', '#8a8c8a', '#d9d9d9']) {
      expect(dsAccentFor(custom(hex))).toBe('ink')
    }
  })

  it('still reads a muted but coloured custom colour as its hue', () => {
    expect(dsAccentFor(custom('#3366cc'))).toBe('cobalt')
  })

  it('falls back to moss, the app default, for missing or invalid settings', () => {
    const bad = [
      undefined, null, {}, 'sky', 42, [],
      { accent: 'nonsense' },
      { accent: 7 },
      { accent: 'custom' },
      { accent: 'custom', accentCustom: 'red' },
      { accent: 'custom', accentCustom: '#abc' },
      { accent: 'custom', accentCustom: 'url(x)' },
    ]
    for (const S of bad) expect(dsAccentFor(S)).toBe('moss')
  })

  it('ignores a stored custom colour while a preset is picked', () => {
    expect(dsAccentFor({ accent: 'sky', accentCustom: '#ff0000' })).toBe('cobalt')
  })
})
