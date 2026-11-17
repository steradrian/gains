// @vitest-environment happy-dom
// LookTile: a radio with a still preview of the look. No WebGL (and Classic) leaves the CSS gradient.
import { afterEach, describe, expect, it, vi } from 'vitest'
import LookTile from './LookTile.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const tile = () => view.host.querySelector('[role="radio"]')

afterEach(() => { vi.restoreAllMocks() })

describe('LookTile', () => {
  it('is a radio with the look\'s name, lit when selected', () => {
    view.render(<LookTile look="silk" accent="cobalt" label="Silk" selected onSelect={() => {}} />)
    expect(tile().textContent).toBe('Silk')
    expect(tile().getAttribute('aria-checked')).toBe('true')
    view.render(<LookTile look="silk" accent="cobalt" label="Silk" onSelect={() => {}} />)
    expect(tile().getAttribute('aria-checked')).toBe('false')
  })

  it('a tap hands the look id to onSelect', () => {
    const onSelect = vi.fn()
    view.render(<LookTile look="linen" accent="cobalt" label="Linen" onSelect={onSelect} haptic={false} />)
    click(tile())
    expect(onSelect).toHaveBeenCalledWith('linen')
  })

  it('without WebGL the preview is the CSS gradient: no canvas is left behind', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    view.render(<LookTile look="bloom" accent="cobalt" label="Bloom" onSelect={() => {}} />)
    expect(view.host.querySelector('canvas')).toBeNull()
    expect(view.host.querySelector('.g-ltile-pv')).not.toBeNull()
  })

  it('Classic is the CSS stage itself and never asks for a context', () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    view.render(<LookTile look="plain" accent="cobalt" label="Classic" onSelect={() => {}} />)
    expect(view.host.querySelector('canvas')).toBeNull()
    expect(getContext).not.toHaveBeenCalled()
  })

  it('a look other than Classic starts a canvas', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    view.render(<LookTile look="lines" accent="cobalt" label="Lines" onSelect={() => {}} />)
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalled()
  })
})
