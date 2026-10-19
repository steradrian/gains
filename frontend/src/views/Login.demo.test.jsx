// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Login from './Login.jsx'
import { buttons, cleanup, click, mount } from './login.test-util.jsx'

/* The demo build has no backend to sign in against: the only way in is the local guest profile. */
const mocks = vi.hoisted(() => {
  const state = { setGuest: vi.fn() }
  state.snapshot = () => ({
    config: null, S: {}, setUser: vi.fn(), adoptProfile: vi.fn(), setGuest: state.setGuest, loadConfig: vi.fn(),
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
  const snap = () => ({ toast: vi.fn(), openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('../lib/api.js', () => ({
  webauthnOK: () => true, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), bio: () => 'your fingerprint', passkeyError: () => '',
  api: vi.fn(), passkeyAssertion: vi.fn(), passwordLogin: vi.fn(), passwordRegister: vi.fn(), passwordResetRedeem: vi.fn(), createPasskey: vi.fn(),
}))
vi.mock('../lib/demo.js', () => ({ DEMO: true, REPO: 'https://example.invalid/gains' }))
vi.mock('../sheets.jsx', () => ({ askAddDeviceData: vi.fn(), confirmSheet: vi.fn() }))

afterEach(cleanup)

describe('Login in the demo build', () => {
  it('says it is a demo, what that means, and offers to start it', async () => {
    const page = mount(<Login />)
    expect(page.textContent).toContain('Live demo. Everything stays in this browser.')
    expect(page.textContent).toContain('This demo runs entirely in your browser on example data.')
    // No passkey, code or password here: there is no server to take them.
    expect(buttons(page)).toEqual(['Start the demo'])
    await click(page, 'Start the demo')
    expect(mocks.setGuest).toHaveBeenCalledWith(true)
  })

  it('links to self-hosting, in a new tab', () => {
    const link = mount(<Login />).querySelector('a[href="https://example.invalid/gains"]')
    expect(link.textContent).toBe('Self-host it in a minute →')
    expect(link.getAttribute('target')).toBe('_blank')
  })
})
