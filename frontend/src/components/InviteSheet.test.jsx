// @vitest-environment happy-dom
// The Invite drawer: Copy invite link mints one link and copies <base>/g/<code>; the people list
// comes from GET /people for this group, Invite turns into Invited, nobody shows the search scene.
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type, useView } from '../ds/render.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  openSheet: vi.fn(), toast: vi.fn(), createInvite: vi.fn(), findPeople: vi.fn(), inviteUser: vi.fn(), copy: vi.fn(), canShare: vi.fn(),
}))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ openSheet: mocks.openSheet, toast: mocks.toast }) } }))
vi.mock('../lib/friends/api.js', async importActual => ({
  ...(await importActual()),
  createInvite: (...a) => mocks.createInvite(...a),
  findPeople: (...a) => mocks.findPeople(...a),
  inviteUser: (...a) => mocks.inviteUser(...a),
}))
vi.mock('../lib/friends/store.js', () => ({ getFriends: () => ({ groups: [{ id: 'g1', name: 'Iron Sunday' }] }) }))
vi.mock('../lib/friends/group-link.js', () => ({ groupLink: code => 'https://gains.example.com/g/' + code }))
vi.mock('../lib/clipboard.js', () => ({ copyText: (...a) => mocks.copy(...a) }))
vi.mock('../lib/invite-link.js', () => ({ canShareLink: () => mocks.canShare(), shareLink: vi.fn() }))

import { inviteSheet } from './InviteSheet.jsx'

const view = useView()
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const buttons = text => [...view.host.querySelectorAll('button')].filter(b => b.textContent === text)

async function open(people = []) {
  mocks.findPeople.mockResolvedValue(people)
  inviteSheet('g1')
  view.render(mocks.openSheet.mock.calls[0][0](() => {}))
  await flush()
}

beforeEach(() => {
  for (const f of Object.values(mocks)) f.mockReset()
  mocks.createInvite.mockResolvedValue({ code: 'Hn4Tz8Wq2X', url: 'x', expiresAt: 'later' })
  mocks.copy.mockResolvedValue(true)
  mocks.canShare.mockReturnValue(false)
})

describe('the Invite drawer', () => {
  it('is a plain ds sheet titled with the group and says the link works once for 7 days', async () => {
    await open()
    expect(mocks.openSheet.mock.calls[0][1]).toEqual({ variant: 'ds' })
    expect(view.host.querySelector('h2').textContent).toBe('Invite to Iron Sunday')
    expect(view.host.textContent).toContain('Works once · 7 days')
  })

  it('Copy invite link mints one link, copies it and says Link copied', async () => {
    await open()
    await act(async () => { buttons('Copy invite link')[0].click() })
    await flush()
    expect(mocks.createInvite).toHaveBeenCalledWith('g1')
    expect(mocks.copy).toHaveBeenCalledWith('https://gains.example.com/g/Hn4Tz8Wq2X')
    expect(buttons('Link copied')).toHaveLength(1)
    await act(async () => { buttons('Link copied')[0].click() })
    await flush()
    expect(mocks.createInvite).toHaveBeenCalledTimes(1)
  })

  it('a failed mint toasts and copies nothing', async () => {
    mocks.createInvite.mockRejectedValue(new Error('offline'))
    await open()
    await act(async () => { buttons('Copy invite link')[0].click() })
    await flush()
    expect(mocks.copy).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith("Couldn't do that. Try again when you're online.")
  })

  it('offers Share link only where the device can share', async () => {
    await open()
    expect(buttons('Share link')).toHaveLength(0)
  })

  it('and offers it when the device can', async () => {
    mocks.canShare.mockReturnValue(true)
    await open()
    expect(buttons('Share link')).toHaveLength(1)
  })

  it('lists who is on Gains for this group, with when they joined', async () => {
    await open([{ uid: 'u1', name: 'Andrei', since: '2026-10' }, { uid: 'u2', name: 'Elena', since: '2026-09' }])
    expect(mocks.findPeople).toHaveBeenCalledWith('', 'g1')
    expect(view.host.textContent).toContain('Andrei')
    expect(view.host.textContent).toContain('Joined Gains in')
    expect(buttons('Invite')).toHaveLength(2)
  })

  it('Invite sends that person an invitation and turns into Invited', async () => {
    mocks.inviteUser.mockResolvedValue({ ok: true })
    await open([{ uid: 'u1', name: 'Andrei', since: '2026-10' }, { uid: 'u2', name: 'Elena', since: '2026-09' }])
    await act(async () => { buttons('Invite')[0].click() })
    await flush()
    expect(mocks.inviteUser).toHaveBeenCalledWith('g1', 'u1')
    expect(view.host.textContent).toContain('Invited')
    expect(buttons('Invite')).toHaveLength(1)
  })

  it('shows the search scene when nobody can be invited', async () => {
    await open([])
    expect(view.host.textContent).toContain('No one to invite yet')
    expect(view.host.querySelector('.g-sempty')).not.toBeNull()
  })

  it('searching asks the server with the typed name', async () => {
    await open([])
    vi.useFakeTimers()
    type(view.host.querySelector('input'), 'ele')
    await act(async () => { vi.advanceTimersByTime(300) })
    vi.useRealTimers()
    expect(mocks.findPeople).toHaveBeenLastCalledWith('ele', 'g1')
  })
})
