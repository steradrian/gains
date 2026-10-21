// @vitest-environment happy-dom
// The backup-folder rows (#161) sit under Auto-backup, on Android only, and only while it is on.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, MOBILE: true, android: true, folder: {}, asked: [] }
  state.snapshot = () => ({
    S: state.S,
    user: null,
    sync: { status: 'local' },
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
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))
vi.mock('../../../lib/mobile.js', () => ({ get MOBILE() { return mocks.MOBILE }, isAndroid: () => Promise.resolve(mocks.android), shareExport: vi.fn() }))
vi.mock('../use-settings-ctx.js', () => ({ useSettingsCtx: () => ({ android: mocks.android, hasMedia: false }) }))
vi.mock('../use-data-actions.js', () => ({ useDataActions: () => ({ buildJson: vi.fn(), buildZip: vi.fn(), saveFile: vi.fn(), doImport: vi.fn() }) }))
vi.mock('../../MobileOnboarding.jsx', () => ({ ConnectSheet: () => null, CfAccessSheet: () => null }))
vi.mock('./backup-folder.jsx', async () => {
  const real = await vi.importActual('./backup-folder.jsx')
  return {
    default: () => <div className="backup-folder-row" />,
    useBackupFolder: enabled => { mocks.asked.push(enabled); return [enabled ? mocks.folder : null, () => {}] },
    autoBackupSubtitle: real.autoBackupSubtitle,
  }
})

const { default: SyncPage } = await import('./SyncPage.jsx')

let host, root
beforeEach(() => {
  mocks.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: false, effort: 'none',
    gifSize: 'full', workouts: [], routines: [], exWeights: {},
  }
  mocks.MOBILE = true
  mocks.android = true
  mocks.folder = {}
  mocks.asked = []
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = async () => { await act(async () => { root.render(<SyncPage />) }) }
const shown = () => !!host.querySelector('.backup-folder-row')

describe('the backup folder rows', () => {
  it('show on Android with auto-backup on', async () => {
    mocks.S.autoBackup = true
    await mount()
    expect(shown()).toBe(true)
  })
  it('not with auto-backup off', async () => {
    mocks.S.autoBackup = false
    await mount()
    expect(shown()).toBe(false)
  })
  it('not on iOS', async () => {
    mocks.S.autoBackup = true
    mocks.android = false
    await mount()
    expect(shown()).toBe(false)
  })
})

// Android QA: the Auto-backup row still said Documents/Gains after another folder was chosen.
describe('the Auto-backup row', () => {
  const subtitle = () => [...host.querySelectorAll('.g-glist-row')].find(r => r.querySelector('b')?.textContent === 'Auto-backup on changes')?.querySelector('.g-glist-body span')?.textContent
  it('names the chosen folder', async () => {
    mocks.S.autoBackup = true
    mocks.folder = { uri: 'content://tree/Sync', label: 'SyncFolder' }
    await mount()
    expect(subtitle()).toContain('“SyncFolder”')
    expect(subtitle()).not.toContain('Documents/Gains')
  })
  it('names Documents/Gains with no folder chosen', async () => {
    mocks.S.autoBackup = true
    await mount()
    expect(subtitle()).toContain('Documents/Gains')
  })
  it('flips the setting', async () => {
    mocks.S.autoBackup = false
    await mount()
    const sw = [...host.querySelectorAll('.g-glist-row')].find(r => r.querySelector('b')?.textContent === 'Auto-backup on changes').querySelector('[role="switch"], input')
    await act(async () => { sw.click() })
    expect(mocks.S.autoBackup).toBe(true)
  })
})
