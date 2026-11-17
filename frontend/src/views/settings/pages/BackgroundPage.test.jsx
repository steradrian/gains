// @vitest-environment happy-dom
// Background: the six looks as tiles, the Intensity slider, and what is built in. A look nobody
// picked shows the mode's default as chosen (bloom in dark, Classic in light).
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BackgroundPage from './BackgroundPage.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({
    S: state.S,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
  })
  return state
})
vi.mock('../../../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))

let host, root
beforeEach(() => {
  mocks.S = { theme: 'dark', accent: null }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<BackgroundPage />))
const tiles = () => [...host.querySelectorAll('.g-lgrid [role="radio"]')]
const lit = () => tiles().filter(r => r.getAttribute('aria-checked') === 'true').map(r => r.textContent)
const slider = () => host.querySelector('input[type="range"]')
const type = (input, value) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
const release = () => act(() => { slider().dispatchEvent(new Event('pointerup', { bubbles: true })) })
const row = title => [...host.querySelectorAll('.g-glist-row')].find(r => r.querySelector('.g-glist-body > b')?.textContent === title)

describe('Background: the looks', () => {
  it('shows the six, Classic first, and lights the mode\'s default when none was chosen', () => {
    const before = mocks.S
    mount()
    expect(tiles().map(r => r.textContent)).toEqual(['Classic', 'Linen', 'Lines', 'Florals', 'Silk', 'Bloom'])
    expect(lit()).toEqual(['Bloom'])
    expect(mocks.S).toBe(before)
    mocks.S = { ...mocks.S, theme: 'light' }
    mount()
    expect(lit()).toEqual(['Classic'])
  })

  it('choosing a look writes S.bgLook', () => {
    mount()
    act(() => tiles().find(r => r.textContent === 'Silk').click())
    expect(mocks.S.bgLook).toBe('silk')
    mount()
    expect(lit()).toEqual(['Silk'])
    expect(host.querySelector('.g-sptitle p').textContent).toBe('Silk · tab roots full, inner pages half')
  })

  it('Classic can be chosen on purpose, and then Intensity says it has none', () => {
    mount()
    act(() => tiles()[0].click())
    expect(mocks.S.bgLook).toBe('plain')
    mount()
    expect(slider()).toBeNull()
    expect(host.textContent).toContain('Classic has no intensity: it is the stage itself.')
  })
})

describe('Background: Intensity', () => {
  it('previews while the thumb moves and writes S.bgIntensity once, on release', () => {
    mocks.S = { ...mocks.S, bgLook: 'linen', bgIntensity: 0.45 }
    mount()
    expect(slider().value).toBe('45')
    type(slider(), '70')
    expect(slider().value).toBe('70')
    expect(mocks.S.bgIntensity).toBe(0.45)
    release()
    expect(mocks.S.bgIntensity).toBe(0.7)
  })

  it('the dramatic looks carry the warning, the others do not', () => {
    mocks.S = { ...mocks.S, bgLook: 'silk' }
    mount()
    expect(host.textContent).toContain('More dramatic; keep at 35% or less.')
    mocks.S = { ...mocks.S, bgLook: 'linen' }
    mount()
    expect(host.textContent).not.toContain('More dramatic')
    expect(host.textContent).toContain('Around 40 to 50% a look reads as texture, not a picture.')
  })
})

describe('Background: built in', () => {
  it('says the drift follows the phone, or that it is still under Reduce motion', () => {
    mount()
    expect(row('Slow drift').textContent).toContain('Follows phone')
    mocks.S = { ...mocks.S, reduceMotion: true }
    mount()
    expect(row('Slow drift').textContent).toContain('Still')
  })
})
