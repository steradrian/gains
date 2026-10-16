// @vitest-environment happy-dom
// useCount: a number that counts to its target; the Summary's `delay` is the first count's alone.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCount } from './use-count.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function Count({ target }) {
  const shown = useCount(target, 100, { from: 0, delay: 500 })
  return <output>{Math.round(shown)}</output>
}

let root, host
const show = target => act(() => root.render(<Count target={target} />))
const run = ms => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const value = () => Number(host.querySelector('output').textContent)

beforeEach(() => {
  vi.useFakeTimers()
  host = document.createElement('div')
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  vi.useRealTimers()
})

describe('useCount with a delay', () => {
  it('holds the first count for the delay, then counts', async () => {
    show(100)
    await run(300)
    expect(value()).toBe(0)
    await run(500)
    expect(value()).toBe(100)
  })

  it('counts a later target at once, without waiting the delay again', async () => {
    show(100)
    await run(800)
    expect(value()).toBe(100)
    show(300)
    await run(60)
    expect(value()).toBeGreaterThan(100)
    await run(100)
    expect(value()).toBe(300)
  })
})
