// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWatchdog, glassIsOff, OFF_KEY } from './glass-watchdog.js'
import { parseRgba } from './material-probe.js'

// Feeds `n` back-to-back drawn frames, 16 ms apart, from `start`.
function run(dog, n, { cpu, gap = 16, start = 1000 }) {
  let t = start
  for (let i = 0; i < n; i++) { dog.frame(true, cpu, gap, t); t += gap }
  return t
}

describe('glass watchdog', () => {
  beforeEach(() => sessionStorage.clear())

  it('does not trip on cheap frames', () => {
    const onTrip = vi.fn()
    run(createWatchdog({ onTrip }), 400, { cpu: 2 })
    expect(onTrip).not.toHaveBeenCalled()
    expect(glassIsOff()).toBe(false)
  })

  it('trips after two slow windows and remembers it for the session', () => {
    const onTrip = vi.fn()
    run(createWatchdog({ onTrip }), 400, { cpu: 9 })
    expect(onTrip).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(OFF_KEY)).toBe('1')
    expect(glassIsOff()).toBe(true)
  })

  it('trips on a slow rAF interval even when the CPU cost is low', () => {
    const onTrip = vi.fn()
    run(createWatchdog({ onTrip }), 200, { cpu: 1, gap: 33 })
    expect(onTrip).toHaveBeenCalledTimes(1)
  })

  it('does not trip on one slow window followed by a good one', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    const t = run(dog, 70, { cpu: 9 })
    run(dog, 200, { cpu: 1, start: t })
    expect(onTrip).not.toHaveBeenCalled()
  })

  it('starts over after the loop went idle (a gap over 100 ms)', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    let t = run(dog, 70, { cpu: 9 })
    t = run(dog, 70, { cpu: 9, start: t + 200 })
    expect(onTrip).not.toHaveBeenCalled()
  })

  it('trips on slow drawn frames at the 15 Hz look cadence (draw, then idle frames)', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    let t = 1000
    for (let i = 0; i < 160; i++) { dog.frame(i % 4 === 0, i % 4 === 0 ? 20 : 0.2, 16, t); t += 16 }
    expect(onTrip).toHaveBeenCalledTimes(1)
  })

  it('does not trip on cheap drawn frames between idle frames', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    let t = 1000
    for (let i = 0; i < 400; i++) { dog.frame(i % 4 === 0, i % 4 === 0 ? 2 : 0.2, 16, t); t += 16 }
    expect(onTrip).not.toHaveBeenCalled()
  })

  it('keeps a window going across idle frames under a scroll refresh, and trips on its slow rAF interval', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    let t = 1000
    for (let i = 0; i < 100; i++) { dog.frame(i % 5 === 0, 1, 30, t); t += 30 }
    expect(onTrip).toHaveBeenCalledTimes(1)
  })
})

describe('parseRgba', () => {
  it('reads the rgb and rgba text a computed colour comes back as', () => {
    expect(parseRgba('rgb(255, 255, 255)')).toEqual([1, 1, 1, 1])
    expect(parseRgba('rgba(5, 10, 41, 0.5)')[3]).toBe(0.5)
    expect(parseRgba('rgb(0 0 0 / 25%)')[3]).toBe(0.25)
  })

  it('gives null for anything else', () => {
    expect(parseRgba('')).toBeNull()
    expect(parseRgba('color(srgb 1 1 1)')).toBeNull()
  })
})
