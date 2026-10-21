// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'
import { preloadPages } from './settings/pages/index.js'
import { stubHubOffline } from '../lib/nutrition/hub-offline.test-util.js'

await preloadPages()
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// About & updates and Licences: the source link, the version and the credits. (Start over, which
// shared this file as "Reset training data", is tested in settings/sheets/start-over.test.jsx.)
const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({
    S: state.S, user: null, coachLocal: null,
    update: vi.fn(), replaceState: vi.fn(), resetEverything: vi.fn(), setUser: vi.fn(), pullState: vi.fn(), pushState: vi.fn(),
    signOut: vi.fn(), signOutAll: vi.fn(), resetDemo: vi.fn(), disconnectServer: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' }, workouts: [] }, hasData: () => false }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(() => Promise.resolve({ ok: true })), webauthnOK: () => false, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), IS_ANDROID: false,
}))
vi.mock('../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn() }))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), syncReminder: vi.fn() }))
vi.mock('../lib/coach-api.js', () => ({ forgetCoach: vi.fn() }))
vi.mock('./MobileOnboarding.jsx', () => ({ ConnectSheet: () => null }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), confirmSheet: vi.fn(), importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(), menuSheet: vi.fn(),
}))

globalThis.__APP_VERSION__ ??= 'test'

let host, root
beforeEach(() => {
  stubHubOffline()
  mocks.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: false, effort: 'none',
    gifSize: 'full', workouts: [], routines: [], exWeights: {},
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('Settings — footer', () => {
  it('links the source code to its home on GitHub, on About & updates', () => {
    act(() => root.render(<Settings page="about" />))
    const link = [...host.querySelectorAll('a')].find(a => a.textContent === 'Source code')
    expect(link.getAttribute('href')).toBe('https://github.com/steradrian/gains')
  })

  it('shows Gains\' own version, not upstream\'s', () => {
    act(() => root.render(<Settings page="about" />))
    expect(host.textContent).toContain('Gains v0.1.0 · free & open source (AGPL v3)')
    expect(host.textContent).not.toContain(`v${globalThis.__APP_VERSION__} ·`)
  })

  it('keeps the Gym visual attribution word for word, still naming openGym, on About and Licences', () => {
    const line = 'Exercise media © Aliaksandr Makatserchyk, Gym visual, gymvisual.com.Media licensed for use in openGym only; see NOTICE.md'
    for (const page of ['about', 'licences']) {
      act(() => root.render(<Settings page={page} />))
      expect(host.textContent.replace(/\s+/g, ' ').replace('.Media', '. Media')).toContain(line.replace('.Media', '. Media'))
    }
  })

  it('credits the upstream version on Licences', () => {
    act(() => root.render(<Settings page="licences" />))
    expect(host.textContent).toContain(`Built on openGym v${globalThis.__APP_VERSION__} by Duarte Santos.`)
  })
})
