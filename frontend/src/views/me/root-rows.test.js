// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { ME_ROW_SLOTS, meRows } from './root-rows.js'

const ctx = { bodyLogged: true, changeCount: 3, invites: { joined: 2, waiting: 1 }, canInvite: true }

describe('meRows', () => {
  it('lists Body, Recent changes and Invite a friend with their lines', () => {
    expect(meRows(ctx).map(r => [r.title, r.sub, r.to])).toEqual([
      ['Body', 'Weigh-ins, measurements, photos', '/me/body'],
      ['Recent changes', '3 in the last 7 days', '/me/changes'],
      ['Invite a friend', '2 joined · 1 waiting', '/me/invite'],
    ])
  })

  it('reads as new when nothing is logged', () => {
    const rows = meRows({ bodyLogged: false, changeCount: 0, invites: null, canInvite: true })
    expect(rows.map(r => r.sub)).toEqual(['Nothing logged yet', 'Nothing in the last 7 days', 'A link that works once'])
  })

  it('hides Invite a friend where no invite can be made', () => {
    expect(meRows({ ...ctx, canInvite: false }).map(r => r.id)).toEqual(['body', 'changes'])
  })

  it('has the Groups row in the you slot, going to /me/groups', () => {
    expect(ME_ROW_SLOTS.you.map(r => r.id)).toEqual(['groups'])
    expect(ME_ROW_SLOTS.you[0].to).toBe('/me/groups')
  })

  it('renders a slot row last, with its tag, only where it is visible', () => {
    const groups = { id: 'groups', title: 'Groups', sub: 'no group yet', icon: 'users', to: '/me/groups', tag: 'New', visible: c => c.friends }
    const on = meRows({ ...ctx, friends: true }, { you: [groups] })
    expect(on.at(-1)).toEqual({ id: 'groups', title: 'Groups', sub: 'no group yet', icon: 'users', to: '/me/groups', tag: 'New' })
    expect(meRows({ ...ctx, friends: false }, { you: [groups] }).map(r => r.id)).toEqual(['body', 'changes', 'invite'])
  })
})
