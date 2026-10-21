// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login.jsx'
import { alertText, button, buttons, cleanup, click, mount, settle } from './login.test-util.jsx'

/* The sign-in screen on the stage: S0.0 ready, S0.1 waiting for the passkey, S0.2 not confirmed,
   S0.3 its Having-trouble drawer, S0.10 a browser without passkeys; and the ways in the boards do
   not draw (guest, open registration). The API, the store and the passkey prompt are stand-ins;
   what a tap does and what the screen shows next is the point. */
const mocks = vi.hoisted(() => {
  const state = { webauthn: true, config: null, sheets: [], nav: vi.fn(), toast: vi.fn(), copyText: vi.fn(async () => true) }
  state.setUser = vi.fn()
  state.adoptProfile = vi.fn(async () => ({}))
  state.setGuest = vi.fn()
  state.passkeyLogin = vi.fn()
  state.snapshot = () => ({
    config: state.config, S: {}, user: null, linkCode: null,
    setUser: state.setUser, adoptProfile: state.adoptProfile, setGuest: state.setGuest, loadConfig: vi.fn(async () => state.config),
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
  const snap = () => ({ toast: (...a) => mocks.toast(...a), openSheet: render => { mocks.sheets.push(render); return {} } })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI, drawerFlow: open => open() }
})
vi.mock('../lib/api.js', () => ({
  webauthnOK: () => mocks.webauthn, passkeyLogin: (...a) => mocks.passkeyLogin(...a), passkeyRegister: vi.fn(), BIO: 'your fingerprint', bio: () => 'your fingerprint',
  api: vi.fn(), passkeyAssertion: vi.fn(), passwordLogin: vi.fn(), passwordRegister: vi.fn(), passwordResetRedeem: vi.fn(),
  createPasskey: vi.fn(),
  passkeyError: (e, fallback) => (e?.data?.code === 'disabled' ? 'This account has been disabled.' : e?.message || fallback),
}))
vi.mock('../lib/nav.js', () => ({
  nav: (...a) => mocks.nav(...a), onSheetEntry: () => false,
  closeThen: (close, go) => { close?.(); go(false) },
}))
vi.mock('../lib/clipboard.js', () => ({ copyText: (...a) => mocks.copyText(...a) }))
vi.mock('../lib/demo.js', () => ({ DEMO: false, REPO: 'https://example.invalid' }))
vi.mock('../sheets.jsx', () => ({ askAddDeviceData: vi.fn(), confirmSheet: vi.fn() }))

const named = (name, e = new Error(name)) => Object.assign(e, { name })
// A passkey prompt that stays open until the test answers it.
function openPrompt() {
  const p = {}
  mocks.passkeyLogin.mockImplementationOnce(({ signal } = {}) => new Promise((resolve, reject) => {
    p.signal = signal
    p.resolve = resolve
    p.reject = reject
    signal?.addEventListener('abort', () => reject(named('AbortError')))
  }))
  return p
}
const alertEl = page => page.querySelector('[role="alert"]')

beforeEach(() => {
  mocks.webauthn = true
  mocks.config = null
  mocks.sheets.length = 0
  for (const f of [mocks.nav, mocks.toast, mocks.copyText, mocks.setUser, mocks.adoptProfile, mocks.setGuest, mocks.passkeyLogin]) f.mockReset()
  mocks.adoptProfile.mockResolvedValue({})
  mocks.copyText.mockResolvedValue(true)
})
afterEach(cleanup)

describe('S0.0 Sign in', () => {
  it('welcomes back, with the passkey first, then a code from another device', () => {
    const page = mount(<Login />)
    expect(page.querySelector('h1').textContent).toBe('Welcome back')
    expect(page.textContent).toContain('Your training and your food in one place.')
    expect(page.querySelector('[aria-label="Gains"]')).toBeTruthy()
    expect(buttons(page).slice(0, 2)).toEqual(['Sign in with passkey', 'Use a code from your other device'])
    expect(alertEl(page)).toBeNull()
  })

  it('on an invite-only instance has no Create button and says to open the invite link', () => {
    mocks.config = { invite_only: true }
    const page = mount(<Login />)
    expect(buttons(page)).not.toContain('Create new profile')
    expect(page.textContent).toContain('Gains is invite-only. New here? Open the invite link a friend sent you.')
  })

  it('where registration is open, keeps a plain Create new profile link that opens the sign-up sheet', async () => {
    mocks.config = { invite_only: false }
    const page = mount(<Login />)
    expect(page.textContent).not.toContain('invite-only')
    await click(page, 'Create new profile')
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(sheet.querySelector('h3').textContent).toBe('Create your profile')
  })

  it('offers Continue without account where guests are allowed, and takes the guest in', async () => {
    mocks.config = { allow_guest: true }
    const page = mount(<Login />)
    await click(page, 'Continue without account')
    expect(mocks.setGuest).toHaveBeenCalledWith(true)
    mocks.config = { allow_guest: false }
    expect(buttons(mount(<Login />))).not.toContain('Continue without account')
  })
})

describe('S0.1 Waiting for your passkey', () => {
  it('the button shows a spinner and says what it waits for, with Cancel under it; the other ways are put away', async () => {
    const prompt = openPrompt()
    const page = mount(<Login />)
    await click(page, 'Sign in with passkey')
    const waiting = button(page, 'Waiting for your passkey')
    expect(waiting.getAttribute('aria-busy')).toBe('true')
    expect(waiting.querySelector('.g-spin')).toBeTruthy()
    expect(buttons(page)).toEqual(['Waiting for your passkey', 'Cancel'])
    expect(prompt.signal).toBeInstanceOf(AbortSignal)
  })

  it('a second tap while it waits asks for no second prompt', async () => {
    openPrompt()
    const page = mount(<Login />)
    await click(page, 'Sign in with passkey')
    act(() => button(page, 'Waiting for your passkey').click())
    expect(mocks.passkeyLogin).toHaveBeenCalledTimes(1)
  })

  it('Cancel calls the prompt off and lands on S0.2', async () => {
    const prompt = openPrompt()
    const page = mount(<Login />)
    await click(page, 'Sign in with passkey')
    await click(page, 'Cancel')
    expect(prompt.signal.aborted).toBe(true)
    expect(alertText(page)).toBe('Your passkey could not be confirmed.Having trouble?')
    expect(mocks.setUser).not.toHaveBeenCalled()
  })

  it('a prompt that answers after Cancel changes nothing', async () => {
    const prompt = openPrompt()
    const page = mount(<Login />)
    await click(page, 'Sign in with passkey')
    await click(page, 'Cancel')
    prompt.resolve({ id: 'u1', name: 'Ana' })
    await settle()
    expect(mocks.setUser).not.toHaveBeenCalled()
    expect(alertEl(page)).toBeTruthy()
  })

  it('signs in like it always did: the user adopted with their data, then a welcome', async () => {
    mocks.passkeyLogin.mockResolvedValue({ id: 'u1', name: 'Ana' })
    const page = mount(<Login />)
    await click(page, 'Sign in with passkey')
    expect(mocks.setUser).toHaveBeenCalledWith({ id: 'u1', name: 'Ana' }, { adopt: true })
    expect(mocks.adoptProfile).toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith('Welcome back, Ana')
  })
})

describe('S0.2 Passkey not confirmed', () => {
  it('a prompt the person closed shows the alert with Having trouble?, then Try again, a code, and the password', async () => {
    mocks.config = { password_login: true, allow_guest: false }
    mocks.passkeyLogin.mockRejectedValue(named('NotAllowedError'))
    const page = mount(<Login />)
    await click(page, 'Sign in with passkey')
    expect(alertText(page)).toBe('Your passkey could not be confirmed.Having trouble?')
    expect(document.activeElement).toBe(alertEl(page))
    expect(buttons(page)).toEqual(['Having trouble?', 'Try again', 'Use a code from your other device', 'Sign in with password', 'Create new profile'])
    expect(page.textContent).not.toContain('invite-only')
  })

  it('Try again asks for the passkey again, and signs in when it works', async () => {
    mocks.passkeyLogin.mockRejectedValueOnce(named('NotAllowedError')).mockResolvedValueOnce({ id: 'u1', name: 'Ana' })
    const page = mount(<Login />)
    await click(page, 'Sign in with passkey')
    await click(page, 'Try again')
    expect(mocks.passkeyLogin).toHaveBeenCalledTimes(2)
    expect(mocks.setUser).toHaveBeenCalledWith({ id: 'u1', name: 'Ana' }, { adopt: true })
  })

  it('a second failure is a new alert, which takes focus again', async () => {
    mocks.passkeyLogin.mockRejectedValue(named('NotAllowedError'))
    const page = mount(<Login />)
    await click(page, 'Sign in with passkey')
    const first = alertEl(page)
    document.activeElement.blur()
    await click(page, 'Try again')
    expect(alertEl(page)).not.toBe(first)
    expect(document.activeElement).toBe(alertEl(page))
  })

  it('an account the server has disabled says so in that line', async () => {
    mocks.passkeyLogin.mockRejectedValue(Object.assign(new Error('disabled'), { data: { code: 'disabled' } }))
    const page = mount(<Login />)
    await click(page, 'Sign in with passkey')
    expect(alertText(page)).toBe('This account has been disabled.Having trouble?')
    expect(mocks.setUser).not.toHaveBeenCalled()
  })

  it('a code from another device goes to the Add this device screen', async () => {
    mocks.passkeyLogin.mockRejectedValue(named('NotAllowedError'))
    const page = mount(<Login />)
    await click(page, 'Sign in with passkey')
    await click(page, 'Use a code from your other device')
    expect(mocks.nav).toHaveBeenCalledWith('/add-device', undefined)
  })
})

describe('S0.3 Having trouble?', () => {
  const open = async config => {
    mocks.config = config
    mocks.passkeyLogin.mockRejectedValue(named('NotAllowedError'))
    const page = mount(<Login />)
    await click(page, 'Sign in with passkey')
    await click(page, 'Having trouble?')
    const close = vi.fn()
    return { page, close, sheet: mount(mocks.sheets.at(-1)(close)) }
  }

  it('says what a passkey needs and offers the code', async () => {
    const { sheet } = await open(null)
    expect(sheet.querySelector('h3').textContent).toBe('Having trouble?')
    expect(sheet.textContent).toContain('Passkeys need Safari or Chrome, with Face ID, Touch ID or a screen lock turned on.')
    expect(sheet.textContent).toContain('Your other device gets you in, then this one gets its own passkey')
    // No password where the instance has none.
    expect(sheet.textContent).not.toContain('If you set one in Settings › Account')
  })

  it('the code row closes the drawer and goes to the Add this device screen', async () => {
    const { sheet, close } = await open(null)
    act(() => sheet.querySelector('.g-glist-row').click())
    expect(close).toHaveBeenCalled()
    expect(mocks.nav).toHaveBeenCalledWith('/add-device', undefined)
  })

  it('where passwords are on, a second row opens the password drawer, which slides in over this one', async () => {
    const { sheet, close } = await open({ password_login: true })
    const rows = [...sheet.querySelectorAll('.g-glist-row')]
    expect(rows).toHaveLength(2)
    expect(rows[1].textContent).toContain('If you set one in Settings › Account')
    const before = mocks.sheets.length
    act(() => rows[1].click())
    // the drawer under it is not closed ahead of it: the panel's back returns to it
    expect(close).not.toHaveBeenCalled()
    expect(mocks.sheets).toHaveLength(before + 1)
    expect(mount(mocks.sheets.at(-1)(() => {})).querySelector('h3').textContent).toBe('Sign in with password')
  })

  it('Close, and the X, just send it away', async () => {
    const { sheet, close } = await open(null)
    act(() => button(sheet, 'Close').click())
    act(() => sheet.querySelector('button[aria-label="Close"]').click())
    expect(close).toHaveBeenCalledTimes(2)
  })
})

describe('S0.10 This browser can’t use passkeys', () => {
  it('says so, offers the link to open elsewhere, and copies the app’s address', async () => {
    mocks.webauthn = false
    const page = mount(<Login />)
    expect(page.querySelector('h1').textContent).toBe('This browser can’t use passkeys')
    expect(buttons(page)[0]).toMatch(/^Copy link to open in/)
    expect(page.querySelector('.g-ill')).toBeTruthy()
    await click(page, buttons(page)[0])
    expect(mocks.copyText).toHaveBeenCalledWith(window.location.origin + window.location.pathname)
    expect(mocks.toast).toHaveBeenCalledWith('Link copied')
  })

  it('says when the link could not be copied', async () => {
    mocks.webauthn = false
    mocks.copyText.mockResolvedValue(false)
    const page = mount(<Login />)
    await click(page, buttons(page)[0])
    expect(mocks.toast).toHaveBeenCalledWith('Could not copy the link')
  })

  it('keeps the guest entrance where there is one', async () => {
    mocks.webauthn = false
    mocks.config = { allow_guest: true }
    const page = mount(<Login />)
    expect(buttons(page)).toContain('Continue without account')
    await click(page, 'Continue without account')
    expect(mocks.setGuest).toHaveBeenCalledWith(true)
  })
})
