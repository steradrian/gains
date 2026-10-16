// @vitest-environment happy-dom
// Admin › Invite codes: an invite is shared as the full join link, each open one shows when it
// expires, and every string on the card goes through t().
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Admin from './Admin.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ answers: {}, toasts: [], copied: [], copyOk: true, confirm: null, posts: [], bodies: [], sheets: [] }))
vi.mock('../lib/api.js', () => ({
  remoteServer: () => '',
  api: (path, init) => {
    if (init?.method === 'POST') { mocks.posts.push(path); mocks.bodies.push(JSON.parse(init.body)) }
    if (path === '/api/admin/invites/new') {
      if (mocks.newError) return Promise.reject(new Error(mocks.newError))
      if (mocks.newPending) return new Promise(r => { mocks.release = () => r({ invite: { code: 'NEWCODE1' } }) })
      return Promise.resolve({ invite: { code: 'NEWCODE1' } })
    }
    const key = path.split('?')[0]
    return key in mocks.answers ? Promise.resolve(mocks.answers[key]) : Promise.reject(new Error('not found'))
  }
}))
vi.mock('../lib/clipboard.js', () => ({
  copyText: async text => { mocks.copied.push(text); return mocks.copyOk }
}))
vi.mock('../store/useStore.js', () => {
  const snap = () => ({ user: { id: 'adm', name: 'Admin', admin: true }, S: {} })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: m => mocks.toasts.push(m), openSheet: r => mocks.sheets.push(r) })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: opts => { mocks.confirm = opts } }))
vi.mock('./AdminCoach.jsx', () => ({ default: () => null }))

const NOW = Date.parse('2026-10-16T12:00:00Z')
const iso = days => new Date(NOW + days * 86400000).toISOString()

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
const click = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
const flush = () => act(() => new Promise(r => setTimeout(r, 0)))

beforeEach(() => {
  document.body.innerHTML = ''
  Object.assign(mocks, { toasts: [], copied: [], copyOk: true, confirm: null, posts: [], bodies: [], sheets: [], newError: '', newPending: false, closed: false })
  mocks.answers = {
    '/api/admin/users': { users: [], invite_only: true },
    '/api/admin/audit': { rows: [] },
    '/api/admin/invites/revoke': { ok: true },
    '/api/admin/invites': {
      invite_only: true,
      invites: [
        { code: 'OPEN0001', status: 'valid', expiresAt: iso(9.5) },
        { code: 'OPEN0002', status: 'valid', expiresAt: iso(0.2) },
        { code: 'OLD00003', status: 'expired', expiresAt: iso(-1) },
        { code: 'NOTIME04', status: 'valid' },
        { code: 'NAMED006', status: 'valid', name: 'Mum', note: 'for Sunday lunch', expiresAt: iso(5) },
        { code: 'USED0005', status: 'used', usedBy: 'u1', usedByName: 'Mallory', expiresAt: iso(3) }
      ]
    }
  }
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  delete navigator.share
  vi.useRealTimers()
})

async function mount() {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  const page = render(<Admin />)
  await settle()
  return page
}
const rowOf = (page, code) => [...page.querySelectorAll('.adm-inv-row')].find(r => r.textContent.includes(code))
const btn = (row, label) => row.querySelector(`button[aria-label="${label}"]`)

describe('Invites card', () => {
  it('copies the full join link, not the bare code, where there is no share sheet', async () => {
    const page = await mount()
    click(btn(rowOf(page, 'OPEN0001'), 'Copy invite link'))
    await flush()
    expect(mocks.copied).toEqual([location.origin + '/join/OPEN0001'])
    expect(mocks.toasts).toContain('Invite link copied')
  })

  it('says so when the clipboard refuses', async () => {
    mocks.copyOk = false
    const page = await mount()
    click(btn(rowOf(page, 'OPEN0001'), 'Copy invite link'))
    await flush()
    expect(mocks.toasts).toContain('Could not copy the invite link')
  })

  it('uses one word, "invite", for the card and its button', async () => {
    const page = await mount()
    expect(page.textContent).toContain('Invites')
    expect(page.textContent).toContain('New invite')
    expect(page.textContent).not.toContain('New code')
  })

  const openNewSheet = async () => {
    mocks.sheets.length = 0
    mocks.closed = false
    const page = await mount()
    click([...page.querySelectorAll('button')].find(b => b.textContent.includes('New invite')))
    expect(mocks.sheets).toHaveLength(1)
    return render(mocks.sheets[0](() => { mocks.closed = true }))
  }
  const type = (el, value) => act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const create = sheet => click([...sheet.querySelectorAll('button')].find(b => b.textContent === 'Create invite'))

  const fields = sheet => [...sheet.querySelectorAll('input')]

  it('"New invite" opens a form; with both fields empty it creates a plain invite and copies its link', async () => {
    const sheet = await openNewSheet()
    create(sheet)
    await flush()
    expect(mocks.bodies).toEqual([{}])
    expect(mocks.copied).toEqual([location.origin + '/join/NEWCODE1'])
    expect(mocks.toasts).toContain('Invite created and invite link copied')
    expect(mocks.closed).toBe(true)
  })

  it('sends the name and note trimmed, and leaves out a blank one', async () => {
    const sheet = await openNewSheet()
    const [name, note] = fields(sheet)
    type(name, '  Mum  ')
    type(note, '   ')
    create(sheet)
    await flush()
    expect(mocks.bodies).toEqual([{ name: 'Mum' }])

    mocks.bodies.length = 0
    const again = await openNewSheet()
    type(fields(again)[1], ' for Sunday lunch ')
    create(again)
    await flush()
    expect(mocks.bodies).toEqual([{ note: 'for Sunday lunch' }])
  })

  it('uses the kit form fields: limits set, described by their helper text, no field for choosing the code', async () => {
    const sheet = await openNewSheet()
    const [name, note] = fields(sheet)
    expect(name.maxLength).toBe(40)
    expect(note.maxLength).toBe(60)
    expect(fields(sheet)).toHaveLength(2)
    expect(name.classList.contains('field')).toBe(true)
    expect(sheet.textContent).toContain('Prefilled as their profile name when they open the link.')
    expect(sheet.querySelector('#' + name.getAttribute('aria-describedby')).textContent).toContain('Prefilled')
    expect(sheet.querySelector('#' + note.getAttribute('aria-describedby'))).not.toBeNull()
  })

  it('shows a character count only near each limit', async () => {
    const sheet = await openNewSheet()
    const [name, note] = fields(sheet)
    expect(sheet.textContent).not.toContain('/ 60')
    type(note, 'x'.repeat(52))
    expect(sheet.textContent).toContain('52 / 60')
    expect(sheet.textContent).not.toContain('/ 40')
    type(name, 'y'.repeat(31))
    expect(sheet.textContent).toContain('31 / 40')
  })

  it('says an invite was created, not copied, when the clipboard refuses', async () => {
    mocks.copyOk = false
    const sheet = await openNewSheet()
    create(sheet)
    await flush()
    expect(mocks.toasts).toContain('Invite created. Copy its invite link from the list.')
  })

  it('keeps the sheet open and shows a role=alert error when creating fails', async () => {
    mocks.newError = 'Too many invites'
    const sheet = await openNewSheet()
    create(sheet)
    await flush()
    expect(sheet.querySelector('[role="alert"]').textContent).toBe('Too many invites')
    expect(mocks.closed).toBe(false)
    expect([...sheet.querySelectorAll('button')].find(b => b.textContent === 'Create invite').disabled).toBe(false)
  })

  it('shows "Creating…" and disables the button while the request is in flight', async () => {
    mocks.newPending = true
    const sheet = await openNewSheet()
    create(sheet)
    await flush()
    const button = [...sheet.querySelectorAll('button')].find(b => b.textContent === 'Creating…')
    expect(button.disabled).toBe(true)
    mocks.release()
    await flush()
  })

  it('shows the name as the row title, with the code and expiry under it and the note below', async () => {
    const page = await mount()
    const main = rowOf(page, 'NAMED006').querySelector('.adm-inv-main')
    const kids = [...main.children].map(c => c.textContent)
    expect(kids[0]).toBe('For Mum')
    expect(kids[1]).toContain('NAMED006')
    expect(kids[1]).toContain('Expires in 5 days')
    expect(kids[2]).toBe('for Sunday lunch')
    expect(rowOf(page, 'OPEN0001').querySelector('.adm-inv-main').firstElementChild.textContent).toContain('OPEN0001')
  })

  it('offers Share where the system share sheet exists, instead of Copy, and shares the link', async () => {
    let page = await mount()
    expect(btn(rowOf(page, 'OPEN0001'), 'Share invite link')).toBeNull()

    navigator.share = vi.fn().mockResolvedValue(undefined)
    document.body.innerHTML = ''
    page = await mount()
    const row = rowOf(page, 'OPEN0001')
    expect(btn(row, 'Copy invite link')).toBeNull()
    expect(row.querySelectorAll('button')).toHaveLength(2)
    click(btn(row, 'Share invite link'))
    await flush()
    expect(navigator.share).toHaveBeenCalledWith(expect.objectContaining({ url: location.origin + '/join/OPEN0001' }))
  })

  it('toasts when sharing fails, but not when the sheet is dismissed', async () => {
    navigator.share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }))
    const page = await mount()
    click(btn(rowOf(page, 'OPEN0001'), 'Share invite link'))
    await flush()
    expect(mocks.toasts).not.toContain('Could not share the invite link')
    navigator.share = vi.fn().mockRejectedValue(new Error('boom'))
    click(btn(rowOf(page, 'OPEN0001'), 'Share invite link'))
    await flush()
    expect(mocks.toasts).toContain('Could not share the invite link')
  })

  it('shows when each open invite expires, from the server record', async () => {
    const page = await mount()
    expect(rowOf(page, 'OPEN0001').textContent).toContain('Expires in 10 days')
    expect(rowOf(page, 'OPEN0002').textContent).toContain('Expires in 1 day')
    expect(rowOf(page, 'OPEN0002').textContent).not.toContain('Expires in 1 days')
    expect(rowOf(page, 'OLD00003').textContent).toContain('Expired')
  })

  it('shows nothing for an invite without a time, and no link actions for an expired one', async () => {
    const page = await mount()
    expect(rowOf(page, 'NOTIME04').textContent).toBe('NOTIME04')
    expect(btn(rowOf(page, 'OLD00003'), 'Copy invite link')).toBeNull()
    expect(btn(rowOf(page, 'OLD00003'), 'Revoke invite')).not.toBeNull()
  })

  it('confirms a revoke with translated copy and revokes on confirm', async () => {
    const page = await mount()
    click(btn(rowOf(page, 'OPEN0001'), 'Revoke invite'))
    expect(mocks.confirm.title).toBe('Revoke invite OPEN0001?')
    expect(mocks.confirm.confirmText).toBe('Revoke')
    await act(async () => { await mocks.confirm.onConfirm() })
    expect(mocks.posts).toContain('/api/admin/invites/revoke')
    expect(mocks.toasts).toContain('Invite revoked')
  })

  it('lists used invites with who used them', async () => {
    const page = await mount()
    expect(page.textContent).toContain('Used by Mallory')
  })

  it('has no inline styles', async () => {
    const page = await mount()
    expect(rowOf(page, 'OPEN0001').querySelectorAll('[style]').length).toBe(0)
    expect(page.querySelector('.adm-inv-used').hasAttribute('style')).toBe(false)
  })
})
