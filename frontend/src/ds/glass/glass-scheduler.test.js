// @vitest-environment happy-dom
// The scheduler runs only while something changes: idle after two unchanged frames, restarted by a
// wake, held through an announced transition, and gated to 15 Hz for the look's clock. The springs snap
// under reduce motion.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publishPhase, REST_PHASE } from '../../lib/stage-look/clock.js'
import { createLookGate, createScheduler, createSprings, runsThisFrame, SCROLL_FRAME_MS, SCROLL_MAX_MS } from './glass-scheduler.js'

function fakeRaf() {
  let queue = []
  let id = 0
  return {
    raf: cb => { queue.push([++id, cb]); return id },
    caf: n => { queue = queue.filter(([x]) => x !== n) },
    flush(ts) {
      const run = queue
      queue = []
      run.forEach(([, cb]) => cb(ts))
    },
    pending: () => queue.length,
  }
}

let clock
let scheduler
beforeEach(() => { clock = { t: 1000 } })
afterEach(() => { scheduler?.dispose(); scheduler = null })

const make = (frame, extra = {}) => {
  const r = fakeRaf()
  scheduler = createScheduler({ frame, raf: r.raf, caf: r.caf, now: () => clock.t, ...extra })
  return r
}

describe('createScheduler', () => {
  it('draws nothing until it is woken', () => {
    const frame = vi.fn(() => false)
    const r = make(frame)
    expect(r.pending()).toBe(0)
    expect(frame).not.toHaveBeenCalled()
  })

  it('stops after two frames that changed nothing', () => {
    const frame = vi.fn(() => false)
    const r = make(frame)
    scheduler.wake('test')
    r.flush(1016)
    expect(r.pending()).toBe(1)
    r.flush(1032)
    expect(r.pending()).toBe(0)
    expect(frame).toHaveBeenCalledTimes(2)
  })

  it('keeps running while frames change, and a wake restarts it from idle', () => {
    let changed = true
    const frame = vi.fn(() => changed)
    const r = make(frame)
    scheduler.wake('test')
    for (let i = 1; i <= 5; i++) r.flush(1000 + i * 16)
    expect(r.pending()).toBe(1)
    changed = false
    r.flush(1100)
    r.flush(1116)
    expect(r.pending()).toBe(0)
    scheduler.wake('scroll')
    expect(r.pending()).toBe(1)
  })

  it('passes dt in seconds, capped', () => {
    const frame = vi.fn(() => false)
    const r = make(frame)
    scheduler.wake('test')
    r.flush(1016)
    expect(frame.mock.calls[0][0]).toBeCloseTo(0.016)
    scheduler.wake('test')
    r.flush(3000)
    expect(frame.mock.calls[1][0]).toBe(0.05)
  })

  it('does not start a second loop when woken twice', () => {
    const r = make(() => false)
    scheduler.wake('a')
    scheduler.wake('b')
    expect(r.pending()).toBe(1)
  })

  it('holds the loop through an announced transition even when frames are unchanged', () => {
    const r = make(() => false)
    scheduler.wake('transitionrun', 500)
    r.flush(1016)
    r.flush(1032)
    r.flush(1048)
    expect(r.pending()).toBe(1)
    clock.t += 600
    r.flush(1064)
    expect(r.pending()).toBe(0)
  })

  it('wakes on a capture scroll, a resize and a transition starting', () => {
    const r = make(() => false)
    document.body.dispatchEvent(new Event('scroll')) // scroll does not bubble; the capture listener still hears it
    expect(r.pending()).toBe(1)
    r.flush(1016); r.flush(1032)
    window.dispatchEvent(new Event('resize'))
    expect(r.pending()).toBe(1)
    r.flush(1048); r.flush(1064)
    document.dispatchEvent(new Event('transitionrun'))
    expect(r.pending()).toBe(1)
  })

  it('stays stopped while paused and resumes on unpause', () => {
    const r = make(() => true)
    scheduler.setPaused(true)
    scheduler.wake('scroll')
    expect(r.pending()).toBe(0)
    scheduler.setPaused(false)
    expect(r.pending()).toBe(1)
  })

  it('wakes on the look clock', () => {
    const r = make(() => false)
    publishPhase(0.3)
    expect(r.pending()).toBe(1)
  })

  it('stops listening on dispose', () => {
    const r = make(() => false)
    scheduler.dispose()
    document.dispatchEvent(new Event('scroll'))
    expect(r.pending()).toBe(0)
  })

  it('presses the glass under a finger and releases it', () => {
    const root = document.createElement('div')
    const btn = document.createElement('button')
    btn.className = 'g-glass'
    root.appendChild(btn)
    document.body.appendChild(root)
    const r = make(() => false, { root })
    btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 4, clientY: 5 }))
    expect(r.pending()).toBe(1)
    expect(scheduler.springs.get(btn).touch).toBeNull() // v is still 0
    scheduler.springs.step(0.016)
    expect(scheduler.springs.get(btn)).toMatchObject({ touch: [4, 5] })
    window.dispatchEvent(new Event('pointerup'))
    scheduler.springs.step(0.016)
    root.remove()
  })

  it('does not press a shape the filter refuses', () => {
    const root = document.createElement('div')
    const card = document.createElement('div')
    card.className = 'g-glass'
    root.appendChild(card)
    document.body.appendChild(root)
    const r = make(() => false, { root, pressable: () => false })
    card.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    expect(r.pending()).toBe(0)
    root.remove()
  })
})

describe('createLookGate', () => {
  it('takes a new phase at most every LOOK_MS and holds it in between', () => {
    const t = { now: 1000 }
    const gate = createLookGate({ now: () => t.now })
    publishPhase(0.3)
    expect(gate.phase(true)).toBe(0.3)
    publishPhase(0.31)
    t.now += 33
    expect(gate.due()).toBe(false)
    expect(gate.phase(true)).toBe(0.3)
    publishPhase(0.32)
    t.now += 33
    expect(gate.due()).toBe(true)
    expect(gate.phase(true)).toBe(0.32)
  })

  it('draws the resting phase while the look stands still, and takes the live one at once when it moves again', () => {
    const t = { now: 1000 }
    const gate = createLookGate({ now: () => t.now })
    publishPhase(0.4)
    gate.phase(true)
    t.now += 5
    expect(gate.phase(false)).toBe(REST_PHASE)
    publishPhase(0.41)
    expect(gate.phase(true)).toBe(0.41)
  })
})

describe('runsThisFrame', () => {
  const base = { t: 1000, lastRun: 990, lastScroll: 995, holdUntil: 0, other: false, springsBusy: false }

  it('runs a scroll-only glass frame at most every other 60 Hz frame', () => {
    expect(runsThisFrame({ ...base, lastRun: 1000 - 16.7 })).toBe(false)
    expect(runsThisFrame({ ...base, lastRun: 1000 - 33.4 })).toBe(true)
    expect(runsThisFrame({ ...base, lastRun: 1000 - SCROLL_FRAME_MS })).toBe(true)
  })

  it('steps aside for a frame the look draws in, but not past the third frame', () => {
    expect(runsThisFrame({ ...base, lastRun: 1000 - 33.4, lookThisFrame: true })).toBe(false)
    expect(runsThisFrame({ ...base, lastRun: 1000 - 50.1, lookThisFrame: true })).toBe(true)
    expect(runsThisFrame({ ...base, lastRun: 1000 - SCROLL_MAX_MS, lookThisFrame: true })).toBe(true)
  })

  it('runs every frame for a press, a transition, another wake, or once the scroll is over', () => {
    expect(runsThisFrame({ ...base, springsBusy: true })).toBe(true)
    expect(runsThisFrame({ ...base, holdUntil: 1200 })).toBe(true)
    expect(runsThisFrame({ ...base, other: true })).toBe(true)
    expect(runsThisFrame({ ...base, lastScroll: 800 })).toBe(true)
  })
})

describe('a scroll-driven loop', () => {
  it('runs the glass every other rAF while only a scroll drives it, and hands the frame the display interval', () => {
    const calls = []
    const r = make((dt, rafMs) => { calls.push([dt, rafMs]); return true })
    document.dispatchEvent(new Event('scroll'))
    for (let i = 1; i <= 6; i++) {
      clock.t = 1000 + i * 16.7
      document.dispatchEvent(new Event('scroll'))
      r.flush(clock.t)
    }
    expect(calls).toHaveLength(3)
    expect(calls[1][0]).toBeCloseTo(0.0334, 3) // dt spans the skipped frame
    expect(calls[1][1]).toBeCloseTo(16.7, 1)
    expect(r.pending()).toBe(1)
  })

  it('runs every frame while a press springs, even mid-scroll', () => {
    const root = document.createElement('div')
    const btn = document.createElement('button')
    btn.className = 'g-glass'
    root.appendChild(btn)
    document.body.appendChild(root)
    const frame = vi.fn(() => { scheduler.springs.step(0.016); return true })
    const r = make(frame, { root })
    btn.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    for (let i = 1; i <= 4; i++) {
      clock.t = 1000 + i * 16.7
      document.dispatchEvent(new Event('scroll'))
      r.flush(clock.t)
    }
    expect(frame).toHaveBeenCalledTimes(4)
    root.remove()
  })
})

describe('the look clock and the shared frame', () => {
  it('wakes on a 30 Hz look at 15 Hz once the frame takes each tick', () => {
    const r = make(() => {
      scheduler.look.phase(true)
      return false
    })
    let wakes = 0
    for (let i = 0; i < 30; i++) { // one second of a look publishing every 33 ms
      clock.t = 1000 + i * 33.3
      const before = r.pending()
      publishPhase(0.2 + i / 1000)
      if (!before && r.pending()) wakes++
      r.flush(clock.t + 16)
    }
    expect(wakes).toBeGreaterThanOrEqual(14)
    expect(wakes).toBeLessThanOrEqual(16)
  })

  it('knows the frame the look drew in', async () => {
    const { phaseFrame, requestFrame } = await import('../../lib/stage-look/clock.js')
    const frames = []
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { frames.push(cb); return frames.length })
    try {
      requestFrame(() => publishPhase(0.5))
      frames.shift()(4242)
      expect(phaseFrame()).toBe(4242)
      publishPhase(0.6) // a still frame drawn outside the clock belongs to no frame to come
      requestFrame(() => {})
      frames.shift()(4259)
      expect(phaseFrame()).not.toBe(4259)
    } finally {
      raf.mockRestore()
    }
  })

  it('runs on the shared clock by default: a look loop and the glass take one rAF per frame', async () => {
    const { requestFrame } = await import('../../lib/stage-look/clock.js')
    const frames = []
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { frames.push(cb); return frames.length })
    let looping = true
    try {
      const glassFrame = vi.fn(() => true)
      scheduler = createScheduler({ frame: glassFrame })
      const look = vi.fn(() => { if (looping) requestFrame(look) })
      requestFrame(look)
      scheduler.wake('test')
      expect(raf).toHaveBeenCalledTimes(1)
      frames.shift()(16)
      expect(look).toHaveBeenCalledTimes(1)
      expect(glassFrame).toHaveBeenCalledTimes(1)
      expect(raf).toHaveBeenCalledTimes(2) // one for the next frame, shared by both
    } finally {
      looping = false
      scheduler.dispose()
      scheduler = null
      frames.shift()?.(32) // the look's last frame: the clock is idle for the next test
      raf.mockRestore()
    }
  })
})

describe('createSprings', () => {
  it('springs a press up with a little overshoot and settles', () => {
    const el = document.createElement('div')
    const springs = createSprings()
    springs.press(el, [1, 2])
    let peak = 0
    let moving = true
    for (let i = 0; i < 600 && moving; i++) {
      moving = springs.step(1 / 60)
      peak = Math.max(peak, springs.get(el).v)
    }
    expect(moving).toBe(false)
    expect(peak).toBeGreaterThan(1)
    expect(springs.get(el).v).toBe(1)
    springs.release()
    for (let i = 0; i < 600 && springs.step(1 / 60); i++) { /* settle */ }
    expect(springs.get(el).v).toBe(0)
  })

  it('snaps under reduce motion', () => {
    const el = document.createElement('div')
    const springs = createSprings({ reduced: () => true })
    springs.press(el, null)
    expect(springs.step(0.016)).toBe(false)
    expect(springs.get(el).v).toBe(1)
    springs.release()
    springs.step(0.016)
    expect(springs.get(el).v).toBe(0)
  })

  it('writes --lg-press on flush, once per change, and removes it on clear', () => {
    const el = document.createElement('div')
    const springs = createSprings({ reduced: () => true })
    springs.press(el, null)
    springs.step(0.016)
    springs.flush()
    expect(el.style.getPropertyValue('--lg-press')).toBe('1.000')
    springs.clear()
    expect(el.style.getPropertyValue('--lg-press')).toBe('')
  })

  it('moves the highlight of a held shape only', () => {
    const a = document.createElement('div')
    const b = document.createElement('div')
    const springs = createSprings({ reduced: () => true })
    springs.press(a, [0, 0])
    springs.step(0.016)
    expect(springs.move([9, 9])).toBe(true)
    expect(springs.get(a).touch).toEqual([9, 9])
    expect(springs.get(b).touch).toBeNull()
    springs.release()
    expect(springs.move([1, 1])).toBe(false)
  })
})
