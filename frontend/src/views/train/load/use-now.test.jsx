// @vitest-environment happy-dom
// useNow (finding 38): the clock the Training load memos key on. It used to return Date.now() on
// every render, so each render was a new key and no memo ever hit.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from './use-training-load.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const START = new Date(2026, 9, 21, 9).getTime()
let host, root, seen

function Probe({ n }) {
  seen.push(useNow())
  return <i>{n}</i>
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(START)
  seen = []
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
})

describe('useNow', () => {
  it('holds the same timestamp across renders between ticks', () => {
    act(() => root.render(<Probe n={1} />))
    vi.setSystemTime(START + 10000)
    act(() => root.render(<Probe n={2} />))
    act(() => root.render(<Probe n={3} />))
    expect(seen.length).toBeGreaterThanOrEqual(3)
    expect(new Set(seen)).toEqual(new Set([START]))
  })

  it('moves on once a minute', () => {
    act(() => root.render(<Probe n={1} />))
    act(() => { vi.advanceTimersByTime(60000) })
    expect(seen.at(-1)).toBe(START + 60000)
  })
})
