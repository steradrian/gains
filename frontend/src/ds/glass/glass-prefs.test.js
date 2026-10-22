// @vitest-environment happy-dom
// The stored sprite options: known values only, defaults when missing or when storage throws, and the
// retired device-gate keys are dropped.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPref, readPrefs, writePref } from './glass-prefs.js'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('glass prefs', () => {
  it('defaults to the approved look: cards 3x with the drawn shadow', () => {
    expect(readPrefs()).toEqual({ cardDpr: 3, shadow: 'shader' })
  })

  it('stores and reads back a known value, and ignores an unknown one', () => {
    writePref('cardDpr', '2')
    expect(localStorage.getItem('lg-card-dpr')).toBe('2')
    expect(readPref('cardDpr')).toBe('2')
    writePref('cardDpr', '7')
    expect(readPref('cardDpr')).toBe('2')
    localStorage.setItem('lg-shadow', 'nope')
    expect(readPrefs().shadow).toBe('shader')
  })

  it('migrates a stored "fixed" presenter pick and the copy path away', () => {
    localStorage.setItem('lg-presenter', 'fixed')
    localStorage.setItem('lg-copy', 'bitmap')
    readPrefs()
    expect(localStorage.getItem('lg-presenter')).toBeNull()
    expect(localStorage.getItem('lg-copy')).toBeNull()
  })

  it('falls back to the defaults when storage throws', () => {
    // Safari with blocked site data throws on the localStorage getter itself.
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked') })
    expect(() => writePref('cardDpr', '2')).not.toThrow()
    expect(() => readPrefs()).not.toThrow()
    expect(readPref('cardDpr')).toBe('3')
  })
})
