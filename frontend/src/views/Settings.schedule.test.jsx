// @vitest-environment happy-dom
// Settings › Schedule › How you train (board St1Schedule): Fixed week or Rotation, DERIVED from the
// live queue (never stored) and switched with the same lib/rotation.js calls Plan uses
// (Plan.rotation.test.jsx covers Plan's side). A planner's own queue is shown, not switchable.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'
import { preloadPages } from './settings/pages/index.js'

await preloadPages()
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, nav: null, openSheet: null }
  state.snapshot = () => ({
    S: state.S,
    user: null,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
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
  const snap = () => ({ toast: vi.fn(), openSheet: (...a) => mocks.openSheet(...a) })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(), webauthnOK: () => false, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), IS_ANDROID: false,
}))
vi.mock('../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn() }))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), syncReminder: vi.fn() }))
vi.mock('./MobileOnboarding.jsx', () => ({ ConnectSheet: () => null }))
vi.mock('../sheets.jsx', () => ({
  loadStarterPlan: vi.fn(), starterPlanSheet: vi.fn(), confirmSheet: vi.fn(), importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(), menuSheet: vi.fn(),
}))
vi.mock('../lib/update.js', () => ({ checkForUpdate: vi.fn(), downloadAndInstall: vi.fn() }))

import { todayISO } from '../lib/format.js'

const routines = [{ id: 'a', name: 'A', emoji: null, ex: [] }, { id: 'b', name: 'B', emoji: null, ex: [] }]
const baseS = over => ({
  unit: 'kg', lang: 'en', weekStart: 1, checkIn: true, theme: 'dark', accent: 'lime', restSec: 90,
  workoutView: 'cards', wc: {}, reminder: { on: false, time: '08:00', tz: null }, effort: null,
  routines, week: {}, dayPlan: {}, workouts: [], bodyweight: [], exWeights: {}, customEx: [],
  equipProfiles: [], activeEquipId: null, gymCards: [], favEx: [], exNotes: {}, barWeights: {},
  queue: null, rotation: null, scheduleMode: null, active: null, ...over,
})

let host, root
beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  mocks.nav = vi.fn()
  mocks.openSheet = vi.fn()
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const ownLoop = {
  queue: { ids: ['a', 'b'], since: Date.now(), startsOn: todayISO(), label: 'Rotation', rotationId: 'r1' },
  rotation: { id: 'r1', sequence: ['a', 'b'], label: 'Rotation' },
}
const plannerQueue = { queue: { ids: ['a', 'b'], since: Date.now(), startsOn: todayISO(), label: 'US W1' } }

const mount = over => { mocks.S = baseS(over); act(() => root.render(<Settings page="schedule" />)) }
const howRow = () => [...host.querySelectorAll('[data-find]')].find(r => r.dataset.find === 'How you train')
const option = label => [...howRow().querySelectorAll('[role="radio"]')].find(b => b.textContent === label)
const picked = () => [...howRow().querySelectorAll('[role="radio"]')].find(b => b.getAttribute('aria-checked') === 'true')?.textContent

describe('Settings › Schedule › How you train', () => {
  it('reads Fixed Week without a usable queue, Rotation with one this app manages', () => {
    mount()
    expect(picked()).toBe('Fixed Week')
    mount(ownLoop)
    expect(picked()).toBe('Rotation')
  })

  it('a malformed queue reads Fixed Week; Rotation chosen with nothing built yet reads Rotation', () => {
    mount({ queue: { ids: ['gone'], since: Date.now() } })
    expect(picked()).toBe('Fixed Week')
    mount({ scheduleMode: 'rotation' })
    expect(picked()).toBe('Rotation')
  })

  it('the page line names the mode and the week start', () => {
    mount()
    expect(host.querySelector('.g-sptitle p').textContent).toBe('Fixed Week · Monday')
  })

  it('choosing Rotation writes the mode; with no fixed-week loop running, choosing Fixed Week needs no confirm', () => {
    mount()
    act(() => { option('Rotation').click() })
    expect(mocks.S.scheduleMode).toBe('rotation')
    mount({ scheduleMode: 'rotation' })
    act(() => { option('Fixed Week').click() })
    expect(mocks.S.scheduleMode).toBe('week')
    expect(mocks.openSheet).not.toHaveBeenCalled()
  })

  it('leaving a running loop asks first and changes nothing until confirmed', () => {
    mount(ownLoop)
    act(() => { option('Fixed Week').click() })
    expect(mocks.openSheet).toHaveBeenCalledTimes(1)
    expect(mocks.S.queue).not.toBeNull()
    expect(mocks.S.scheduleMode).toBe(null)
  })

  it('says when a planner manages the week, and offers no switch for it', () => {
    mount(plannerQueue)
    expect(howRow().querySelector('.g-gvr-val').textContent).toBe('Rotation · Externally managed')
    expect(howRow().textContent).toContain('Your planner manages the week, so it can’t be switched here.')
    expect(howRow().querySelector('[role="radio"]')).toBeNull()
    expect(mocks.S.queue).not.toBeNull()
  })
})
