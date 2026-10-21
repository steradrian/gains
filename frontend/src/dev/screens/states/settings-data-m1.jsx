import { useEffect } from 'react'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import ImportDoneScreen from '../../../views/settings/pages/ImportDoneScreen.jsx'
import ImportPage from '../../../views/settings/pages/ImportPage.jsx'
import ImportProgressScreen from '../../../views/settings/pages/ImportProgressScreen.jsx'
import SyncPage from '../../../views/settings/pages/SyncPage.jsx'
import { openHevyKeySheet } from '../../../views/settings/pages/hevy-key-sheet.jsx'
import { registerScreens } from '../registry.js'

// Settings data m1 (PR-06, boards St1Sync, St1SyncWaiting, St1Backup, St1Import, St1ImportHevy,
// St1Importing, St1Imported). Sync and Import are the real pages over a mocked signed-in user; the
// sync status the page reads is laid over the store while the state shows and put back after. The
// progress and done screens are the real components given an import's numbers. Nothing is stored.
const NOOP = () => {}
const USER = { id: 'u1', name: 'Alex' }
const HUB = { 'GET /api/sync/status': { state: 'ok', last_synced_at: Date.now() - 120000 } }
const SERVER = 'https://fit.example.com'

function WithSync({ sync, owed = { owed: false, count: 0 }, children }) {
  useEffect(() => {
    const was = { sync: useStore.getState().sync, unsyncedChanges: useStore.getState().unsyncedChanges }
    useStore.setState({ sync, unsyncedChanges: () => owed })
    return () => useStore.setState(was)
  }, [sync, owed])
  return children
}

const synced = { status: 'ok', server: SERVER, lastSynced: Date.now() - 120000 }
const offline = { status: 'offline', offline: true, pending: true, server: SERVER, lastSynced: Date.now() - 3600000, lastError: { status: 0, code: 'network' } }
const MOCK = { user: USER, config: {}, api: HUB }

const done = {
  kind: 'workouts', source: 'Strong', from: '2023-09-04', to: '2025-06-20', imported: 212, sets: 1204, matched: 38,
  newNames: ['landmine press', 'belt squat', 'cable y raise'], leftAlone: 4,
}

registerScreens('Settings', [
  { id: 'A1.28', title: 'Sync and backup', note: 'All synced, Sync now, the server, Nutrition, then Backup and Import backup.',
    render: () => <WithSync sync={synced}><SyncPage /></WithSync>, mock: MOCK },
  { id: 'A1.29', title: 'Changes waiting (offline)', note: 'The count and the reassurance; the store knows how many changes, not their names, so none are listed.',
    render: () => <WithSync sync={offline} owed={{ owed: true, count: 3 }}><SyncPage /></WithSync>, mock: { ...MOCK, online: false } },
  { id: 'A1.30', title: 'Backup exported', note: 'The toast names the file and its size, with Share (held open here).',
    render: () => <WithSync sync={synced}><SyncPage /></WithSync>, mock: MOCK,
    play: async t => {
      useUI.getState().toast('Backup exported', { body: 'gains-backup-2026-10-18.json · 2.4 MB', action: 'Share', onAction: NOOP })
      await t.wait(200)
      useUI.getState().pauseToast()
    } },
  { id: 'A1.31', title: 'Import', note: 'Sources by file, then Hevy directly. Existing days are always left alone.',
    render: () => <ImportPage />, mock: { S: {} } },
  { id: 'A1.32', title: 'Import from Hevy', note: 'The key drawer: read once, forgotten.',
    render: () => <ImportPage />, mock: { S: {} }, play: async t => { openHevyKeySheet(NOOP); await t.wait(300) } },
  { id: 'A1.33', title: 'Importing', note: 'Hevy’s fetch, page by page. It asks to keep the page open: leaving drops the result.',
    render: () => <ImportProgressScreen source="Hevy" label="Fetching workouts… (3/5)" fraction={0.52} onCancel={NOOP} /> },
  { id: 'A1.34', title: 'Import done', note: 'Numbers from the import itself: sets only of the days added.',
    render: () => <ImportDoneScreen outcome={done} onOpen={NOOP} /> },
])
