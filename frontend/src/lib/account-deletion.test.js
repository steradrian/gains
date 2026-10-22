// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

/* Account deletion's client calls. The rule they keep: nothing is asked of the server's delete
   route without a proof made now, and every way it can fail — a closed prompt, a prompt that
   throws, a refused proof, no answer — rejects with NotConfirmedError and changes nothing here. */
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  assert: vi.fn(),
  webauthn: true,
  user: { id: 'u1', name: 'Ana' },
  setUser: vi.fn(),
}))
vi.mock('./api.js', () => ({
  api: (...a) => mocks.api(...a),
  passkeyAssert: (...a) => mocks.assert(...a),
  webauthnOK: () => mocks.webauthn,
}))
vi.mock('../store/useStore.js', () => ({
  useStore: { getState: () => ({ user: mocks.user, setUser: mocks.setUser }) },
}))

import { GRACE_DAYS, NotConfirmedError, REFRESH_RETRY_MS, cancelDeletion, deletionDay, graceEnd, prepareDeletion, scheduleDeletion } from './account-deletion.js'

const httpError = (status, data = {}) => Object.assign(new Error(data.error || 'HTTP ' + status), { status, data })
const netError = () => Object.assign(new TypeError('Failed to fetch'), { status: undefined })
const OPTIONS = { cid: 'c1', options: { challenge: 'AAAA', allowCredentials: [{ id: 'k1', type: 'public-key' }] }, password: false }
const CRED = { id: 'k1', type: 'public-key', response: {} }
const AT = '2026-10-29T12:00:00.000Z'
const REQ = '2026-10-22T12:00:00.000Z'
const calls = () => mocks.api.mock.calls.map(([p, o]) => (o?.method || 'GET') + ' ' + p)
const deleteCalls = () => mocks.api.mock.calls.filter(([p]) => p === '/api/account/delete')
const reasonOf = async promise => {
  try { await promise } catch (e) { expect(e).toBeInstanceOf(NotConfirmedError); return e.reason }
  throw new Error('expected a NotConfirmedError')
}
// The server's answers by route; a function answers per call.
const answer = table => mocks.api.mockImplementation(async (path, o) => {
  const a = table[(o?.method || 'GET') + ' ' + path]
  if (a === undefined) throw new Error('unexpected ' + path)
  if (a instanceof Error) throw a
  return typeof a === 'function' ? a() : a
})

beforeEach(() => {
  mocks.api.mockReset()
  mocks.assert.mockReset()
  mocks.setUser.mockReset()
  mocks.webauthn = true
  mocks.user = { id: 'u1', name: 'Ana' }
})

describe('scheduleDeletion: the proof first, and nothing without it', () => {
  it('with prepared options: the prompt, then the delete with { cid, credential }; the user carries the deletion', async () => {
    mocks.assert.mockResolvedValue(CRED)
    answer({ 'POST /api/account/delete': { ok: true, at: AT, requestedAt: REQ } })
    await expect(scheduleDeletion({ prepared: OPTIONS })).resolves.toEqual({ at: AT, requestedAt: REQ })
    expect(mocks.assert).toHaveBeenCalledWith(OPTIONS.options, { signal: undefined })
    expect(calls()).toEqual(['POST /api/account/delete'])
    expect(JSON.parse(deleteCalls()[0][1].body)).toEqual({ cid: 'c1', credential: CRED })
    expect(mocks.setUser).toHaveBeenCalledWith({ id: 'u1', name: 'Ana', deletion: { at: AT, requestedAt: REQ } })
  })

  it('opens the prompt before awaiting anything when the options are in hand (the tap still counts)', () => {
    mocks.assert.mockReturnValue(new Promise(() => {}))
    scheduleDeletion({ prepared: OPTIONS })
    expect(mocks.assert).toHaveBeenCalledTimes(1)   // synchronously, in the same tick as the call
  })

  it('without options, asks for them first', async () => {
    mocks.assert.mockResolvedValue(CRED)
    answer({ 'POST /api/account/delete/options': OPTIONS, 'POST /api/account/delete': { ok: true, at: AT, requestedAt: REQ } })
    await scheduleDeletion()
    expect(calls()).toEqual(['POST /api/account/delete/options', 'POST /api/account/delete'])
  })

  it('a closed or called-off prompt: cancelled, and the delete is never sent', async () => {
    mocks.assert.mockRejectedValue(Object.assign(new Error('not allowed'), { name: 'NotAllowedError' }))
    expect(await reasonOf(scheduleDeletion({ prepared: OPTIONS }))).toBe('cancelled')
    mocks.assert.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    expect(await reasonOf(scheduleDeletion({ prepared: OPTIONS }))).toBe('cancelled')
    expect(deleteCalls()).toHaveLength(0)
    expect(mocks.setUser).not.toHaveBeenCalled()
  })

  it('a prompt that fails some other way: passkey, and nothing sent', async () => {
    mocks.assert.mockRejectedValue(Object.assign(new Error('bad state'), { name: 'InvalidStateError' }))
    expect(await reasonOf(scheduleDeletion({ prepared: OPTIONS }))).toBe('passkey')
    expect(deleteCalls()).toHaveLength(0)
  })

  it('a prompt answered after its page called it off is not sent', async () => {
    const ctl = new AbortController()
    mocks.assert.mockImplementation(async () => { ctl.abort(); return CRED })
    expect(await reasonOf(scheduleDeletion({ prepared: OPTIONS, signal: ctl.signal }))).toBe('cancelled')
    expect(deleteCalls()).toHaveLength(0)
  })

  it('any 403 (a refused proof) is refused: nothing changes here and the account is not re-read', async () => {
    mocks.assert.mockResolvedValue(CRED)
    for (const code of ['passkey', 'passkey-required', 'current-wrong']) {
      answer({ 'POST /api/account/delete': httpError(403, { code }) })
      expect(await reasonOf(scheduleDeletion({ prepared: OPTIONS }))).toBe('refused')
    }
    expect(calls().every(c => c === 'POST /api/account/delete')).toBe(true)
    expect(mocks.setUser).not.toHaveBeenCalled()
  })

  it('no answer: offline, and the account is read again in case the server did schedule it', async () => {
    mocks.assert.mockResolvedValue(CRED)
    const scheduled = { id: 'u1', name: 'Ana', deletion: { at: AT, requestedAt: REQ } }
    answer({ 'POST /api/account/delete': netError(), 'GET /api/me': { user: scheduled } })
    expect(await reasonOf(scheduleDeletion({ prepared: OPTIONS }))).toBe('offline')
    expect(mocks.setUser).toHaveBeenCalledWith(scheduled)
  })

  it('a lost answer and a failed /api/me: the account is read again with a backoff until it lands', async () => {
    vi.useFakeTimers()
    try {
      mocks.assert.mockResolvedValue(CRED)
      const scheduled = { id: 'u1', name: 'Ana', deletion: { at: AT, requestedAt: REQ } }
      let me = 0
      answer({ 'POST /api/account/delete': netError(), 'GET /api/me': () => { if (++me < 3) throw netError(); return { user: scheduled } } })
      expect(await reasonOf(scheduleDeletion({ prepared: OPTIONS }))).toBe('offline')
      expect(mocks.setUser).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(REFRESH_RETRY_MS[0])
      expect(mocks.setUser).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(REFRESH_RETRY_MS[1])
      expect(mocks.setUser).toHaveBeenCalledWith(scheduled)
      await vi.advanceTimersByTimeAsync(60000)
      expect(me).toBe(3)
    } finally { vi.useRealTimers() }
  })

  it('a cancel stops a retry still running from a lost schedule answer', async () => {
    vi.useFakeTimers()
    try {
      mocks.assert.mockResolvedValue(CRED)
      mocks.user = { id: 'u1', name: 'Ana', deletion: { at: AT, requestedAt: REQ } }
      answer({ 'POST /api/account/delete': netError(), 'GET /api/me': netError(), 'POST /api/account/delete/cancel': { ok: true } })
      await reasonOf(scheduleDeletion({ prepared: OPTIONS }))
      await cancelDeletion()
      const before = calls().length
      await vi.advanceTimersByTimeAsync(60000)
      expect(calls().length).toBe(before)
    } finally { vi.useRealTimers() }
  })

  it('a 429 is locked, a 500 is error', async () => {
    mocks.assert.mockResolvedValue(CRED)
    answer({ 'POST /api/account/delete': httpError(429, { code: 'locked', retryAfter: 60 }) })
    expect(await reasonOf(scheduleDeletion({ prepared: OPTIONS }))).toBe('locked')
    answer({ 'POST /api/account/delete': httpError(500), 'GET /api/me': { user: mocks.user } })
    expect(await reasonOf(scheduleDeletion({ prepared: OPTIONS }))).toBe('error')
  })

  it('a 200 without a date is not taken for a scheduled deletion', async () => {
    mocks.assert.mockResolvedValue(CRED)
    answer({ 'POST /api/account/delete': { ok: true }, 'GET /api/me': { user: mocks.user } })
    expect(await reasonOf(scheduleDeletion({ prepared: OPTIONS }))).toBe('error')
    expect(mocks.setUser).not.toHaveBeenCalledWith(expect.objectContaining({ deletion: expect.anything() }))
  })
})

describe('scheduleDeletion: the password, where it is the proof', () => {
  it('a password-only profile is asked for its password, with no prompt and nothing sent', async () => {
    answer({ 'POST /api/account/delete/options': { password: true } })
    expect(await reasonOf(scheduleDeletion())).toBe('password')
    expect(mocks.assert).not.toHaveBeenCalled()
    expect(deleteCalls()).toHaveLength(0)
  })

  it('passkeys this browser cannot use: the password when it counts, else no-webauthn', async () => {
    mocks.webauthn = false
    expect(await reasonOf(scheduleDeletion({ prepared: { ...OPTIONS, password: true } }))).toBe('password')
    expect(await reasonOf(scheduleDeletion({ prepared: OPTIONS }))).toBe('no-webauthn')
    expect(mocks.assert).not.toHaveBeenCalled()
    expect(deleteCalls()).toHaveLength(0)
  })

  it('the password goes with the one request as { current }', async () => {
    answer({ 'POST /api/account/delete': { ok: true, at: AT, requestedAt: REQ } })
    await scheduleDeletion({ current: 'hunter22' })
    expect(JSON.parse(deleteCalls()[0][1].body)).toEqual({ current: 'hunter22' })
    expect(mocks.assert).not.toHaveBeenCalled()
  })
})

describe('prepareDeletion', () => {
  it('hands back the options', async () => {
    answer({ 'POST /api/account/delete/options': OPTIONS })
    await expect(prepareDeletion()).resolves.toEqual(OPTIONS)
  })

  it('names the conflicts: last admin, nothing to prove it with, already scheduled (and reads the account)', async () => {
    answer({ 'POST /api/account/delete/options': httpError(409, { code: 'last-admin' }) })
    expect(await reasonOf(prepareDeletion())).toBe('last-admin')
    answer({ 'POST /api/account/delete/options': httpError(409, { code: 'no-passkey' }) })
    expect(await reasonOf(prepareDeletion())).toBe('no-passkey')
    expect(mocks.setUser).not.toHaveBeenCalled()
    const scheduled = { id: 'u1', name: 'Ana', deletion: { at: AT, requestedAt: REQ } }
    answer({ 'POST /api/account/delete/options': httpError(409, { code: 'deletion-scheduled', at: AT }), 'GET /api/me': { user: scheduled } })
    expect(await reasonOf(prepareDeletion())).toBe('scheduled')
    expect(mocks.setUser).toHaveBeenCalledWith(scheduled)
  })
})

describe('cancelDeletion', () => {
  it('cancels, then reads the account so the deletion is gone and sync resumes', async () => {
    answer({ 'POST /api/account/delete/cancel': { ok: true }, 'GET /api/me': { user: { id: 'u1', name: 'Ana' } } })
    await expect(cancelDeletion()).resolves.toBe(true)
    expect(calls()).toEqual(['POST /api/account/delete/cancel', 'GET /api/me'])
    expect(mocks.setUser).toHaveBeenCalledWith({ id: 'u1', name: 'Ana' })
  })

  it('the cancel went through but /api/me fails: the store drops the deletion from the cancel itself', async () => {
    const deletion = { at: AT, requestedAt: REQ }
    mocks.user = { id: 'u1', name: 'Ana', deletion }
    answer({ 'POST /api/account/delete/cancel': { ok: true }, 'GET /api/me': httpError(503) })
    await expect(cancelDeletion()).resolves.toBe(true)
    expect(mocks.setUser).toHaveBeenCalledWith({ id: 'u1', name: 'Ana' })
    expect(mocks.setUser.mock.calls.every(([u]) => !('deletion' in u))).toBe(true)
  })

  it('false when the cancel did not get through; nothing thrown, nothing changed', async () => {
    answer({ 'POST /api/account/delete/cancel': netError() })
    await expect(cancelDeletion()).resolves.toBe(false)
    expect(mocks.setUser).not.toHaveBeenCalled()
  })
})

describe('the grace', () => {
  it('ends seven days after now, and its day reads short in the app language', () => {
    expect(GRACE_DAYS).toBe(7)
    const now = Date.UTC(2026, 9, 18, 12)
    expect(graceEnd(now)).toBe('2026-10-25T12:00:00.000Z')
    expect(deletionDay(graceEnd(now))).toMatch(/25/)
    expect(deletionDay('nope')).toBe('')
  })
})
