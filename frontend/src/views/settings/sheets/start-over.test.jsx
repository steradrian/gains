// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMediaStore, memoryBackend, _setMediaStore } from '../../../lib/media-store.js'
import { useAccountActions } from '../use-account-actions.js'
import StartedOverScreen from '../pages/StartedOverScreen.jsx'
import { startOverItems } from './start-over.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* Start over (A2.9, A2.10; was "Reset training data" on the Danger zone page, moved here with its
   tests). Today's reset, unchanged (owner decision Q11): the store's resetEverything, the Coach's
   data in both its homes, the photos and videos — on the server once the empty state is there,
   and on this device except what a stash still refers to. The confirm says exactly what goes and
   where; it lands on Started over. */
const mocks = vi.hoisted(() => {
  const state = { S: null, user: null, coachLocal: null, config: null, sync: { status: 'ok' }, nutrition: false, stashed: new Set() }
  state.resetEverything = vi.fn()
  state.pushState = vi.fn(async () => {})
  state.confirmDrawer = vi.fn()
  state.forgetCoach = vi.fn(() => Promise.resolve({ ok: true }))
  state.api = vi.fn(() => Promise.resolve({ ok: true }))
  state.navs = []
  state.snapshot = () => ({
    S: state.S, user: state.user, coachLocal: state.coachLocal, config: state.config, sync: state.sync,
    resetEverything: state.resetEverything, pushState: state.pushState, stashedMediaHashes: async () => state.stashed,
  })
  return state
})
vi.mock('../../../store/useStore.js', () => {
  const useStore = selector => (selector ? selector(mocks.snapshot()) : mocks.snapshot())
  useStore.getState = mocks.snapshot
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: vi.fn() })
  const useUI = selector => (selector ? selector(snap()) : snap())
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({
  useNavigate: () => to => mocks.navs.push(to),
  Navigate: ({ to }) => <i data-redirect={to} />,
}))
vi.mock('../../../lib/api.js', () => ({ api: (...a) => mocks.api(...a), webauthnOK: () => false }))
vi.mock('../../../lib/coach-api.js', () => ({ forgetCoach: (...a) => mocks.forgetCoach(...a) }))
vi.mock('../../../lib/nutrition/api.js', () => ({ nutritionAvailable: () => mocks.nutrition }))
vi.mock('../../../sheets.jsx', () => ({ confirmSheet: vi.fn() }))
vi.mock('../../../components/ServerSync.jsx', () => ({ leaveServer: vi.fn() }))
vi.mock('../use-data-actions.js', () => ({ useDataActions: () => ({ doExport: vi.fn(), doExportZip: vi.fn() }) }))
vi.mock('../confirm-drawer.js', () => ({ confirmDrawer: (...a) => mocks.confirmDrawer(...a) }))
vi.mock('../../../ds/StagePage.jsx', () => ({ default: ({ children }) => <section>{children}</section> }))
vi.mock('../../../ds/StagePageTitle.jsx', () => ({ default: ({ title, line }) => <><h1>{title}</h1><p className="line">{line}</p></> }))

const HASH = 'a'.repeat(64)
const OTHER = 'c'.repeat(64)
const items = n => Array.from({ length: n }, (_, i) => ({ id: 'x' + i }))
const photoEx = { id: 'c1', n: 'Sandbag carry', custom: true, media: { kind: 'image', hash: HASH, mime: 'image/jpeg', size: 10, width: 4, height: 4, at: 1 } }

let host, root, actions, media, clock
function Harness() { actions = useAccountActions(); return null }
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
const until = async (cond, ms = 4000) => {
  const end = Date.now() + ms
  while (!(await cond()) && Date.now() < end) await act(async () => { await new Promise(r => setTimeout(r, 10)) })
}
const openConfirm = () => {
  act(() => root.render(<Harness />))
  act(() => actions.startOver())
  expect(mocks.confirmDrawer).toHaveBeenCalledTimes(1)
  return mocks.confirmDrawer.mock.calls[0][0]
}
// Opened, then confirmed. Not inside one act(): the harness has to render this test's store first.
const confirmed = () => {
  const dialog = openConfirm()
  act(() => { dialog.onConfirm() })
}
const serverForgetCalls = () => mocks.api.mock.calls.filter(([path]) => path === '/api/coach/forget')

beforeEach(() => {
  // The clean-up keeps a file put at the moment it runs (retainOnly keepPutAfter): files here are
  // put a second before the reset.
  clock = 1000
  media = createMediaStore(memoryBackend(), { now: () => clock })
  _setMediaStore(media)
  mocks.S = { unit: 'kg', workouts: [], routines: [], bodyweight: [], measurements: [], customEx: [], week: {} }
  mocks.user = null
  mocks.coachLocal = null
  mocks.config = null
  mocks.sync = { status: 'ok' }
  mocks.nutrition = false
  mocks.stashed = new Set()
  mocks.navs = []
  for (const f of [mocks.resetEverything, mocks.pushState, mocks.confirmDrawer, mocks.forgetCoach, mocks.api]) f.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  _setMediaStore(null)
})

describe('Start over: what the confirm lists', () => {
  it('counts what the profile holds, part by part, and leaves out a part with nothing in it', () => {
    const S = { workouts: items(212), routines: items(6), week: { 1: 'r1' }, bodyweight: items(64), measurements: [], customEx: [photoEx] }
    expect(startOverItems(S)).toEqual([
      '212 workouts, 6 routines, 1 custom exercise, your Plan',
      '64 weigh-ins',
      '1 photo or video',
      'Your settings, gym setup and notes. The language stays.',
    ])
  })

  it('an empty profile still says the settings go; a running workout is named', () => {
    expect(startOverItems({ workouts: [], routines: [], week: {} })).toEqual(['Your settings, gym setup and notes. The language stays.'])
    expect(startOverItems({ active: { entries: [] } })).toContain('The workout you have running')
  })
})

describe('Start over: the confirm and what it does', () => {
  it('guest: says the wipe is on this device, resets, never calls the Coach, and lands on Started over', () => {
    const dialog = openConfirm()
    expect(dialog.title).toBe('Start over?')
    expect(dialog.confirmLabel).toBe('Start over')
    expect(dialog.body).toBe('This wipes what you logged on this device. It cannot be undone.')
    expect(dialog.note).toBe('Export a backup first if you might want any of it back.')
    act(() => { dialog.onConfirm() })
    expect(mocks.resetEverything).toHaveBeenCalledTimes(1)
    expect(serverForgetCalls()).toHaveLength(0)
    expect(mocks.forgetCoach).not.toHaveBeenCalled()
    expect(mocks.navs).toEqual(['/me/account/started-over'])
  })

  it('signed in: says the wipe reaches every device, what stays, and forgets the Coach on the server too', () => {
    mocks.user = { id: 'u1', name: 'Ana' }
    mocks.nutrition = true
    const dialog = openConfirm()
    expect(dialog.body).toBe('This wipes what you logged, here and on every device signed in to your profile. It cannot be undone.')
    expect(dialog.note).toBe('Your account and passkeys stay. Your nutrition diary, foods and goals stay. Download my data first if you might want it.')
    act(() => { dialog.onConfirm() })
    expect(serverForgetCalls()).toHaveLength(1)
    expect(serverForgetCalls()[0][1]).toEqual({ method: 'POST', body: '{}' })
    expect(mocks.forgetCoach).not.toHaveBeenCalled()   // no device Coach here
    expect(mocks.resetEverything).toHaveBeenCalledTimes(1)
  })

  it('nothing happens until the confirm is confirmed', () => {
    mocks.user = { id: 'u1', name: 'Ana' }
    openConfirm()
    expect(mocks.resetEverything).not.toHaveBeenCalled()
    expect(mocks.api).not.toHaveBeenCalled()
    expect(mocks.navs).toEqual([])
  })

  it('signed in: a failing Coach call does not block the reset', async () => {
    mocks.user = { id: 'u1', name: 'Ana' }
    mocks.api.mockRejectedValueOnce(new Error('offline'))
    const dialog = openConfirm()
    await act(async () => { dialog.onConfirm(); await Promise.resolve() })
    expect(serverForgetCalls()).toHaveLength(1)
    expect(mocks.resetEverything).toHaveBeenCalledTimes(1)
  })

  // A paired phone running the Coach with its own key has Coach data in both homes.
  it('paired phone with its own key: clears the Coach on the server and on the device', () => {
    mocks.user = { id: 'u1', name: 'Ana' }
    mocks.coachLocal = { mode: 'byok', provider: 'anthropic' }
    confirmed()
    expect(serverForgetCalls()).toHaveLength(1)
    expect(mocks.forgetCoach).toHaveBeenCalledTimes(1)
    expect(mocks.resetEverything).toHaveBeenCalledTimes(1)
  })

  it('own key, no server: clears the device Coach without touching the server', () => {
    mocks.coachLocal = { mode: 'byok', provider: 'anthropic' }
    confirmed()
    expect(serverForgetCalls()).toHaveLength(0)
    expect(mocks.forgetCoach).toHaveBeenCalledTimes(1)
    expect(mocks.resetEverything).toHaveBeenCalledTimes(1)
  })
})

describe('Start over: photos and videos', () => {
  it('signed in: pushes, asks the server to sweep, and keeps only what a stash refers to', async () => {
    mocks.user = { id: 'u1', name: 'Ana' }
    mocks.config = { media: { imageMB: 2 } }
    await media.put(HASH, new Blob(['p']), { mime: 'image/jpeg', pending: false })
    await media.put(OTHER, new Blob(['x']), { mime: 'image/png', pending: true })
    mocks.stashed = new Set([OTHER])
    clock += 1000
    confirmed()
    await until(async () => !(await media.has(HASH)))
    expect(mocks.pushState).toHaveBeenCalled()
    expect(mocks.api.mock.calls.map(c => c[0])).toContain('/api/media/sweep')
    expect(await media.has(HASH)).toBe(false)
    expect(await media.has(OTHER)).toBe(true)
  })

  it('no sweep before the empty state is on the server, nor for a guest', async () => {
    mocks.user = { id: 'u1', name: 'Ana' }
    mocks.config = { media: { imageMB: 2 } }
    mocks.sync = { status: 'offline' }
    confirmed()
    await until(() => mocks.pushState.mock.calls.length > 0)
    await settle()
    expect(mocks.api.mock.calls.map(c => c[0])).not.toContain('/api/media/sweep')

    mocks.user = null
    mocks.sync = { status: 'ok' }
    mocks.confirmDrawer.mockClear(); mocks.api.mockClear()
    await media.put(HASH, new Blob(['p']), { mime: 'image/jpeg', pending: true })
    clock += 1000
    confirmed()
    await until(async () => !(await media.has(HASH)))
    expect(mocks.api).not.toHaveBeenCalled()
    expect(await media.has(HASH)).toBe(false)
  })
})

describe('Started over (A2.10)', () => {
  it('says when, what is gone and what stayed, and Go to Today opens Today', () => {
    mocks.user = { id: 'u1', name: 'Ana' }
    mocks.S = { ...mocks.S, resetAt: new Date(2026, 9, 18, 21, 30).getTime() }
    act(() => root.render(<StartedOverScreen />))
    expect(host.querySelector('h1').textContent).toBe('Started over')
    expect(host.querySelector('.line').textContent).toMatch(/18/)
    expect(host.textContent).toContain('A clean slate')
    expect(host.textContent).toContain('Everything you logged is gone. Your account and passkeys are as they were.')
    const go = [...host.querySelectorAll('button, a')].find(b => b.textContent === 'Go to Today')
    act(() => go.click())
    expect(mocks.navs).toEqual(['/home'])
  })

  it('a guest hears it was this device; a profile that never started over goes back to Account', () => {
    mocks.S = { ...mocks.S, resetAt: Date.now() }
    act(() => root.render(<StartedOverScreen />))
    expect(host.textContent).toContain('Everything you logged on this device is gone.')
    mocks.S = { ...mocks.S, resetAt: undefined }
    act(() => root.render(<StartedOverScreen key="again" />))
    expect(host.querySelector('[data-redirect]').getAttribute('data-redirect')).toBe('/me/account')
  })
})
