// @vitest-environment happy-dom
/* The loader and the loading line: a canvas the G draws itself on, decoration only, still when
 * the device or the app asks for reduced motion, harmless where there is no canvas; and the line
 * that pairs it with its words as one live status. The canvas is a stand-in that records what it
 * is asked (the drawing itself is brand-motion.test.js). */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Loader, Loading } from './Loader.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, host, ctx, frames, cancelled
const realGetContext = HTMLCanvasElement.prototype.getContext
const draw = el => act(() => root.render(el))

beforeEach(() => {
  frames = []; cancelled = []
  ctx = {}
  for (const m of ['beginPath', 'moveTo', 'lineTo', 'arc', 'save', 'restore', 'stroke', 'setTransform', 'clearRect']) ctx[m] = vi.fn()
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx)
  vi.stubGlobal('requestAnimationFrame', fn => { frames.push(fn); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', id => cancelled.push(id))
  delete document.documentElement.dataset.motion
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  HTMLCanvasElement.prototype.getContext = realGetContext
  vi.restoreAllMocks(); vi.unstubAllGlobals()
  delete document.documentElement.dataset.motion
})

describe('Loader', () => {
  it('is a canvas, decoration only, medium by default', () => {
    draw(<Loader />)
    const c = host.querySelector('canvas')
    expect(c.className).toBe('loader loader-md')
    expect(c.getAttribute('aria-hidden')).toBe('true')
  })

  it('takes a size and a class', () => {
    draw(<Loader size="lg" className="here" />)
    expect(host.querySelector('canvas').className).toBe('loader loader-lg here')
  })

  it('draws a frame at once and keeps animating until it is taken away', () => {
    draw(<Loader />)
    expect(ctx.clearRect).toHaveBeenCalledTimes(1)
    expect(frames).toHaveLength(1)
    act(() => root.render(null))
    expect(cancelled).toHaveLength(1)
  })

  it('reduced motion: the whole G once, and nothing moving', () => {
    document.documentElement.dataset.motion = 'reduce'
    draw(<Loader />)
    expect(ctx.stroke).toHaveBeenCalledTimes(2)   // the ring and bar, then the groove cut
    expect(frames).toHaveLength(0)
  })

  it('does nothing where there is no 2D context, and does not break the page', () => {
    HTMLCanvasElement.prototype.getContext.mockImplementation(() => null)
    draw(<Loader />)
    expect(host.querySelector('canvas')).not.toBeNull()
    expect(frames).toHaveLength(0)
  })
})

describe('Loading', () => {
  it('is one live status: the loader and the words', () => {
    draw(<Loading />)
    const line = host.querySelector('[role="status"]')
    expect(line.className).toBe('loadline')
    expect(line.textContent).toBe('Loading…')
    expect(line.querySelector('canvas.loader.loader-sm').getAttribute('aria-hidden')).toBe('true')
    expect(line.hasAttribute('aria-label')).toBe(false)
  })

  it('says what it is asked to say', () => {
    draw(<Loading>Loading Coach status…</Loading>)
    expect(host.querySelector('[role="status"]').textContent).toBe('Loading Coach status…')
  })

  it('inline sits in a sentence, with the small loader, and keeps the classes it is given', () => {
    draw(<Loading inline className="muted small">Fetching</Loading>)
    const line = host.querySelector('[role="status"]')
    expect(line.className).toBe('loadline loadline-inline muted small')
    expect(line.querySelector('canvas').className).toContain('loader-xs')
  })

  it('without words it is named by its label, so it is still announced', () => {
    draw(<Loading label="Loading photos">{null}</Loading>)
    const line = host.querySelector('[role="status"]')
    expect(line.getAttribute('aria-label')).toBe('Loading photos')
    expect(line.querySelector('span')).toBeNull()
  })
})
