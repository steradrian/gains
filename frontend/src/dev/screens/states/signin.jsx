import Login from '../../../views/Login.jsx'
import { ADD_DEVICE_PATH } from '../../../views/AddDevice.jsx'
import { creationOptions, denied, madePasskey, never, requestOptions } from '../mock-env.js'
import { registerScreens } from '../registry.js'

// Sign in (S0.0–S0.10 of the entry boards) and the configurations the boards do not draw. Every
// state is the real Login or AddDevice; `mock` is what the server and the passkey prompt answer
// and `play` is the tapping that brings it there.
const CODE = 'K7WQ2MZP4HXA'
const PASSKEY_START = { 'POST /api/login/options': { cid: 'c', options: requestOptions } }
const LINK_START = { 'POST /api/device-link/options': { cid: 'link', options: creationOptions, id: 'u1', name: 'Alex' } }
const WRONG = { 'POST /api/login/password': { status: 401, body: { error: 'wrong', code: 'bad-credentials' } } }
const DISABLED = { 'POST /api/login/password': { status: 403, body: { error: 'disabled', code: 'disabled' } } }
const withPasswords = { password_login: true }

const login = () => <Login />
const failedPasskey = async t => { await t.click('Sign in with passkey') }
const troubleDrawer = async t => { await failedPasskey(t); await t.click('Having trouble?') }
const signInDrawer = async t => { await t.click('Sign in with password') }
const wrongDetails = async t => {
  await signInDrawer(t)
  await t.type('Name or e-mail', 'alex@example.com')
  await t.type('Password', 'not-the-password')
  await t.submit()
}
const typeCode = t => t.type('Code from your other device', CODE)

registerScreens('Sign in', [
  { id: 'S0.0', title: 'Sign in', note: 'Invite-only instance: no Create button, the invite-link line.', render: login,
    mock: { config: { invite_only: true, password_login: true } } },
  { id: 'S0.1', title: 'Waiting for your passkey', note: 'The button spins; Cancel calls the prompt off.', render: login,
    mock: { config: withPasswords, api: PASSKEY_START, credentials: { get: never } }, play: failedPasskey },
  { id: 'S0.2', title: 'Passkey not confirmed', note: 'The alert shakes once and holds focus.', render: login,
    mock: { config: withPasswords, api: PASSKEY_START, credentials: { get: denied } }, play: failedPasskey },
  { id: 'S0.3', title: 'Having trouble?', note: 'A drawer over S0.2.', render: login,
    mock: { config: withPasswords, api: PASSKEY_START, credentials: { get: denied } }, play: troubleDrawer },
  { id: 'S0.4', title: 'Add this device', note: 'Reached from S0.0, S0.2 and S0.3.', render: login, path: ADD_DEVICE_PATH,
    mock: { config: withPasswords, api: LINK_START } },
  { id: 'S0.5', title: 'Code didn’t work', render: login, path: ADD_DEVICE_PATH,
    mock: { config: withPasswords, api: { 'POST /api/device-link/options': { status: 400, body: { error: 'invalid', code: 'link-invalid' } } } },
    play: async t => { await typeCode(t); await t.submit() } },
  { id: 'S0.6', title: 'Passkey added', note: 'The ring draws itself.', render: login, path: ADD_DEVICE_PATH,
    mock: { config: withPasswords, api: { ...LINK_START, 'POST /api/device-link/verify': { user: { id: 'u1', name: 'Alex' } } }, credentials: { create: madePasskey } },
    play: async t => { await typeCode(t); await t.submit() } },
  { id: 'S0.7', title: 'Sign in with password', note: 'A drawer over S0.0.', render: login, mock: { config: withPasswords }, play: signInDrawer },
  { id: 'S0.7a', title: 'Account disabled', note: 'One line from the server; nothing to retry.', render: login,
    mock: { config: withPasswords, api: DISABLED }, play: wrongDetails },
  { id: 'S0.8', title: 'Wrong details', render: login, mock: { config: withPasswords, api: WRONG }, play: wrongDetails },
  { id: 'S0.9', title: 'Reset your password', note: 'The same drawer in its reset-code half.', render: login, mock: { config: withPasswords },
    play: async t => { await signInDrawer(t); await t.click('Have a reset code from your admin?') } },
  { id: 'S0.10', title: 'Browser can’t use passkeys', render: login, mock: { config: withPasswords, webauthn: false } },
])

registerScreens('Sign in: other configurations', [
  { id: 'S0.demo', title: 'Demo build', note: 'Start the demo; no server to sign in to.', render: () => <Login demo />, mock: {} },
  { id: 'S0.guest', title: 'Guest allowed', note: 'Continue without account under the other ways in.', render: login,
    mock: { config: { allow_guest: true, password_login: true } } },
  { id: 'S0.open', title: 'Open registration', note: 'Not invite-only: Create new profile as a plain link.', render: login,
    mock: { config: { invite_only: false, password_login: true } } },
  { id: 'S0.nopw', title: 'No password on this instance', note: 'The drawer offers the code alone.', render: login,
    mock: { config: { allow_guest: false }, api: PASSKEY_START, credentials: { get: denied } }, play: troubleDrawer },
  { id: 'S0.10a', title: 'Browser can’t use passkeys, guest allowed', render: login, mock: { config: { allow_guest: true }, webauthn: false } },
])
