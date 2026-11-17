import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.fn()
vi.mock('../api.js', () => ({ api: (...args) => api(...args) }))

const { INVITE_NAME_MAX, INVITE_TTL_DAYS, canInvite, codeHint, createInvite, groupInvites, loadInvites, revokeInvite } = await import('./invites.js')

const NOW = new Date(2026, 9, 21, 12, 0).getTime()
const DAY = 86400000
const inv = (code, rest) => ({ code, status: 'valid', created: new Date(NOW - DAY).toISOString(), expiresAt: new Date(NOW + 6 * DAY).toISOString(), ...rest })

beforeEach(() => api.mockReset())

describe('the numbers the page repeats from the server', () => {
  // api/invites.js is the source: the page says "lasts 7 days" from this constant, so a change on
  // the server alone would make the card lie.
  const server = readFileSync(new URL('../../../../api/invites.js', import.meta.url), 'utf8')
  it('INVITE_TTL_DAYS equals the server\'s', () => {
    expect(server).toMatch(/export const INVITE_TTL_DAYS = (\d+);/)
    expect(INVITE_TTL_DAYS).toBe(Number(server.match(/export const INVITE_TTL_DAYS = (\d+);/)[1]))
  })

  it('INVITE_NAME_MAX equals the server\'s', () => {
    expect(INVITE_NAME_MAX).toBe(Number(server.match(/export const INVITE_NAME_MAX = (\d+);/)[1]))
  })
})

describe('groupInvites', () => {
  it('sorts by the server\'s status: valid is waiting, used is joined, expired is expired', () => {
    const g = groupInvites([
      inv('W1'),
      inv('J1', { status: 'used', usedBy: 'u1', usedAt: new Date(NOW - 3 * DAY).toISOString() }),
      inv('E1', { status: 'expired', expiresAt: new Date(NOW - 2 * DAY).toISOString() }),
    ], NOW)
    expect(g.waiting.map(i => i.code)).toEqual(['W1'])
    expect(g.joined.map(i => i.code)).toEqual(['J1'])
    expect(g.expired.map(i => i.code)).toEqual(['E1'])
  })

  it('moves a valid invite whose time has passed since the list was loaded to expired', () => {
    const g = groupInvites([inv('W1', { expiresAt: new Date(NOW - 1000).toISOString() })], NOW)
    expect(g.waiting).toEqual([])
    expect(g.expired.map(i => i.code)).toEqual(['W1'])
  })

  it('leaves out a revoked invite, and sorts waiting newest first, joined by when they joined', () => {
    const g = groupInvites([
      inv('OLD', { created: new Date(NOW - 5 * DAY).toISOString() }),
      inv('NEW', { created: new Date(NOW - 1000).toISOString() }),
      inv('GONE', { revoked: true }),
      inv('J1', { status: 'used', usedBy: 'a', usedAt: new Date(NOW - 9 * DAY).toISOString() }),
      inv('J2', { status: 'used', usedBy: 'b', usedAt: new Date(NOW - 2 * DAY).toISOString() }),
    ], NOW)
    expect(g.waiting.map(i => i.code)).toEqual(['NEW', 'OLD'])
    expect(g.joined.map(i => i.code)).toEqual(['J2', 'J1'])
  })

  it('copes with nothing', () => {
    expect(groupInvites(undefined, NOW)).toEqual({ waiting: [], joined: [], expired: [] })
  })
})

describe('the admin endpoints', () => {
  it('loadInvites reads invites, requests and invite_only, and inviteOnly is false only when the server says so', async () => {
    api.mockResolvedValueOnce({ invites: [inv('A')], requests: [{ id: 'r1' }], invite_only: false })
    expect(await loadInvites()).toEqual({ invites: [inv('A')], requests: [{ id: 'r1' }], inviteOnly: false })
    expect(api).toHaveBeenCalledWith('/api/admin/invites')
    api.mockResolvedValueOnce({})
    expect(await loadInvites()).toEqual({ invites: [], requests: [], inviteOnly: true })
  })

  it('createInvite posts the trimmed name and the requestId, leaving empty ones out', async () => {
    api.mockResolvedValue({ invite: { code: 'X' } })
    expect(await createInvite({ name: '  Andrei ', requestId: 'r1' })).toEqual({ code: 'X' })
    expect(api).toHaveBeenLastCalledWith('/api/admin/invites/new', { method: 'POST', body: JSON.stringify({ name: 'Andrei', requestId: 'r1' }) })
    await createInvite({ name: '   ' })
    expect(api).toHaveBeenLastCalledWith('/api/admin/invites/new', { method: 'POST', body: '{}' })
  })

  it('revokeInvite posts the code, and a rejection reaches the caller', async () => {
    api.mockResolvedValueOnce({ ok: true })
    await revokeInvite('ABCD')
    expect(api).toHaveBeenCalledWith('/api/admin/invites/revoke', { method: 'POST', body: JSON.stringify({ code: 'ABCD' }) })
    api.mockRejectedValueOnce(new Error('already used, cannot revoke'))
    await expect(revokeInvite('ABCD')).rejects.toThrow('already used')
  })
})

describe('canInvite and codeHint', () => {
  it('needs a signed-in account on a server: no guest, no demo', () => {
    expect(canInvite({ id: 'u1' }, { demo: false })).toBe(true)
    expect(canInvite(null, { demo: false })).toBe(false)
    expect(canInvite({ id: 'u1' }, { demo: true })).toBe(false)
  })

  it('shows four characters of a code, never the code', () => {
    expect(codeHint('A1B2C3D4E5F60718')).toBe('A1B2…')
    expect(codeHint('')).toBe('')
    expect(codeHint(undefined)).toBe('')
  })
})
