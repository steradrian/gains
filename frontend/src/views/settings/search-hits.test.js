// @vitest-environment happy-dom
// The rows of a settings search: the page and a hint of what is on the row.
import { describe, expect, it, vi } from 'vitest'
import { searchSettings } from '../settings-pages.js'
import { hitDetail, hitRows } from './search-hits.js'

const S = { theme: 'dark', accent: 'cobalt', unit: 'kg' }
const ctx = { user: null, mobile: false, canHaptic: false, lang: 'en' }

describe('hitRows', () => {
  it('a choice row names its choices after its page', () => {
    const hits = searchSettings('theme', ctx)
    const rows = hitRows(hits, S, ctx, vi.fn())
    const theme = rows.find(r => r.title === 'Theme')
    expect(theme.sub).toBe('Appearance · Dark, Light, System')
  })

  it('a row with many choices counts them', () => {
    const accent = searchSettings('accent', ctx).find(h => h.title === 'Accent color')
    expect(hitDetail(accent, S, ctx)).toBe('28 options')
  })

  it('a row with a value says it; a page says nothing extra', () => {
    const unit = searchSettings('weight unit', ctx).find(h => h.title === 'Weight unit')
    expect(hitRows([unit], S, ctx, vi.fn())[0].sub).toBe('Units & language · kg')
    const page = searchSettings('appearance', ctx).find(h => h.isPage)
    expect(hitDetail(page, S, ctx)).toBeNull()
  })

  it('a click hands the hit to the opener', () => {
    const onGo = vi.fn()
    const hits = searchSettings('theme', ctx)
    hitRows(hits, S, ctx, onGo)[0].onClick()
    expect(onGo).toHaveBeenCalledWith(hits[0])
  })
})
