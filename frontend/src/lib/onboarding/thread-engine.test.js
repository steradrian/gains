// The thread engine on its own (motion-onboarding-thread.md §1, §4): anchors stand in for the
// scenes' svg lines, the frames are stepped by hand, and the overlay path is read after each.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThreadEngine, LAND_MS } from './thread-engine.js'
import { dOf, lineP } from './thread-geometry.js'

let frames = []
let clock = 0
// Runs the frames due, then moves the clock on: the engine's own time starts at its first frame.
function step(ms) {
  const due = frames
  frames = []
  due.forEach(cb => cb(clock))
  clock += ms
}
function runTo(ms) {
  const end = clock + ms
  while (clock < end) step(16)
  step(0)
}

// A scene's floor line from x0 to x1 at y, in viewport coordinates (an identity screen CTM, plus
// `at.slide`, the translation its screen is sliding in with). `at.box`: where its own <svg> starts.
function anchor(x0, x1, y, at = {}) {
  const attrs = { 'data-thread': 'line' }
  const el = {
    y,
    isConnected: true,
    ownerSVGElement: { style: { setProperty() {} }, getBoundingClientRect: () => at.box ?? { left: 0, top: 0 } },
    getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: at.slide?.[0] ?? 0, f: at.slide?.[1] ?? 0 }),
    getBBox: () => ({ x: x0, y: el.y, width: x1 - x0, height: 0 }),
    getAttribute: k => attrs[k] ?? null,
    setAttribute: (k, v) => { attrs[k] = v },
    removeAttribute: k => { delete attrs[k] },
    hasAttribute: k => k in attrs,
    closest: () => (at.slide ? { slide: at.slide, querySelectorAll: () => [] } : null),
  }
  return el
}

function setup() {
  const svg = { style: {} }
  const path = { d: null, style: {}, setAttribute(k, v) { this[k] = v } }
  const engine = createThreadEngine({ layer: () => ({ svg, path }), blocked: () => false, clip: () => ({ top: 0, bottom: 800 }) })
  return { engine, svg, path }
}

beforeEach(() => {
  frames = []
  clock = 0
  vi.stubGlobal('window', { innerHeight: 800 })
  // A screen reads as the transform it slides with; an anchor as its stroke.
  vi.stubGlobal('getComputedStyle', el => (el?.slide
    ? { transform: `matrix(1, 0, 0, 1, ${el.slide[0]}, ${el.slide[1]})` }
    : { strokeWidth: '2', stroke: 'rgb(0, 0, 0)' }))
  vi.stubGlobal('DOMMatrixReadOnly', class {
    constructor(s) { const n = s.match(/-?[\d.]+/g).map(Number); this.m41 = n[4]; this.m42 = n[5] }
  })
  vi.stubGlobal('requestAnimationFrame', cb => { frames.push(cb); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => { vi.unstubAllGlobals() })

describe('a run between floors that coincide (goal to weight)', () => {
  it('claims the new floor and holds the line still until the screen has landed', () => {
    const { engine, svg, path } = setup()
    const goal = anchor(16, 304, 200)
    const leave = engine.register(goal)
    leave()
    const sex = anchor(16, 304, 200)
    engine.register(sex)
    const still = dOf(lineP(16, 200, 304, 200))
    expect(sex.hasAttribute('data-thread-claim')).toBe(true)
    expect(svg.style.visibility).toBe('visible')
    expect(path.d).toBe(still)
    runTo(LAND_MS - 40)
    expect(sex.hasAttribute('data-thread-claim')).toBe(true)
    expect(path.d).toBe(still)
    runTo(60)
    expect(sex.hasAttribute('data-thread-claim')).toBe(false)
    expect(svg.style.visibility).toBe('hidden')
  })
})

describe('a transition interrupted mid-flight', () => {
  it('starts the next run from the shape on screen, not from the old anchor at rest', () => {
    const { engine, path } = setup()
    engine.register(anchor(16, 304, 100))()
    const b = anchor(16, 304, 300)
    const leaveB = engine.register(b)
    runTo(160)
    const mid = path.d
    expect(mid).not.toBe(dOf(lineP(16, 100, 304, 100)))
    expect(mid).not.toBe(dOf(lineP(16, 300, 304, 300)))
    // Back is tapped while the line is still travelling: b goes, c arrives.
    leaveB()
    const c = anchor(16, 304, 500)
    engine.register(c)
    expect(c.hasAttribute('data-thread-claim')).toBe(true)
    expect(path.d).toBe(mid)
  })
})

describe('landing where the line is painted (scripts/thread-handoff-check.mjs)', () => {
  it('sets the layer at the sub-pixel offset of the anchor\'s own svg, and draws the path back by it', () => {
    const { engine, svg, path } = setup()
    engine.register(anchor(16, 304, 100))()
    engine.register(anchor(16, 304, 300, { box: { left: 35.25, top: 167.5 } }))
    expect(svg.style.left).toBe('0.25px')
    expect(svg.style.top).toBe('0.5px')
    expect(path.transform).toBe('translate(-0.25 -0.5)')
  })

  it('measures an anchor whose screen is still sliding in where it will rest', () => {
    const { engine, path } = setup()
    engine.register(anchor(16, 304, 100))()
    engine.register(anchor(16, 304, 300, { slide: [24, 0] }))
    runTo(400)
    expect(path.d).toBe(dOf(lineP(16, 300, 304, 300)))
  })

  it('glides on to an anchor that moved while the thread flew, and hands over only there', () => {
    const { engine, svg, path } = setup()
    engine.register(anchor(16, 304, 100))()
    const b = anchor(16, 304, 300)
    engine.register(b)
    runTo(160)
    // The screen's header grew above the floor mid-flight.
    b.y = 400
    runTo(200)
    expect(b.hasAttribute('data-thread-claim')).toBe(true)
    expect(svg.style.visibility).toBe('visible')
    runTo(340)
    expect(b.hasAttribute('data-thread-claim')).toBe(false)
    expect(path.d).toBe(dOf(lineP(16, 400, 304, 400)))
  })
})
