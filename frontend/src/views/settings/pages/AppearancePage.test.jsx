// @vitest-environment happy-dom
// Appearance: the accent picker, the ready-made chips, the theme, the Background row, Reduce motion.
// What is lit when nothing was chosen is the mode's default (ink in dark, cobalt in light).
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setRestAccent } from '../../../lib/rest-alert.js'
import AppearancePage from './AppearancePage.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, user: null, ctx: { systemMotion: false, canHaptic: false }, navs: [] }
  state.snapshot = () => ({
    S: state.S,
    user: state.user,
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
vi.mock('react-router-dom', () => ({ useNavigate: () => (...a) => mocks.navs.push(a) }))
vi.mock('../use-settings-ctx.js', () => ({ useSettingsCtx: () => mocks.ctx }))
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))
vi.mock('../../../lib/rest-alert.js', () => ({ setRestAccent: vi.fn() }))

let host, root
beforeEach(() => {
  mocks.S = { theme: 'dark', accent: null, workouts: [], routines: [] }
  mocks.user = null
  mocks.ctx = { systemMotion: false, canHaptic: false }
  mocks.navs = []
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  setRestAccent.mockClear()
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<AppearancePage />))
const swatch = name => [...host.querySelectorAll('.g-apick [role="radio"]')].find(r => r.textContent === name)
const litSwatches = () => [...host.querySelectorAll('.g-apick [aria-checked="true"]')].map(r => r.textContent)
const row = title => [...host.querySelectorAll('.g-glist-row')].find(r => r.querySelector('.g-glist-body > b')?.textContent === title)
const chip = name => [...host.querySelectorAll('.g-rmchip')].find(c => c.textContent === name)
const line = () => host.querySelector('.g-sptitle p').textContent

describe('Appearance: accent', () => {
  it('lights the mode\'s default when none was chosen, and writes nothing', () => {
    const before = mocks.S
    mount()
    expect(litSwatches()).toEqual(['Ink'])
    expect(mocks.S).toBe(before)
    mocks.S = { ...mocks.S, theme: 'light' }
    mount()
    expect(litSwatches()).toEqual(['Cobalt'])
  })

  it('picking one writes S.accent and tells the native countdown', () => {
    mount()
    act(() => swatch('Moss').click())
    expect(mocks.S.accent).toBe('moss')
    expect(setRestAccent).toHaveBeenCalledWith('moss')
    mount()
    expect(litSwatches()).toEqual(['Moss'])
  })
})

describe('Appearance: the line under the title', () => {
  it('names the resolved accent, look and theme', () => {
    mount()
    expect(line()).toBe('Ink · Bloom · Dark theme')
    mocks.S = { ...mocks.S, theme: 'light' }
    mount()
    expect(line()).toBe('Cobalt · Classic · Light theme')
    mocks.S = { ...mocks.S, theme: 'system', accent: 'moss', bgLook: 'silk' }
    mount()
    expect(line()).toMatch(/^Moss · Silk · System theme$/)
  })
})

describe('Appearance: ready-made', () => {
  it('Princess sets the accent, the look and its strength together', () => {
    mount()
    act(() => chip('Princess').click())
    expect(mocks.S).toMatchObject({ accent: 'blossom', bgLook: 'florals', bgIntensity: 0.5 })
    expect(setRestAccent).toHaveBeenCalledWith('blossom')
  })

  it('has the six chips and presses the one that matches the current settings', () => {
    mocks.S = { ...mocks.S, accent: 'mist', bgLook: 'bloom', bgIntensity: 0.4 }
    mount()
    expect([...host.querySelectorAll('.g-rmchip')].map(c => c.textContent)).toEqual(['Princess', 'Watermelon', 'Peach cream', 'Snow', 'Cream', 'Mist'])
    expect([...host.querySelectorAll('.g-rmchip[aria-pressed="true"]')].map(c => c.textContent)).toEqual(['Mist'])
  })
})

describe('Appearance: theme', () => {
  it('writes S.theme', () => {
    mount()
    const radios = [...host.querySelectorAll('[aria-label="Theme"] [role="radio"]')]
    expect(radios.map(r => r.textContent)).toEqual(['Light', 'Dark', 'System'])
    act(() => radios[2].click())
    expect(mocks.S.theme).toBe('system')
    act(() => radios[0].click())
    expect(mocks.S.theme).toBe('light')
  })
})

describe('Appearance: Background and pictures', () => {
  it('the Background row shows the resolved look and opens the page', () => {
    mount()
    expect(row('Background').textContent).toContain('Bloom')
    act(() => row('Background').click())
    expect(mocks.navs.at(-1)).toEqual(['/me/background'])
  })

  it('Body diagram and Exercise drawings keep their keys', () => {
    mount()
    const body = [...row('Body diagram').querySelectorAll('[role="radio"]')]
    act(() => body[1].click())
    expect(mocks.S.body).toBe('female')
    const drawings = [...row('Exercise drawings').querySelectorAll('[role="radio"]')]
    act(() => drawings[1].click())
    expect(mocks.S.exFigure).toBe('female')
  })
})

describe('Appearance: on screen', () => {
  const motion = () => row('Reduce motion').querySelector('[role="switch"]')

  it('Reduce motion writes S.reduceMotion', () => {
    mount()
    expect(motion().getAttribute('aria-checked')).toBe('false')
    act(() => motion().click())
    expect(mocks.S.reduceMotion).toBe(true)
  })

  it('is on and locked, with the reason, when the phone already reduces motion', () => {
    mocks.ctx = { systemMotion: true, canHaptic: false }
    mount()
    expect(motion().getAttribute('aria-checked')).toBe('true')
    expect(motion().disabled).toBe(true)
    expect(row('Reduce motion').textContent).toContain('Follows your phone.')
    act(() => motion().click())
    expect(mocks.S.reduceMotion).toBeUndefined()
  })

  const transparency = () => row('Reduce transparency').querySelector('[role="switch"]')

  it('Reduce transparency writes S.reduceTransparency', () => {
    mount()
    expect(transparency().getAttribute('aria-checked')).toBe('false')
    expect(row('Reduce transparency').textContent).toContain('Solid surfaces instead of glass.')
    act(() => transparency().click())
    expect(mocks.S.reduceTransparency).toBe(true)
  })

  it('Reduce transparency is on and locked, with the reason, when the phone already reduces it', () => {
    mocks.ctx = { systemMotion: false, systemTransparency: true, canHaptic: false }
    mount()
    expect(transparency().getAttribute('aria-checked')).toBe('true')
    expect(transparency().disabled).toBe(true)
    expect(row('Reduce transparency').textContent).toContain('Follows your phone.')
    act(() => transparency().click())
    expect(mocks.S.reduceTransparency).toBeUndefined()
  })

  it('Haptics is only offered where the device has them', () => {
    mount()
    expect(row('Haptics')).toBeUndefined()
    mocks.ctx = { systemMotion: false, canHaptic: true }
    mount()
    act(() => row('Haptics').querySelector('[role="switch"]').click())
    expect(mocks.S.haptics).toBe(false)
  })

  it('Gym check-in is on by default, writes S.checkIn, and Add card opens the card page while it is on', () => {
    mount()
    expect(row('Gym check-in').querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('true')
    act(() => row('Add card').click())
    expect(mocks.navs.at(-1)).toEqual(['/train/checkin'])
    act(() => row('Gym check-in').querySelector('[role="switch"]').click())
    expect(mocks.S.checkIn).toBe(false)
    mount()
    expect(row('Add card')).toBeUndefined()
  })

  it('Show connection status keeps its two writes', () => {
    mocks.S = { ...mocks.S, connStatus: false, connLocal: false }
    mount()
    act(() => row('Show connection status').querySelector('[role="switch"]').click())
    expect(mocks.S).toMatchObject({ connStatus: true, connLocal: true })
  })
})
