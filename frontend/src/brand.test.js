import { describe, it, expect } from 'vitest'
import { BRAND, LINKS } from './brand.js'
import { t } from './lib/i18n-core.js'

describe('brand', () => {
  it('is Gains', () => {
    expect(BRAND.name).toBe('Gains')
    expect(BRAND.shortName).toBe('Gains')
  })

  it('says Gains in the strings the app shows, with no substitution step', () => {
    expect(t('Update to Gains v{0}', '1.2.3')).toBe('Update to Gains v1.2.3')
    expect(t('Documents/Gains is where copies go.')).toBe('Documents/Gains is where copies go.')
  })

  it('keeps the credit to the project Gains was forked from, which the licence requires', () => {
    expect(LINKS.copyright[0]).toBe('Copyright © 2026 Duarte Santos (openGym)')
    expect(LINKS.copyright[1]).toContain('steradrian')
    expect(LINKS.upstream.name).toBe('openGym')
  })

  it('links only to our own repositories for source, never to the upstream project', () => {
    expect(LINKS.upstream.url).toBeUndefined()
    for (const l of LINKS.source) expect(l.url).toContain('github.com/steradrian/')
    expect(LINKS.upstream.notice).toContain('github.com/steradrian/')
  })

  it('keeps the credit out of every other string: a name that arrives as an argument is shown as given', () => {
    expect(t('Built on {0} by {1}.', 'openGym', 'Duarte Santos')).toBe('Built on openGym by Duarte Santos.')
  })
})
