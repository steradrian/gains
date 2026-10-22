// @vitest-environment happy-dom
// GlassHost falls back where there is no WebGL (jsdom-like environments, old devices), so a page that
// mounts it still renders, and it leaves no canvas behind.
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useView } from './render.test-util.js'
import GlassHost from './GlassHost.jsx'

const view = useView()

function Page({ onStatus }) {
  const ground = useRef(null)
  return (
    <div ref={ground} className="g-root">
      <GlassHost groundRef={ground} look="bloom" accent="cobalt" onStatus={onStatus} />
      <button type="button" className="g-glass">Hello</button>
    </div>
  )
}

describe('GlassHost', () => {
  it('reports fallback without WebGL, renders its children and mounts no canvas', async () => {
    const onStatus = vi.fn()
    await view.render(<Page onStatus={onStatus} />)
    expect(onStatus).toHaveBeenCalledWith('fallback')
    expect(onStatus).not.toHaveBeenCalledWith('webgl')
    expect(view.host.querySelector('button').textContent).toBe('Hello')
    expect(view.host.querySelector('canvas')).toBeNull()
  })

  it('leaves the page on the CSS material: data-lg is css, with no throw and no canvas', async () => {
    document.documentElement.dataset.lg = 'gl'
    await view.render(<Page />)
    expect(document.documentElement.dataset.lg).toBe('css')
    expect(document.querySelector('canvas')).toBeNull()
  })

  it('reports reduced when the device asks for reduced transparency', async () => {
    const mq = vi.spyOn(window, 'matchMedia').mockImplementation(q => ({ matches: q.includes('reduced-transparency'), addEventListener() {}, removeEventListener() {} }))
    const onStatus = vi.fn()
    await view.render(<Page onStatus={onStatus} />)
    expect(onStatus).toHaveBeenCalledWith('reduced')
    mq.mockRestore()
  })

  it('reports reduced, and follows the switch live, through html[data-transparency]', async () => {
    document.documentElement.dataset.transparency = 'reduce'
    await view.render(<Page />)
    expect(document.documentElement.dataset.lg).toBe('reduced')
    delete document.documentElement.dataset.transparency
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(document.documentElement.dataset.lg).toBe('css')
  })
})
