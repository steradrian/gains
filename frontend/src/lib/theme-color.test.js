// @vitest-environment happy-dom
// The browser chrome colour: the stage's top on a tab root, the page surface elsewhere, kept in the
// <meta name="theme-color"> and in step with index.html's pre-paint values.
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { BRAND } from '../brand.js'
import { chromeColor, isLightColor, syncThemeColor } from './theme-color.js'
import { DEFAULT_ACCENT_BY_MODE, THEMES, themeOf } from './themes.js'

const meta = () => document.head.querySelector('meta[name="theme-color"]')
afterEach(() => { meta()?.remove() })

describe('chromeColor', () => {
  it('is the stage top of the accent on a tab root, and follows the accent', () => {
    expect(chromeColor({ accent: 'cobalt', mode: 'dark', onStage: true })).toBe(themeOf('cobalt').stage.stage)
    expect(chromeColor({ accent: 'ember', mode: 'dark', onStage: true })).toBe(themeOf('ember').stage.stage)
  })

  it('is a light colour on a light stage', () => {
    const colour = chromeColor({ accent: 'blossom', mode: 'dark', onStage: true })
    expect(colour).toBe('#FFC2D1')
    expect(isLightColor(colour)).toBe(true)
    expect(isLightColor(chromeColor({ accent: 'cobalt', mode: 'light', onStage: true }))).toBe(false)
  })

  it('reads exactly the light stages as light', () => {
    for (const p of THEMES) expect(isLightColor(p.stage.stage), p.id).toBe(!!p.ink)
  })

  it('is the page surface of the mode on pushed pages and in drawers, whatever the accent', () => {
    expect(chromeColor({ accent: 'blossom', mode: 'dark', onStage: false })).toBe(BRAND.themeColor.dark)
    expect(chromeColor({ accent: 'blossom', mode: 'light', onStage: false })).toBe(BRAND.themeColor.light)
    expect(isLightColor(BRAND.themeColor.light)).toBe(true)
    expect(isLightColor(BRAND.themeColor.dark)).toBe(false)
  })

  it('has pre-paint values in index.html that match the default accent of each mode', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    expect(html).toContain(`<meta name="theme-color" content="${themeOf(DEFAULT_ACCENT_BY_MODE.dark).stage.stage}">`)
    expect(html).toContain(`.content = '${themeOf(DEFAULT_ACCENT_BY_MODE.light).stage.stage}'`)
  })
})

describe('syncThemeColor', () => {
  it('creates the tag when it is missing', () => {
    expect(meta()).toBeNull()
    syncThemeColor('#3A62D6')
    expect(meta().content).toBe('#3A62D6')
    expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1)
  })

  it('follows accent and mode changes through the same tag', () => {
    syncThemeColor(chromeColor({ accent: 'cobalt', mode: 'dark', onStage: true }))
    expect(meta().content).toBe('#3A62D6')
    syncThemeColor(chromeColor({ accent: 'blossom', mode: 'dark', onStage: true }))
    expect(meta().content).toBe('#FFC2D1')
    syncThemeColor(chromeColor({ accent: 'blossom', mode: 'light', onStage: false }))
    expect(meta().content).toBe(BRAND.themeColor.light)
    expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1)
  })

  it('does nothing when the value has not changed', () => {
    syncThemeColor('#3A62D6')
    const tag = meta()
    let value = tag.content
    let writes = 0
    Object.defineProperty(tag, 'content', { get: () => value, set: v => { writes++; value = v } })
    syncThemeColor('#3A62D6')
    expect(writes).toBe(0)
    syncThemeColor('#FFC2D1')
    expect(writes).toBe(1)
  })
})
