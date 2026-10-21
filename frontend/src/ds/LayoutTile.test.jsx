// @vitest-environment happy-dom
// LayoutTile: a drawn layout you can choose. A radio that says whether it is checked.
import { describe, expect, it, vi } from 'vitest'
import LayoutTile from './LayoutTile.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const tile = () => view.host.firstElementChild

describe('LayoutTile', () => {
  it('is a radio button named by its label, with the layout drawn aria-hidden', () => {
    view.render(<LayoutTile layout="cards" label="Cards" />)
    expect(tile().tagName).toBe('BUTTON')
    expect(tile().getAttribute('role')).toBe('radio')
    expect(tile().textContent).toBe('Cards')
    expect(tile().querySelector('svg').getAttribute('aria-hidden')).toBe('true')
  })

  it('announces whether it is selected, and lights when it is', () => {
    view.render(<LayoutTile layout="list" label="List" selected />)
    expect(tile().getAttribute('aria-checked')).toBe('true')
    expect(tile().classList.contains('on')).toBe(true)
    view.render(<LayoutTile layout="list" label="List" />)
    expect(tile().getAttribute('aria-checked')).toBe('false')
    expect(tile().classList.contains('on')).toBe(false)
  })

  it('calls onClick when chosen', () => {
    const onClick = vi.fn()
    view.render(<LayoutTile layout="compact" label="Compact" onClick={onClick} />)
    click(tile())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('draws a different picture for each layout', () => {
    const drawn = []
    for (const layout of ['cards', 'list', 'compact', 'focus']) {
      view.render(<LayoutTile layout={layout} label={layout} />)
      drawn.push(tile().querySelector('svg').innerHTML)
    }
    expect(new Set(drawn).size).toBe(4)
  })

  it('passes tabIndex on, so a group can keep one tab stop', () => {
    view.render(<LayoutTile layout="focus" label="Focus" tabIndex={-1} />)
    expect(tile().getAttribute('tabindex')).toBe('-1')
  })
})
