// @vitest-environment happy-dom
// WaterGlasses: one glass per step up to the target, and a + that adds one. On its own it counts
// up to the target; given a value and onAdd it only asks.
import { describe, expect, it, vi } from 'vitest'
import WaterGlasses from './WaterGlasses.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const glasses = () => [...view.host.querySelectorAll('.g-water-g i')]
const filled = () => glasses().filter(g => g.classList.contains('on')).length
const add = () => view.host.querySelector('.g-water-add')

describe('WaterGlasses', () => {
  it('draws target / step glasses and fills value / step of them', () => {
    view.render(<WaterGlasses value={1.25} target={2.5} />)
    expect(glasses()).toHaveLength(10)
    expect(filled()).toBe(5)
    expect(view.host.firstElementChild.getAttribute('aria-label')).toBe('Water, 1.25 of 2.5 L')
  })

  it('names the add button by the glass it adds', () => {
    view.render(<WaterGlasses />)
    expect(add().getAttribute('aria-label')).toBe('Add 250 ml of water')
    view.render(<WaterGlasses step={0.5} target={3} />)
    expect(add().getAttribute('aria-label')).toBe('Add 500 ml of water')
    expect(glasses()).toHaveLength(6)
  })

  it('speaks the caller\'s labels, in the person\'s units, over its litre defaults', () => {
    view.render(<WaterGlasses value={0.5} target={2} step={0.25} label="Water, 17 fl oz of 68 fl oz" addLabel="Add a glass of water, 8 fl oz" />)
    expect(view.host.firstElementChild.getAttribute('aria-label')).toBe('Water, 17 fl oz of 68 fl oz')
    expect(add().getAttribute('aria-label')).toBe('Add a glass of water, 8 fl oz')
  })

  it('fills a glass on each tap and stops at the target when it keeps its own count', () => {
    const onAdd = vi.fn()
    view.render(<WaterGlasses target={0.5} onAdd={onAdd} />)
    click(add())
    expect(filled()).toBe(1)
    click(add())
    click(add())
    expect(filled()).toBe(2)
    expect(onAdd.mock.calls.map(c => c[0])).toEqual([0.25, 0.5, 0.75])
  })

  it('is controlled with a value and onAdd: it reports the new total and waits to be told', () => {
    const onAdd = vi.fn()
    view.render(<WaterGlasses value={1} onAdd={onAdd} />)
    click(add())
    expect(onAdd).toHaveBeenCalledWith(1.25)
    expect(filled()).toBe(4)
    view.render(<WaterGlasses value={1.25} onAdd={onAdd} />)
    expect(filled()).toBe(5)
  })

  it('does not drift on small steps', () => {
    const onAdd = vi.fn()
    view.render(<WaterGlasses value={0.2} step={0.1} target={1} onAdd={onAdd} />)
    click(add())
    expect(onAdd).toHaveBeenCalledWith(0.3)
  })

  it('never shows more filled than there are glasses', () => {
    view.render(<WaterGlasses value={9} target={2.5} />)
    expect(filled()).toBe(10)
  })

  describe('fill animation', () => {
    const animating = (cls) => glasses().map((g, k) => (g.classList.contains(cls) ? k : -1)).filter(k => k >= 0)
    const controlled = (value) => <WaterGlasses value={value} target={2.5} onAdd={() => {}} />

    it('draws each glass as an svg with water clipped to its interior', () => {
      view.render(<WaterGlasses value={0.5} target={1} />)
      expect(glasses()).toHaveLength(4)
      for (const g of glasses()) {
        expect(g.querySelector('svg clipPath path')).not.toBeNull()
        expect(g.querySelector('g[clip-path] .g-wg-water')).not.toBeNull()
      }
    })

    it('animates nothing on mount, or on a re-render with the same value', () => {
      view.render(controlled(1))
      expect(animating('fill')).toEqual([])
      expect(animating('drain')).toEqual([])
      view.render(controlled(1))
      expect(animating('fill')).toEqual([])
    })

    it('animates only the glass that just filled, and keeps it through a re-render', () => {
      view.render(controlled(1))
      view.render(controlled(1.25))
      expect(filled()).toBe(5)
      expect(animating('fill')).toEqual([4])
      expect(animating('drain')).toEqual([])
      view.render(controlled(1.25))
      expect(animating('fill')).toEqual([4])
    })

    it('fills the glass on tap when it counts for itself', () => {
      view.render(<WaterGlasses target={1} />)
      click(add())
      expect(animating('fill')).toEqual([0])
    })

    it('drains the glass that emptied, with no fill', () => {
      view.render(controlled(1.25))
      view.render(controlled(1))
      expect(filled()).toBe(4)
      expect(animating('drain')).toEqual([4])
      expect(animating('fill')).toEqual([])
    })

    it('changes instantly under reduced motion: no fill or drain state', () => {
      document.documentElement.dataset.motion = 'reduce'
      try {
        view.render(controlled(1))
        view.render(controlled(1.25))
        expect(filled()).toBe(5)
        expect(animating('fill')).toEqual([])
        view.render(controlled(0.5))
        expect(animating('drain')).toEqual([])
      } finally {
        delete document.documentElement.dataset.motion
      }
    })
  })

  it('is a link when it has an href', () => {
    view.render(<WaterGlasses href="#/water" />)
    expect(add().tagName).toBe('A')
  })
})
