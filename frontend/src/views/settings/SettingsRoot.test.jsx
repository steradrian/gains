// @vitest-environment happy-dom
// The Settings root wired to the store: the account card, the deletion banner and its stub-backed
// Cancel, the search (every hit opens its page with the row to flash; the query survives Back), a
// row's address, Sign out, and the offline pill.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = { S: null, user: null, sync: null, unsynced: { owed: false, count: 0 }, navs: [], toast: vi.fn(), cancel: vi.fn(), signOutHere: vi.fn(), disconnect: vi.fn(), MOBILE: false }
  state.snapshot = () => ({
    S: state.S, user: state.user, sync: state.sync, coachLocal: null, config: null, unsyncedChanges: () => state.unsynced,
    update: vi.fn(), setUser: vi.fn(),
  })
  return state
})
vi.mock('../../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})
vi.mock('../../store/useUI.js', () => {
  const snap = () => ({ toast: mocks.toast, openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => (...a) => mocks.navs.push(a) }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({ passkeys: [{}, {}] })), webauthnOK: () => false, IS_ANDROID: false, remoteServer: () => '' }))
vi.mock('../../lib/push.js', () => ({ pushSupported: () => false }))
vi.mock('../../lib/wakelock.js', () => ({ wakeLockSupported: () => true }))
vi.mock('../../lib/mobile.js', () => ({ get MOBILE() { return mocks.MOBILE }, isAndroid: () => Promise.resolve(false) }))
vi.mock('../../lib/account-deletion.js', () => ({ cancelDeletion: (...a) => mocks.cancel(...a) }))
vi.mock('../Measurements.jsx', () => ({ manageMeasurementsSheet: vi.fn() }))
vi.mock('./use-account-actions.js', () => ({ useAccountActions: () => ({ signOutHere: mocks.signOutHere, disconnect: mocks.disconnect }) }))

import SettingsRoot from './SettingsRoot.jsx'
import { stubHubOffline } from '../../lib/nutrition/hub-offline.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
beforeEach(() => {
  stubHubOffline()
  mocks.S = { unit: 'kg', lang: 'en', workouts: [], routines: [], effort: 'rir', reminder: { on: false }, equipProfiles: [] }
  mocks.user = { id: 'u1', name: 'Adrian', admin: true }
  mocks.sync = { status: 'ok', lastSynced: Date.now() - 120000 }
  mocks.unsynced = { owed: false, count: 0 }
  mocks.navs = []
  mocks.MOBILE = false
  for (const f of [mocks.toast, mocks.cancel, mocks.signOutHere, mocks.disconnect]) f.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  window.history.replaceState(null, '')
})

const mount = async (props = {}) => { await act(async () => { root.render(<SettingsRoot {...props} />) }) }
const rowEl = title => [...host.querySelectorAll('.g-glist-row, .g-danger-row')].find(r => r.querySelector('b').textContent === title)
const type = v => act(() => {
  const input = host.querySelector('input[type="search"]')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, v)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
const openSearch = () => act(() => { host.querySelector('.sroot-search input').dispatchEvent(new FocusEvent('focusin', { bubbles: true })) })

describe('the Settings root', () => {
  it('names the account, the passkeys and the sync, and Admin shows for an admin only', async () => {
    await mount()
    expect(rowEl('Adrian').textContent).toContain('Admin · 2 passkeys')
    expect(host.querySelector('.sroot-pill').textContent).toMatch(/^All synced · /)
    expect(rowEl('Admin')).toBeTruthy()
    mocks.user = { id: 'u1', name: 'Adrian' }
    await mount()
    expect(rowEl('Admin')).toBeUndefined()
  })

  it('a row opens its page; the card opens Account; the pill opens Sync and backup; Progress opens Progress', async () => {
    await mount()
    act(() => rowEl('Appearance').click())
    act(() => rowEl('Adrian').click())
    act(() => host.querySelector('.sroot-pill').click())
    act(() => rowEl('Progress').click())
    expect(mocks.navs).toEqual([['/me/appearance'], ['/me/account'], ['/me/backup'], ['/progress']])
  })

  it('offline with changes held: the pill counts them', async () => {
    mocks.sync = { status: 'offline', pending: true }
    mocks.unsynced = { owed: true, count: 3 }
    await mount()
    expect(host.querySelector('.sroot-pill').textContent).toBe('3 changes waiting')
  })

  it('Sign out runs the sign-out; a paired phone gets Disconnect instead', async () => {
    await mount()
    act(() => rowEl('Sign out').click())
    expect(mocks.signOutHere).toHaveBeenCalledTimes(1)
    mocks.MOBILE = true
    await mount()
    expect(rowEl('Sign out')).toBeUndefined()
    act(() => rowEl('Disconnect').click())
    expect(mocks.disconnect).toHaveBeenCalledTimes(1)
  })

  it('a guest has no pill and no Sign out', async () => {
    mocks.user = null
    mocks.sync = null
    await mount()
    expect(host.querySelector('.sroot-pill')).toBeNull()
    expect(rowEl('Sign out')).toBeUndefined()
    expect(rowEl('Guest')).toBeTruthy()
  })

  it('a scheduled deletion: the banner, the paused pill, and Cancel deletion toasts what happened', async () => {
    mocks.user = { id: 'u1', name: 'Adrian', deletion: { at: '2026-10-25T10:00:00Z', requestedAt: '2026-10-18T10:00:00Z' } }
    mocks.cancel.mockResolvedValueOnce(true)
    await mount()
    expect(host.querySelector('.sroot-banner').textContent).toContain('Your account is scheduled for deletion')
    expect(host.querySelector('.sroot-pill').textContent).toBe('Sync paused · deletion scheduled')
    await act(async () => { [...host.querySelectorAll('.sroot-banner button')].find(b => b.textContent === 'Cancel deletion').click() })
    expect(mocks.cancel).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith('Deletion cancelled. Your account stays.', expect.objectContaining({ action: 'OK' }))
    mocks.cancel.mockResolvedValueOnce(false)
    await act(async () => { [...host.querySelectorAll('.sroot-banner button')].find(b => b.textContent === 'Cancel deletion').click() })
    expect(mocks.toast).toHaveBeenLastCalledWith('Could not cancel the deletion. Try again.', undefined)
  })

  it('search: a hit shows its page and what is on it, and opens the page with the row to flash', async () => {
    await mount()
    openSearch()
    type('theme')
    const hit = rowEl('Theme')
    expect(hit.textContent).toContain('Appearance · Dark, Light, System')
    act(() => hit.click())
    expect(mocks.navs.at(-1)).toEqual(['/me/appearance', { state: { find: 'Theme' } }])
  })

  it('search: a page is a hit too; a row of the root itself comes back to the root with the row to flash', async () => {
    await mount()
    openSearch()
    type('sign out')
    act(() => rowEl('Sign out').click())
    expect(mocks.navs.at(-1)).toEqual(['/me/settings', { state: { find: 'Sign out' } }])
  })

  it('search: close empties it and returns the page', async () => {
    await mount()
    openSearch()
    type('theme')
    act(() => host.querySelector('button[aria-label="Close search"]').click())
    expect(host.querySelector('.g-sptitle')).not.toBeNull()
  })

  it('the query comes back with Back to the same entry and is gone when Settings opens afresh', async () => {
    window.history.replaceState({ key: 'root1', idx: 1 }, '')
    await mount()
    openSearch()
    type('vib')
    act(() => root.render(null))
    await mount()
    expect(host.querySelector('input[type="search"]').value).toBe('vib')
    act(() => root.render(null))
    window.history.replaceState({ key: 'root2', idx: 3 }, '')
    await mount()
    expect(host.querySelector('.g-sptitle')).not.toBeNull()
  })

  it('a hit for a row on the root is flashed', async () => {
    await mount({ find: 'Sign out' })
    expect(rowEl('Sign out').classList.contains('sp-flash')).toBe(true)
  })
})
