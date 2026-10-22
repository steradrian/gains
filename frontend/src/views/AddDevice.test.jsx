// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AddDevice from './AddDevice.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* Add this device (S0.4 the code, S0.5 the code that did not work, S0.6 passkey added): the other
   device's side of a one-time code (#95). The API and the passkey prompt are stand-ins; what each
   step sends, and what the screen says back, is the point. */
const mocks = vi.hoisted(() => {
  const state = { webauthn: true, answers: {}, calls: [], store: {} }
  state.setUser = vi.fn()
  state.adoptProfile = vi.fn(async () => ({}))
  state.createPasskey = vi.fn(async () => ({ id: 'new-key', response: {} }))
  state.askAddDeviceData = vi.fn()
  state.api = vi.fn(async (path, init) => {
    state.calls.push({ path, method: init?.method || 'GET', body: init?.body ? JSON.parse(init.body) : null })
    const a = state.answers[(init?.method || 'GET') + ' ' + path]
    if (a instanceof Error) throw a
    return a ?? {}
  })
  state.snapshot = () => ({ ...state.store, setUser: state.setUser, adoptProfile: state.adoptProfile })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  useStore.setState = patch => Object.assign(mocks.store, patch)
  return { useStore }
})
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn(), openSheet: vi.fn() }) } }))
vi.mock('../lib/api.js', () => ({
  api: (...a) => mocks.api(...a),
  webauthnOK: () => mocks.webauthn,
  createPasskey: (...a) => mocks.createPasskey(...a),
  // PasswordAuth.jsx, for passwordError, imports these too.
  passkeyAssertion: vi.fn(), passwordLogin: vi.fn(), passwordRegister: vi.fn(), passwordResetRedeem: vi.fn(),
}))
vi.mock('../sheets.jsx', () => ({ askAddDeviceData: mocks.askAddDeviceData }))

const fail = (status, data) => Object.assign(new Error(data?.error || 'HTTP ' + status), { status, data })
const named = (name, e = new Error(name)) => Object.assign(e, { name })

const mounted = []
// The screen on its route, and what any other route shows: where it went.
function Elsewhere() { return <p id="elsewhere">{useLocation().pathname}</p> }
function mount(entries = ['/add-device']) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  act(() => root.render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes><Route path="/add-device" element={<AddDevice />} /><Route path="*" element={<Elsewhere />} /></Routes>
    </MemoryRouter>))
  return host
}
const settle = () => act(() => new Promise(r => setTimeout(r, 0)))
function type(el, value) {
  act(() => {
    Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const codeInput = host => host.querySelector('input[aria-label="Code from your other device"]')
const cells = host => [...host.querySelectorAll('.g-code-cell')].map(c => c.textContent).join('')
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent === text)
const buttons = host => [...host.querySelectorAll('button')].map(b => b.textContent)
const click = async (host, text) => { act(() => button(host, text).click()); await settle() }
const submit = async host => { act(() => { host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await settle() }
const alertText = host => host.querySelector('[role="alert"]')?.textContent || null

const LINK = 'K7WQ-2MZP-4HXA'
const CODE = 'K7WQ2MZP4HXA'
const OPTIONS = { cid: 'link-cid', options: { challenge: 'xyz' }, id: 'u1', name: 'Ana' }
const CAUTION = 'Only continue if this code comes from a device of your own. This browser is then signed in to “Ana”, and what you log here goes to that profile.'

beforeEach(() => {
  mocks.webauthn = true
  mocks.answers = {}
  mocks.calls.length = 0
  mocks.store = { user: null, linkCode: null }
  for (const f of [mocks.setUser, mocks.adoptProfile, mocks.createPasskey, mocks.askAddDeviceData]) f.mockClear()
})
afterEach(() => { vi.restoreAllMocks(); act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })

describe('Add this device: the code (S0.4)', () => {
  it('is a full screen with Back, the code cells, where to find the code, Create passkey and Paste code', () => {
    const host = mount()
    expect(host.querySelector('h1').textContent).toBe('Add this device')
    // The code lives on the other device, so nothing here can open its Settings: no breadcrumb either.
    expect(host.textContent).toContain('Enter the code your other device shows. This device then gets a passkey of its own.')
    expect(host.textContent).toContain('On your other device, when you add a device')
    expect(host.textContent).not.toContain('›')
    expect(host.querySelector('[aria-label="Back"]')).toBeTruthy()
    expect(host.querySelectorAll('.g-code-cell')).toHaveLength(12)
    expect(host.textContent).toContain('Codes work once and last 10 minutes.')
    expect(host.textContent).toContain('Where is the code?')
    expect(buttons(host)).toContain('Create passkey')
    expect(buttons(host)).toContain('Paste code')
  })

  it('checks a code from the link at once, then creates the passkey and signs in like a passkey sign-in', async () => {
    mocks.store = { user: null, linkCode: LINK }
    mocks.answers['POST /api/device-link/options'] = OPTIONS
    mocks.answers['POST /api/device-link/verify'] = { user: { id: 'u1', name: 'Ana', admin: false } }
    const host = mount()
    await settle()
    expect(mocks.calls[0]).toEqual({ path: '/api/device-link/options', method: 'POST', body: { code: CODE } })
    expect(cells(host)).toBe(CODE)
    expect(host.textContent).toContain('for the profile “Ana”')
    // A guest is told where this device ends up, and that the code has to be their own.
    expect(host.textContent).toContain(CAUTION)
    expect(host.textContent).not.toMatch(/signed in as/)
    await submit(host)
    // The options already here are used as they are: the prompt opens straight from the tap.
    expect(mocks.calls.filter(c => c.path === '/api/device-link/options')).toHaveLength(1)
    expect(mocks.createPasskey).toHaveBeenCalledWith({ challenge: 'xyz' })
    expect(mocks.calls.at(-1).path).toBe('/api/device-link/verify')
    expect(mocks.calls.at(-1).body).toMatchObject({ code: CODE, cid: 'link-cid', credential: { id: 'new-key' } })
    expect(mocks.setUser).toHaveBeenCalledWith({ id: 'u1', name: 'Ana', admin: false }, { adopt: { alwaysAsk: true } })
    // What this device logged goes into that profile only when asked, even into an empty one.
    expect(mocks.adoptProfile).toHaveBeenCalledWith(mocks.askAddDeviceData, { alwaysAsk: true })
    expect(mocks.store.linkCode).toBeNull()
  })

  it('a typed or pasted code with its dashes is the same code', async () => {
    mocks.answers['POST /api/device-link/options'] = OPTIONS
    const host = mount()
    type(codeInput(host), 'k7wq-2mzp-4hxa')
    expect(cells(host)).toBe(CODE)
    await submit(host)
    expect(mocks.calls[0].body).toEqual({ code: CODE })
  })

  it('Paste code fills the cells from the clipboard, a link that carries the code included', async () => {
    const readText = vi.fn(async () => 'https://gains.example/?link=K7WQ-2MZP-4HXA')
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText } })
    const host = mount()
    await click(host, 'Paste code')
    expect(cells(host)).toBe(CODE)
    vi.unstubAllGlobals()
  })

  it('Paste code just focuses the field where the clipboard cannot be read', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: async () => { throw new Error('denied') } } })
    const host = mount()
    await click(host, 'Paste code')
    expect(document.activeElement).toBe(codeInput(host))
    vi.unstubAllGlobals()
  })

  it('an empty code is said on the screen, and nothing is asked of the server', async () => {
    const host = mount()
    await submit(host)
    expect(alertText(host)).toBe('Enter the code from your other device.')
    expect(mocks.calls).toHaveLength(0)
  })

  it('a prompt the person closed is no failure', async () => {
    mocks.store = { user: null, linkCode: LINK }
    mocks.answers['POST /api/device-link/options'] = OPTIONS
    mocks.createPasskey.mockRejectedValueOnce(named('NotAllowedError'))
    const host = mount()
    await settle()
    await submit(host)
    expect(alertText(host)).toBeNull()
    expect(host.textContent).not.toContain('Passkey added')
  })

  it('after a refused verify it asks for fresh options next time, since the server spent the challenge', async () => {
    mocks.store = { user: null, linkCode: LINK }
    mocks.answers['POST /api/device-link/options'] = OPTIONS
    mocks.answers['POST /api/device-link/verify'] = fail(400, { error: 'not verified' })
    const host = mount()
    await settle()
    await submit(host)
    expect(alertText(host)).toBe('not verified')
    expect(host.querySelector('[aria-invalid="true"]')).toBeNull()
    await submit(host)
    expect(mocks.calls.filter(c => c.path === '/api/device-link/options')).toHaveLength(2)
  })

  it('says so when another profile is signed in here', async () => {
    mocks.store = { user: { id: 'u2', name: 'Bea' }, linkCode: LINK }
    mocks.answers['POST /api/device-link/options'] = OPTIONS
    const host = mount()
    await settle()
    expect(host.textContent).toContain('This browser is signed in as “Bea”. Adding it to “Ana” signs “Bea” out here.')
    expect(host.textContent).toContain(CAUTION)
  })

  it('tells a different profile with the same name apart by its id', async () => {
    // Someone else's profile, named like the one signed in here on purpose.
    mocks.store = { user: { id: 'u2', name: 'Ana' }, linkCode: LINK }
    mocks.answers['POST /api/device-link/options'] = OPTIONS
    mocks.answers['POST /api/device-link/verify'] = { user: { id: 'u1', name: 'Ana', admin: false } }
    const host = mount()
    await settle()
    expect(host.textContent).toContain('This code is for a different profile that is also called “Ana”, not the one this browser is signed in as. Adding it there signs yours out here.')
    expect(host.textContent).toContain(CAUTION)
    await submit(host)
    expect(mocks.adoptProfile).toHaveBeenCalledWith(mocks.askAddDeviceData, { alwaysAsk: true })
  })

  it('a browser without passkeys is told plainly, and nothing is asked of the server', async () => {
    mocks.webauthn = false
    mocks.store = { user: null, linkCode: LINK }
    const host = mount()
    await settle()
    expect(host.textContent).toMatch(/cannot create passkeys/)
    expect(buttons(host)).toContain('Done')
    expect(mocks.calls).toHaveLength(0)
  })

  it('Back goes back where it came from, and to the start from a page opened cold', () => {
    const from = mount(['/me', '/add-device'])
    act(() => from.querySelector('[aria-label="Back"]').click())
    expect(from.querySelector('#elsewhere').textContent).toBe('/me')
    const cold = mount(['/add-device'])
    act(() => cold.querySelector('[aria-label="Back"]').click())
    expect(cold.querySelector('#elsewhere').textContent).toBe('/')
  })
})

describe('Add this device: the code that did not work (S0.5)', () => {
  it('says it, marks the cells, offers only to enter the code again, and signs nobody in', async () => {
    mocks.answers['POST /api/device-link/options'] = fail(400, { code: 'link-invalid' })
    const host = mount()
    type(codeInput(host), 'wrng-code-0000')
    await submit(host)
    expect(alertText(host)).toBe('That code didn’t workIt is wrong, already used or expired. Make a new one on your other device.')
    expect(host.querySelectorAll('.g-code-cell.bad')).toHaveLength(12)
    expect(codeInput(host).getAttribute('aria-invalid')).toBe('true')
    // (Back is a button with no text of its own.)
    expect(buttons(host).filter(Boolean)).toEqual(['Enter the code again'])
    expect(host.textContent).toContain('Where is the code?')
    expect(mocks.createPasskey).not.toHaveBeenCalled()
    expect(mocks.setUser).not.toHaveBeenCalled()
    // The alert is read out: focus is on it.
    expect(document.activeElement).toBe(host.querySelector('[role="alert"]'))
  })

  it('Enter the code again clears it and brings back the way to try', async () => {
    mocks.answers['POST /api/device-link/options'] = fail(400, { code: 'link-invalid' })
    const host = mount()
    type(codeInput(host), 'wrng-code-0000')
    await submit(host)
    await click(host, 'Enter the code again')
    expect(cells(host)).toBe('')
    expect(alertText(host)).toBeNull()
    expect(document.activeElement).toBe(codeInput(host))
    expect(buttons(host)).toContain('Create passkey')
  })

  it('typing again takes the notice away', async () => {
    mocks.answers['POST /api/device-link/options'] = fail(400, { code: 'link-invalid' })
    const host = mount()
    type(codeInput(host), 'wrng-code-0000')
    await submit(host)
    type(codeInput(host), 'wrng-code-000')
    expect(alertText(host)).toBeNull()
    expect(buttons(host)).toContain('Create passkey')
  })

  it('a link whose code is already dead says so as soon as the screen opens', async () => {
    mocks.store = { user: null, linkCode: LINK }
    mocks.answers['POST /api/device-link/options'] = fail(400, { code: 'link-invalid' })
    const host = mount()
    await settle()
    expect(alertText(host)).toContain('That code didn’t work')
  })
})

describe('Add this device: passkey added (S0.6)', () => {
  const add = async (store, name = 'Ana') => {
    mocks.store = store
    mocks.answers['POST /api/device-link/options'] = OPTIONS
    mocks.answers['POST /api/device-link/verify'] = { user: { id: 'u1', name, admin: false } }
    const host = mount()
    await settle()
    await submit(host)
    return host
  }

  it('says whose profile this device signs in to, and Go to Today leaves for the app', async () => {
    const host = await add({ user: null, linkCode: LINK })
    expect(host.querySelector('h1').textContent).toBe('Passkey added')
    expect(host.textContent).toContain('This phone now signs in to Ana’s profile on its own. Your other device stays signed in.')
    expect(host.querySelector('.g-check')).toBeTruthy()
    expect(button(host, 'Create passkey')).toBeUndefined()
    await click(host, 'Go to Today')
    expect(host.querySelector('#elsewhere').textContent).toBe('/')
  })

  it('stays up after the sign-in it causes, the store now holding the user', async () => {
    mocks.setUser.mockImplementation(u => { mocks.store.user = u })
    const host = await add({ user: null, linkCode: LINK })
    expect(host.querySelector('h1').textContent).toBe('Passkey added')
  })

  it('the same account adding this browser keeps its copy as it is', async () => {
    // Renamed since this browser signed in: the id is what makes it the same profile.
    const host = await add({ user: { id: 'u1', name: 'Ana (old name)' }, linkCode: LINK })
    expect(mocks.setUser).toHaveBeenCalledWith({ id: 'u1', name: 'Ana', admin: false }, undefined)
    expect(mocks.adoptProfile).not.toHaveBeenCalled()
    expect(host.querySelector('h1').textContent).toBe('Passkey added')
  })
})
