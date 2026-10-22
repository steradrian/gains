// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { passkeyError, listOf, usePasskeys } from './Passkeys.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* The data side of more than one passkey (#95): the server's refusals in the UI language, and the
   list the Account page reads. The drawers that rename, remove and add are tested beside them
   (views/settings/sheets/*.test.jsx); redeeming a code on the other device is
   views/AddDevice.test.jsx. */
const mocks = vi.hoisted(() => ({ api: null, sync: null }))
vi.mock('../store/useStore.js', () => {
  const snap = () => ({ sync: mocks.sync })
  const useStore = selector => (selector ? selector(snap()) : snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: vi.fn() })
  const useUI = selector => (selector ? selector(snap()) : snap())
  useUI.getState = snap
  return { useUI }
})
vi.mock('../lib/api.js', () => ({
  api: (...a) => mocks.api(...a),
  passwordLogin: vi.fn(), passwordRegister: vi.fn(), passwordResetRedeem: vi.fn(), webauthnOK: () => true, passkeyAssertion: vi.fn(), createPasskey: vi.fn(),
}))

const fail = (status, data) => Object.assign(new Error(data?.error || 'HTTP ' + status), { status, data })
const named = (name, e = new Error(name)) => Object.assign(e, { name })

describe('passkeyError', () => {
  it('words this feature’s refusals, and hands the proof refusals to the password sheet’s wording', () => {
    expect(passkeyError(named('InvalidStateError'))).toBe('This device already has a passkey for this profile.')
    expect(passkeyError(fail(409, { code: 'last-way-in' }))).toMatch(/only way in/)
    expect(passkeyError(fail(409, { code: 'passkey-limit' }))).toMatch(/as many passkeys/)
    expect(passkeyError(fail(409, { code: 'credential-exists' }))).toMatch(/already belongs to a profile/)
    expect(passkeyError(fail(403, { code: 'current-wrong' }))).toBe('Your current password is not right.')
    expect(passkeyError(fail(403, { code: 'passkey' }))).toBe('Your passkey could not be confirmed.')
  })
})

describe('listOf', () => {
  it('is the answer when it is a list, and null for a server from before the list existed', () => {
    const list = { passkeys: [], password: false, lastWayIn: true }
    expect(listOf(list)).toBe(list)
    expect(listOf({})).toBeNull()
    expect(listOf(null)).toBeNull()
  })
})

describe('usePasskeys', () => {
  let host, root, seen
  function Probe({ on }) { seen = usePasskeys(on); return null }
  beforeEach(() => {
    mocks.sync = { status: 'ok', lastSynced: 1 }
    mocks.api = vi.fn(async () => ({ passkeys: [{ id: 'k1' }], password: false, lastWayIn: true }))
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })
  afterEach(() => { act(() => root.unmount()); host.remove() })
  const settle = () => act(() => new Promise(r => setTimeout(r, 0)))

  it('asks only when switched on, and holds the list it got', async () => {
    act(() => root.render(<Probe on={false} />))
    await settle()
    expect(mocks.api).not.toHaveBeenCalled()
    expect(seen.st).toBeNull()
    act(() => root.render(<Probe on />))
    await settle()
    expect(mocks.api).toHaveBeenCalledWith('/api/account/passkeys')
    expect(seen.st.passkeys).toHaveLength(1)
  })

  it('a server without the list leaves it null; a refusal is an answer, not asked again on the next sync', async () => {
    mocks.api = vi.fn(async () => { throw fail(404, {}) })
    act(() => root.render(<Probe on />))
    await settle()
    expect(seen.st).toBeNull()
    mocks.sync = { status: 'ok', lastSynced: 2 }
    act(() => root.render(<Probe on />))
    await settle()
    expect(mocks.api).toHaveBeenCalledTimes(1)
  })

  it('a server that was down is asked again once the store hears from it', async () => {
    mocks.api = vi.fn(async () => { throw fail(502, {}) })
    act(() => root.render(<Probe on />))
    await settle()
    expect(mocks.api).toHaveBeenCalledTimes(1)
    mocks.api = vi.fn(async () => ({ passkeys: [], password: false, lastWayIn: true }))
    mocks.sync = { status: 'ok', lastSynced: 2 }
    act(() => root.render(<Probe on />))
    await settle()
    expect(mocks.api).toHaveBeenCalledTimes(1)
    expect(seen.st.passkeys).toEqual([])
  })
})
