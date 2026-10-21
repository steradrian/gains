// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { needsHomeScreen, webPermission } from './permission.js'

describe('webPermission', () => {
  it('on once allowed, off while not yet or no longer', () => {
    expect(webPermission({ notification: { permission: 'granted' } })).toBe('on')
    expect(webPermission({ notification: { permission: 'default' } })).toBe('off')
    expect(webPermission({ notification: { permission: 'denied' } })).toBe('off')
  })

  it('an iPhone browser tab is off until Gains is on the Home Screen', () => {
    expect(webPermission({ notification: null, ios: true, installed: false })).toBe('off')
    expect(webPermission({ notification: null, ios: true, installed: true })).toBe('unsupported')
  })

  it('a browser with no notifications at all is unsupported', () => {
    expect(webPermission({ notification: null, ios: false, installed: false })).toBe('unsupported')
  })
})

describe('needsHomeScreen', () => {
  const win = (userAgent, standalone = false) => ({ navigator: { userAgent, standalone }, matchMedia: () => ({ matches: false }) })
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'

  it('only an iPhone browser tab has to add Gains to the Home Screen first', () => {
    expect(needsHomeScreen(win(IPHONE))).toBe(true)
    expect(needsHomeScreen(win(IPHONE, true))).toBe(false)
    expect(needsHomeScreen(win('Mozilla/5.0 (Linux; Android 15)'))).toBe(false)
  })
})
