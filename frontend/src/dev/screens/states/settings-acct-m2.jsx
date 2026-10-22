import { useStore } from '../../../store/useStore.js'
import { deletionDay, graceEnd } from '../../../lib/account-deletion.js'
import { ServerSyncSection } from '../../../components/ServerSync.jsx'
import AccountPage from '../../../views/settings/pages/AccountPage.jsx'
import DeleteAccountPage from '../../../views/settings/pages/DeleteAccountPage.jsx'
import StartedOverScreen from '../../../views/settings/pages/StartedOverScreen.jsx'
import { confirmDeletion, openNotConfirmed } from '../../../views/settings/sheets/delete-account-sheets.jsx'
import { confirmStartOver } from '../../../views/settings/sheets/start-over.jsx'
import SettingsPage from '../../../views/settings/SettingsPage.jsx'
import { requestOptions } from '../mock-env.js'
import { registerScreens } from '../registry.js'

// Start over and Delete account (PR-06 acct-m2, boards St2StartOver, St2Fresh, St3*): the real
// pages with a mock profile in memory. The drawers open with confirm buttons that do nothing here:
// the real ones would reset this browser's store or ask the server to delete. A3.3 (the root's
// banner) and A3.4 (the cancelled toast) are shell-m2's states.
const items = n => Array.from({ length: n }, (_, i) => ({ id: 'x' + i }))
const S = { workouts: items(212), routines: items(6), week: { 1: 'r1' }, bodyweight: items(64), measurements: items(41) }
const user = { id: 'u_8f3a2c19', name: 'Adrian', admin: true }
const passkeys = [{ id: 'k1', name: 'iPhone 15', created: '2025-08-02T09:00:00.000Z', lastUsed: null, transports: [] },
  { id: 'k2', name: 'MacBook Air', created: '2025-09-14T10:00:00.000Z', lastUsed: null, transports: [] }]
const api = {
  'GET /api/account/passkeys': { passkeys, password: false, lastWayIn: false },
  'POST /api/account/delete/options': { cid: 'c', options: requestOptions, password: false },
}
const mock = (extra = {}) => ({ user, S, api, ...extra })
const NOOP = () => {}
const at = graceEnd()
const scheduled = { ...user, deletion: { at, requestedAt: new Date().toISOString() } }

function SyncPaused() {
  return <SettingsPage title="Sync and backup" parent="/me/account"><ServerSyncSection /></SettingsPage>
}

registerScreens('Settings', [
  { id: 'A2.9', title: 'Start over?', note: 'R5, no Undo: what is wiped, counted; what stays.', render: () => <AccountPage />, path: '/me/account', mock: mock(),
    play: async t0 => {
      await t0.wait(250)
      confirmStartOver({ S, signedIn: true, server: true, nutrition: true, onConfirm: NOOP })
      await t0.wait(350)
    } },
  { id: 'A2.10', title: 'Started over', note: 'A clean slate; Go to Today.', render: () => <StartedOverScreen />, path: '/me/account/started-over',
    mock: mock({ S: { workouts: [], routines: [], bodyweight: [], measurements: [], resetAt: Date.now() - 60000 } }) },
  { id: 'A3.0', title: 'Delete account', note: 'What goes, counted; 7 days to change your mind; download first.', render: () => <DeleteAccountPage />, path: '/me/account/delete', mock: mock() },
  { id: 'A3.1', title: 'Delete your account?', note: 'R5 with the passkey.', render: () => <DeleteAccountPage />, path: '/me/account/delete', mock: mock(),
    play: async t0 => {
      await t0.wait(250)
      confirmDeletion({ day: deletionDay(at), onConfirm: NOOP })
      await t0.wait(350)
    } },
  { id: 'A3.2', title: 'Not confirmed', note: 'Passkey cancelled or refused; nothing deleted.', render: () => <DeleteAccountPage />, path: '/me/account/delete', mock: mock(),
    play: async t0 => {
      await t0.wait(250)
      openNotConfirmed({ reason: 'cancelled', onRetry: NOOP })
      await t0.wait(350)
    } },
  { id: 'A1.28.paused', title: 'Sync paused', note: 'Deletion scheduled: the status says so; nothing retries. (The Sync page is data-m1’s; this is the status block it will hold.)',
    render: () => <SyncPaused />, path: '/me/backup', mock: mock({ user: scheduled }),
    play: async t0 => {
      useStore.setState({ sync: { offline: false, pending: true, auth: false, lastError: null, lastSynced: Date.now() - 3600000, server: location.origin, held: false, paused: at, status: 'paused' } })
      await t0.wait(100)
    } },
])
