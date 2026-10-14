// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Admin from './Admin.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* "Lost passkey" in a user's drill-down: there only when the server runs with ADMIN_RECOVERY=1
   (`admin_recovery` in /api/config), honest about the lost passkey still working, and never
   saying "Copied" of a one-time code the clipboard refused. */
const mocks = vi.hoisted(() => ({ answers: {}, sheets: [], posts: [], confirm: vi.fn(), toast: vi.fn(), copyText: vi.fn(), config: {}, refreshConfig: vi.fn() }))
vi.mock('../lib/api.js', () => ({
  api: (path, init) => {
    if (init?.method === 'POST') mocks.posts.push({ path, body: JSON.parse(init.body) })
    const key = path.split('?')[0]
    return key in mocks.answers ? Promise.resolve(mocks.answers[key]) : Promise.reject(new Error('not found'))
  }
}))
vi.mock('../lib/clipboard.js', () => ({ copyText: (...a) => mocks.copyText(...a) }))
vi.mock('../store/useStore.js', () => {
  const snap = () => ({ user: { id: 'adm', name: 'Admin', admin: true }, S: {}, config: mocks.config, refreshConfig: mocks.refreshConfig })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: (...a) => mocks.toast(...a), openSheet: (render, opts) => mocks.sheets.push({ render, opts }) })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: (...a) => mocks.confirm(...a) }))
vi.mock('./AdminCoach.jsx', () => ({ default: () => null }))

const mounted = []
function render(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(el))
  return host
}
const settle = () => act(() => new Promise(r => setTimeout(r, 0)))
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent === text)

const CODE = 'K7WQ-2MZP-4HXA'
async function openMallory() {
  const page = render(<Admin />)
  await settle()
  act(() => [...page.querySelectorAll('.item')].find(el => el.textContent.includes('Mallory')).click())
  const sheet = render(mocks.sheets.at(-1).render(() => {}))
  await settle()
  return sheet
}
// Through the confirm, to the locked sheet that shows the code once.
async function issue() {
  const sheet = await openMallory()
  act(() => button(sheet, 'Lost passkey').click())
  const opts = mocks.confirm.mock.calls[0][0]
  const before = mocks.sheets.length
  await act(async () => { await opts.onConfirm() })
  await settle()
  return { opts, shown: render(mocks.sheets.slice(before).find(s => s.opts?.locked).render(() => {})) }
}

beforeEach(() => {
  document.body.innerHTML = ''
  mocks.sheets.length = 0
  mocks.posts.length = 0
  mocks.confirm.mockClear()
  mocks.toast.mockClear()
  mocks.refreshConfig.mockClear()
  mocks.copyText.mockReset()
  mocks.config = { admin_recovery: true }
  mocks.answers = {
    '/api/admin/users': { users: [{ id: 'u1', name: 'Mallory', workouts: 0, lastSync: null, disabled: false }], invite_only: false },
    '/api/admin/invites': { invites: [] },
    '/api/admin/audit': { events: [], total: 0, enabled: true, retention: { days: 90 }, ip_mode: 'off' },
    '/api/admin/user': {
      user: { id: 'u1', name: 'Mallory', created: '2026-09-01T00:00:00Z', disabled: false, admin: false },
      unit: 'kg', lastSync: null, routines: [], bodyweight: [], workouts: []
    },
    '/api/admin/user/recovery-link': { ok: true, name: 'Mallory', code: CODE, link: 'x', expires: Date.now() + 600000 },
  }
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('Admin → Lost passkey', () => {
  it('is not there unless the server offers it, and the page asks the server again on open', async () => {
    mocks.config = {}
    const sheet = await openMallory()
    expect(button(sheet, 'Disable account')).toBeTruthy()
    expect(button(sheet, 'Lost passkey')).toBeUndefined()
    expect(mocks.refreshConfig).toHaveBeenCalled()
  })

  it('says the lost passkey keeps working until it is removed, then shows the code once', async () => {
    const sheet = await openMallory()
    expect(sheet.textContent).toMatch(/lost passkey still works until they remove it/)
    const { opts, shown } = await issue()
    expect(opts.message).toMatch(/lost passkey itself keeps working until they remove it/)
    expect(opts.message).not.toMatch(/signs them out everywhere/i)
    expect(mocks.posts).toEqual([{ path: '/api/admin/user/recovery-link', body: { id: 'u1' } }])
    expect(shown.textContent).toContain(CODE)
    expect(shown.textContent).toMatch(/until they do, it still signs in/)
  })

  it('says "Copied" only when the clipboard took it, and otherwise selects the text to copy by hand', async () => {
    const { shown } = await issue()
    mocks.copyText.mockResolvedValueOnce(true)
    await act(async () => { button(shown, CODE).click() })
    expect(mocks.toast).toHaveBeenLastCalledWith('Copied')
    expect(shown.querySelector('input')).toBeNull()

    mocks.copyText.mockResolvedValueOnce(false)
    await act(async () => { button(shown, 'Copy link').click() })
    expect(mocks.toast).not.toHaveBeenLastCalledWith('Copied')
    expect(mocks.toast.mock.lastCall[0]).toMatch(/Could not copy/)
    const field = shown.querySelector('input')
    expect(field.value).toBe(mocks.copyText.mock.lastCall[0])
    expect(field.value).toContain('link=')
    expect(field.readOnly).toBe(true)
  })
})
