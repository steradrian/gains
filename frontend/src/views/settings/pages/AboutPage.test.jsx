// @vitest-environment happy-dom
// About (board St1About): the version from BRAND, the Android-only update check (the old
// Settings.update.test, moved here), the Install row's states and the Credits rows.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BRAND, LINKS } from '../../../brand.js'
import { fmtDate } from '../../../lib/format.js'
import AboutPage from './AboutPage.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, MOBILE: false, android: false, androidWeb: false, standalone: false, navs: [], opened: [] }
  state.snapshot = () => ({
    S: state.S, user: null, sync: null, config: null,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
  })
  state.checkForUpdate = vi.fn(() => Promise.resolve({ hasUpdate: true, latestVersion: '9.9.9', apkUrl: 'https://x/gains.apk', hashUrl: null }))
  state.confirmSheet = vi.fn()
  state.toast = vi.fn()
  return state
})
vi.mock('../../../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})
vi.mock('../../../store/useUI.js', () => {
  const snap = () => ({ toast: mocks.toast, openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => (...a) => mocks.navs.push(a) }))
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn(), isSwitching: () => false }))
vi.mock('../../../lib/api.js', () => ({
  api: vi.fn(), webauthnOK: () => false, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(),
  get IS_ANDROID() { return mocks.androidWeb },
}))
vi.mock('../../../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn() }))
vi.mock('../../../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
// MOBILE is read at render time through a getter so one module mock serves both builds.
vi.mock('../../../lib/mobile.js', () => ({
  get MOBILE() { return mocks.MOBILE },
  isAndroid: () => Promise.resolve(mocks.android),
  shareExport: vi.fn(), syncReminder: vi.fn(),
}))
vi.mock('../../../lib/update.js', () => ({
  checkForUpdate: (...a) => mocks.checkForUpdate(...a),
  downloadAndInstall: vi.fn(),
  fetchChecksum: vi.fn(),
  RELEASES_PAGE: 'https://example.test/releases',
}))
vi.mock('../../../lib/build-info.js', () => ({ BUILD_DATE: '2026-10-18' }))
vi.mock('../../../components/CustomMedia.jsx', () => ({ openExternal: url => mocks.opened.push(url) }))
vi.mock('../../../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), confirmSheet: (...a) => mocks.confirmSheet(...a), importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(), menuSheet: vi.fn(),
}))

globalThis.__APP_VERSION__ ??= 'test'

let host, root
beforeEach(() => {
  mocks.S = { unit: 'kg', restSec: 90, gifSize: 'full', workouts: [], routines: [], exWeights: {} }
  mocks.MOBILE = false
  mocks.android = false
  mocks.androidWeb = false
  mocks.standalone = false
  mocks.navs = []
  mocks.opened = []
  mocks.checkForUpdate.mockClear()
  mocks.confirmSheet.mockClear()
  mocks.toast.mockClear()
  window.matchMedia = () => ({ matches: mocks.standalone })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

// The effect resolves two promises (isAndroid, then checkForUpdate) before the row can render.
const mount = async () => {
  await act(async () => { root.render(<AboutPage />) })
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}
const rowTitled = title => [...host.querySelectorAll('[data-find]')].find(r => r.dataset.find === title)
const subOf = title => rowTitled(title)?.querySelector('.g-glist-body span')?.textContent
const updateRow = () => rowTitled('Update to Gains v9.9.9')
const checkRow = () => rowTitled('Check for updates')

describe('About', () => {
  it('names the page About and shows the version from BRAND with the build date, nothing hard-coded', async () => {
    await mount()
    expect(host.querySelector('h1').textContent).toBe('About')
    expect(rowTitled('Version').textContent).toContain('v' + BRAND.version)
    expect(subOf('Version')).toBe('Built ' + fmtDate('2026-10-18', false, true))
    expect(host.textContent).not.toContain('2.14.0')
  })

  it('draws no inline text links: everything that goes somewhere is a row', async () => {
    await mount()
    expect(host.querySelectorAll('a')).toHaveLength(0)
  })
})

describe('About, Install', () => {
  it('web, not installed: says the steps for this browser', async () => {
    await mount()
    expect(subOf('Install')).toBe('In Safari: Share → Add to Home Screen')
    act(() => root.unmount())
    root = createRoot(host)
    mocks.androidWeb = true
    await mount()
    expect(subOf('Install')).toBe('In Chrome: ⋮ menu → Add to Home screen')
  })

  it('web, already installed: says so', async () => {
    mocks.standalone = true
    await mount()
    expect(subOf('Install')).toBe('Already installed on this device')
  })

  it('the phone build has no Install row', async () => {
    mocks.MOBILE = true
    await mount()
    expect(rowTitled('Install')).toBeUndefined()
  })
})

describe('About, Credits', () => {
  it('Licences opens the Licences page; the others open their source outside the app', async () => {
    await mount()
    act(() => { rowTitled('Licences').click() })
    expect(mocks.navs.at(-1)).toEqual(['/me/licences'])
    act(() => { rowTitled('Exercise pictures').click() })
    act(() => { rowTitled('Food data').click() })
    act(() => { rowTitled('Muscle map').click() })
    expect(mocks.opened).toEqual([LINKS.media.url, LINKS.openFoodFacts.url, LINKS.muscleMap.url])
  })
})

describe('About, in-app update check', () => {
  it('web build: never asks for releases and offers no APK (Gains ships none)', async () => {
    await mount()
    expect(mocks.checkForUpdate).not.toHaveBeenCalled()
    expect(updateRow()).toBeUndefined()
    expect(checkRow()).toBeUndefined()
  })

  it('mobile build on iOS: no check, no row', async () => {
    mocks.MOBILE = true
    await mount()
    expect(mocks.checkForUpdate).not.toHaveBeenCalled()
    expect(updateRow()).toBeUndefined()
    expect(checkRow()).toBeUndefined()
  })

  it('mobile build on Android: checks once and shows the row, tapping it asks before downloading', async () => {
    mocks.MOBILE = true
    mocks.android = true
    await mount()
    expect(mocks.checkForUpdate).toHaveBeenCalledTimes(1)
    expect(updateRow()).toBeTruthy()
    act(() => { updateRow().click() })
    expect(mocks.confirmSheet).toHaveBeenCalledTimes(1)
    expect(mocks.confirmSheet.mock.calls[0][0].title).toBe('Update to 9.9.9?')
  })

  it('Android without a newer release: a "Check for updates" row stays, and tapping it checks again', async () => {
    mocks.MOBILE = true
    mocks.android = true
    mocks.checkForUpdate.mockResolvedValueOnce({ hasUpdate: false, latestVersion: 'test', apkUrl: null, hashUrl: null })
    await mount()
    expect(mocks.checkForUpdate).toHaveBeenCalledTimes(1)
    expect(updateRow()).toBeUndefined()
    expect(checkRow()).toBeTruthy()
    await act(async () => { checkRow().click(); await Promise.resolve() })
    expect(mocks.checkForUpdate).toHaveBeenCalledTimes(2)
    await act(async () => { await Promise.resolve() })
    expect(updateRow()).toBeTruthy()   // the second (default) answer had 9.9.9: the row now offers it
  })

  it('Android when GitHub is unreachable: stays quiet at first, keeps the row, and answers a tap', async () => {
    mocks.MOBILE = true
    mocks.android = true
    mocks.checkForUpdate.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'))
    await mount()
    expect(updateRow()).toBeUndefined()
    expect(checkRow()).toBeTruthy()
    expect(mocks.toast).not.toHaveBeenCalled()
    await act(async () => { checkRow().click(); await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(mocks.toast).toHaveBeenCalledWith('Couldn’t check for updates. Are you online?')
  })
})
