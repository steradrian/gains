// @vitest-environment happy-dom
// Invite a friend, the member's view (M5.4 Ask an admin, M5.5 Asked): the page over a mocked
// lib/me/invite-requests.js. The card and field, asking with its toast and Undo, the open asks and
// Withdraw, the cap, the refusals (daily, open, offline) and the Groups row.
import { act } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, type, useView } from '../../../ds/render.test-util.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'

const askAdmin = vi.fn()
const myRequests = vi.fn()
const cancelRequest = vi.fn()
vi.mock('../../../lib/me/invite-requests.js', async importOriginal => ({
  ...(await importOriginal()),
  askAdmin: (...a) => askAdmin(...a),
  myRequests: (...a) => myRequests(...a),
  cancelRequest: (...a) => cancelRequest(...a),
}))

const { default: MemberInvite } = await import('./MemberInvite.jsx')
const { default: InviteRoute } = await import('./InviteRoute.jsx')

const view = useView()
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
const text = () => view.host.textContent
const button = label => [...view.host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent.trim()) === label)
const field = () => view.host.querySelector('input')

const OPEN = { id: 'r1', note: 'My training partner Andrei', at: Date.now() - 86400000 }

const show = async ({ groupsOn = false } = {}) => {
  view.render(<MemberInvite groupsOn={groupsOn} />)
  await flush()
}
const ask = async note => {
  type(field(), note)
  click(button('Ask an admin'))
  await flush()
}

let savedUser
beforeEach(() => {
  askAdmin.mockReset()
  myRequests.mockReset().mockResolvedValue([])
  cancelRequest.mockReset().mockResolvedValue({ ok: true })
  savedUser = useStore.getState().user
  useStore.setState({ user: { id: 'u_m', name: 'Mara', admin: false } })
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
})
afterEach(() => {
  useStore.setState({ user: savedUser })
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
})

describe('Ask an admin', () => {
  it('says who invites, with the lifetime, names no admin, and keeps Ask off until there is a note', async () => {
    await show()
    expect(view.host.querySelector('h1').textContent).toBe('Invite a friend')
    expect(text()).toContain('Admins send the invites')
    expect(text()).toContain('Only admins invite people to Gains')
    expect(text()).toContain('Ask an admin and they get a request with your note. They send them a link that works once, for 7 days.')
    expect(text()).toContain('Your note')
    expect(text()).toContain('Who they are, so the admin knows')
    expect(field().maxLength).toBe(120)
    expect(button('Ask an admin').disabled).toBe(true)
    type(field(), '   ')
    expect(button('Ask an admin').disabled).toBe(true)
    type(field(), 'Andrei')
    expect(button('Ask an admin').disabled).toBe(false)
  })

  it('shows no open asks, no Groups row and no status-only row when there is nothing to withdraw', async () => {
    await show()
    expect(button('Withdraw')).toBeUndefined()
    expect(view.host.querySelector('.g-ssec')).toBeNull()
    expect(text()).not.toContain('Groups')
  })

  it('sends the note, clears the field, lists the ask and toasts with Undo', async () => {
    askAdmin.mockResolvedValue('new1')
    await show()
    await ask('  My friend Andrei ')
    expect(askAdmin).toHaveBeenCalledWith('My friend Andrei')
    expect(field().value).toBe('')
    expect(useUI.getState().toastMsg).toBe('Asked an admin. You’ll hear when the invite is sent.')
    expect(useUI.getState().toastAction.label).toBe('Undo')
    expect(useUI.getState().toastAction.ms).toBe(8000)
    expect(view.host.querySelector('.g-ssec h2').textContent).toBe('Your open asks')
    expect(text()).toContain('My friend Andrei')
  })

  it('Undo withdraws the ask and its row leaves', async () => {
    askAdmin.mockResolvedValue('new1')
    await show()
    await ask('Andrei')
    act(() => { useUI.getState().runToastAction() })
    await flush()
    expect(cancelRequest).toHaveBeenCalledWith('new1')
    expect(button('Withdraw: Andrei')).toBeUndefined()
    expect(view.host.querySelector('.g-ssec')).toBeNull()
  })
})

describe('open asks', () => {
  it('lists each with the day and Withdraw, and a withdrawn one leaves', async () => {
    myRequests.mockResolvedValue([OPEN])
    await show()
    expect(text()).toContain('My training partner Andrei')
    expect(text()).toMatch(/Asked \w{3} \d{1,2} \w{3}/)
    click(button('Withdraw: My training partner Andrei'))
    await flush()
    expect(cancelRequest).toHaveBeenCalledWith('r1')
    expect(button('Withdraw: My training partner Andrei')).toBeUndefined()
  })

  it('keeps the row and says why when the withdraw fails', async () => {
    myRequests.mockResolvedValue([OPEN])
    cancelRequest.mockRejectedValue(new Error('The server did not answer in time.'))
    await show()
    click(button('Withdraw: My training partner Andrei'))
    await flush()
    expect(button('Withdraw: My training partner Andrei')).toBeTruthy()
    expect(useUI.getState().toastMsg).toBe('The server did not answer in time.')
  })

  it('at 3 open asks turns Ask off and says so, from the server\'s cap', async () => {
    myRequests.mockResolvedValue([OPEN, { ...OPEN, id: 'r2', note: 'Sara' }, { ...OPEN, id: 'r3', note: 'Tudor' }])
    await show()
    type(field(), 'Another')
    expect(button('Ask an admin').disabled).toBe(true)
    expect(text()).toContain('You have 3 open asks. Withdraw one to ask again.')
    click(button('Withdraw: Tudor'))
    await flush()
    expect(button('Ask an admin').disabled).toBe(false)
  })

  it('still lets a member ask when their asks cannot be loaded', async () => {
    myRequests.mockRejectedValue(new Error('offline'))
    await show()
    type(field(), 'Andrei')
    expect(button('Ask an admin').disabled).toBe(false)
  })
})

describe('refusals', () => {
  const refuse = (status, data) => askAdmin.mockRejectedValue(Object.assign(new Error('x'), { status, data }))

  it('daily: says 3 times and when to try again, and keeps the note', async () => {
    refuse(429, { reason: 'daily', retryAfter: 4 * 3600 })
    await show()
    await ask('Andrei')
    expect(view.host.querySelector('[role="alert"]').textContent).toBe('You’ve asked 3 times today. Try again in 4h 0m.')
    expect(field().value).toBe('Andrei')
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('open: says 3 open asks and promises no time', async () => {
    refuse(429, { reason: 'open', retryAfter: 86400 })
    await show()
    await ask('Andrei')
    expect(view.host.querySelector('[role="alert"]').textContent).toBe('You have 3 open asks. Withdraw one to ask again.')
  })

  it('offline: keeps the draft and offers Try again, which sends it again', async () => {
    askAdmin.mockRejectedValueOnce(new Error('The server did not answer in time.'))
    await show()
    await ask('Andrei')
    const alert = view.host.querySelector('[role="alert"]')
    expect(alert.textContent).toContain('Couldn’t send your ask. Check your connection and try again.')
    expect(field().value).toBe('Andrei')
    askAdmin.mockResolvedValue('new1')
    click([...alert.querySelectorAll('button, a')].find(b => b.textContent === 'Try again'))
    await flush()
    expect(askAdmin).toHaveBeenCalledTimes(2)
    expect(view.host.querySelector('[role="alert"]')).toBeNull()
    expect(useUI.getState().toastMsg).toBe('Asked an admin. You’ll hear when the invite is sent.')
  })

  it('clears the error as soon as the note changes', async () => {
    refuse(429, { reason: 'daily', retryAfter: 600 })
    await show()
    await ask('Andrei')
    type(field(), 'Andrei P')
    expect(view.host.querySelector('[role="alert"]')).toBeNull()
  })
})

describe('a build with no account', () => {
  it('goes back to the Me root and never asks the server', async () => {
    useStore.setState({ user: null })
    view.render(
      <MemoryRouter initialEntries={['/me/invite']}>
        <Routes>
          <Route path="/me/invite" element={<InviteRoute />} />
          <Route path="/me" element={<p>Me root</p>} />
        </Routes>
      </MemoryRouter>,
    )
    await flush()
    expect(text()).toBe('Me root')
    expect(myRequests).not.toHaveBeenCalled()
  })
})

describe('Groups row', () => {
  it('shows only when Friends is on, as a row that goes to Groups', async () => {
    await show({ groupsOn: true })
    const row = [...view.host.querySelectorAll('a')].find(a => a.textContent.includes('Groups'))
    expect(row.getAttribute('href')).toBe('#/me/groups')
    expect(row.textContent).toContain('Already on Gains? Add them to a group from Friends instead; group links only work for people who are in.')
  })
})
