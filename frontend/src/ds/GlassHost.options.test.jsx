// @vitest-environment happy-dom
// GlassHost's sprite options: the prop wins, else the stored choice, else the approved look (cards 3x,
// drawn shadow). They are passed to the engine, a change rebuilds it, and a stored "fixed" presenter pick
// from the device gate is dropped. The engine is stubbed: no WebGL here.
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

describe('GlassHost sprite options', () => {
  it('defaults to the approved look, with no presenter choice', async () => {
    await view.render(<Page />)
    expect(lastOpts()).toMatchObject({ sprite: { cardDpr: 3, shadow: 'shader' }, watchdog: true })
    expect(lastOpts()).not.toHaveProperty('presenter')
    expect(document.documentElement.dataset.lgPresenter).toBeUndefined()
  })

  it('migrates a stored "fixed" pick: sprites all the same, and the key is gone', async () => {
    localStorage.setItem('lg-presenter', 'fixed')
    await view.render(<Page />)
    expect(localStorage.getItem('lg-presenter')).toBeNull()
    expect(lastOpts()).toMatchObject({ sprite: { cardDpr: 3, shadow: 'shader' } })
  })

  it('takes the stored choice, and the prop over it', async () => {
    localStorage.setItem('lg-card-dpr', '2')
    await view.render(<Page />)
    expect(lastOpts().sprite.cardDpr).toBe(2)
    await view.render(<Page cardDpr={3} shadow="css" />)
    expect(lastOpts().sprite).toEqual({ cardDpr: 3, shadow: 'css' })
  })

  it('rebuilds the engine when an option changes and hands its stats to statsRef', async () => {
    const statsRef = { current: null }
    await view.render(<Page shadow="shader" statsRef={statsRef} />)
    expect(statsRef.current).toBe(stats)
    await view.render(<Page shadow="css" statsRef={statsRef} />)
    expect(engine.dispose).toHaveBeenCalledTimes(1)
    expect(createGlassEngine).toHaveBeenCalledTimes(2)
  })
})
