import { describe, expect, it } from 'vitest'
import { dsAccentFor } from './ds-accent.js'
import { THEME_IDS } from './themes.js'

describe('dsAccentFor', () => {
  it('is the stored theme id, in either mode', () => {
    for (const accent of THEME_IDS) {
      expect(dsAccentFor({ accent }, 'dark')).toBe(accent)
      expect(dsAccentFor({ accent }, 'light')).toBe(accent)
    }
  })

  it('maps an id from before the 25 themes, and the old default is not a pick', () => {
    expect(dsAccentFor({ accent: 'sky' }, 'dark')).toBe('cobalt')
    expect(dsAccentFor({ accent: 'violet' }, 'dark')).toBe('iris')
    expect(dsAccentFor({ accent: 'lime' }, 'dark')).toBe('ink')
    expect(dsAccentFor({ accent: 'lime' }, 'light')).toBe('cobalt')
  })

  it('an accent nobody picked follows the mode; junk is the same', () => {
    for (const accent of [undefined, null, '', 'auto', 'mint', 42]) {
      expect(dsAccentFor({ accent }, 'dark'), String(accent)).toBe('ink')
      expect(dsAccentFor({ accent }, 'light'), String(accent)).toBe('cobalt')
    }
    expect(dsAccentFor({}, 'dark')).toBe('ink')
  })

  it('a custom colour goes to the nearest preset by hue, a grey to ink', () => {
    expect(dsAccentFor({ accent: 'custom', accentCustom: '#777777' }, 'light')).toBe('ink')
    expect(THEME_IDS).toContain(dsAccentFor({ accent: 'custom', accentCustom: '#0a84ff' }, 'light'))
  })
})
