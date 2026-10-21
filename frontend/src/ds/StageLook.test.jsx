// @vitest-environment happy-dom
// StageLook: what draws the chosen look behind the app. Classic draws nothing here; a look is one
// canvas, drawn still unless it may move, and gone (Classic shows) when WebGL is not there.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from './render.test-util.js'
import StageLook from './StageLook.jsx'

const renderer = { draw: vi.fn(), dispose: vi.fn() }
const createRenderer = vi.hoisted(() => vi.fn())
vi.mock('../lib/stage-look/renderer.js', () => ({ createRenderer }))

const view = useView()
const canvas = () => view.host.querySelector('canvas')
const props = { look: 'silk', intensity: 0.45, accent: 'cobalt' }
const lastDraw = () => renderer.draw.mock.calls.at(-1)[0]

let raf, caf, hidden
beforeEach(() => {
  renderer.draw.mockReset()
  renderer.dispose.mockReset()
  createRenderer.mockReset()
  createRenderer.mockReturnValue(renderer)
  raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 7)
  caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
})
afterEach(() => vi.restoreAllMocks())

describe('StageLook', () => {
  it('renders no canvas for Classic and never asks for WebGL', () => {
    view.render(<StageLook {...props} look="plain" />)
    expect(canvas()).toBeNull()
    expect(createRenderer).not.toHaveBeenCalled()
  })

  it('renders one hidden canvas for a look and draws it once at the resting phase', () => {
    view.render(<StageLook {...props} />)
    expect(canvas().className).toBe('g-stage-look')
    expect(canvas().getAttribute('aria-hidden')).toBe('true')
    expect(renderer.draw).toHaveBeenCalledTimes(1)
    expect(lastDraw()).toMatchObject({ look: 'silk', phase: 0.12, calm: true })
    expect(lastDraw().theme.intensity).toBe(0.45)
  })

  it('draws a pushed page at half strength with no calm zone', () => {
    view.render(<StageLook {...props} pushed />)
    expect(lastDraw().theme.intensity).toBeCloseTo(0.225)
    expect(lastDraw().calm).toBe(false)
  })

  it('redraws the still frame when a prop changes', () => {
    view.render(<StageLook {...props} />)
    view.render(<StageLook {...props} intensity={0.8} accent="blossom" />)
    expect(renderer.draw).toHaveBeenCalledTimes(2)
    expect(lastDraw().theme.intensity).toBe(0.8)
    expect(lastDraw().theme.id).toBe('blossom')
  })

  it('never calls requestAnimationFrame without motion', () => {
    view.render(<StageLook {...props} motion={false} />)
    expect(raf).not.toHaveBeenCalled()
  })

  it('does not move on a pushed page even with motion on', () => {
    view.render(<StageLook {...props} motion pushed />)
    expect(raf).not.toHaveBeenCalled()
  })

  it('loops when it may move, and stops at unmount', () => {
    view.render(<StageLook {...props} motion />)
    expect(raf).toHaveBeenCalledTimes(1)
    view.render(<StageLook {...props} look="plain" />)
    expect(caf).toHaveBeenCalledWith(7)
    expect(renderer.dispose).toHaveBeenCalled()
  })

  it('throttles to about 30 fps and loops the phase over 40 seconds', () => {
    let frame
    raf.mockImplementation(cb => { frame = cb; return 7 })
    const t0 = performance.now()
    view.render(<StageLook {...props} motion />)
    renderer.draw.mockClear()
    act(() => frame(t0 + 10_000))
    expect(lastDraw().phase).toBeCloseTo(0.12 + 0.25, 1)
    act(() => frame(t0 + 10_010))
    expect(renderer.draw).toHaveBeenCalledTimes(1)
    act(() => frame(t0 + 10_050))
    expect(renderer.draw).toHaveBeenCalledTimes(2)
  })

  it('stops while the document is hidden and restarts when it is shown', () => {
    view.render(<StageLook {...props} motion />)
    raf.mockClear()
    caf.mockClear()
    hidden = true
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(caf).toHaveBeenCalled()
    expect(raf).not.toHaveBeenCalled()
    hidden = false
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(raf).toHaveBeenCalledTimes(1)
  })

  it('does not start the loop in a hidden document', () => {
    hidden = true
    view.render(<StageLook {...props} motion />)
    expect(raf).not.toHaveBeenCalled()
  })

  it('stands still again when motion is switched off', () => {
    view.render(<StageLook {...props} motion />)
    caf.mockClear()
    view.render(<StageLook {...props} motion={false} />)
    expect(caf).toHaveBeenCalled()
  })

  it('caps the pixel ratio at 2', () => {
    const was = window.devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 })
    view.render(<StageLook {...props} />)
    expect(lastDraw().dpr).toBe(2)
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: was })
  })

  it('leaves no canvas when WebGL is not available', () => {
    createRenderer.mockReturnValue(null)
    view.render(<StageLook {...props} />)
    expect(canvas()).toBeNull()
  })

  it('leaves no canvas when the shader does not compile', () => {
    createRenderer.mockImplementation(() => { throw new Error('bad shader') })
    view.render(<StageLook {...props} />)
    expect(canvas()).toBeNull()
  })

  it('leaves no canvas when the context is lost', () => {
    view.render(<StageLook {...props} />)
    act(() => { canvas().dispatchEvent(new Event('webglcontextlost', { cancelable: true })) })
    expect(canvas()).toBeNull()
  })
})
