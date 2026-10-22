// @vitest-environment happy-dom
// What the Notifications feed reads of Friends: null while Friends is off, the cached cheers and
// invites while it is on, and a time for an invite the server sent none for, kept from the first
// time it was seen (never storage in the gallery's mock, dropped once the invite is gone).
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from '../../ds/render.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../mobile.js', () => ({ MOBILE: false }))
vi.mock('../demo.js', () => ({ DEMO: false }))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ user: { id: 'u1', name: 'Adrian' } })
  const useStore = selector => selector(snap())
  useStore.getState = snap
  return { useStore }
})

import { __setMockFriends } from './store.js'
import { __setMockCheers } from './use-cheers.js'
import { __resetFirstSeen, firstSeen, useFriendsFeed } from './use-friends-feed.js'
import { GROUP, ME_OFF, ME_ON } from '../../dev/screens/states/friends-fixture.js'
import { CHEERS_PLAIN } from '../../dev/screens/states/friends-surfaces-fixture.js'

const view = useView()
const undos = []
let seen
function Probe() { seen = useFriendsFeed(); return null }
const INVITE = { code: 'K7M2X9QPA4', group: { id: 'g1', name: 'Run Club' }, from: { name: 'Mara' } }

beforeEach(() => { seen = undefined; __resetFirstSeen(); localStorage.clear() })
afterEach(() => { while (undos.length) undos.pop()() })

const show = async me => {
  undos.push(__setMockFriends({ me, groups: [GROUP] }))
  undos.push(__setMockCheers(CHEERS_PLAIN))
  await act(async () => { view.root.render(<Probe />) })
}

describe('useFriendsFeed', () => {
  it('is null while Friends is off', async () => {
    await show(ME_OFF)
    expect(seen).toBeNull()
  })

  it('hands over the cheers and the invites, each with a time in ms', async () => {
    const at = '2026-10-20T09:00:00.000Z'
    await show({ ...ME_ON, invitations: [{ ...INVITE, at }], challengeInvites: [{ cid: 'c1', group: { id: 'g-iron-sunday', name: 'Iron Sunday' }, from: { name: 'Radu' } }] })
    expect(seen.cheers).toHaveLength(CHEERS_PLAIN.length)
    expect(seen.invitations[0].at).toBe(Date.parse(at))
    expect(Number.isFinite(seen.challengeInvites[0].at)).toBe(true)
  })

  it('the gallery\'s mock never writes the real storage', async () => {
    await show({ ...ME_ON, invitations: [INVITE] })
    expect(localStorage.getItem('gains_friends_invite_seen')).toBeNull()
  })
})

describe('firstSeen', () => {
  it('keeps the first time an invite was seen and forgets one that is gone', () => {
    expect(firstSeen(['group-invite:a'], 100)).toEqual({ 'group-invite:a': 100 })
    expect(firstSeen(['group-invite:a', 'challenge:c'], 200)).toEqual({ 'group-invite:a': 100, 'challenge:c': 200 })
    expect(firstSeen(['challenge:c'], 300)).toEqual({ 'challenge:c': 200 })
  })
})
