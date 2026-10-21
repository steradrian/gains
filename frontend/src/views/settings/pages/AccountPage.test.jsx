// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHubOffline } from '../../../lib/nutrition/hub-offline.test-util.js'
import AccountPage from './AccountPage.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* Account and data (A2.0): the signed-in browser's board, and the branches that keep their rows
   with nothing new drawn: the demo, a phone kept local, a paired phone, a guest. Row-level
   behaviour of the passkeys, the password and the account id is in views/Settings.passkeys.test,
   Settings.password.test and Settings.account-id.test; the drawers are in ../sheets/. */
const mocks = vi.hoisted(() => {
  const state = { S: null, user: null, sync: null, config: null, MOBILE: false, DEMO: false, webauthn: true, sheets: [], navs: [], resetEverything: vi.fn(), media: [] }
  state.toast = vi.fn()
  state.confirmSheet = vi.fn()
  state.resetDemo = vi.fn()
  state.list = { passkeys: [{ id: 'k1', name: 'iPhone 15', created: null, lastUsed: null, transports: [] }], password: false, lastWayIn: true }
  state.api = vi.fn(async path => (path === '/api/account/passkeys' ? state.list : {}))
  state.snapshot = () => ({
    S: state.S, user: state.user, sync: state.sync, config: state.config, coachLocal: null,
    update: vi.fn(), setUser: vi.fn(), pullState: vi.fn(), pushState: vi.fn(), resetDemo: state.resetDemo,
    syncNow: vi.fn(), unsyncedChanges: () => ({ owed: false, count: 0 }), keptChanges: async () => [],
    disconnectServer: vi.fn(), signOut: vi.fn(), signOutAll: vi.fn(), adoptProfile: vi.fn(), resetEverything: state.resetEverything,
  })
  return state
})
vi.mock('../../../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})
vi.mock('../../../store/useUI.js', () => {
  const snap = () => ({ toast: (...a) => mocks.toast(...a), openSheet: (render, opts) => { mocks.sheets.push({ render, opts }); return {} } })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => to => mocks.navs.push(to) }))
vi.mock('../SettingsPage.jsx', () => ({ default: ({ title, line, children }) => <main><h1>{title}</h1>{line && <p>{line}</p>}{children}</main> }))
vi.mock('../../../lib/api.js', () => ({
  api: (...a) => mocks.api(...a), webauthnOK: () => mocks.webauthn, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), IS_ANDROID: false,
  passkeyAssertion: vi.fn(), passwordLogin: vi.fn(), passwordRegister: vi.fn(), passwordResetRedeem: vi.fn(), createPasskey: vi.fn(),
}))
vi.mock('../../../lib/demo.js', () => ({ get DEMO() { return mocks.DEMO }, REPO: 'https://example.com/gains' }))
vi.mock('../../../lib/mobile.js', () => ({
  get MOBILE() { return mocks.MOBILE }, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), shareExportBlob: vi.fn(), syncReminder: vi.fn(),
}))
vi.mock('../../../lib/media-refs.js', () => ({ referencedFiles: () => mocks.media }))
vi.mock('../../../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn() }))
vi.mock('../../../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../../MobileOnboarding.jsx', () => ({ ConnectSheet: () => null }))
vi.mock('../../../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), confirmSheet: (...a) => mocks.confirmSheet(...a), importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(), menuSheet: vi.fn(), askAddDeviceData: vi.fn(),
}))
vi.mock('../use-account-actions.js', () => ({
  useAccountActions: () => ({ signOutEverywhere: mocks.signOutEverywhere, resetEverything: mocks.resetEverything, disconnect: vi.fn(), signOutHere: vi.fn() }),
}))

globalThis.__APP_VERSION__ ??= 'test'

const mounted = []
function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  act(() => root.render(el))
  return host
}
const settle = () => act(() => new Promise(r => setTimeout(r, 0)))
const titles = el => [...el.querySelectorAll('.g-glist-row b, .g-danger-b b')].map(t => t.textContent)
const headings = el => [...el.querySelectorAll('.g-ssec h2')].map(h => h.textContent)
const row = (el, title) => [...el.querySelectorAll('.g-glist-row, .g-danger-row')].find(r => r.querySelector('b')?.textContent === title)

beforeEach(() => {
  stubHubOffline()
  mocks.S = { unit: 'kg', workouts: [], routines: [], exWeights: {} }
  mocks.user = { id: 'u_8f3a2c19', name: 'Adrian', admin: true }
  mocks.sync = { status: 'ok', offline: false, pending: false, auth: false, lastError: null, lastSynced: Date.now(), server: null }
  mocks.config = null
  mocks.MOBILE = false
  mocks.DEMO = false
  mocks.webauthn = true
  mocks.media = []
  mocks.sheets.length = 0
  mocks.navs.length = 0
  mocks.signOutEverywhere = vi.fn()
  mocks.resetEverything = vi.fn()
  for (const f of [mocks.toast, mocks.confirmSheet, mocks.resetDemo, mocks.api]) f.mockClear()
})
afterEach(() => { act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })

describe('A2.0 the signed-in browser', () => {
  it('draws the account card, then Passkeys, Devices, Your data and Start again, in that order', async () => {
    const page = mount(<AccountPage />)
    await settle()
    expect(page.querySelector('h1').textContent).toBe('Account and data')
    expect(page.querySelector('.g-acct-who b').textContent).toBe('Adrian')
    expect(page.querySelector('.g-acct-who span').textContent).toBe('Admin')
    expect(headings(page)).toEqual(['Passkeys', 'Devices', 'Your data', 'Start again'])
    expect(titles(page)).toEqual([
      'iPhone 15', 'Add a passkey', 'Add another device', 'Pair the mobile app', 'Sign out everywhere',
      'Download my data', 'Import', 'Sync and backup', 'Account ID', 'Start over', 'Delete account',
    ])
  })

  it('a member is a member, and nothing is said about when they joined (the API has no date)', async () => {
    mocks.user = { id: 'u2', name: 'Bea' }
    const page = mount(<AccountPage />)
    await settle()
    expect(page.querySelector('.g-acct-who span').textContent).toBe('Member')
    expect(page.textContent).not.toMatch(/member since/i)
  })

  it('shows only what the passkey list returns, and no "This device" marker the API cannot back', async () => {
    mocks.list = { passkeys: [{ id: 'k1', name: 'iPhone 15', created: '2025-08-02T09:00:00.000Z', lastUsed: null, transports: [] }], password: false, lastWayIn: true }
    const page = mount(<AccountPage />)
    await settle()
    expect(row(page, 'iPhone 15').textContent).toMatch(/Added 2 Aug/)
    expect(row(page, 'iPhone 15').textContent).not.toMatch(/This device|Last used/)
  })

  it('Sign out everywhere, Download my data, Import and Sync and backup open their own', async () => {
    const page = mount(<AccountPage />)
    await settle()
    act(() => row(page, 'Sign out everywhere').click())
    expect(mocks.signOutEverywhere).toHaveBeenCalledTimes(1)
    act(() => row(page, 'Download my data').click())
    expect(mocks.sheets.at(-1).opts).toEqual({ variant: 'ds' })
    act(() => row(page, 'Import').click())
    act(() => row(page, 'Sync and backup').click())
    expect(mocks.navs).toEqual(['/me/import', '/me/backup'])
  })

  it('Download my data names the .zip only when there are photos or videos to put in it', async () => {
    const page = mount(<AccountPage />)
    await settle()
    expect(row(page, 'Download my data').textContent).toContain('Everything, as a JSON file')
    mocks.media = [{}]
    act(() => mounted.at(-1).root.render(<AccountPage />))
    await settle()
    expect(row(page, 'Download my data').textContent).toContain('Everything, as JSON and a .zip of photos')
  })

  it('Start over keeps today\'s reset until its own flow lands; Delete account goes to its page', async () => {
    const page = mount(<AccountPage />)
    await settle()
    act(() => row(page, 'Start over').click())
    expect(mocks.resetEverything).toHaveBeenCalledTimes(1)
    act(() => row(page, 'Delete account').click())
    expect(mocks.navs).toEqual(['/me/account/delete'])
  })

  it('Account ID copies, as it always did, and the pairing row opens its drawer', async () => {
    const page = mount(<AccountPage />)
    await settle()
    act(() => row(page, 'Pair the mobile app').click())
    expect(mocks.sheets.at(-1).opts).toEqual({ variant: 'ds' })
    expect(row(page, 'Account ID').querySelector('.acct-id').textContent).toBe('u_8f3a2c19')
  })
})

describe('the other builds keep their rows', () => {
  it('the demo: what it is, reset, and self-host; no passkeys, no sign-out', async () => {
    mocks.DEMO = true
    mocks.user = null
    const page = mount(<AccountPage />)
    await settle()
    expect(headings(page)).toEqual(['Demo'])
    expect(titles(page)).toEqual(['You’re in the demo', 'Reset demo data', 'Self-host Gains'])
    act(() => row(page, 'Reset demo data').click())
    expect(mocks.confirmSheet).toHaveBeenCalledTimes(1)
    expect(mocks.api).not.toHaveBeenCalledWith('/api/account/passkeys')
  })

  it('a phone kept local: all data stays on it, and Connect to my server', async () => {
    mocks.MOBILE = true
    mocks.user = null
    const page = mount(<AccountPage />)
    await settle()
    expect(headings(page)).toEqual(['Your data'])
    expect(titles(page)).toEqual(['All data stays on this phone', 'Connect to my server'])
  })

  it('a paired phone: the connection block and the account id, nothing to sign in to', async () => {
    mocks.MOBILE = true
    const page = mount(<AccountPage />)
    await settle()
    expect(titles(page)).toEqual(['Account ID'])
    expect(headings(page)).toEqual([])
    expect(row(page, 'Start over')).toBeUndefined()
    expect(mocks.api).not.toHaveBeenCalledWith('/api/account/passkeys')
  })

  it('a guest says so once, when the banner does not', async () => {
    mocks.user = null
    mocks.sync = null
    mocks.S = { ...mocks.S, connStatus: false }
    const page = mount(<AccountPage />)
    await settle()
    expect(headings(page)).toEqual(['Account'])
    expect(page.querySelector('.g-snote').textContent).toBe('Guest mode: your data lives only in this browser.')
  })
})
