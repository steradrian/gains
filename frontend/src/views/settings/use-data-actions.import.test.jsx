// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDataActions } from './use-data-actions.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* Importing a zip backup: the media goes into the local store first. A file the store refuses or
   cannot keep is counted and named in the toast; a store that cannot be reached at all stops the
   import with a message instead of closing the confirm and saying nothing. */
const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  importBackup: vi.fn(),
  confirm: null,
  read: { state: { workouts: [] }, files: [{ hash: 'a'.repeat(64), entry: {} }], zip: true },
  store: vi.fn(),
  syncMedia: vi.fn(),
}))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ importBackup: mocks.importBackup, importConflict: async () => null, config: null, S: {} })
  const useStore = selector => selector(snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../store/useUI.js', () => ({ useUI: selector => selector({ toast: mocks.toast }) }))
vi.mock('../../sheets.jsx', () => ({ confirmSheet: opts => { mocks.confirm = opts }, menuSheet: vi.fn() }))
vi.mock('../../lib/media-sync.js', () => ({ syncMedia: (...a) => mocks.syncMedia(...a), fetchToStore: vi.fn() }))
vi.mock('../../lib/backup-media.js', () => ({
  readBackupFile: async () => mocks.read,
  storeBackupMedia: (...a) => mocks.store(...a),
  backupImportError: () => 'Couldn’t read that file.',
}))

let host, root, actions
function Harness() { actions = useDataActions(); return null }
const pick = async () => {
  await act(async () => { await actions.doImport({ target: { files: [new File(['x'], 'b.zip')], value: 'b.zip' } }) })
  await act(async () => { await mocks.confirm.onConfirm() })
}

beforeEach(() => {
  for (const f of [mocks.toast, mocks.importBackup, mocks.store, mocks.syncMedia]) f.mockReset()
  mocks.confirm = null
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<Harness />))
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('backup import with media', () => {
  it('everything stored: imports and says so', async () => {
    mocks.store.mockResolvedValue({ stored: 1, skipped: 0 })
    await pick()
    expect(mocks.importBackup).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith('Backup imported')
  })

  it('files that could not be stored are counted in the toast; the import still goes ahead', async () => {
    mocks.store.mockResolvedValue({ stored: 1, skipped: 2 })
    await pick()
    expect(mocks.importBackup).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith('Backup imported. 2 photos or videos could not be stored.')
  })

  it('one file says photo or video', async () => {
    mocks.store.mockResolvedValue({ stored: 0, skipped: 1 })
    await pick()
    expect(mocks.toast).toHaveBeenCalledWith('Backup imported. 1 photo or video could not be stored.')
  })

  it('a store that throws: nothing is imported, and the toast says why', async () => {
    mocks.store.mockRejectedValue(new Error('QuotaExceededError'))
    await pick()
    expect(mocks.importBackup).not.toHaveBeenCalled()
    expect(mocks.syncMedia).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith('Nothing was imported: couldn’t store the backup’s photos and videos.')
  })
})
