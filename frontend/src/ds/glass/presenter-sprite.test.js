// @vitest-environment happy-dom
// The sprite presenter's pure parts (shelf packing and its cap, the refresh plan, which elements may host a
// sprite, the shadow margin) and its DOM life with a fake renderer, since there is no WebGL here: a sprite
// is appended and marked ready on its first copy, released (width = height = 0, removed) when its shape is
// far and re-attached when it comes back, re-appended when React's textContent wipes it (R5), and a lost
// context unreadies every sprite.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveTheme } from '../../lib/stage-look/color.js'
import { themeOf } from '../../lib/themes.js'
import { createRegistry, sortRecords, SPRITE_CLASS } from './glass-registry.js'
import {
  ATLAS_MAX_BYTES, ATLAS_MAX_HEIGHT, ATLAS_WIDTH, canHost, createSpritePresenter, FRAME_PX, offscreen, packShelves, planRefresh,
  SCROLL_MS, SETTLE_MS, shadowMargin, SHRINK_MS, SPRITE_MARGIN,
} from './presenter-sprite.js'

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe('packShelves', () => {
  it('places every item without overlaps, inside the width and the height cap', () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ key: i, w: 40 + ((i * 37) % 700), h: 30 + ((i * 53) % 260) }))
    const { pages, skipped } = packShelves(items, { width: 1024, maxHeight: 512 })
    expect(skipped).toEqual([])
    expect(pages.flatMap(p => p.placed).map(p => p.key).sort((a, b) => a - b)).toEqual(items.map(i => i.key))
    for (const page of pages) {
      expect(page.width).toBeLessThanOrEqual(1024)
      expect(page.height).toBeLessThanOrEqual(512)
      for (const r of page.placed) {
        expect(r.x + r.w).toBeLessThanOrEqual(1024)
        expect(r.y + r.h).toBeLessThanOrEqual(512)
      }
      page.placed.forEach((a, i) => page.placed.slice(i + 1).forEach(b => expect(overlaps(a, b)).toBe(false)))
    }
  })

  it('starts another page when one is full, and skips an item larger than a page', () => {
    const { pages, skipped } = packShelves([
      { key: 'a', w: 100, h: 300 }, { key: 'b', w: 100, h: 300 }, { key: 'huge', w: 5000, h: 10 },
    ], { width: 150, maxHeight: 400 })
    expect(pages).toHaveLength(2)
    expect(skipped).toEqual(['huge'])
  })

  it('caps the atlas at 8 MB by default', () => {
    expect(ATLAS_WIDTH * ATLAS_MAX_HEIGHT * 4).toBeLessThanOrEqual(8 * 1024 * 1024)
    const { pages } = packShelves(Array.from({ length: 40 }, (_, i) => ({ key: i, w: 1000, h: 300 })))
    for (const p of pages) expect(p.width * p.height * 4).toBeLessThanOrEqual(8 * 1024 * 1024)
  })
})

describe('planRefresh', () => {
  const px = 1000

  it('refreshes an urgent or pressed sprite at once, whatever the budget', () => {
    const plan = planRefresh([{ urgent: true, px: 5e6 }, { pressed: true, px: 5e6 }, { px }], 1000, { budgetPx: 10 })
    expect(plan.refresh).toEqual([0, 1])
    expect(plan.pending).toBe(false)
  })

  it('holds each moved sprite to 12 Hz on its own clock, and keeps the loop going meanwhile', () => {
    const early = planRefresh([{ moved: true, at: 1000, px }], 1000 + SCROLL_MS - 5)
    expect(early).toEqual({ refresh: [], pending: true })
    const due = planRefresh([{ moved: true, at: 1000, px }, { moved: true, at: 1010, px }], 1000 + SCROLL_MS + 1)
    expect(due.refresh).toEqual([0])
    expect(due.pending).toBe(true)
  })

  it('refreshes every moved sprite once the movement has settled', () => {
    expect(planRefresh([{ moved: true, at: 1000, px }], 1010, { settled: true }).refresh).toEqual([0])
  })

  it('takes a look tick at once (the engine already gates the look to 15 Hz)', () => {
    expect(planRefresh([{ look: true, at: 1000, px }], 1001).refresh).toEqual([0])
  })

  it('spreads due sprites over frames within the pixel budget, oldest copy first', () => {
    const cands = [{ moved: true, at: 300, px: 400 }, { moved: true, at: 100, px: 400 }, { moved: true, at: 200, px: 400 }]
    const plan = planRefresh(cands, 1000, { budgetPx: 900 })
    expect(plan.refresh).toEqual([1, 2])
    expect(plan.pending).toBe(true)
  })

  it('puts a stale sprite coming on screen ahead of the others', () => {
    const cands = [{ moved: true, at: 0, px: 600 }, { soon: true, at: 900, px: 600 }]
    expect(planRefresh(cands, 1000, { budgetPx: 1000 }).refresh).toEqual([1])
  })

  it('always takes one sprite larger than the budget when nothing else draws, but not beside urgent work', () => {
    expect(planRefresh([{ moved: true, at: 0, px: 5000 }], 1000, { budgetPx: 1000 }).refresh).toEqual([0])
    const busy = planRefresh([{ urgent: true, px: 900 }, { moved: true, at: 0, px: 5000 }], 1000, { budgetPx: 1000 })
    expect(busy).toEqual({ refresh: [0], pending: true })
  })

  it('caps a frame at about one full-width card at 3x by default', () => {
    const card = 1218 * 414
    const plan = planRefresh([0, 1, 2].map(i => ({ moved: true, at: i, px: card })), 1000)
    expect(plan.refresh).toHaveLength(1)
    expect(FRAME_PX).toBeGreaterThanOrEqual(card)
  })
})

describe('offscreen', () => {
  it('is 0 inside the viewport and its band, and the distance past it outside', () => {
    expect(offscreen({ x: 100, y: 100, hw: 50, hh: 50 }, 390, 844)).toBe(0)
    expect(offscreen({ x: 100, y: 844 + 80 + 50 + 30, hw: 50, hh: 50 }, 390, 844)).toBe(30)
    expect(offscreen({ x: 100, y: -80 - 50 - 200, hw: 50, hh: 50 }, 390, 844)).toBe(200)
  })
})

describe('canHost and shadowMargin', () => {
  it('takes HTML elements that can hold a child, never inputs, selects, textareas or svg', () => {
    for (const tag of ['div', 'button', 'a', 'span', 'label', 'nav']) expect(canHost(document.createElement(tag))).toBe(true)
    for (const tag of ['input', 'select', 'textarea', 'img', 'canvas']) expect(canHost(document.createElement(tag))).toBe(false)
    expect(canHost(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))).toBe(false)
  })

  it('holds the swell and the drawn shadow of each kind', () => {
    expect(shadowMargin('card', 180, 36)).toBe(24)
    expect(shadowMargin('control', 22, 22)).toBe(22)
    expect(shadowMargin('control', 22, 22)).toBeGreaterThan(SPRITE_MARGIN)
  })
})

describe('sortRecords', () => {
  const sprite = () => { const c = document.createElement('canvas'); c.className = SPRITE_CLASS; return c }
  const rec = (target, added = [], removed = []) => ({ type: 'childList', target, addedNodes: added, removedNodes: removed })

  it('treats a batch that only moved sprites as no DOM change', () => {
    const host = document.createElement('div')
    expect(sortRecords([rec(host, [sprite()])]).dom).toBe(false)
  })

  it('reports a removed sprite with its host, beside a real change', () => {
    const host = document.createElement('div')
    const c = sprite()
    const out = sortRecords([rec(host, [document.createTextNode('5')], [c])])
    expect(out.dom).toBe(true)
    expect(out.removed).toEqual([[host, c]])
  })
})

// ---- the presenter's DOM life, with a fake renderer ----------------------------------------------

const LOOK = { look: 'plain', theme: { ...deriveTheme(themeOf('cobalt'), 0.45), intensity: 0.45 }, phase: 0, calm: true }
const MATERIAL = { lift: [1, 1, 1, 0.02], rim: [1, 1, 1], spec: [1, 1, 1], shade: [0, 0, 0, 1], tint: [0, 0, 1] }
let clockMs
let gl
let atlasCanvas
let ctx2d
let ground

function shape(el, { x = 100, y = 100, hw = 60, hh = 30, kind = 'card', press = 0 } = {}) {
  return { el, kind, x, y, hw, hh, radius: 24, press, touch: null, box: { x, y, hw, hh } }
}

function makePresenter(opts = {}) {
  const hooks = { onReady: vi.fn(), onRelease: vi.fn(), onLost: vi.fn(), onRestored: vi.fn() }
  atlasCanvas = document.createElement('canvas')
  gl.canvas = atlasCanvas
  const p = createSpritePresenter({
    now: () => clockMs,
    renderers: { acquire: () => gl, release: r => r.destroy(), renew: canvas => (canvas === atlasCanvas ? gl : null) },
    ...opts,
  })
  expect(p.mount(hooks)).toBe(true)
  return { p, hooks }
}

const frame = (p, shapes, keep = () => false) => p.draw(shapes, MATERIAL, LOOK, { lookId: 'plain', keep })
const spriteOf = el => el.querySelector(`canvas.${SPRITE_CLASS}`)

beforeEach(() => {
  clockMs = 1000
  gl = { draw: vi.fn(), destroy: vi.fn() }
  ctx2d = { drawImage: vi.fn(), globalCompositeOperation: '' }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(type => (type === '2d' ? ctx2d : null))
  ground = document.createElement('div')
  document.body.appendChild(ground)
})
afterEach(() => {
  ground.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('createSpritePresenter', () => {
  it('appends an aria-hidden sprite last, copies its region and marks it ready in that frame', () => {
    const el = document.createElement('div')
    el.append(document.createElement('b'))
    ground.appendChild(el)
    const { p, hooks } = makePresenter()
    const out = frame(p, [shape(el)])
    expect(out.drew).toBe(true)
    const c = spriteOf(el)
    expect(c).not.toBeNull()
    expect(el.lastElementChild).toBe(c)
    expect(c.getAttribute('aria-hidden')).toBe('true')
    expect(el.getAttribute('data-lg-sprite')).toBe('card')
    expect(ctx2d.drawImage).toHaveBeenCalledTimes(1)
    expect(ctx2d.globalCompositeOperation).toBe('copy')
    expect(hooks.onReady).toHaveBeenCalledWith(el)
    expect(p.isReady(el)).toBe(true)
    // The atlas draw is in atlas mode and the shape's region carries its shadow and its margin.
    const drawn = gl.draw.mock.calls[0][0]
    expect(drawn.atlas.width).toBeGreaterThan(0)
    expect(drawn.shapes[0].shadow).toBe(true)
    expect(drawn.shapes[0].margin).toBe(shadowMargin('card', 60, 30))
  })

  it('sizes the sprite from the element box and its margin at the device pixel ratio, or the cards\' cap', () => {
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(3)
    const a = document.createElement('div')
    const b = document.createElement('div')
    ground.append(a, b)
    const m = shadowMargin('card', 60, 30)
    frame(makePresenter().p, [shape(a, { hw: 60, hh: 30 })])
    expect(spriteOf(a).width).toBe(Math.round((120 + 2 * m) * 3))
    expect(spriteOf(a).height).toBe(Math.round((60 + 2 * m) * 3))
    frame(makePresenter({ cardDpr: 2 }).p, [shape(b, { hw: 60, hh: 30 })])
    expect(spriteOf(b).width).toBe(Math.round((120 + 2 * m) * 2))
  })

  it('takes the CSS shadow and the small margin when asked, or when the element clips', () => {
    const el = document.createElement('div')
    ground.appendChild(el)
    const { p } = makePresenter({ shadow: 'css' })
    frame(p, [shape(el)])
    expect(el.hasAttribute('data-lg-edge')).toBe(true)
    expect(gl.draw.mock.calls[0][0].shapes[0]).toMatchObject({ shadow: false, margin: SPRITE_MARGIN })
  })

  it('does not redraw a still sprite, and redraws a pressed one every frame', () => {
    const el = document.createElement('button')
    ground.appendChild(el)
    const { p } = makePresenter()
    frame(p, [shape(el, { kind: 'control' })])
    clockMs += 16
    expect(frame(p, [shape(el, { kind: 'control' })]).drew).toBe(false)
    clockMs += 16
    expect(frame(p, [shape(el, { kind: 'control', press: 0.4 })]).drew).toBe(true)
    clockMs += 16
    expect(frame(p, [shape(el, { kind: 'control', press: 0.7 })]).drew).toBe(true)
    expect(gl.draw).toHaveBeenCalledTimes(3)
  })

  it('holds a moved sprite to its own 12 Hz clock and says the loop must keep going', () => {
    const el = document.createElement('div')
    ground.appendChild(el)
    const { p } = makePresenter()
    frame(p, [shape(el, { y: 100 })])
    clockMs += SCROLL_MS + 1
    const moved = frame(p, [shape(el, { y: 140 })])
    expect(moved.drew).toBe(true) // the first movement after a quiet spell refreshes at once
    clockMs += 16
    const held = frame(p, [shape(el, { y: 180 })])
    expect(held.drew).toBe(false)
    expect(held.pending).toBe(true)
    expect(p.stats().contentLag).toBeCloseTo(40)
    clockMs += SETTLE_MS
    expect(frame(p, [shape(el, { y: 180 })]).drew).toBe(true)
  })

  it('leaves an off-screen sprite stale while it moves, and refreshes it at once when it comes on screen', () => {
    const el = document.createElement('div')
    ground.appendChild(el)
    const { p } = makePresenter()
    const below = window.innerHeight + 300
    frame(p, [shape(el, { y: below })])
    expect(gl.draw).toHaveBeenCalledTimes(1)
    clockMs += SETTLE_MS * 2
    const off = frame(p, [shape(el, { y: below - 100 })])
    expect(off).toEqual({ drew: false, pending: false })
    clockMs += 16
    expect(frame(p, [shape(el, { y: window.innerHeight - 40 })]).drew).toBe(true)
  })

  it('releases a far sprite (width = height = 0, removed) and re-attaches it when it comes near', () => {
    const el = document.createElement('div')
    ground.appendChild(el)
    const { p, hooks } = makePresenter()
    frame(p, [shape(el)])
    const first = spriteOf(el)
    // Missing from the frame but still near: kept as it is.
    frame(p, [], () => true)
    expect(spriteOf(el)).toBe(first)
    // Far: given back.
    frame(p, [], () => false)
    expect(spriteOf(el)).toBeNull()
    expect(first.width).toBe(0)
    expect(first.height).toBe(0)
    expect(el.hasAttribute('data-lg-sprite')).toBe(false)
    expect(hooks.onRelease).toHaveBeenCalledWith(el)
    expect(p.isReady(el)).toBe(false)
    // Near again: a new sprite, ready on its first copy.
    frame(p, [shape(el)])
    expect(spriteOf(el)).not.toBeNull()
    expect(hooks.onReady).toHaveBeenCalledTimes(2)
  })

  it('never hosts a sprite on an input', () => {
    const input = document.createElement('input')
    ground.appendChild(input)
    const { p } = makePresenter()
    expect(frame(p, [shape(input)]).drew).toBe(false)
    expect(input.children).toHaveLength(0)
  })

  it('leaves an element larger than the atlas on the CSS material, without retrying it every frame', () => {
    const el = document.createElement('div')
    ground.appendChild(el)
    const { p, hooks } = makePresenter()
    frame(p, [shape(el, { hw: 2000, hh: 30 })])
    clockMs += 16
    frame(p, [shape(el, { hw: 2000, hh: 30 })])
    expect(gl.draw).not.toHaveBeenCalled()
    expect(spriteOf(el)).toBeNull()
    expect(hooks.onReady).not.toHaveBeenCalled()
  })

  it('unreadies every sprite on a lost context, and redraws them all once it is back', () => {
    const el = document.createElement('div')
    ground.appendChild(el)
    const { p, hooks } = makePresenter()
    frame(p, [shape(el)])
    const lost = new Event('webglcontextlost', { cancelable: true })
    atlasCanvas.dispatchEvent(lost)
    expect(lost.defaultPrevented).toBe(true)
    expect(hooks.onLost).toHaveBeenCalled()
    expect(p.isReady(el)).toBe(false)
    expect(frame(p, [shape(el)], () => true).drew).toBe(false)
    atlasCanvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(hooks.onRestored).toHaveBeenCalled()
    expect(frame(p, [shape(el)]).drew).toBe(true)
    expect(p.isReady(el)).toBe(true)
  })

  describe('the memory budget', () => {
    const spriteBytes = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const m = shadowMargin('card', 60, 30)
      return Math.round((120 + 2 * m) * dpr) * Math.round((60 + 2 * m) * dpr) * 4
    }
    const three = () => [0, 1, 2].map(() => {
      const el = document.createElement('div')
      ground.appendChild(el)
      return el
    })

    it('leaves the elements that would not fit on the CSS material, and still draws the others', () => {
      const els = three()
      const { p, hooks } = makePresenter({ budget: ATLAS_MAX_BYTES + spriteBytes() * 1.5 })
      const out = frame(p, els.map(el => shape(el)), () => true)
      expect(out.drew).toBe(true)
      expect(spriteOf(els[0])).not.toBeNull()
      expect(p.isReady(els[0])).toBe(true)
      expect(spriteOf(els[1])).toBeNull()
      expect(spriteOf(els[2])).toBeNull()
      expect(p.isReady(els[1])).toBe(false)
      expect(hooks.onReady).toHaveBeenCalledTimes(1)
      expect(p.stats()).toMatchObject({ over: 2, budget: ATLAS_MAX_BYTES + spriteBytes() * 1.5 })
    })

    it('counts the atlas at its cap, since it can grow after the check', () => {
      const els = three()
      const { p } = makePresenter({ budget: ATLAS_MAX_BYTES + spriteBytes() * 0.5 })
      frame(p, els.map(el => shape(el)), () => true)
      expect(els.some(el => spriteOf(el))).toBe(false)
      expect(p.stats().over).toBe(3)
    })

    it('gives an element on screen the room of a sprite off screen, and leaves that one on the CSS material', () => {
      const [near, onScreen] = three()
      const { p, hooks } = makePresenter({ budget: ATLAS_MAX_BYTES + spriteBytes() * 1.5 })
      const below = window.innerHeight + 300
      frame(p, [shape(near, { y: below })], () => true)
      expect(spriteOf(near)).not.toBeNull()
      clockMs += 16
      frame(p, [shape(near, { y: below }), shape(onScreen, { y: 100 })], () => true)
      expect(spriteOf(onScreen)).not.toBeNull()
      expect(spriteOf(near)).toBeNull()
      expect(hooks.onRelease).toHaveBeenCalledWith(near)
      expect(p.stats().over).toBe(1)
    })

    it('never lets an element off screen take the room of one on screen', () => {
      const [onScreen, near] = three()
      const { p } = makePresenter({ budget: ATLAS_MAX_BYTES + spriteBytes() * 1.5 })
      frame(p, [shape(onScreen, { y: 100 })], () => true)
      clockMs += 16
      frame(p, [shape(onScreen, { y: 100 }), shape(near, { y: window.innerHeight + 300 })], () => true)
      expect(spriteOf(onScreen)).not.toBeNull()
      expect(spriteOf(near)).toBeNull()
    })

    it('gives a waiting element its sprite once memory is freed, and asks for another draw', () => {
      const els = three()
      const { p } = makePresenter({ budget: ATLAS_MAX_BYTES + spriteBytes() * 1.5 })
      frame(p, els.map(el => shape(el)), () => true)
      // The first element scrolls far away and gives its sprite back.
      const out = frame(p, [shape(els[1]), shape(els[2])], () => false)
      expect(spriteOf(els[0])).toBeNull()
      expect(out.pending).toBe(true)
      frame(p, [shape(els[1]), shape(els[2])])
      expect(spriteOf(els[1])).not.toBeNull()
      expect(spriteOf(els[2])).toBeNull()
      expect(p.stats().over).toBe(1)
    })

    it('never counts the default budget against a normal screen', () => {
      const els = three()
      const { p } = makePresenter()
      frame(p, els.map(el => shape(el)), () => true)
      expect(p.stats().over).toBe(0)
      expect(els.every(el => spriteOf(el))).toBe(true)
    })
  })

  it('keeps an element whose 2D context is refused on the CSS material, and does not ask again at the same size', () => {
    const el = document.createElement('div')
    const other = document.createElement('div')
    ground.append(el, other)
    const { p, hooks } = makePresenter()
    const getContext = HTMLCanvasElement.prototype.getContext
    let refuse = true
    getContext.mockImplementation(type => {
      if (type !== '2d') return null
      if (refuse) { refuse = false; return null }
      return ctx2d
    })
    const out = frame(p, [shape(el), shape(other, { y: 300 })])
    expect(out.drew).toBe(true) // the other element still draws
    expect(spriteOf(el)).toBeNull()
    expect(el.childElementCount).toBe(0)
    expect(p.isReady(el)).toBe(false)
    expect(spriteOf(other)).not.toBeNull()
    expect(hooks.onReady).toHaveBeenCalledTimes(1)
    const calls = getContext.mock.calls.length
    clockMs += 16
    frame(p, [shape(el), shape(other, { y: 300 })])
    expect(getContext.mock.calls.length).toBe(calls)
    expect(spriteOf(el)).toBeNull()
  })

  it('spreads a screen of moved sprites over frames, one atlas render of at most the frame budget each', () => {
    const els = [0, 1, 2].map(() => { const el = document.createElement('div'); ground.appendChild(el); return el })
    const { p } = makePresenter()
    const big = (el, y) => shape(el, { x: 200, y, hw: 400, hh: 300 })
    frame(p, els.map((el, i) => big(el, 300 + i * 10))) // first draw: all at once (no content yet)
    expect(gl.draw.mock.calls.flatMap(c => c[0].shapes)).toHaveLength(3)
    gl.draw.mockClear()
    clockMs += SCROLL_MS + 1
    const first = frame(p, els.map((el, i) => big(el, 280 + i * 10)))
    expect(first).toEqual({ drew: true, pending: true })
    expect(gl.draw.mock.calls[0][0].shapes).toHaveLength(1)
    clockMs += 16
    frame(p, els.map((el, i) => big(el, 280 + i * 10)))
    clockMs += 16
    const third = frame(p, els.map((el, i) => big(el, 280 + i * 10)))
    expect(gl.draw).toHaveBeenCalledTimes(3)
    expect(gl.draw.mock.calls.map(c => c[0].shapes.length)).toEqual([1, 1, 1])
    expect(third.pending).toBe(false)
  })

  it('refreshes every sprite of a look tick in one batch at rest, then has nothing pending', () => {
    const els = [0, 1, 2].map(() => { const el = document.createElement('div'); ground.appendChild(el); return el })
    const { p } = makePresenter()
    const big = (el, i) => shape(el, { x: 200, y: 300 + i * 10, hw: 400, hh: 300 })
    frame(p, els.map(big))
    gl.draw.mockClear()
    clockMs += 500
    const tick = p.draw(els.map(big), MATERIAL, { ...LOOK, phase: 0.5 }, { lookId: 'plain', keep: () => false })
    expect(tick).toEqual({ drew: true, pending: false })
    expect(gl.draw.mock.calls.flatMap(c => c[0].shapes)).toHaveLength(3)
  })

  it('shrinks the atlas once a whole second needed less than half of it', () => {
    const el = document.createElement('div')
    const small = document.createElement('button')
    ground.append(el, small)
    const { p } = makePresenter()
    gl.draw.mockImplementation(f => { atlasCanvas.width = f.atlas.width; atlasCanvas.height = f.atlas.height })
    frame(p, [shape(el, { hw: 400, hh: 300 }), shape(small, { kind: 'control', hw: 20, hh: 20, y: 700 })])
    const big = gl.draw.mock.calls.at(-1)[0].atlas
    let press = 0
    const pressSmall = () => {
      press += 0.1
      clockMs += 100
      frame(p, [shape(el, { hw: 400, hh: 300 }), shape(small, { kind: 'control', hw: 20, hh: 20, y: 700, press })])
    }
    pressSmall()
    expect(gl.draw.mock.calls.at(-1)[0].atlas).toEqual(big) // a press never reallocates it
    for (let i = 0; i < (2 * SHRINK_MS) / 100 + 1; i++) pressSmall()
    const after = gl.draw.mock.calls.at(-1)[0].atlas
    expect(after.width * after.height * 2).toBeLessThanOrEqual(big.width * big.height)
  })

  it('removes every sprite and gives the atlas renderer back on dispose', () => {
    const el = document.createElement('div')
    ground.appendChild(el)
    const { p } = makePresenter()
    frame(p, [shape(el)])
    p.dispose()
    expect(spriteOf(el)).toBeNull()
    expect(gl.destroy).toHaveBeenCalled()
    expect(p.bytes()).toBe(0)
  })
})

describe('the registry with sprites (R5)', () => {
  it('re-appends a sprite that a textContent update wiped, and does not count it as a DOM change', async () => {
    const el = document.createElement('button')
    el.className = 'g-glass'
    el.textContent = '1'
    el.getBoundingClientRect = () => ({ width: 48, height: 48, left: 0, top: 0, right: 48, bottom: 48 })
    ground.appendChild(el)
    const { p } = makePresenter()
    const registry = createRegistry(ground, { onSpriteRemoved: (h, c) => p.restore(h, c) })
    frame(p, [shape(el, { kind: 'control', hw: 24, hh: 24 })])
    const c = spriteOf(el)
    expect(el.lastChild).toBe(c)
    el.textContent = '2' // what React does to a single-text child when the element has another child
    expect(spriteOf(el)).toBeNull()
    await vi.waitFor(() => expect(el.lastChild).toBe(c))
    expect(el.textContent).toBe('2')
    // A released sprite stays gone.
    frame(p, [], () => false)
    await new Promise(r => setTimeout(r, 0))
    expect(spriteOf(el)).toBeNull()
    registry.dispose()
  })

  it('defers the mark of a shape that is not ready and marks it on request', () => {
    const el = document.createElement('div')
    el.className = 'g-glass'
    el.getBoundingClientRect = () => ({ width: 120, height: 60, left: 0, top: 0, right: 120, bottom: 60 })
    ground.appendChild(el)
    let ready = false
    const registry = createRegistry(ground, { defer: () => !ready })
    registry.setMarked(true)
    expect(el.hasAttribute('data-lg-on')).toBe(false)
    ready = true
    registry.mark(el, true)
    expect(el.hasAttribute('data-lg-on')).toBe(true)
    registry.mark(el, false)
    expect(el.hasAttribute('data-lg-on')).toBe(false)
    registry.dispose()
  })
})
