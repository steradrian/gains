// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AddDeviceSheet, PairSheet } from './add-device-sheet.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* A2.4, a code for another device: the proof, then the code, a QR code of the link and a way to
   copy it; the code runs out and a new one starts from the proof. And the pairing code for the
   phone app. The API and the passkey prompt are stand-ins. */
const mocks = vi.hoisted(() => {
  const state = { webauthn: true, answers: {}, calls: [] }
  state.toast = vi.fn()
  state.passkeyAssertion = vi.fn(async () => ({ cid: 'login-cid', credential: { id: 'k1' } }))
  state.copyText = vi.fn(async () => true)
  state.api = vi.fn(async (path, init) => {
    const method = init?.method || 'GET'
    state.calls.push({ path, method, body: init?.body ? JSON.parse(init.body) : null })
    const a = state.answers[method + ' ' + path]
    if (a instanceof Error) throw a
    return typeof a === 'function' ? a() : a ?? {}
  })
  state.snapshot = () => ({ S: {}, user: { id: 'u1', name: 'Ana' } })
  return state
})
vi.mock('../../../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => {
  const snap = () => ({ toast: (...a) => mocks.toast(...a), openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('../../../lib/api.js', () => ({
  api: (...a) => mocks.api(...a),
  webauthnOK: () => mocks.webauthn,
  passkeyAssertion: (...a) => mocks.passkeyAssertion(...a),
  passwordLogin: vi.fn(), passwordRegister: vi.fn(), passwordResetRedeem: vi.fn(),
}))
vi.mock('../../../lib/clipboard.js', () => ({ copyText: (...a) => mocks.copyText(...a) }))
// lean-qr loads on demand; what matters here is what the QR code carries.
vi.mock('../../../components/QrCanvas.jsx', () => ({ default: ({ value }) => <canvas data-qr={value} /> }))

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
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent === text)
const click = async (host, text) => { act(() => button(host, text).click()); await settle() }

const LIST = { passkeys: [{ id: 'k1' }], password: false, lastWayIn: true }
const LINK = 'K7WQ-2MZP-4HXA'

beforeEach(() => {
  mocks.webauthn = true
  mocks.answers = {}
  mocks.calls.length = 0
  for (const f of [mocks.toast, mocks.passkeyAssertion, mocks.copyText]) f.mockClear()
})
afterEach(() => { vi.useRealTimers(); act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })

describe('A2.4 add another device', () => {
  it('says plainly when nothing here can confirm it is the owner', () => {
    // A profile that only has a password, on an instance that switched passwords off.
    const host = mount(<AddDeviceSheet state={{ passkeys: [], password: false, lastWayIn: true }} close={() => {}} />)
    expect(button(host, 'Confirm with a passkey')).toBeUndefined()
    expect(host.querySelector('input[type="password"]')).toBeNull()
    expect(host.textContent).toMatch(/has no passkey, and this server does not take passwords/)
    // A passkey this browser cannot use is another matter: another device can.
    mocks.webauthn = false
    const other = mount(<AddDeviceSheet state={LIST} close={() => {}} />)
    expect(other.textContent).toMatch(/This browser cannot confirm with your passkey/)
    expect(mocks.calls).toEqual([])
  })

  it('after the proof shows the code, a QR code of the link, how long it lives, and copies the link', async () => {
    mocks.answers['POST /api/account/device-link'] = { code: LINK, expires: Date.now() + 600000 }
    const host = mount(<AddDeviceSheet state={LIST} close={() => {}} />)
    expect(host.querySelector('canvas')).toBeNull()
    await click(host, 'Confirm with a passkey')
    expect(mocks.calls.at(-1)).toEqual({ path: '/api/account/device-link', method: 'POST', body: { cid: 'login-cid', credential: { id: 'k1' } } })
    const link = window.location.origin + window.location.pathname + '?link=' + LINK
    expect(host.querySelector('canvas').dataset.qr).toBe(link)
    expect(host.querySelector('.g-acct-code').textContent).toBe(LINK)
    expect(host.textContent).toMatch(/works once, for 10 minutes/)
    expect(host.textContent).toContain('Expires in 10:00')
    await click(host, 'Copy link')
    expect(mocks.copyText).toHaveBeenCalledWith(link)
    expect(mocks.toast).toHaveBeenCalledWith('Copied')
  })

  it('counts down, then says the code has expired and makes a new one from the proof', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    mocks.answers['POST /api/account/device-link'] = { code: LINK, expires: Date.now() + 3000 }
    const host = mount(<AddDeviceSheet state={LIST} close={() => {}} />)
    await click(host, 'Confirm with a passkey')
    expect(host.textContent).toContain('Expires in 0:03')
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(host.textContent).toContain('Expires in 0:01')
    await act(async () => { vi.advanceTimersByTime(1500) })
    expect(host.textContent).toContain('This code has expired.')
    expect(host.querySelector('canvas')).toBeNull()
    expect(host.querySelector('.g-acct-code')).toBeNull()
    await click(host, 'Make a new code')
    expect(button(host, 'Confirm with a passkey')).toBeTruthy()
  })

  it('a code that is already out of time is expired at once', async () => {
    mocks.answers['POST /api/account/device-link'] = { code: LINK, expires: Date.now() - 1 }
    const host = mount(<AddDeviceSheet state={LIST} close={() => {}} />)
    await click(host, 'Confirm with a passkey')
    expect(host.textContent).toContain('This code has expired.')
    expect(host.querySelector('canvas')).toBeNull()
  })

  it('a refused proof shows why and no code', async () => {
    mocks.answers['POST /api/account/device-link'] = Object.assign(new Error('no'), { status: 403, data: { code: 'passkey' } })
    const host = mount(<AddDeviceSheet state={LIST} close={() => {}} />)
    await click(host, 'Confirm with a passkey')
    expect(host.querySelector('[role="alert"]').textContent).toBe('Your passkey could not be confirmed.')
    expect(host.querySelector('canvas')).toBeNull()
  })
})

describe('pairing the phone app', () => {
  it('shows the code the server minted', async () => {
    mocks.answers['POST /api/pair/create'] = { code: 'ABCD1234' }
    const host = mount(<PairSheet close={() => {}} />)
    await settle()
    expect(host.querySelector('.g-acct-code').textContent).toBe('ABCD1234')
  })

  it('says so when no code could be made', async () => {
    mocks.answers['POST /api/pair/create'] = new Error('HTTP 500')
    const host = mount(<PairSheet close={() => {}} />)
    await settle()
    expect(host.querySelector('[role="alert"]').textContent).toBe('HTTP 500')
  })
})
