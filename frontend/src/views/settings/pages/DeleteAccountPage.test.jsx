// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DeleteAccountPage from './DeleteAccountPage.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* A3.0 to A3.2 Delete account, with the real lib/account-deletion.js over a mocked server: what the
   page lists comes from the profile (a line with no count is left out), Delete my account asks the
   server what the proof is and opens the confirm, and only the confirm's button runs the proof.
   Scheduled, it goes to the Settings root; refused, cancelled or failed, it says "Not confirmed"
   and nothing is deleted. */
const mocks = vi.hoisted(() => ({
  S: null, user: null, list: null, ctx: null, webauthn: true,
  api: vi.fn(), assert: vi.fn(), setUser: vi.fn(), popToRoot: vi.fn(), download: vi.fn(),
  sheets: [],
}))
vi.mock('../../../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S, user: mocks.user, setUser: mocks.setUser })
  const useStore = selector => (selector ? selector(snap()) : snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => {
  const snap = () => ({ openSheet: (render, opts) => { mocks.sheets.push({ render, opts }); return {} }, toast: vi.fn() })
  const useUI = selector => (selector ? selector(snap()) : snap())
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ Navigate: ({ to }) => <i data-redirect={to} /> }))
vi.mock('../../../lib/api.js', () => ({
  api: (...a) => mocks.api(...a), passkeyAssert: (...a) => mocks.assert(...a), webauthnOK: () => mocks.webauthn,
}))
vi.mock('../../../lib/mobile.js', () => ({ MOBILE: false }))
vi.mock('../../../lib/demo.js', () => ({ DEMO: false }))
vi.mock('../../../lib/use-tab-nav.js', () => ({ popToRoot: (...a) => mocks.popToRoot(...a) }))
vi.mock('../../../components/Passkeys.jsx', () => ({ usePasskeys: () => ({ st: mocks.list }) }))
vi.mock('../../../components/PasswordAuth.jsx', () => ({ passwordError: () => 'Your current password is not right.' }))
vi.mock('../use-settings-ctx.js', () => ({ useSettingsCtx: () => mocks.ctx }))
vi.mock('../sheets/download-sheet.jsx', () => ({ openDownloadSheet: (...a) => mocks.download(...a) }))
vi.mock('../../../ds/StagePage.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../ds/StagePageTitle.jsx', () => ({ default: ({ title, line }) => <><h1>{title}</h1><p className="line">{line}</p></> }))

const items = n => Array.from({ length: n }, (_, i) => ({ id: 'x' + i }))
const httpError = (status, data = {}) => Object.assign(new Error('HTTP ' + status), { status, data })
const OPTIONS = { cid: 'c1', options: { challenge: 'AAAA', allowCredentials: [] }, password: false }
const AT = '2026-10-29T12:00:00.000Z'
const answer = table => mocks.api.mockImplementation(async (path, o) => {
  const a = table[(o?.method || 'GET') + ' ' + path]
  if (a === undefined) throw new Error('unexpected ' + path)
  if (a instanceof Error) throw a
  return a
})
const deleteCalls = () => mocks.api.mock.calls.filter(([p]) => p === '/api/account/delete')

let host, root
const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
const mount = () => act(() => root.render(<DeleteAccountPage />))
const rows = () => [...host.querySelectorAll('.g-glist-row')].map(r => [r.querySelector('b').textContent, r.querySelector('.g-glist-body > span')?.textContent || ''])
const headings = () => [...host.querySelectorAll('.g-ssec h2')].map(h => h.textContent)
const deleteButton = () => [...host.querySelectorAll('button')].find(b => b.textContent.includes('Delete my account'))
// The element the last openSheet drew, and its props.
const lastSheet = () => mocks.sheets.at(-1).render(vi.fn())
const tapDelete = async () => { await act(async () => { deleteButton().click() }); await settle() }

beforeEach(() => {
  mocks.S = { workouts: items(212), routines: items(6), week: { 1: 'r1' }, bodyweight: items(64), measurements: items(41), customEx: [] }
  mocks.user = { id: 'u1', name: 'Adrian' }
  mocks.list = { passkeys: [{ id: 'k1' }, { id: 'k2' }], password: false }
  mocks.ctx = { nutrition: false, hasMedia: false, pwOn: false }
  mocks.webauthn = true
  mocks.sheets = []
  for (const f of [mocks.api, mocks.assert, mocks.setUser, mocks.popToRoot, mocks.download]) f.mockReset()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('A3.0 what goes', () => {
  it('counts what this profile holds, and leaves out a line the app has no count for', () => {
    mount()
    expect(host.querySelector('h1').textContent).toBe('Delete account')
    expect(host.querySelector('.line').textContent).toBe('Everything below goes, after 7 days')
    expect(headings()).toEqual(['What goes', 'What happens', 'Before you go'])
    expect(rows().slice(0, 4)).toEqual([
      ['Training', '212 workouts, 6 routines, your Plan'],
      ['Body', '64 weigh-ins, 41 measurements'],
      ['Sign-in', '2 passkeys'],
      ['Settings', 'Your settings and gym setup'],
    ])
    expect(host.textContent).not.toMatch(/Photos|devices|Food|Invites/)
  })

  it('an empty profile lists only what it has; no passkey list yet, no Sign-in line', () => {
    mocks.S = { workouts: [], routines: [], week: {} }
    mocks.list = null
    mount()
    expect(rows().filter(([t]) => ['Training', 'Body', 'Sign-in'].includes(t))).toEqual([])
  })

  it('says the food diary is not part of it when nutrition is on', () => {
    mocks.ctx = { ...mocks.ctx, nutrition: true }
    mount()
    expect(host.textContent).toContain('Your food diary lives with NutriTrace and is not deleted with your account.')
  })

  it('what happens: seven days, sync pauses, then gone; Download my data opens its drawer', () => {
    mount()
    const happens = rows().map(([t]) => t)
    expect(happens).toEqual(expect.arrayContaining(['7 days to change your mind', 'Sync pauses', 'After 7 days', 'Download my data']))
    act(() => [...host.querySelectorAll('.g-glist-row')].find(r => r.textContent.includes('Download my data')).click())
    expect(mocks.download).toHaveBeenCalledTimes(1)
    expect(host.textContent).toContain('Gains asks for your passkey to make sure it’s you.')
  })

  it('a guest has nothing to delete; a deletion already pending is the root\'s banner', () => {
    mocks.user = null
    mount()
    expect(host.querySelector('[data-redirect]').getAttribute('data-redirect')).toBe('/me/account')
    mocks.user = { id: 'u1', name: 'Adrian', deletion: { at: AT } }
    act(() => root.render(<DeleteAccountPage key="2" />))
    expect(host.querySelector('[data-redirect]').getAttribute('data-redirect')).toBe('/me')
  })
})

describe('A3.1 and A3.2: the confirm, the proof, and nothing without them', () => {
  it('Delete my account asks for the options and opens the confirm; nothing is deleted yet', async () => {
    answer({ 'POST /api/account/delete/options': OPTIONS })
    mount()
    await tapDelete()
    expect(mocks.assert).not.toHaveBeenCalled()
    expect(deleteCalls()).toHaveLength(0)
    const confirm = lastSheet()
    expect(confirm.props.title).toBe('Delete your account?')
    expect(confirm.props.confirmLabel).toBe('Delete with passkey')
    expect(confirm.props.body).toMatch(/^Gains will ask for your passkey\. Your account is then scheduled for deletion on .+; until then, signing in lets you cancel\.$/)
  })

  it('Cancel on the confirm deletes nothing', async () => {
    answer({ 'POST /api/account/delete/options': OPTIONS })
    mount()
    await tapDelete()
    act(() => lastSheet().props.onCancel())
    await settle()
    expect(mocks.assert).not.toHaveBeenCalled()
    expect(deleteCalls()).toHaveLength(0)
  })

  it('confirmed with the passkey: scheduled, the user carries it, and the root (with its banner) opens', async () => {
    answer({ 'POST /api/account/delete/options': OPTIONS, 'POST /api/account/delete': { ok: true, at: AT, requestedAt: '2026-10-22T12:00:00.000Z' } })
    mocks.assert.mockResolvedValue({ id: 'k1' })
    mount()
    await tapDelete()
    await act(async () => { lastSheet().props.onConfirm() })
    await settle()
    expect(mocks.assert).toHaveBeenCalledWith(OPTIONS.options, expect.anything())
    expect(deleteCalls()).toHaveLength(1)
    expect(mocks.setUser).toHaveBeenCalledWith(expect.objectContaining({ deletion: { at: AT, requestedAt: '2026-10-22T12:00:00.000Z' } }))
    expect(mocks.popToRoot).toHaveBeenCalledWith('me')
  })

  it('the prompt cancelled: Not confirmed, Try again, and nothing was sent or changed', async () => {
    answer({ 'POST /api/account/delete/options': OPTIONS })
    mocks.assert.mockRejectedValue(Object.assign(new Error('no'), { name: 'NotAllowedError' }))
    mount()
    await tapDelete()
    await act(async () => { lastSheet().props.onConfirm() })
    await settle()
    expect(deleteCalls()).toHaveLength(0)
    expect(mocks.setUser).not.toHaveBeenCalled()
    expect(mocks.popToRoot).not.toHaveBeenCalled()
    const failed = lastSheet()
    expect(failed.props.reason).toBe('cancelled')
    expect(typeof failed.props.onRetry).toBe('function')
  })

  it('the proof refused (403): Not confirmed, nothing deleted; Try again runs a fresh proof', async () => {
    answer({ 'POST /api/account/delete/options': OPTIONS, 'POST /api/account/delete': httpError(403, { code: 'passkey' }) })
    mocks.assert.mockResolvedValue({ id: 'k1' })
    mount()
    await tapDelete()
    await act(async () => { lastSheet().props.onConfirm() })
    await settle()
    expect(lastSheet().props.reason).toBe('refused')
    expect(mocks.setUser).not.toHaveBeenCalled()
    expect(mocks.popToRoot).not.toHaveBeenCalled()
    const optionsBefore = mocks.api.mock.calls.filter(([p]) => p === '/api/account/delete/options').length
    await act(async () => { lastSheet().props.onRetry() })
    await settle()
    expect(mocks.api.mock.calls.filter(([p]) => p === '/api/account/delete/options').length).toBe(optionsBefore + 1)
    expect(mocks.assert).toHaveBeenCalledTimes(2)
  })

  it('the last admin is told so before any confirm, with no Try again', async () => {
    answer({ 'POST /api/account/delete/options': httpError(409, { code: 'last-admin' }) })
    mount()
    await tapDelete()
    const sheet = lastSheet()
    expect(sheet.props.reason).toBe('last-admin')
    expect(sheet.props.onRetry).toBeNull()
    expect(mocks.sheets).toHaveLength(1)   // no confirm was opened
  })

  it('already scheduled (another device): straight to the root', async () => {
    answer({ 'POST /api/account/delete/options': httpError(409, { code: 'deletion-scheduled', at: AT }), 'GET /api/me': { user: { ...mocks.user, deletion: { at: AT } } } })
    mount()
    await tapDelete()
    expect(mocks.sheets).toHaveLength(0)
    expect(mocks.popToRoot).toHaveBeenCalledWith('me')
  })

  it('a password-only profile gets the password confirm instead', async () => {
    answer({ 'POST /api/account/delete/options': { password: true } })
    mocks.list = { passkeys: [], password: true }
    mocks.ctx = { ...mocks.ctx, pwOn: true }
    mount()
    expect(host.textContent).toContain('Gains asks for your password to make sure it’s you.')
    await tapDelete()
    expect(lastSheet().props.day).toBeTruthy()
    expect(lastSheet().props.onScheduled).toBeTypeOf('function')
    expect(mocks.assert).not.toHaveBeenCalled()
  })
})
