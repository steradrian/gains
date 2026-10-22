// @vitest-environment happy-dom
// GlassHost freezes the engine (no wake) while a sheet or the search overlay is open and while the page has
// no stage, and sets <html data-lg> from what the engine reports. The engine is stubbed: no WebGL here.
import { act, useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSearch } from '../lib/search/session.js'
import { useUI } from '../store/useUI.js'
import { useView } from './render.test-util.js'

const engine = { wake: vi.fn(), setFrozen: vi.fn(), dispose: vi.fn() }
let report
vi.mock('./glass/glass-engine.js', () => ({
  createGlassEngine: vi.fn(({ onStatus }) => { report = onStatus; return engine }),
}))

const { default: GlassHost } = await import('./GlassHost.jsx')
const view = useView()

function Page({ stage }) {
  const ground = useRef(null)
  return (
    <div ref={ground} className="g-root">
      <GlassHost groundRef={ground} look="bloom" accent="cobalt" />
      {stage && <div className="g-route" data-shared=""><div className="g-stage" /></div>}
    </div>
  )
}

const frozen = () => engine.setFrozen.mock.calls.at(-1)?.[0]

beforeEach(() => {
  vi.clearAllMocks()
  useUI.setState({ sheets: [] })
  useSearch.setState({ open: false })
})

describe('GlassHost with an engine', () => {
  it('is gl only while the engine is live and a stage is on screen', async () => {
    await view.render(<Page stage />)
    expect(document.documentElement.dataset.lg).toBe('css')
    vi.useFakeTimers()
    try {
      act(() => report('webgl'))
      // The reveal is a 300 ms cross-fade: the canvases fade in over the CSS material, then data-lg flips.
      expect(document.documentElement.dataset.lg).toBe('css')
      expect(document.documentElement.dataset.lgFade).toBe('')
      act(() => { vi.advanceTimersByTime(300) })
      expect(document.documentElement.dataset.lg).toBe('gl')
      expect(document.documentElement.dataset.lgFade).toBeUndefined()
      act(() => report('fallback'))
      expect(document.documentElement.dataset.lg).toBe('css')
    } finally { vi.useRealTimers() }
  })

  it('reveals at once under reduce motion, and a fallback mid-fade cancels it', async () => {
    await view.render(<Page stage />)
    document.documentElement.dataset.motion = 'reduce'
    try {
      act(() => report('webgl'))
      expect(document.documentElement.dataset.lg).toBe('gl')
      act(() => report('fallback'))
    } finally { delete document.documentElement.dataset.motion }
    act(() => report('webgl'))
    expect(document.documentElement.dataset.lgFade).toBe('')
    act(() => report('fallback'))
    expect(document.documentElement.dataset.lgFade).toBeUndefined()
    expect(document.documentElement.dataset.lg).toBe('css')
  })

  it('stays on the CSS material and frozen on a page with no stage', async () => {
    await view.render(<Page stage={false} />)
    act(() => report('webgl'))
    expect(document.documentElement.dataset.lg).toBe('css')
    expect(frozen()).toBe(true)
  })

  it('freezes while a sheet is open and wakes again when it closes', async () => {
    await view.render(<Page stage />)
    expect(frozen()).toBe(false)
    act(() => useUI.setState({ sheets: [{ id: 1 }] }))
    expect(frozen()).toBe(true)
    act(() => useUI.setState({ sheets: [] }))
    expect(frozen()).toBe(false)
  })

  it('freezes while the search overlay is open', async () => {
    await view.render(<Page stage />)
    act(() => useSearch.setState({ open: true }))
    expect(frozen()).toBe(true)
  })

  it('builds the engine when Reduce transparency turns off after load, and disposes it when it turns on', async () => {
    const { createGlassEngine } = await import('./glass/glass-engine.js')
    document.documentElement.dataset.transparency = 'reduce'
    await view.render(<Page stage />)
    expect(createGlassEngine).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.lg).toBe('reduced')
    delete document.documentElement.dataset.transparency
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(createGlassEngine).toHaveBeenCalledTimes(1)
    document.documentElement.dataset.transparency = 'reduce'
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(engine.dispose).toHaveBeenCalled()
    expect(document.documentElement.dataset.lg).toBe('reduced')
    delete document.documentElement.dataset.transparency
  })
})
