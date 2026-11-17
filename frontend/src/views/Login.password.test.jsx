// @vitest-environment happy-dom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login.jsx'
import { button, buttons, cleanup, click, mount } from './login.test-util.jsx'

/* The sign-in screen with password sign-in (#118). Only an instance that advertises
   `password_login` shows any of it; there, a browser without passkey support finally has a way
   in instead of being told to stay local, and creating a profile can use a password. */
const mocks = vi.hoisted(() => {
  const state = { webauthn: true, config: null, sheets: [] }
  state.snapshot = () => ({
    config: state.config, S: {},
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
  return { useUI }
})
vi.mock('../lib/api.js', () => ({
  webauthnOK: () => mocks.webauthn, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), BIO: 'your fingerprint', bio: () => 'your fingerprint',
  api: vi.fn(), passkeyAssertion: vi.fn(), passwordLogin: vi.fn(), passwordRegister: vi.fn(), passwordResetRedeem: vi.fn(),
  createPasskey: vi.fn(), passkeyError: (e, fallback) => e?.message || fallback,
}))
vi.mock('../lib/demo.js', () => ({ DEMO: false, REPO: 'https://example.invalid' }))
vi.mock('../sheets.jsx', () => ({ askAddDeviceData: vi.fn(), confirmSheet: vi.fn() }))

beforeEach(() => { mocks.webauthn = true; mocks.config = null; mocks.sheets.length = 0 })
afterEach(cleanup)

describe('Login with password sign-in', () => {
  it('an instance without it offers no password, and says nothing about one', () => {
    const page = mount(<Login />)
    expect(buttons(page)).not.toContain('Sign in with password')
    mocks.webauthn = false
    const noPasskeys = mount(<Login />)
    expect(noPasskeys.querySelector('h1').textContent).toBe('This browser can’t use passkeys')
    expect(buttons(noPasskeys)).not.toContain('Sign in with password')
  })

  it('next to passkeys it is a plain link under the buttons, and the drawer offers the passkey back', async () => {
    mocks.config = { password_login: true, allow_guest: true }
    const page = mount(<Login />)
    expect(buttons(page).slice(0, 3)).toEqual(['Sign in with passkey', 'Use a code from your other device', 'Sign in with password'])
    await click(page, 'Sign in with password')
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(sheet.querySelector('h3').textContent).toBe('Sign in with password')
    expect(sheet.querySelector('input[autocomplete="current-password"]')).toBeTruthy()
    expect(buttons(sheet)).toContain('Sign in with passkey')
  })

  it('a browser without passkeys gets a way in instead of "stay local"', async () => {
    mocks.webauthn = false
    mocks.config = { password_login: true, allow_guest: false }
    const page = mount(<Login />)
    expect(page.querySelector('h1').textContent).toBe('This browser can’t use passkeys')
    expect(page.textContent).toContain('Open Gains in Safari or Chrome instead.')
    expect(buttons(page)).toEqual(['Copy link to open in your browser', 'Sign in with password', 'Create new profile'])
    // Creating a profile here can only mean a password: no passkey/password choice to make.
    await click(page, 'Create new profile')
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(sheet.querySelector('.seg')).toBeNull()
    expect(sheet.querySelector('input[placeholder="Repeat the password"]')).toBeTruthy()
    expect(buttons(sheet)).toContain('Create profile')
  })

  it('a browser without passkeys, without passwords and without guests is told to use another one', () => {
    mocks.webauthn = false
    mocks.config = { allow_guest: false, invite_only: true }
    const page = mount(<Login />)
    expect(buttons(page)).toEqual(['Copy link to open in your browser'])
    expect(page.querySelector('h1').textContent).toBe('This browser can’t use passkeys')
  })

  it('where both work, creating a profile starts on the passkey and switches to a password', async () => {
    mocks.config = { password_login: true }
    const page = mount(<Login />)
    await click(page, 'Create new profile')
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(buttons(sheet)).toContain('Create passkey')
    await click(sheet, 'Password')
    expect(buttons(sheet)).toContain('Create profile')
    expect(sheet.querySelector('input[autocomplete="new-password"]')).toBeTruthy()
  })

  it('an invite-only instance draws no Create button, password or not, and the invite sheet is unreachable', () => {
    mocks.config = { password_login: true, invite_only: true }
    const page = mount(<Login />)
    expect(buttons(page)).not.toContain('Create new profile')
    expect(buttons(page)).toContain('Sign in with password')
    expect(button(page, 'Create new profile')).toBeUndefined()
  })
})
