// @vitest-environment happy-dom
// LandscapeCover: the portrait-only app's cover for a phone held sideways. It follows the device's
// orientation, not the viewport's shape: the Android keyboard shrinks the viewport of a portrait
// phone until it is wider than tall.
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import LandscapeCover, { deviceLandscape } from './LandscapeCover.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const css = readFileSync(join(import.meta.dirname, 'ds.css'), 'utf8')

const own = Object.getOwnPropertyDescriptor(window.screen, 'orientation')
const ownSize = { width: Object.getOwnPropertyDescriptor(window.screen, 'width'), height: Object.getOwnPropertyDescriptor(window.screen, 'height') }
const set = (obj, key, value) => Object.defineProperty(obj, key, { configurable: true, value })
// A screen.orientation that can turn.
function holdPhone(type) {
  const target = new EventTarget()
  const orientation = Object.assign(target, { type })
  set(window.screen, 'orientation', orientation)
  return next => { orientation.type = next; act(() => { orientation.dispatchEvent(new Event('change')) }) }
}
afterEach(() => {
  if (own) Object.defineProperty(window.screen, 'orientation', own); else delete window.screen.orientation
  for (const [k, d] of Object.entries(ownSize)) if (d) Object.defineProperty(window.screen, k, d); else delete window.screen[k]
  delete window.orientation
  vi.restoreAllMocks()
})

describe('LandscapeCover', () => {
  it('says to turn the phone upright on the stage, with line art and no button', () => {
    holdPhone('landscape-primary')
    view.render(<LandscapeCover />)
    const root = view.host.querySelector('.g-landscape-cover')
    expect(root.classList.contains('g-root')).toBe(true)
    expect(root.querySelector('.g-sempty b').textContent).toBe('Turn your phone upright')
    expect(root.querySelector('.g-sempty .g-ill')).not.toBeNull()
    expect(root.querySelector('.g-sempty').className).not.toContain('g-glass')
    expect(root.querySelectorAll('button, a')).toHaveLength(0)
  })

  it('does not show on an upright phone whose keyboard shrank the viewport to wider than tall', () => {
    holdPhone('portrait-primary')
    set(window, 'innerWidth', 360)
    set(window, 'innerHeight', 270)
    view.render(<LandscapeCover />)
    expect(view.host.querySelector('.g-landscape-cover')).toBeNull()
  })

  it('follows the device as it turns, both ways', () => {
    const turnTo = holdPhone('portrait-primary')
    view.render(<LandscapeCover />)
    expect(view.host.querySelector('.g-landscape-cover')).toBeNull()
    turnTo('landscape-secondary')
    expect(view.host.querySelector('.g-landscape-cover')).not.toBeNull()
    turnTo('portrait-secondary')
    expect(view.host.querySelector('.g-landscape-cover')).toBeNull()
  })

  it('without screen.orientation: the legacy angle, then the screen’s own sides', () => {
    set(window.screen, 'orientation', undefined)
    set(window, 'orientation', 90)
    expect(deviceLandscape()).toBe(true)
    set(window, 'orientation', 0)
    expect(deviceLandscape()).toBe(false)
    delete window.orientation
    set(window.screen, 'width', 800)
    set(window.screen, 'height', 360)
    expect(deviceLandscape()).toBe(true)
    set(window.screen, 'width', 360)
    set(window.screen, 'height', 800)
    expect(deviceLandscape()).toBe(false)
  })

  it('is hidden except on a short touch screen', () => {
    expect(css).toMatch(/\.g-landscape-cover \{ display: none; \}/)
    const media = css.match(/@media \(max-height: 500px\) and \(pointer: coarse\) \{[^}]*\.g-landscape-cover \{[^}]*display: block; position: fixed; inset: 0;/)
    expect(media).not.toBeNull()
  })
})
