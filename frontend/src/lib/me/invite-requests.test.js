import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.fn()
vi.mock('../api.js', () => ({ api: (...args) => api(...args) }))

const { REQUEST_DAY_MAX, REQUEST_NOTE_MAX, REQUEST_OPEN_MAX, askAdmin, cancelRequest, myRequests } = await import('./invite-requests.js')

beforeEach(() => api.mockReset())

describe('the numbers the page repeats from the server', () => {
  const server = readFileSync(new URL('../../../../api/invites.js', import.meta.url), 'utf8')
  const of = name => Number(server.match(new RegExp('export const ' + name + ' = (\\d+);'))[1])
  it('match api/invites.js', () => {
    expect(REQUEST_NOTE_MAX).toBe(of('REQUEST_NOTE_MAX'))
    expect(REQUEST_OPEN_MAX).toBe(of('REQUEST_OPEN_MAX'))
    expect(REQUEST_DAY_MAX).toBe(of('REQUEST_DAY_MAX'))
  })
})

describe('askAdmin', () => {
  it('posts the trimmed note and resolves to the id', async () => {
    api.mockResolvedValueOnce({ ok: true, id: 'abc123' })
    await expect(askAdmin('  My friend Andrei ')).resolves.toBe('abc123')
    expect(api).toHaveBeenCalledWith('/api/invites/request', { method: 'POST', body: JSON.stringify({ note: 'My friend Andrei' }) })
  })

  it('rejects with the API error, which keeps its status and body', async () => {
    api.mockRejectedValueOnce(Object.assign(new Error('Too many'), { status: 429, data: { code: 'rate-limited', reason: 'daily', retryAfter: 600 } }))
    await expect(askAdmin('x')).rejects.toMatchObject({ status: 429, data: { reason: 'daily', retryAfter: 600 } })
  })
})

describe('myRequests', () => {
  it('reads the open asks', async () => {
    api.mockResolvedValueOnce({ requests: [{ id: 'a', note: 'n', at: 1 }] })
    await expect(myRequests()).resolves.toEqual([{ id: 'a', note: 'n', at: 1 }])
    expect(api).toHaveBeenCalledWith('/api/invites/requests/mine')
  })

  it('is an empty list when the body has none', async () => {
    api.mockResolvedValueOnce({})
    await expect(myRequests()).resolves.toEqual([])
  })
})

describe('cancelRequest', () => {
  it('posts the id', async () => {
    api.mockResolvedValueOnce({ ok: true })
    await cancelRequest('abc123')
    expect(api).toHaveBeenCalledWith('/api/invites/request/cancel', { method: 'POST', body: JSON.stringify({ id: 'abc123' }) })
  })
})
