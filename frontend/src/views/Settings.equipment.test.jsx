// @vitest-environment happy-dom
// /me/equipment is Gym setup (Train slice 6, T12.0): SettingsRoute gives the Equipment page to the
// stage page Train opens too, instead of the old Settings card, and a Settings search hit for one
// of its rows lands on that row there. Every other page stays in the Settings shell.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsRoute } from './settings/SettingsRoute.jsx'
import { preloadPages } from './settings/pages/index.js'

await preloadPages()
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, params: {}, location: { key: 'k1', state: null } }
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
vi.mock('react-router-dom', () => ({
  useNavigate: () => () => {},
  useParams: () => mocks.params,
  useLocation: () => mocks.location,
  Navigate: () => null,
}))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(), webauthnOK: () => false, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), IS_ANDROID: false,
}))
vi.mock('../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn() }))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), syncReminder: vi.fn() }))
vi.mock('./MobileOnboarding.jsx', () => ({ ConnectSheet: () => null }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), confirmSheet: vi.fn(), importFromApp: vi.fn(), importFromHevy: vi.fn(), menuSheet: vi.fn(),
  equipmentProfileSheet: vi.fn(), plateInventorySheet: vi.fn(), dumbbellInventorySheet: vi.fn(),
}))

globalThis.__APP_VERSION__ ??= 'test'

let host, root
beforeEach(() => {
  mocks.S = {
    unit: 'kg', theme: 'dark', accent: 'lime', workouts: [], routines: [], exWeights: {},
    equipProfiles: [{ id: 'home', name: 'Home', equipment: ['dumbbell'] }], activeEquipId: 'home', equipFilterOn: false,
  }
  mocks.params = {}
  mocks.location = { key: 'k1', state: null }
  Element.prototype.scrollIntoView = vi.fn()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<SettingsRoute />))

describe('SettingsRoute: the Equipment page', () => {
  it('is Gym setup on the stage, not a card in the Settings shell', () => {
    mocks.params = { page: 'equipment' }
    mount()
    expect(host.querySelector('.g-spage-title').textContent).toBe('Gym setup')
    expect(host.querySelector('.lrow')).toBeNull()
    expect(host.textContent).toContain('Used for plate maths and plan fitting')
  })

  it('lands a search hit on its row and flashes it', () => {
    mocks.params = { page: 'equipment' }
    mocks.location = { key: 'k2', state: { find: 'Dumbbells' } }
    mount()
    const part = host.querySelector('#gym-bells')
    expect(part.classList.contains('tcp-flash')).toBe(true)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('leaves the other pages in the Settings shell', () => {
    mocks.params = { page: 'import' }
    mount()
    expect(host.querySelector('.g-spage')).toBeNull()
    expect(host.querySelector('.lrow')).not.toBeNull()
  })
})
