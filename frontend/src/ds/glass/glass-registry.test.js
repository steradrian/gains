// @vitest-environment happy-dom
// The registry finds the glass under a ground, drops it when the class goes, ignores flat and
// excluded elements, and caches the clipping ancestor.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRegistry } from './glass-registry.js'

let ground
let registry
const observers = { io: [], ro: [] }

class FakeObserver {
  constructor(cb, opts) { this.cb = cb; this.opts = opts; this.watched = new Set() }
  observe(el) { this.watched.add(el) }
  unobserve(el) { this.watched.delete(el) }
  disconnect() { this.watched.clear() }
}
class FakeIO extends FakeObserver { constructor(cb, opts) { super(cb, opts); observers.io.push(this) } }
class FakeRO extends FakeObserver { constructor(cb, opts) { super(cb, opts); observers.ro.push(this) } }

function add(parent, cls, { w = 120, h = 60, top = 0, left = 0, style = '', glass } = {}) {
  const el = document.createElement('div')
  el.className = cls
  if (style) el.setAttribute('style', style)
  if (glass !== undefined) el.dataset.glass = glass
  el.getBoundingClientRect = () => ({ width: w, height: h, left, top, right: left + w, bottom: top + h })
  parent.appendChild(el)
  return el
}

beforeEach(() => {
  observers.io.length = 0
  observers.ro.length = 0
  vi.stubGlobal('IntersectionObserver', FakeIO)
  vi.stubGlobal('ResizeObserver', FakeRO)
  ground = document.createElement('div')
  document.body.appendChild(ground)
})
afterEach(() => {
  registry?.dispose()
  registry = null
  ground.remove()
  vi.unstubAllGlobals()
})

describe('createRegistry', () => {
  it('finds .g-glass, .g-btn-glass and [data-glass] elements under the ground', () => {
    const a = add(ground, 'g-glass')
    const b = add(ground, 'g-btn-glass')
    const c = add(ground, '', { glass: 'bar' })
    add(ground, 'g-tile')
    registry = createRegistry(ground)
    expect([...registry.shapes.keys()]).toEqual([a, b, c])
    expect(registry.shapes.get(c).kind).toBe('bar')
  })

  it('observes each shape for size and for nearness (rootMargin 50%)', () => {
    const a = add(ground, 'g-glass')
    registry = createRegistry(ground)
    expect(observers.io[0].opts.rootMargin).toBe('50%')
    expect(observers.io[0].watched.has(a)).toBe(true)
    expect(observers.ro[0].watched.has(a)).toBe(true)
  })

  it('drops a shape when its class goes and when it is removed', async () => {
    const a = add(ground, 'g-glass')
    const b = add(ground, 'g-glass')
    const onChange = vi.fn()
    registry = createRegistry(ground, { onChange })
    a.className = 'plain'
    b.remove()
    await vi.waitFor(() => expect(registry.shapes.size).toBe(0))
    expect(onChange).toHaveBeenCalledWith('dom')
    expect(observers.ro[0].watched.size).toBe(0)
  })

  it('picks up a shape added later', async () => {
    registry = createRegistry(ground)
    const a = add(ground, 'g-glass')
    await vi.waitFor(() => expect(registry.shapes.has(a)).toBe(true))
  })

  it('ignores flat shapes: small ones, a card in a card, and an explicit flat', () => {
    const card = add(ground, 'g-glass')
    add(card, 'g-glass')
    add(ground, 'g-glass', { w: 20, h: 20 })
    add(ground, 'g-btn-glass', { glass: 'flat' })
    registry = createRegistry(ground)
    expect([...registry.shapes.keys()]).toEqual([card])
  })

  it('ignores shapes inside the excluded subtrees', () => {
    const modal = add(ground, '')
    modal.id = 'modal-root'
    add(modal, 'g-glass')
    const overlay = add(ground, 'search-ov')
    add(overlay, 'g-glass')
    registry = createRegistry(ground)
    expect(registry.shapes.size).toBe(0)
  })

  it('caches the nearest clipping ancestor and the route layer', () => {
    const layer = add(ground, 'g-route')
    const rail = add(layer, 'rail', { style: 'overflow-x: hidden; overflow-y: hidden' })
    const inner = add(rail, 'wrap')
    const a = add(inner, 'g-glass')
    registry = createRegistry(ground)
    const s = registry.shapes.get(a)
    expect(s.clipEl).toBe(rail)
    expect(s.layerEl).toBe(layer)
  })

  it('has no clip ancestor when nothing clips', () => {
    const a = add(add(ground, 'wrap'), 'g-glass')
    registry = createRegistry(ground)
    expect(registry.shapes.get(a).clipEl).toBeNull()
  })

  it('reads centre, half size without the inset, the clip rect and the opacity of a layer', () => {
    const layer = add(ground, 'g-route', { style: 'opacity: 0.5' })
    const rail = add(layer, 'rail', { w: 200, h: 100, top: 10, left: 5, style: 'overflow-x: hidden; overflow-y: hidden' })
    const a = add(rail, '', { w: 100, h: 40, top: 20, left: 30, glass: 'lens' })
    a.dataset.glassInset = '2'
    registry = createRegistry(ground)
    const [s] = registry.read()
    expect(s).toMatchObject({ el: a, kind: 'lens', x: 80, y: 40, hw: 48, hh: 20 })
    expect(s.clip).toEqual([5, 10, 205, 110])
    expect(s.opacity).toBeCloseTo(0.5)
  })

  it('leaves shapes far outside the viewport out of the frame', () => {
    add(ground, 'g-glass', { top: 5000 })
    const near = add(ground, 'g-glass', { top: 100 })
    registry = createRegistry(ground)
    expect(registry.read().map(s => s.el)).toEqual([near])
  })

  it('takes only shapes inside the include selector', () => {
    const route = add(ground, 'g-route')
    route.dataset.shared = ''
    const inside = add(route, 'g-glass')
    add(ground, 'g-glass')
    registry = createRegistry(ground, { include: '.g-route[data-shared]' })
    expect([...registry.shapes.keys()]).toEqual([inside])
  })

  it('setMarked marks every shape, later shapes follow the flag, and false unmarks', async () => {
    const a = add(ground, 'g-glass')
    registry = createRegistry(ground)
    expect(a.hasAttribute('data-lg-on')).toBe(false)
    registry.setMarked(true)
    expect(a.hasAttribute('data-lg-on')).toBe(true)
    const b = add(ground, 'g-glass')
    await vi.waitFor(() => expect(b.hasAttribute('data-lg-on')).toBe(true))
    registry.setMarked(false)
    expect(a.hasAttribute('data-lg-on')).toBe(false)
    expect(b.hasAttribute('data-lg-on')).toBe(false)
  })

  it('unmarks a shape that is dropped and every shape on dispose', async () => {
    const a = add(ground, 'g-glass')
    const b = add(ground, 'g-glass')
    registry = createRegistry(ground)
    registry.setMarked(true)
    a.className = 'plain'
    await vi.waitFor(() => expect(registry.shapes.has(a)).toBe(false))
    expect(a.hasAttribute('data-lg-on')).toBe(false)
    registry.dispose()
    expect(b.hasAttribute('data-lg-on')).toBe(false)
  })

  it('stops observing on dispose', () => {
    add(ground, 'g-glass')
    registry = createRegistry(ground)
    registry.dispose()
    expect(registry.shapes.size).toBe(0)
    expect(observers.io[0].watched.size).toBe(0)
  })
})
