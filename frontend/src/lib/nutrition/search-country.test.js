// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { countryOfRegion, defaultSearchCountry, regionOfLocale } from './search-country.js'
import { OFF_COUNTRIES } from './settings-lists.js'
import { offSearchUrl } from './off.js'
import { settingOf } from './use-nt-settings.js'

afterEach(() => vi.unstubAllGlobals())

describe('the search country list', () => {
  it('offers Romania, by its ISO region', () => {
    expect(OFF_COUNTRIES.Romania).toBe('RO')
    expect(Object.keys(OFF_COUNTRIES)).toContain('Romania')
  })
})

describe('the default search country', () => {
  it('is the region of the device language: ro-RO is Romania', () => {
    expect(regionOfLocale('ro-RO')).toBe('RO')
    expect(regionOfLocale('en_GB')).toBe('GB')
    expect(regionOfLocale('zh-Hant-TW')).toBe('TW')
    expect(regionOfLocale('ro')).toBe('')
    expect(countryOfRegion('RO')).toBe('Romania')
    expect(defaultSearchCountry(['ro-RO'])).toBe('Romania')
  })

  it('takes the first language that names a region the picker offers, else World', () => {
    expect(defaultSearchCountry(['en', 'ro-RO'])).toBe('Romania')
    expect(defaultSearchCountry(['bg-BG', 'de-DE'])).toBe('Germany')
    expect(defaultSearchCountry(['bg-BG'])).toBe('World')
    expect(defaultSearchCountry([])).toBe('World')
  })

  it('reads the browser languages when none are given', () => {
    vi.stubGlobal('navigator', { languages: ['ro-RO', 'en-US'], language: 'ro-RO' })
    expect(defaultSearchCountry()).toBe('Romania')
  })

  it('applies only while the setting was never saved: an explicit choice, World included, wins', () => {
    vi.stubGlobal('navigator', { languages: ['ro-RO'], language: 'ro-RO' })
    expect(settingOf({}, 'offSearchCountry')).toBe('Romania')
    expect(settingOf(undefined, 'offSearchCountry')).toBe('Romania')
    expect(settingOf({ offSearchCountry: 'World' }, 'offSearchCountry')).toBe('World')
    expect(settingOf({ offSearchCountry: 'Germany' }, 'offSearchCountry')).toBe('Germany')
  })
})

describe('the hub request', () => {
  it('carries only q, page, page_size and langs, with the country filter inside q', () => {
    const url = new URL(offSearchUrl('nutella', { country: 'Romania', lang: 'ro' }))
    expect([...url.searchParams.keys()].sort()).toEqual(['langs', 'page', 'page_size', 'q'])
    expect(url.searchParams.get('q')).toBe('nutella +countries_tags:"en:romania"')
  })

  it('has no filter for World', () => {
    expect(new URL(offSearchUrl('nutella', { country: 'World' })).searchParams.get('q')).toBe('nutella')
  })
})
