// @vitest-environment happy-dom
// GlassHost's presenter choice (M3): the prop wins, else localStorage 'lg-presenter', else fixed. It is
// passed to the engine with the sprite options, marked on <html data-lg-presenter>, and a change rebuilds
// the engine. The engine is stubbed: no WebGL here.
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from './render.test-util.js'

const stats = { snapshot: () => ({ gauges: {} }) }
const engine = { wake: vi.fn(), setFrozen: vi.fn(), dispose: vi.fn(), stats }
vi.mock('./glass/glass-engine.js', () => ({ createGlassEngine: vi.fn(() => engine) }))

const { createGlassEngine } = await import('./glass/glass-engine.js')
const { default: GlassHost } = await import('./GlassHost.jsx')
const view = useView()

function Page(props) {
  const ground = useRef(null)
  return (
    <div ref={ground} className="g-root">
      <GlassHost groundRef={ground} look="bloom" accent="cobalt" {...props} />
    </div>
  )
}

const lastOpts = () => createGlassEngine.mock.calls.at(-1)[0]

beforeEach(() => vi.clearAllMocks())
afterEach(() => localStorage.clear())

describe('GlassHost presenter', () => {
  it('defaults to the fixed presenter with the material-identical sprite options', async () => {
    await view.render(<Page />)
    expect(lastOpts()).toMatchObject({ presenter: 'fixed', sprite: { copy: 'draw2d', cardDpr: 3, shadow: 'shader' }, compare: false, watchdog: true })
    expect(document.documentElement.dataset.lgPresenter).toBe('fixed')
  })

  it('takes the stored choice, and the prop over it', async () => {
    localStorage.setItem('lg-presenter', 'sprite')
    await view.render(<Page />)
    expect(lastOpts().presenter).toBe('sprite')
    expect(document.documentElement.dataset.lgPresenter).toBe('sprite')
    await view.render(<Page presenter="fixed" />)
    expect(lastOpts().presenter).toBe('fixed')
  })

  it('rebuilds the engine when the presenter changes and hands its stats to statsRef', async () => {
    const statsRef = { current: null }
    await view.render(<Page presenter="fixed" statsRef={statsRef} />)
    expect(statsRef.current).toBe(stats)
    await view.render(<Page presenter="sprite" statsRef={statsRef} />)
    expect(engine.dispose).toHaveBeenCalledTimes(1)
    expect(createGlassEngine).toHaveBeenCalledTimes(2)
    expect(lastOpts().presenter).toBe('sprite')
  })
})
