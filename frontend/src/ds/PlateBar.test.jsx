// @vitest-environment happy-dom
// PlateBar: the loaded bar side on. The drawing says nothing in words; what a screen reader hears
// is the caller's label, and plates are drawn by their size against the biggest of the unit.
import { describe, expect, it } from 'vitest'
import PlateBar from './PlateBar.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const svg = () => view.host.querySelector('svg')
const plates = () => [...view.host.querySelectorAll('.g-plate')]
const heights = () => plates().map(p => Number(p.getAttribute('height')))

describe('PlateBar', () => {
  it('is an image named by the caller\'s label', () => {
    view.render(<PlateBar plates={[25, 5]} unit="kg" label="80 kg: bar plus 25 and 5 each side" />)
    expect(svg().getAttribute('role')).toBe('img')
    expect(svg().getAttribute('aria-label')).toBe('80 kg: bar plus 25 and 5 each side')
    expect(svg().hasAttribute('aria-hidden')).toBe(false)
  })

  it('is hidden from a screen reader when it has no label, and says nothing in words itself', () => {
    view.render(<PlateBar plates={[25]} />)
    expect(svg().getAttribute('aria-hidden')).toBe('true')
    expect(svg().hasAttribute('role')).toBe(false)
    expect(view.host.textContent).toBe('')
  })

  it('draws the bar and a plate each side for every weight, the first in the accent and the next in its partner', () => {
    view.render(<PlateBar plates={[25, 10, 5]} label="x" />)
    expect(view.host.querySelectorAll('.g-plate-bar')).toHaveLength(1)
    expect(plates()).toHaveLength(6)
    expect(plates().filter(p => p.classList.contains('g-plate-2'))).toHaveLength(4)
    // mirrored about the middle of the bar
    const [right, left] = plates()
    expect(Number(right.getAttribute('x')) + Number(right.getAttribute('width')) / 2 - 160).toBeCloseTo(160 - (Number(left.getAttribute('x')) + Number(left.getAttribute('width')) / 2))
  })

  it('draws a bigger plate taller, against the biggest plate of the unit', () => {
    view.render(<PlateBar plates={[25, 10, 5, 2.5]} unit="kg" label="x" />)
    const [a, , b, , c, , d] = heights()
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
    expect(c).toBeGreaterThan(d)
    // a 45 lb plate is as big in pounds as a 25 kg plate is in kilograms
    const kg = heights()[0]
    view.render(<PlateBar plates={[45]} unit="lb" label="x" />)
    expect(heights()[0]).toBe(kg)
  })

  it('draws a bar with nothing on it', () => {
    view.render(<PlateBar plates={[]} label="20 kg: the bar alone" />)
    expect(plates()).toHaveLength(0)
    expect(view.host.querySelectorAll('.g-plate-bar')).toHaveLength(1)
  })

  it('stops drawing plates that would run off the bar', () => {
    view.render(<PlateBar plates={Array(30).fill(25)} label="x" />)
    expect(plates().length).toBeGreaterThan(0)
    expect(plates().length).toBeLessThan(60)
    for (const p of plates()) {
      const x = Number(p.getAttribute('x'))
      expect(x).toBeGreaterThanOrEqual(6)
      expect(x + Number(p.getAttribute('width'))).toBeLessThanOrEqual(314)
    }
  })

  it('puts the caller\'s children in a caption', () => {
    view.render(<PlateBar plates={[20]} label="x">From your plates at Home gym.</PlateBar>)
    expect(view.host.querySelector('figcaption').textContent).toBe('From your plates at Home gym.')
    view.render(<PlateBar plates={[20]} label="x" />)
    expect(view.host.querySelector('figcaption')).toBeNull()
  })
})
