// @vitest-environment happy-dom
// The stored presenter choice: known values only, defaults when missing or when storage throws.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPref, readPrefs, writePref } from './glass-prefs.js'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('glass prefs', () => {
  it('defaults to the fixed presenter and the material-identical sprite options', () => {
    expect(readPrefs()).toEqual({ presenter: 'fixed', copy: 'draw2d', cardDpr: 3, shadow: 'shader' })
  })

  it('stores and reads back a known value, and ignores an unknown one', () => {
    writePref('presenter', 'sprite')
    expect(localStorage.getItem('lg-presenter')).toBe('sprite')
    expect(readPref('presenter')).toBe('sprite')
    writePref('presenter', 'nope')
    expect(readPref('presenter')).toBe('sprite')
    localStorage.setItem('lg-card-dpr', '7')
    expect(readPrefs().cardDpr).toBe(3)
  })

  it('falls back to the defaults when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => writePref('presenter', 'sprite')).not.toThrow()
    expect(readPref('presenter')).toBe('fixed')
  })
})
