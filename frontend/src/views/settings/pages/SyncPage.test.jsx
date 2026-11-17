// @vitest-environment happy-dom
// Sync and backup (boards St1Sync, St1SyncWaiting, St1Backup): Gains' own sync and the hub's
// Gains ↔ NutriTrace sync, the two the avatar's dot watches, and one Sync now for both (against the
// fake hub); the changes waiting; and the export toast with its file name, size and Share.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { resetSyncThrottle, useHubSync } from '../../../lib/nutrition/sync.js'
import { createFakeNutriTrace, fixtureSyncStatus } from '../../../lib/nutrition/fake-nutritrace.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const m = vi.hoisted(() => ({
  files: { json: { name: 'gains-backup-2026-10-18.json', json: '' }, zip: null },
  saved: [], saveResult: true,
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))
vi.mock('../use-settings-ctx.js', () => ({ useSettingsCtx: () => ({ android: false, hasMedia: false }) }))
vi.mock('../use-data-actions.js', () => ({
  useDataActions: () => ({
    buildJson: () => m.files.json, buildZip: async () => m.files.zip,
    saveFile: async file => { m.saved.push(file); return m.saveResult },
    doImport: vi.fn(),
  }),
}))

const { default: SyncPage } = await import('./SyncPage.jsx')

let host, root, nt
const toast = vi.fn()
const syncNow = vi.fn(async () => useStore.getState().sync)
const row = title => [...host.querySelectorAll('.g-glist-row')].find(r => r.querySelector('b')?.textContent === title)
const settle = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0)) })

function setUp({ syncStatus = fixtureSyncStatus(), user = { id: 3, name: 'Ana' }, sync = { status: 'ok', lastSynced: Date.now() - 60000, server: 'https://fit.example.com' }, owed = { owed: false, count: 0 } } = {}) {
  nt = createFakeNutriTrace({ syncStatus })
  vi.stubGlobal('fetch', nt.fetch)
  useStore.setState({ user, sync, syncNow, pushState: vi.fn(async () => {}), unsyncedChanges: () => owed })
  useUI.setState({ toast })
}

beforeEach(() => {
  useHubSync.getState().reset()
  resetSyncThrottle()
  toast.mockClear()
  syncNow.mockClear()
  m.saved = []; m.saveResult = true
  m.files.json = { name: 'gains-backup-2026-10-18.json', json: 'x'.repeat(Math.round(2.4 * 1024 * 1024)) }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

describe('Sync and backup: the status', () => {
  it('shows both syncs, each with its state and when it last ran, and the server it talks to', async () => {
    setUp()
    act(() => root.render(<SyncPage />))
    await settle()
    expect(row('All synced').textContent).toContain('Last synced 1 minute ago with fit.example.com')
    expect(row('fit.example.com').textContent).toContain('Signed in as Ana')
    expect(row('fit.example.com').textContent).toContain('Connected')
    expect(row('Nutrition').textContent).toMatch(/Last synced: .*All synced/)
    expect(nt.requests.some(r => r.path === '/hub/api/sync/status')).toBe(true)
  })

  it('says when the hub needs the person, and Sync now runs both and says so', async () => {
    setUp({ syncStatus: fixtureSyncStatus('error') })
    act(() => root.render(<SyncPage />))
    await settle()
    expect(row('Nutrition').textContent).toContain('Nutrition sync needs attention')
    await act(async () => { row('Sync now').click() })
    await settle()
    expect(syncNow).toHaveBeenCalledTimes(1)
    expect(nt.requests.some(r => r.method === 'POST' && r.path === '/hub/api/sync/now')).toBe(true)
    expect(toast).toHaveBeenCalledWith('Nutrition sync needs attention')
    // Gains was synced by the first half: the hub run does not push it a second time
    expect(useStore.getState().pushState).not.toHaveBeenCalled()
  })

  it('a hub that does not answer is not "All synced": the toast says nutrition did not sync', async () => {
    setUp()
    act(() => root.render(<SyncPage />))
    await settle()
    nt.failNext('POST', '/hub/api/sync/now', 'offline')
    await act(async () => { row('Sync now').click() })
    await settle()
    expect(toast).toHaveBeenCalledWith('Training synced, but nutrition did not: the sync service did not answer.')
    expect(toast).not.toHaveBeenCalledWith('All synced')
  })

  it('a training sync that fails says so, without asking the hub', async () => {
    setUp({ sync: { status: 'error', lastError: { status: 502, code: 'http' }, server: 'https://fit.example.com' } })
    act(() => root.render(<SyncPage />))
    await settle()
    await act(async () => { row('Sync now').click() })
    await settle()
    expect(toast).toHaveBeenCalledWith('Server error (HTTP 502)')
    expect(nt.requests.some(r => r.path === '/hub/api/sync/now')).toBe(false)
  })

  it('a person the hub has not stored yet reads "Not synced yet"', async () => {
    setUp({ syncStatus: null })
    act(() => root.render(<SyncPage />))
    await settle()
    expect(row('Nutrition').textContent).toContain('Not synced yet')
  })

  it('offline with changes owed: the count and the reassurance, no list the store cannot give', async () => {
    setUp({ sync: { status: 'offline', pending: true, lastError: { status: 0, code: 'network' }, server: 'https://fit.example.com' }, owed: { owed: true, count: 3 } })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    act(() => root.render(<SyncPage />))
    await settle()
    const hero = row('3 changes waiting')
    expect(hero.textContent).toContain('Offline. Your changes are saved on this device and sync when you’re back online.')
    expect(host.textContent).not.toContain('Weigh-in')
    expect(row('fit.example.com').textContent).toContain('Offline')
    vi.restoreAllMocks()
  })

  it('a count the store does not know still says some changes are waiting', async () => {
    setUp({ sync: { status: 'offline', pending: true, lastError: { status: 0, code: 'network' }, server: 'https://fit.example.com' }, owed: { owed: true, count: null } })
    act(() => root.render(<SyncPage />))
    await settle()
    expect(host.textContent).toContain('Some changes on this device have not reached your server.')
    expect(host.textContent).not.toContain('changes waiting')
  })

  it('is a guest’s page too: nothing to sync, the backup rows stay', async () => {
    setUp({ user: null, sync: { status: 'local' } })
    act(() => root.render(<SyncPage />))
    await settle()
    expect(row('Sync now')).toBeUndefined()
    expect(row('Server')).toBeUndefined()
    expect(row('Export backup')).toBeTruthy()
    expect(row('Import backup').textContent).toContain('From a Gains .json or .zip')
  })
})

describe('Sync and backup: export', () => {
  it('names the file and its size in the toast and offers Share where the browser can', async () => {
    setUp()
    const share = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    act(() => root.render(<SyncPage />))
    await settle()
    await act(async () => { row('Export backup').click() })
    expect(m.saved).toHaveLength(1)
    const [msg, opts] = toast.mock.calls.at(-1)
    expect(msg).toBe('Backup exported')
    expect(opts.body).toBe('gains-backup-2026-10-18.json · 2.4 MB')
    expect(opts.action).toBe('Share')
    await act(async () => { await opts.onAction() })
    expect(share).toHaveBeenCalledTimes(1)
    expect(share.mock.calls[0][0].files[0].name).toBe('gains-backup-2026-10-18.json')
  })

  it('offers no Share where the browser cannot share files', async () => {
    setUp()
    vi.stubGlobal('navigator', { ...navigator, canShare: undefined })
    act(() => root.render(<SyncPage />))
    await settle()
    await act(async () => { row('Export backup').click() })
    const [, opts] = toast.mock.calls.at(-1)
    expect(opts.action).toBeUndefined()
  })

  it('says nothing when the share sheet was dismissed', async () => {
    setUp()
    m.saveResult = false
    act(() => root.render(<SyncPage />))
    await settle()
    await act(async () => { row('Export backup').click() })
    expect(toast).not.toHaveBeenCalledWith('Backup exported', expect.anything())
  })
})
