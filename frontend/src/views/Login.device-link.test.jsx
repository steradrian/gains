// @vitest-environment happy-dom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login.jsx'
import { button, buttons, cleanup, click, mount } from './login.test-util.jsx'

/* The sign-in screen's way in for a device whose person already has a profile elsewhere (#95):
   a code from the signed-in device gives this one a passkey of its own, instead of "Create new
   profile" making a second, empty one. Only where this browser can make a passkey. The screen
   that redeems the code is views/AddDevice.jsx; here, only that the way there is offered. */
const mocks = vi.hoisted(() => {
  const state = { webauthn: true, config: null, sheets: [], nav: vi.fn() }
  state.snapshot = () => ({
    config: state.config, S: {}, user: null, linkCode: null,
    setUser: vi.fn(), adoptProfile: vi.fn(), setGuest: vi.fn(), loadConfig: vi.fn(async () => state.config),
    pushState: vi.fn(), pullState: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, hasData: () => false }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: render => { mocks.sheets.push(render); return {} } })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI, drawerFlow: open => open() }
})
vi.mock('../lib/api.js', () => ({
  webauthnOK: () => mocks.webauthn, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), BIO: 'your fingerprint', bio: () => 'your fingerprint',
  api: vi.fn(), passkeyAssertion: vi.fn(), passwordLogin: vi.fn(), passwordRegister: vi.fn(), passwordResetRedeem: vi.fn(),
  createPasskey: vi.fn(), passkeyError: (e, fallback) => e?.message || fallback,
}))
vi.mock('../lib/nav.js', () => ({
  nav: (...a) => mocks.nav(...a), onSheetEntry: () => false,
  closeThen: (close, go) => { close?.(); go(false) },
}))
vi.mock('../lib/demo.js', () => ({ DEMO: false, REPO: 'https://example.invalid' }))
vi.mock('../sheets.jsx', () => ({ askAddDeviceData: vi.fn(), confirmSheet: vi.fn() }))

beforeEach(() => { mocks.webauthn = true; mocks.config = null; mocks.sheets.length = 0; mocks.nav.mockClear() })
afterEach(cleanup)

describe('Login: a code from another device', () => {
  it('sits right under the passkey button where passkeys work, and goes to the Add this device screen', async () => {
    mocks.config = { allow_guest: true }
    const page = mount(<Login />)
    const all = buttons(page)
    expect(all.indexOf('Use a code from your other device')).toBe(all.indexOf('Sign in with passkey') + 1)
    await click(page, 'Use a code from your other device')
    expect(mocks.nav).toHaveBeenCalledWith('/add-device', undefined)
  })

  it('is not offered in a browser that cannot make a passkey, with or without passwords', () => {
    mocks.webauthn = false
    expect(buttons(mount(<Login />))).not.toContain('Use a code from your other device')
    mocks.config = { password_login: true }
    expect(buttons(mount(<Login />))).not.toContain('Use a code from your other device')
  })

  it('has a button, not a link, so the keyboard and a screen reader reach it', () => {
    const page = mount(<Login />)
    expect(button(page, 'Use a code from your other device').tagName).toBe('BUTTON')
  })
})
