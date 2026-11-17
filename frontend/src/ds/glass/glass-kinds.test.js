// @vitest-environment happy-dom
// Which kind an element is (plan 3.2), the strength table, and how a pressed shape swells.
import { describe, expect, it } from 'vitest'
import { glassKind, isChrome, KIND, STRENGTH, swollen } from './glass-kinds.js'

function make(tag, cls = '', { w = 120, h = 60, glass, attrs = {} } = {}) {
  const el = document.createElement(tag)
  el.className = cls
  if (glass !== undefined) el.dataset.glass = glass
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.getBoundingClientRect = () => ({ width: w, height: h, left: 0, top: 0, right: w, bottom: h })
  return el
}

describe('glassKind', () => {
  it('makes .g-btn-glass a control', () => {
    expect(glassKind(make('button', 'g-btn g-btn-glass'))).toBe(KIND.CONTROL)
  })

  it('makes .g-glass a control on a button, a link, a role=button and a search label', () => {
    expect(glassKind(make('button', 'g-glass'))).toBe(KIND.CONTROL)
    expect(glassKind(make('a', 'g-glass', { attrs: { href: '#/x' } }))).toBe(KIND.CONTROL)
    expect(glassKind(make('div', 'g-glass', { attrs: { role: 'button' } }))).toBe(KIND.CONTROL)
    expect(glassKind(make('label', 'g-glass', { attrs: { role: 'search' } }))).toBe(KIND.CONTROL)
  })

  it('makes .g-glass on anything else a card', () => {
    expect(glassKind(make('div', 'g-glass'))).toBe(KIND.CARD)
    expect(glassKind(make('a', 'g-glass'))).toBe(KIND.CARD) // an anchor without href is not interactive
  })

  it('makes anything under 32px on a side flat', () => {
    expect(glassKind(make('button', 'g-glass', { w: 24, h: 24 }))).toBe(KIND.FLAT)
    expect(glassKind(make('div', 'g-glass', { w: 300, h: 31 }))).toBe(KIND.FLAT)
    expect(glassKind(make('div', 'g-glass', { w: 300, h: 32 }))).toBe(KIND.CARD)
  })

  it('makes a card inside a card flat, and leaves a control inside a card lensed', () => {
    expect(glassKind(make('div', 'g-glass'), KIND.CARD)).toBe(KIND.FLAT)
    expect(glassKind(make('button', 'g-glass'), KIND.CARD)).toBe(KIND.CONTROL)
    expect(glassKind(make('div', 'g-glass'), KIND.CONTROL)).toBe(KIND.CARD)
  })

  it('lets an explicit data-glass win over every rule, including size and nesting', () => {
    expect(glassKind(make('div', 'g-glass', { glass: 'bar' }))).toBe(KIND.BAR)
    expect(glassKind(make('div', 'g-glass', { glass: 'lens', w: 20, h: 20 }))).toBe(KIND.LENS)
    expect(glassKind(make('div', 'g-glass', { glass: 'card' }), KIND.CARD)).toBe(KIND.CARD)
    expect(glassKind(make('button', 'g-btn-glass', { glass: 'flat' }))).toBe(KIND.FLAT)
    expect(glassKind(make('span', '', { glass: 'tint', w: 54, h: 54 }))).toBe(KIND.TINT)
  })

  it('ignores an unknown data-glass value and infers instead', () => {
    expect(glassKind(make('div', 'g-glass', { glass: 'bogus' }))).toBe(KIND.CARD)
  })

  it('is flat for an element with no glass class and no data-glass', () => {
    expect(glassKind(make('div', 'g-tile'))).toBe(KIND.FLAT)
  })
})

describe('strength table', () => {
  it('has the prototype numbers for each lensed kind and a unique shader id', () => {
    expect(STRENGTH.bar).toMatchObject({ bezel: 14, D: 12, shadow: 0.24, swell: 1.2 })
    expect(STRENGTH.lens).toMatchObject({ bezel: 12, D: 6, shadow: 0, swell: 6 })
    expect(STRENGTH.control).toMatchObject({ bezel: 12, D: 10, shadow: 0.12, swell: 3.5 })
    expect(STRENGTH.card).toMatchObject({ bezel: 10, D: 6, shadow: 0.08, swell: 2, rim: 0.7 })
    expect(STRENGTH.tint.swell).toBe(3)
    const ids = Object.values(STRENGTH).map(k => k.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(STRENGTH.flat).toBeUndefined()
  })

  it('draws the bar, its lens and its + over the page and the rest under it', () => {
    expect(['bar', 'lens', 'tint'].every(isChrome)).toBe(true)
    expect(['control', 'card', 'flat'].some(isChrome)).toBe(false)
  })
})

describe('swollen', () => {
  const control = { kind: 'control', x: 100, y: 50, hw: 30, hh: 30, radius: 30 }

  it('grows by the kind swell times the press', () => {
    const s = swollen(control, 1)
    expect(s.hw).toBeCloseTo(33.5)
    expect(s.hh).toBeCloseTo(33.5)
    expect(s.radius).toBeCloseTo(33.5)
    expect(swollen(control, 0)).toMatchObject({ hw: 30, hh: 30, radius: 30 })
  })

  it('does not swell under reduced motion', () => {
    expect(swollen(control, 1, { reduced: true })).toMatchObject({ hw: 30, hh: 30 })
  })

  it('stretches a lens along its path and keeps it inside its bar', () => {
    const lens = { kind: 'lens', x: 100, y: 50, hw: 30, hh: 25, radius: 25 }
    const bar = { left: 90, right: 200, height: 60 }
    const s = swollen(lens, 0, { stretch: 8, bar })
    expect(s.hw).toBeLessThanOrEqual(30 + 8)
    expect(s.x - s.hw).toBeGreaterThanOrEqual(bar.left + 6 - 1e-9)
    expect(s.x + s.hw).toBeLessThanOrEqual(bar.right - 6 + 1e-9)
    expect(s.hh).toBeLessThanOrEqual(bar.height / 2 - 6)
    expect(s.radius).toBe(Math.min(s.hw, s.hh))
  })
})
