// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'
import { preloadPages } from './settings/pages/index.js'
import { searchSettings } from './settings-pages.js'
import { setRestAccent } from '../lib/rest-alert.js'
import { THEMES } from '../lib/themes.js'

await preloadPages()
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({
    S: state.S,
    user: null,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
    replaceState: vi.fn(), setUser: vi.fn(), pullState: vi.fn(), pushState: vi.fn(),
    signOut: vi.fn(), signOutAll: vi.fn(), resetDemo: vi.fn(), disconnectServer: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(), webauthnOK: () => false, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), IS_ANDROID: false,
}))
vi.mock('../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn() }))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), syncReminder: vi.fn() }))
vi.mock('./MobileOnboarding.jsx', () => ({ ConnectSheet: () => null }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), confirmSheet: vi.fn(), importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(),
}))

// The Settings view reads the build-time version constant at render time.
globalThis.__APP_VERSION__ ??= 'test'

vi.mock('../lib/rest-alert.js', () => ({ setRestAccent: vi.fn() }))

let host, root
beforeEach(() => {
  mocks.S = { unit: 'kg', theme: 'dark', accent: null, workouts: [], routines: [], exWeights: {} }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  setRestAccent.mockClear()
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<Settings page="appearance" />))
const swatches = () => [...host.querySelectorAll('.g-apick [role="radio"]')]
const selected = () => swatches().filter(s => s.getAttribute('aria-checked') === 'true').map(s => s.textContent)

describe('Settings: accent picker', () => {
  it('shows the 28 themes by name, and no own-colour picker', () => {
    mount()
    expect(swatches().map(s => s.textContent)).toEqual(THEMES.map(p => p.name))
    expect(host.querySelector('input[type="color"]')).toBe(null)
  })

  it('picking one stores its id and tells the native countdown', () => {
    mount()
    act(() => swatches().find(s => s.textContent === 'Moss').click())
    expect(mocks.S.accent).toBe('moss')
    expect(setRestAccent).toHaveBeenCalledWith('moss')
    mount()
    expect(selected()).toEqual(['Moss'])
    expect(host.querySelector('.g-sptitle p').textContent).toMatch(/^Moss · /)
  })

  it('an accent never picked shows the mode default and writes nothing', () => {
    const before = mocks.S
    mount()
    expect(selected()).toEqual(['Ink'])
    expect(mocks.S).toBe(before)
    expect(setRestAccent).not.toHaveBeenCalled()
  })

  it('an id from before the 25 themes shows as its theme, stored value untouched', () => {
    mocks.S.accent = 'sky'
    mount()
    expect(selected()).toEqual(['Cobalt'])
    expect(mocks.S.accent).toBe('sky')
  })

  it('a stored own colour shows as the nearest theme and is left alone', () => {
    mocks.S.accent = 'custom'; mocks.S.accentCustom = '#777777'
    mount()
    expect(selected()).toEqual(['Ink'])
    expect(mocks.S.accentCustom).toBe('#777777')
  })

  it('the settings search finds it by accent name', () => {
    for (const q of ['accent', 'Moss', 'Peach cream']) {
      expect(searchSettings(q, {}).map(h => h.title), q).toContain('Accent color')
    }
  })
})
