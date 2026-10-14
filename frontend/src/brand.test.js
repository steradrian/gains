import { describe, it, expect, afterEach } from 'vitest'
import { BRAND, brandText } from './brand.js'
import { t, tn, _setLangState } from './lib/i18n-core.js'

describe('brand', () => {
  afterEach(() => _setLangState('en', {}, null, null))

  it('swaps upstream\'s name for the brand name in English source strings', () => {
    expect(t('Update to openGym v{0}', '1.2.3')).toBe(`Update to ${BRAND.name} v1.2.3`)
  })

  it('does it for a locale pack without the pack being edited', () => {
    _setLangState('de', { 'Welcome to openGym': 'Willkommen bei openGym' }, null, null)
    expect(t('Welcome to openGym')).toBe(`Willkommen bei ${BRAND.name}`)
  })

  it('does it for plural forms', () => {
    expect(tn('{0} openGym set', '{0} openGym sets', 2)).toBe(`2 ${BRAND.name} sets`)
  })

  it('leaves a name that arrives as an argument alone, so the upstream credit survives', () => {
    expect(t('Built on {0} by {1}.', 'openGym', 'Duarte Santos')).toBe('Built on openGym by Duarte Santos.')
  })

  it('picks the article for the new name', () => {
    expect(t('That file isn’t an openGym backup.')).toBe(`That file isn’t a ${BRAND.name} backup.`)
  })

  it('leaves a path or URL alone: Documents/openGym is a real folder on the phone', () => {
    expect(t('openGym copies go to Documents/openGym again.')).toBe(`${BRAND.name} copies go to Documents/openGym again.`)
  })

  it('passes non-strings through', () => {
    expect(brandText(undefined)).toBeUndefined()
  })
})
