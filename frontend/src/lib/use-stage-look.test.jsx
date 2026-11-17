// @vitest-environment happy-dom
// useStageLook: the look, intensity and motion AppStage draws from, as primitives, so a store write
// that changes none of them re-renders nothing.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from '../ds/render.test-util.js'
import { DEF, useStore } from '../store/useStore.js'
import { useStageLook } from './use-stage-look.js'

const view = useView()
let originalS
let renders
let latest
let osReduces
let osListeners

beforeEach(() => {
  originalS = useStore.getState().S
  useStore.setState({ S: JSON.parse(JSON.stringify({ ...DEF, theme: 'dark' })) })
  renders = 0
  osReduces = false
  osListeners = new Set()
  window.matchMedia = vi.fn(query => ({
    matches: query.includes('reduced-motion') ? osReduces : false,
    addEventListener: (_, cb) => osListeners.add(cb),
    removeEventListener: (_, cb) => osListeners.delete(cb),
  }))
})
afterEach(() => { useStore.setState({ S: originalS }) })

function Probe() {
  renders++
  latest = useStageLook()
  return null
}
const set = mut => act(() => { useStore.getState().update(mut, false) })

describe('useStageLook', () => {
  it('follows the resolved mode while no look is chosen', () => {
    view.render(<Probe />)
    expect(latest.look).toBe('bloom')
    set(s => { s.theme = 'light' })
    expect(latest.look).toBe('plain')
  })

  it('draws a chosen look in both modes and reads the intensity', () => {
    set(s => { s.bgLook = 'silk'; s.bgIntensity = 0.7; s.theme = 'light' })
    view.render(<Probe />)
    expect(latest).toMatchObject({ look: 'silk', intensity: 0.7 })
    set(s => { s.theme = 'dark' })
    expect(latest.look).toBe('silk')
  })

  it('falls back to 0.45 for a missing or bad intensity', () => {
    set(s => { s.bgIntensity = 'x' })
    view.render(<Probe />)
    expect(latest.intensity).toBe(0.45)
  })

  it('moves unless Reduce motion or the OS asks it not to', () => {
    view.render(<Probe />)
    expect(latest.motion).toBe(true)
    set(s => { s.reduceMotion = true })
    expect(latest.motion).toBe(false)
    set(s => { s.reduceMotion = false })
    expect(latest.motion).toBe(true)
  })

  it('stands still when the OS asks for reduced motion', () => {
    osReduces = true
    view.render(<Probe />)
    expect(latest.motion).toBe(false)
    osReduces = false
    act(() => osListeners.forEach(cb => cb()))
    expect(latest.motion).toBe(true)
  })

  it('does not re-render for a store write that touches none of its values', () => {
    view.render(<Probe />)
    const before = renders
    const value = latest
    set(s => { s.unit = s.unit === 'kg' ? 'lb' : 'kg' })
    set(s => { s.restSec = 120 })
    expect(renders).toBe(before)
    expect(latest).toBe(value)
  })
})
