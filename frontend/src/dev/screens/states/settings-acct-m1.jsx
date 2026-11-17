import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import AccountPage from '../../../views/settings/pages/AccountPage.jsx'
import { signOutWaiting } from '../../../views/settings/sheets/sign-out-sheets.js'
import { requestOptions } from '../mock-env.js'
import { registerScreens } from '../registry.js'

// Account and data (PR-06 acct-m1, boards St2*): the real AccountPage with a mock profile that
// lives in memory only, and its drawers opened the way a person opens them. Nothing is stored or
// sent; the passkey list, the proof and the code are what the mock server answers.
const iso = ms => new Date(Date.now() - ms).toISOString()
const MACBOOK = { id: 'k2', name: 'MacBook Air', created: '2025-09-14T10:00:00.000Z', lastUsed: iso(3 * 86400000), transports: [] }
const IPHONE = { id: 'k1', name: 'iPhone 15', created: '2025-08-02T09:00:00.000Z', lastUsed: iso(60000), transports: ['internal'] }
const list = passkeys => ({ passkeys, password: false, lastWayIn: passkeys.length < 2 })
const items = n => Array.from({ length: n }, (_, i) => ({ id: 'x' + i }))

const user = { id: 'u_8f3a2c19', name: 'Adrian', admin: true }
const mock = (passkeys = [IPHONE, MACBOOK], extra = {}) => ({
  user,
  S: { workouts: items(212), routines: items(6), bodyweight: items(64), measurements: items(41) },
  api: {
    'GET /api/account/passkeys': list(passkeys),
    'POST /api/login/options': { cid: 'c', options: requestOptions },
    'POST /api/account/device-link': { code: 'K7WQ-2MZP-4HXA', expires: Date.now() + 10 * 60000 },
    ...extra,
  },
  // The passkey prompt answers at once, as a person's confirmation would.
  credentials: {
    get: () => Promise.resolve({
      id: 'k1', rawId: new ArrayBuffer(8), type: 'public-key', getClientExtensionResults: () => ({}),
      response: { clientDataJSON: new ArrayBuffer(8), authenticatorData: new ArrayBuffer(8), signature: new ArrayBuffer(8), userHandle: null },
    }),
  },
})
const page = () => <AccountPage />
const PATH = '/me/account'

// A row is a button whose text is its title and line together: found by its title.
const row = title => [...document.querySelectorAll('.g-glist-row')].find(r => r.querySelector('b')?.textContent === title)
const tap = async (t0, title) => { await t0.wait(250); row(title).click(); await t0.wait(350) }

registerScreens('Settings', [
  { id: 'A2.0', title: 'Account and data', note: 'Passkeys, devices, your data, start again.', render: page, path: PATH, mock: mock() },
  { id: 'A2.1', title: 'Passkey', note: 'Name, created, last used; Rename, Remove passkey.', render: page, path: PATH, mock: mock(),
    play: async t0 => { await tap(t0, 'iPhone 15') } },
  { id: 'A2.2', title: 'Remove passkey', note: 'R5 sub-panel: the proof is the confirmation.', render: page, path: PATH, mock: mock(),
    play: async t0 => { await tap(t0, 'iPhone 15'); await t0.click('Remove passkey') } },
  { id: 'A2.3', title: 'Your only passkey', note: 'Refused; nothing is sent.', render: page, path: PATH, mock: mock([IPHONE]),
    play: async t0 => { await tap(t0, 'iPhone 15'); await t0.click('Remove passkey') } },
  { id: 'A2.4', title: 'Add another device', note: 'After the proof: QR, code, once, 10 minutes.', render: page, path: PATH, mock: mock(),
    play: async t0 => { await tap(t0, 'Add another device'); await t0.click('Confirm with a passkey'); await t0.wait(400) } },
  { id: 'A2.5', title: 'Sign out everywhere?', note: 'R5 confirm.', render: page, path: PATH, mock: mock(),
    play: async t0 => { await tap(t0, 'Sign out everywhere') } },
  { id: 'A2.6', title: 'Changes not synced', note: 'Sign out with changes waiting; Sign out anyway keeps them on this device.', render: page, path: PATH, mock: mock(),
    play: async t0 => { await t0.wait(250); signOutWaiting({ kind: 'signout', count: 3, done: () => {} }); await t0.wait(350) } },
  { id: 'A2.7', title: 'Download my data', note: 'What the file holds, counted from the profile; Prepare download.', render: page, path: PATH, mock: mock(),
    play: async t0 => { await tap(t0, 'Download my data') } },
  { id: 'A2.8', title: 'Download ready', note: 'The toast with Save, held.', render: page, path: PATH, mock: mock(),
    play: async t0 => {
      await t0.wait(250)
      useUI.getState().toast(t('Your data is ready'), { action: t('Save'), body: 'gains-adrian.zip', onAction: () => {}, ms: 600000 })
      await t0.wait(350)
    } },
])
