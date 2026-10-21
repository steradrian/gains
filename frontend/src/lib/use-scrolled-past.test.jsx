// @vitest-environment happy-dom
// useScrolledPast (Eat's "N left" in the header): the line an element has to pass is the pinned
// header's real bottom edge, measured, not a constant plus an inset the CSS cannot resolve.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrolledPast } from './use-scrolled-past.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, header, observers, seen
class FakeIO {
  constructor(cb, opts) { this.cb = cb; this.opts = opts; observers.push(this) }
  observe() {}
  disconnect() { this.gone = true }
}
function Probe() {
  const [ref, past] = useScrolledPast()
  seen = past
  return <div ref={ref} />
}

beforeEach(() => {
  observers = []
  vi.stubGlobal('IntersectionObserver', FakeIO)
  header = document.createElement('header')
  header.className = 'g-shdr g-shdr-pin'
  header.getBoundingClientRect = () => ({ top: 0, bottom: 105, left: 0, right: 375, width: 375, height: 105 })
  document.body.appendChild(header)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  header.remove()
  vi.unstubAllGlobals()
})

describe('useScrolledPast', () => {
  it('watches for the element passing the pinned header\'s measured bottom edge (status bar and connection row in it)', async () => {
    await act(async () => root.render(<Probe />))
    const live = observers.filter(o => !o.gone)
    expect(live).toHaveLength(1)
    expect(live[0].opts.rootMargin).toBe('-105px 0px 0px 0px')
    await act(async () => live[0].cb([{ isIntersecting: false, boundingClientRect: { top: 60 } }]))
    expect(seen).toBe(true)
    await act(async () => live[0].cb([{ isIntersecting: true, boundingClientRect: { top: 120 } }]))
    expect(seen).toBe(false)
  })

  it('without a pinned header, the line is the window\'s top', async () => {
    header.remove()
    await act(async () => root.render(<Probe />))
    expect(observers.filter(o => !o.gone)[0].opts.rootMargin).toBe('-0px 0px 0px 0px')
  })
})
