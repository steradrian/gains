// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWatchdog, fallbackReason, glassIsOff, GRACE_MS, OFF_KEY, PROBE_MAX_MS, REASON_KEY } from './glass-watchdog.js'
import { parseRgba } from './material-probe.js'

// Feeds `n` frames `gap` ms apart from `start`; `drawEvery` 1 draws on every frame, 4 on every fourth.
function run(dog, n, { cpu, gap = 16, start = 1000, drawEvery = 1 }) {
  let t = start
  for (let i = 0; i < n; i++) {
    const drew = i % drawEvery === 0
    dog.frame(drew, drew ? cpu : 0.2, gap, t)
    t += gap
  }
  return t
}
const PAST_PROBE = Math.ceil(PROBE_MAX_MS / 16) + 200 // frames at 60 Hz that outlast the probation

describe('glass watchdog', () => {
  beforeEach(() => sessionStorage.clear())

  it('does not trip on cheap frames, and proves itself after the reveal delay', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    const t = run(dog, 100, { cpu: 2 })
    expect(dog.proven(t)).toBe(false) // 1.6 s in: too early
    run(dog, 200, { cpu: 2, start: t })
    expect(dog.proven(t + 200 * 16)).toBe(true)
    expect(onTrip).not.toHaveBeenCalled()
    expect(glassIsOff()).toBe(false)
  })

  it('startup slow frames never trip, and the glass stays hidden until they pass', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    // 5 s of boot: heavy CPU and 60 ms intervals (lazy chunks, shader compiles, the first atlas)
    let t = run(dog, 80, { cpu: 25, gap: 60 })
    expect(onTrip).not.toHaveBeenCalled()
    expect(dog.proven(t)).toBe(false)
    t = run(dog, 300, { cpu: 2, start: t })
    expect(onTrip).not.toHaveBeenCalled()
    expect(dog.proven(t)).toBe(true)
  })

  it('a 30 Hz cadence (Low Power Mode) never trips and is proven', () => {
    const onTrip = vi.fn()
    for (const drawEvery of [1, 4]) {
      const dog = createWatchdog({ onTrip })
      const t = run(dog, PAST_PROBE, { cpu: 2, gap: 33.3, drawEvery })
      expect(dog.proven(t)).toBe(true)
    }
    expect(onTrip).not.toHaveBeenCalled()
    expect(glassIsOff()).toBe(false)
  })

  it('a 120 Hz cadence never trips', () => {
    const onTrip = vi.fn()
    run(createWatchdog({ onTrip }), 3000, { cpu: 2, gap: 8.3 })
    expect(onTrip).not.toHaveBeenCalled()
  })

  it('genuinely slow glass CPU trips, records the metric, and the glass was never shown', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    const t = run(dog, PAST_PROBE, { cpu: 9 })
    expect(onTrip).toHaveBeenCalledTimes(1)
    expect(glassIsOff()).toBe(true)
    expect(dog.proven(t)).toBe(false)
    expect(sessionStorage.getItem(REASON_KEY)).toMatch(/^watchdog:cpu 9\.0ms/)
    expect(fallbackReason()).toMatch(/watchdog:cpu/)
    expect(sessionStorage.getItem(OFF_KEY)).toBeNull() // a trip is for this page, not the session
  })

  it('slow CPU while the glass is still unproven only delays the reveal, until PROBE_MAX_MS', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    const t = run(dog, 300, { cpu: 9 }) // 4.8 s
    expect(onTrip).not.toHaveBeenCalled()
    expect(dog.proven(t)).toBe(false)
  })

  it('slow CPU trips within two windows once the glass is shown', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    let t = run(dog, 300, { cpu: 2 })
    expect(dog.proven(t)).toBe(true)
    t = run(dog, 200, { cpu: 9, start: t })
    expect(onTrip).toHaveBeenCalledTimes(1)
  })

  it('an interval that is slow against the device\'s own cadence trips', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    let t = run(dog, 300, { cpu: 1, drawEvery: 2 })
    expect(dog.proven(t)).toBe(true)
    t = run(dog, 100, { cpu: 1, gap: 40, drawEvery: 2, start: t })
    expect(onTrip).toHaveBeenCalledTimes(1)
    expect(fallbackReason()).toMatch(/^watchdog:interval 40\.0ms \(base 16\.0ms\)/)
  })

  it('a rate under 20 fps trips even with no baseline to compare', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    let t = run(dog, 300, { cpu: 1 })
    expect(dog.proven(t)).toBe(true)
    t = run(dog, 400, { cpu: 1, gap: 60, start: t })
    expect(onTrip).toHaveBeenCalledTimes(1)
  })

  it('grace ignores slow frames after a resume, a route change or a rebuild', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    let t = run(dog, 300, { cpu: 2 })
    dog.grace(t)
    t = run(dog, Math.floor((GRACE_MS - 200) / 16), { cpu: 12, start: t })
    expect(onTrip).not.toHaveBeenCalled()
    run(dog, 200, { cpu: 12, start: t })
    expect(onTrip).toHaveBeenCalledTimes(1)
  })

  it('does not trip on one slow window followed by a good one', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    let t = run(dog, 300, { cpu: 2 })
    t = run(dog, 70, { cpu: 9, start: t })
    run(dog, 300, { cpu: 1, start: t })
    expect(onTrip).not.toHaveBeenCalled()
  })

  it('starts over after the loop went idle (a gap over 100 ms)', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    let t = run(dog, 300, { cpu: 2 })
    t = run(dog, 70, { cpu: 9, start: t })
    run(dog, 70, { cpu: 9, start: t + 200 })
    expect(onTrip).not.toHaveBeenCalled()
  })

  it('judges slow drawn frames at the 15 Hz look cadence (draw, then idle frames)', () => {
    const onTrip = vi.fn()
    const dog = createWatchdog({ onTrip })
    let t = run(dog, 300, { cpu: 2, drawEvery: 4 })
    t = run(dog, 240, { cpu: 20, drawEvery: 4, start: t })
    expect(onTrip).toHaveBeenCalledTimes(1)
  })

  it('does not trip on cheap drawn frames between idle frames', () => {
    const onTrip = vi.fn()
    run(createWatchdog({ onTrip }), PAST_PROBE, { cpu: 2, drawEvery: 4 })
    expect(onTrip).not.toHaveBeenCalled()
  })
})

describe('glass watchdog across app starts', () => {
  beforeEach(() => { sessionStorage.clear(); vi.resetModules() })

  it('a trip does not survive a new start, and a stale lg-off from an older build is cleared', async () => {
    const first = await import('./glass-watchdog.js')
    const onTrip = vi.fn()
    run(first.createWatchdog({ onTrip }), PAST_PROBE, { cpu: 9 })
    expect(first.glassIsOff()).toBe(true)

    sessionStorage.setItem('lg-off', '1') // what an older build left behind in a PWA's session
    vi.resetModules()
    const second = await import('./glass-watchdog.js')
    expect(second.glassIsOff()).toBe(false)
    expect(sessionStorage.getItem('lg-off')).toBeNull()
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
