// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PasskeySheet, AddPasskeySheet } from './passkey-sheets.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* The passkey drawers of Account and data (St2Passkey, St2RemovePasskey, St2OnlyPasskey): what
   renaming, removing and adding send. Removing and adding both sit behind the proof step; the only
   passkey is refused before anything is sent. The API and the passkey prompts are stand-ins; what
   each step sends, and what it says back in the UI language, is the point. */
const mocks = vi.hoisted(() => {
  const state = { webauthn: true, sheets: [], answers: {}, calls: [], store: {} }
  state.toast = vi.fn()
  state.passkeyAssertion = vi.fn(async () => ({ cid: 'login-cid', credential: { id: 'k1' } }))
  state.createPasskey = vi.fn(async () => ({ id: 'new-key', response: {} }))
  state.api = vi.fn(async (path, init) => {
    const method = init?.method || 'GET'
    state.calls.push({ path, method, body: init?.body ? JSON.parse(init.body) : null })
    const a = state.answers[method + ' ' + path.split('?')[0]]
    if (a instanceof Error) throw a
    return typeof a === 'function' ? a() : a ?? {}
  })
  state.snapshot = () => ({ S: {}, ...state.store })
  return state
})
vi.mock('../../../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => {
  const snap = () => ({ toast: (...a) => mocks.toast(...a), openSheet: (render, opts) => { mocks.sheets.push({ render, opts }); return {} } })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('../../../lib/api.js', () => ({
  api: (...a) => mocks.api(...a),
  webauthnOK: () => mocks.webauthn,
  passkeyAssertion: (...a) => mocks.passkeyAssertion(...a),
  createPasskey: (...a) => mocks.createPasskey(...a),
  // PasswordAuth.jsx, for passwordError, imports these too.
  passwordLogin: vi.fn(), passwordRegister: vi.fn(), passwordResetRedeem: vi.fn(),
}))

const fail = (status, data) => Object.assign(new Error(data?.error || 'HTTP ' + status), { status, data })
const named = (name, e = new Error(name)) => Object.assign(e, { name })

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
function type(el, value) {
  act(() => {
    Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const byPlaceholder = (host, p) => host.querySelector(`input[placeholder="${p}"]`)
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent === text)
const click = async (host, text) => { act(() => button(host, text).click()); await settle() }
const submit = async host => { act(() => { host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await settle() }
const alertText = host => host.querySelector('[role="alert"]')?.textContent || null
// The panel a tap pushed, mounted on its own.
const openedSheet = (i = mocks.sheets.length - 1) => { const close = vi.fn(); return { host: mount(mocks.sheets[i].render(close)), close } }
// The last thing mounted goes away, as when it is closed.
const unmountLast = () => act(() => { const m = mounted.pop(); m.root.unmount(); m.host.remove() })
// A passkey prompt that stays open until the test answers it, and says whether it was called off.
function openPrompt() {
  const p = {}
  mocks.passkeyAssertion.mockImplementationOnce(({ signal } = {}) => new Promise((resolve, reject) => {
    p.signal = signal
    p.answer = () => resolve({ cid: 'login-cid', credential: { id: 'k1' } })
    p.fail = e => reject(e)
  }))
  return p
}

const LAPTOP = { id: 'k/1+', name: 'Laptop', created: '2025-09-01T10:00:00.000Z', lastUsed: new Date().toISOString(), transports: ['internal'] }
const OTHER = { id: 'k2', name: null, created: null, lastUsed: null, transports: [] }
const LIST = { passkeys: [LAPTOP, OTHER], password: false, lastWayIn: false }
const deletes = () => mocks.calls.filter(c => c.method === 'DELETE')
const sent = () => mocks.calls.filter(c => c.method !== 'GET')

beforeEach(() => {
  mocks.webauthn = true
  mocks.sheets.length = 0
  mocks.answers = {}
  mocks.calls.length = 0
  mocks.store = { user: { id: 'u1', name: 'Ana' } }
  for (const f of [mocks.toast, mocks.passkeyAssertion, mocks.createPasskey]) f.mockClear()
})
afterEach(() => { act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })

function openPasskey(state = LIST, passkey = LAPTOP) {
  const done = vi.fn()
  const close = vi.fn()
  const host = mount(<PasskeySheet passkey={passkey} title={passkey.name || 'Passkey 2'} state={state} close={close} done={done} />)
  return { host, done, close }
}

describe('A2.1 one passkey', () => {
  it('shows its name, when it was created and last used, and renames it', async () => {
    const { host, done, close } = openPasskey()
    expect(host.querySelector('h2').textContent).toBe('Passkey')
    expect(byPlaceholder(host, 'Name, e.g. Work laptop').value).toBe('Laptop')
    expect(host.textContent).toContain('Created')
    expect(host.textContent).toContain('Last used')
    const renamed = { ...LIST, passkeys: [{ ...LAPTOP, name: 'Work laptop' }, OTHER] }
    mocks.answers['POST /api/account/passkeys/rename'] = renamed
    type(byPlaceholder(host, 'Name, e.g. Work laptop'), 'Work laptop')
    await submit(host)
    expect(mocks.calls.at(-1)).toEqual({ path: '/api/account/passkeys/rename', method: 'POST', body: { id: 'k/1+', name: 'Work laptop' } })
    expect(done).toHaveBeenCalledWith(renamed)
    expect(close).toHaveBeenCalled()
  })

  it('a passkey from before either date was recorded has neither row', () => {
    const { host } = openPasskey(LIST, OTHER)
    expect(host.textContent).not.toContain('Created')
    expect(host.textContent).not.toContain('Last used')
  })

  it('a refusal stays on the drawer and says why', async () => {
    const { host, close, done } = openPasskey()
    mocks.answers['POST /api/account/passkeys/rename'] = fail(409, { code: 'passkey-limit' })
    await submit(host)
    expect(alertText(host)).toMatch(/as many passkeys/)
    expect(close).not.toHaveBeenCalled()
    expect(done).not.toHaveBeenCalled()
  })
})

/* Removing asks for the proof adding does (proveOwner in api/server.js), on the panel that says
   what removing means: the tap that confirms it is the proof, and the proof goes with the removal
   and nothing else. */
describe('A2.2 removing a passkey', () => {
  async function openRemove(state = LIST) {
    const first = openPasskey(state)
    act(() => button(first.host, 'Remove passkey').click())
    const panel = openedSheet()
    return { host: panel.host, done: first.done, parentClose: first.close }
  }

  it('says sessions stay, sends nothing until the passkey confirms, then removes with that proof', async () => {
    const { host, done, parentClose } = await openRemove()
    expect(host.querySelector('h2').textContent).toBe('Remove this passkey?')
    expect(host.textContent).toContain('Laptop')
    expect(host.textContent).toMatch(/stays signed in. If it was lost, use Sign out everywhere/)
    expect(host.textContent).toContain('First confirm that it is you.')
    // No password on this profile, or none that counts: the passkey is the only proof offered.
    expect(byPlaceholder(host, 'Current password')).toBeNull()
    expect(deletes()).toEqual([])
    expect(button(host, 'Confirm with a passkey').className).toMatch(/\bdanger\b/)

    const left = { ...LIST, passkeys: [OTHER], lastWayIn: true }
    mocks.answers['DELETE /api/account/passkeys'] = left
    await click(host, 'Confirm with a passkey')
    expect(mocks.passkeyAssertion).toHaveBeenCalledTimes(1)
    expect(deletes()).toEqual([{ path: '/api/account/passkeys?id=k%2F1%2B', method: 'DELETE', body: { cid: 'login-cid', credential: { id: 'k1' } } }])
    expect(done).toHaveBeenCalledWith(left)
    // The drawer under the panel goes too: the list it showed is out of date.
    expect(parentClose).toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith('Passkey removed')
  })

  it('takes the password where it counts, and says when it is missing or wrong', async () => {
    const { host } = await openRemove({ ...LIST, password: true })
    const pw = byPlaceholder(host, 'Current password')
    expect(pw.getAttribute('autocomplete')).toBe('current-password')
    // Either way it removes, so both say so in red.
    expect(button(host, 'Confirm with a passkey').className).toMatch(/\bdanger\b/)
    expect(button(host, 'Remove passkey').className).toMatch(/\bdanger\b/)
    await submit(host)
    expect(alertText(host)).toBe('Enter your password.')
    expect(deletes()).toEqual([])
    mocks.answers['DELETE /api/account/passkeys'] = fail(403, { code: 'current-wrong' })
    type(pw, 'not it')
    await submit(host)
    expect(deletes().at(-1).body).toEqual({ current: 'not it' })
    expect(alertText(host)).toBe('Your current password is not right.')
    mocks.answers['DELETE /api/account/passkeys'] = { ...LIST, passkeys: [OTHER] }
    type(pw, 'correct horse battery')
    await click(host, 'Remove passkey')
    expect(deletes().at(-1).body).toEqual({ current: 'correct horse battery' })
    expect(mocks.toast).toHaveBeenCalledWith('Passkey removed')
  })

  it('a refusal stays on the panel and says why; nothing is removed', async () => {
    const { host, done } = await openRemove()
    mocks.answers['DELETE /api/account/passkeys'] = fail(403, { code: 'passkey' })
    await click(host, 'Confirm with a passkey')
    expect(alertText(host)).toBe('Your passkey could not be confirmed.')
    // Another device took the other passkey away meanwhile: this one is the last way in now.
    mocks.answers['DELETE /api/account/passkeys'] = fail(409, { code: 'last-way-in' })
    await click(host, 'Confirm with a passkey')
    expect(alertText(host)).toBe('It is your only way in, so it cannot be removed until there is another.')
    expect(done).not.toHaveBeenCalled()
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('a dismissed prompt removes nothing and is no error; Cancel just closes the panel', async () => {
    const { host } = await openRemove()
    mocks.passkeyAssertion.mockRejectedValueOnce(named('NotAllowedError'))
    await click(host, 'Confirm with a passkey')
    expect(deletes()).toEqual([])
    expect(alertText(host)).toBeNull()
    const callsBefore = mocks.calls.length
    await click(host, 'Cancel')
    expect(mocks.calls.length).toBe(callsBefore)
  })

  it('a prompt still open when the panel goes is called off, and an answer after that removes nothing', async () => {
    const { host } = await openRemove()
    const prompt = openPrompt()
    await click(host, 'Confirm with a passkey')
    expect(prompt.signal.aborted).toBe(false)
    unmountLast()
    expect(prompt.signal.aborted).toBe(true)
    // A browser that answers anyway: the answer is for a panel that is gone.
    await act(async () => { prompt.answer() })
    await settle()
    expect(deletes()).toEqual([])
    expect(mocks.toast).not.toHaveBeenCalled()
  })
})

describe('A2.3 the only passkey', () => {
  const ONLY = { passkeys: [LAPTOP], password: false, lastWayIn: true }

  it('is refused with the reason, and nothing is sent', async () => {
    const first = openPasskey(ONLY)
    act(() => button(first.host, 'Remove passkey').click())
    const { host, close } = openedSheet()
    expect(host.querySelector('h2').textContent).toBe('Your only passkey')
    expect(host.textContent).toMatch(/only way in/)
    expect(button(host, 'Confirm with a passkey')).toBeUndefined()
    expect(byPlaceholder(host, 'Current password')).toBeNull()
    await click(host, 'Keep it')
    // Keep it closes the panel and nothing else.
    expect(close).toHaveBeenCalled()
    expect(first.close).not.toHaveBeenCalled()
    expect(sent()).toEqual([])
    expect(first.done).not.toHaveBeenCalled()
  })

  it('a password on the profile does not make the last passkey removable', () => {
    const first = openPasskey({ ...ONLY, password: true, lastWayIn: false })
    act(() => button(first.host, 'Remove passkey').click())
    const { host } = openedSheet()
    expect(host.querySelector('h2').textContent).toBe('Your only passkey')
    expect(sent()).toEqual([])
  })

  it('offers to add one first, where this browser can', () => {
    const first = openPasskey(ONLY)
    act(() => button(first.host, 'Remove passkey').click())
    const { host } = openedSheet()
    act(() => button(host, 'Add a passkey first').click())
    expect(mocks.sheets.at(-1).opts).toEqual({ variant: 'ds' })

    mocks.webauthn = false
    const again = openPasskey(ONLY)
    act(() => button(again.host, 'Remove passkey').click())
    expect(button(openedSheet().host, 'Add a passkey first')).toBeUndefined()
  })
})

describe('adding a passkey', () => {
  function openAdd(state = LIST) {
    const done = vi.fn()
    const close = vi.fn()
    return { host: mount(<AddPasskeySheet state={state} close={close} done={done} />), done, close }
  }

  it('confirms with a passkey first, then opens the passkey prompt from its own tap and stores the new one', async () => {
    const { host, close, done } = openAdd()
    // No password on this profile: only the passkey proof is offered.
    expect(byPlaceholder(host, 'Current password')).toBeNull()
    type(byPlaceholder(host, 'Name, e.g. Work laptop'), 'YubiKey')
    mocks.answers['POST /api/account/passkeys/options'] = { cid: 'add-cid', options: { challenge: 'abc' } }
    await click(host, 'Confirm with a passkey')
    expect(mocks.calls.at(-1)).toEqual({ path: '/api/account/passkeys/options', method: 'POST', body: { cid: 'login-cid', credential: { id: 'k1' } } })
    // Nothing is created until the second tap.
    expect(mocks.createPasskey).not.toHaveBeenCalled()
    mocks.answers['POST /api/account/passkeys/verify'] = LIST
    await click(host, 'Create passkey')
    expect(mocks.createPasskey).toHaveBeenCalledWith({ challenge: 'abc' })
    expect(mocks.calls.at(-1)).toEqual({ path: '/api/account/passkeys/verify', method: 'POST', body: { cid: 'add-cid', credential: { id: 'new-key', response: {} }, name: 'YubiKey' } })
    expect(done).toHaveBeenCalledWith(LIST)
    expect(close).toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith('Passkey added')
  })

  it('takes the current password as proof where there is one, and says when it is wrong', async () => {
    const { host } = openAdd({ passkeys: [], password: true, lastWayIn: true })
    expect(button(host, 'Confirm with a passkey')).toBeUndefined()
    const pw = byPlaceholder(host, 'Current password')
    expect(pw.getAttribute('autocomplete')).toBe('current-password')
    await submit(host)
    expect(alertText(host)).toBe('Enter your password.')
    mocks.answers['POST /api/account/passkeys/options'] = fail(403, { code: 'current-wrong' })
    type(pw, 'not it')
    await submit(host)
    expect(mocks.calls.at(-1).body).toEqual({ current: 'not it' })
    expect(alertText(host)).toBe('Your current password is not right.')
  })

  it('a dismissed prompt is no error; an authenticator that already holds one says so', async () => {
    const { host } = openAdd()
    mocks.answers['POST /api/account/passkeys/options'] = { cid: 'add-cid', options: {} }
    await click(host, 'Confirm with a passkey')
    mocks.createPasskey.mockRejectedValueOnce(named('NotAllowedError'))
    await click(host, 'Create passkey')
    expect(alertText(host)).toBeNull()
    mocks.createPasskey.mockRejectedValueOnce(named('InvalidStateError'))
    await click(host, 'Create passkey')
    expect(alertText(host)).toBe('This device already has a passkey for this profile.')
  })
})
