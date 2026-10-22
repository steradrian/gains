// @vitest-environment happy-dom
// The scheduler runs only while something changes: idle after two unchanged frames, restarted by a
// wake, held through an announced transition, and throttled for the look's clock. The springs snap
// under reduce motion.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publishPhase } from '../../lib/stage-look/clock.js'
import { createScheduler, createSprings, LOOK_HZ, throttle } from './glass-scheduler.js'

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

describe('throttle', () => {
  it('runs at most once per interval and keeps a trailing call', () => {
    const calls = []
    const timers = []
    const t = { now: 0 }
    const fn = throttle(() => calls.push(t.now), 1000 / LOOK_HZ, {
      now: () => t.now,
      setTimer: (cb, ms) => { timers.push({ cb, ms }); return timers.length },
      clearTimer: () => {},
    })
    fn()
    t.now = 10
    fn()
    fn()
    expect(calls).toEqual([0])
    expect(timers).toHaveLength(1)
    expect(timers[0].ms).toBeCloseTo(1000 / LOOK_HZ - 10)
    t.now = 67
    timers[0].cb()
    expect(calls).toEqual([0, 67])
    t.now = 200
    fn()
    expect(calls).toEqual([0, 67, 200])
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
