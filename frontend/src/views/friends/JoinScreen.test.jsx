// @vitest-environment happy-dom
// Join by link (board Fr4Join): every state of the invite and what its action does.
import { act } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from '../../ds/render.test-util.js'
import { FriendsError } from '../../lib/friends/api.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ toast: vi.fn(), preview: vi.fn(), join: vi.fn(), S: null, user: { id: 'u-adrian', name: 'Adrian' } }))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S, user: mocks.user })
  const useStore = selector => selector(snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast }) } }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../../lib/friends/api.js', async importActual => ({
  ...(await importActual()),
  getJoinPreview: (...a) => mocks.preview(...a),
  joinGroup: (...a) => mocks.join(...a),
}))

import { __setMockFriends } from '../../lib/friends/store.js'
import { GROUP, ME_OFF, ME_ON, PREVIEW_STATE } from '../../dev/screens/states/friends-fixture.js'
import JoinScreen from './JoinScreen.jsx'

const view = useView()
let undo = null
let here = null
function Probe() { here = useLocation(); return null }

const VALID = {
  status: 'valid',
  group: { id: 'g-iron-sunday', name: 'Iron Sunday', memberCount: 5, initials: ['A', 'M', 'R', 'I', 'V'] },
  from: { name: 'Mara' },
}

async function show(me, answer) {
  undo = __setMockFriends({ me, groups: me.on ? [GROUP] : [] })
  if (answer instanceof Error) mocks.preview.mockRejectedValue(answer)
  else mocks.preview.mockResolvedValue(answer)
  view.render(
    <MemoryRouter initialEntries={['/me/groups/join/k7Qp9x2Lm']}>
      <Routes><Route path="/me/groups/join/:code" element={<JoinScreen />} /><Route path="*" element={null} /></Routes>
      <Probe />
    </MemoryRouter>,
  )
  await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}
const text = () => view.host.textContent
const button = label => [...view.host.querySelectorAll('button')].find(b => b.textContent === label)
const press = async label => { await act(async () => { button(label).click() }); await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }

beforeEach(() => {
  mocks.S = PREVIEW_STATE
  for (const f of [mocks.toast, mocks.preview, mocks.join]) f.mockReset()
})
afterEach(() => { undo?.(); undo = null })

describe('a valid invite', () => {
  it('asks the server about the code in the link and shows who invited you and exactly what they will see', async () => {
    await show(ME_ON, VALID)
    expect(mocks.preview).toHaveBeenCalledWith('k7Qp9x2Lm')
    for (const part of ['Mara invited you to Iron Sunday', '5 friends, one weekly goal. Nobody is ranked.', 'This is all they will see', 'Change', 'Training done', 'Never shared: weight, foods, what you ate, photos', 'Join Iron Sunday', 'Not now']) expect(text()).toContain(part)
    expect([...view.host.querySelectorAll('.g-grow .g-mavatar')].map(a => a.textContent)).toEqual(['A', 'M', 'R', 'I', 'V'])
  })

  it('Change opens What you share', async () => {
    await show(ME_ON, VALID)
    await press('Change')
    expect(here.pathname).toBe('/me/groups/sharing')
  })

  it('Not now goes back to Groups and joins nothing', async () => {
    await show(ME_ON, VALID)
    await press('Not now')
    expect(here.pathname).toBe('/me/groups')
    expect(mocks.join).not.toHaveBeenCalled()
  })

  it('Join redeems the code and replaces this page with the group', async () => {
    mocks.join.mockResolvedValue({ id: 'g-iron-sunday', name: 'Iron Sunday' })
    await show(ME_ON, VALID)
    await press('Join Iron Sunday')
    expect(mocks.join).toHaveBeenCalledWith('k7Qp9x2Lm')
    expect(here.pathname).toBe('/me/groups/g-iron-sunday')
  })

  it('a link that was used meanwhile turns into the expired page; other refusals toast', async () => {
    mocks.join.mockRejectedValueOnce(new FriendsError('x', { code: 'invite-used', status: 410 }))
    await show(ME_ON, VALID)
    await press('Join Iron Sunday')
    expect(text()).toContain('This invite has expired')
    expect(text()).toContain('Ask Mara for a new one')
  })

  it('a rate limit or a full group toasts and keeps the page', async () => {
    mocks.join.mockRejectedValue(new FriendsError('x', { code: 'group-full', status: 409 }))
    await show(ME_ON, VALID)
    await press('Join Iron Sunday')
    expect(mocks.toast).toHaveBeenCalledWith('That group is full.')
    expect(text()).toContain('Join Iron Sunday')
  })

  it('already a member when joining: opens that group', async () => {
    mocks.join.mockRejectedValue(new FriendsError('x', { code: 'already-member', status: 409, data: { group: { id: 'g-iron-sunday' } } }))
    await show(ME_ON, VALID)
    await press('Join Iron Sunday')
    expect(here.pathname).toBe('/me/groups/g-iron-sunday')
  })
})

describe('Friends off', () => {
  it('replaces Join with Turn on Friends, which goes through What you share and remembers this page', async () => {
    await show(ME_OFF, VALID)
    expect(button('Join Iron Sunday')).toBeUndefined()
    expect(text()).not.toContain('This is all they will see')
    await press('Turn on Friends')
    expect(here.pathname + here.search).toBe('/me/groups/sharing?first=1')
    expect(here.state).toEqual({ returnTo: '/me/groups/join/k7Qp9x2Lm' })
  })
})

describe('an invite that cannot be used', () => {
  it('expired, used or revoked says so and who to ask', async () => {
    for (const status of ['expired', 'used', 'revoked']) {
      await show(ME_ON, { status, from: { name: 'Mara' } })
      expect(text(), status).toContain('This invite has expired')
      expect(text(), status).toContain('Ask Mara for a new one')
      expect(button('Join Iron Sunday')).toBeUndefined()
      undo?.(); undo = null
      act(() => view.root.render(null))
    }
  })

  it('an unknown code is the same page with no inviter', async () => {
    await show(ME_ON, new FriendsError('x', { code: 'not-found', status: 404 }))
    expect(text()).toContain('This invite has expired')
    expect(text()).toContain('Ask the person who sent it for a new one')
  })

  it('Back to Groups leaves', async () => {
    await show(ME_ON, { status: 'expired' })
    await press('Back to Groups')
    expect(here.pathname).toBe('/me/groups')
  })
})

describe('already a member', () => {
  it('replaces the page with the group the link is for', async () => {
    await show(ME_ON, { status: 'member', group: VALID.group })
    expect(here.pathname).toBe('/me/groups/g-iron-sunday')
  })
})

describe('when the server cannot be reached', () => {
  it('says so and offers Try again; a rate limit also toasts', async () => {
    await show(ME_ON, new FriendsError('x', { code: 'rate-limited', status: 429 }))
    expect(mocks.toast).toHaveBeenCalledWith('Too many tries. Wait a moment and try again.')
    expect(text()).toContain("Couldn't open this invite")
    mocks.preview.mockResolvedValue(VALID)
    await press('Try again')
    expect(text()).toContain('Join Iron Sunday')
  })
})
