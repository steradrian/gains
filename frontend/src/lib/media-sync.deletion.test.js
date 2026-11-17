// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMediaSync } from './media-sync.js'
import { createMediaStore, memoryBackend } from './media-store.js'
import { _resetMediaOwed } from './media-owed.js'

/* Photos and videos while the account is scheduled for deletion (the server answers uploads with
   423): nothing is sent while sync is paused, a 423 pauses it without backing the file off or
   refusing it, and the files go once the pause lifts. */
const MB = 1024 * 1024
const hex = c => c.repeat(64)
const refOf = hash => ({ kind: 'image', hash, mime: 'image/webp', size: 1000, width: 800, height: 600, at: 1 })
const AT = '2026-10-29T12:00:00.000Z'

function appStore(init) {
  let st = { ready: true, user: { id: 'u1' }, config: { media: { imageMB: 2, gifMB: 8, videoMB: 40, videoSec: 60, quotaMB: 200 } }, sync: { lastSynced: 0, paused: false }, S: { customEx: [] }, stashedMediaHashes: async () => new Set(), ...init }
  const subs = new Set()
  return {
    getState: () => st,
    setState: patch => { st = { ...st, ...patch }; for (const f of subs) f(st) },
    subscribe: f => { subs.add(f); return () => subs.delete(f) },
  }
}

let media, toast, api, apiUpload, storage
const make = store => createMediaSync({ store, media, api, apiUpload, apiBlob: vi.fn(), toast, allowed: () => true, now: () => 10_000_000, locks: null, storage })
const put = hash => media.put(hash, new Blob([new Uint8Array(10)]), { mime: 'image/webp', pending: true })
const S = { customEx: [{ id: 'a', media: refOf(hex('a')) }, { id: 'b', media: refOf(hex('b')) }] }

beforeEach(() => {
  _resetMediaOwed()
  media = createMediaStore(memoryBackend(), { now: () => 10_000_000 })
  toast = vi.fn()
  api = vi.fn(async (path, { body }) => ({ missing: JSON.parse(body).hashes, usage: { bytes: 0, count: 0, quotaBytes: 200 * MB } }))
  apiUpload = vi.fn(async () => ({ ok: true, existed: false }))
  const mem = new Map()
  storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) }
})
afterEach(() => { vi.useRealTimers() })

describe('media sync during a scheduled deletion', () => {
  it('paused: asks nothing and sends nothing; the files stay pending on this device', async () => {
    await put(hex('a')); await put(hex('b'))
    await make(appStore({ S, sync: { lastSynced: 0, paused: AT } })).syncMedia({ force: true })
    expect(api).not.toHaveBeenCalled()
    expect(apiUpload).not.toHaveBeenCalled()
    expect([...media.pendingNow()].sort()).toEqual([hex('a'), hex('b')])
  })

  it('a 423 pauses sync, stops the run, and neither refuses the file nor backs it off', async () => {
    await put(hex('a')); await put(hex('b'))
    const pauseSync = vi.fn()
    const store = appStore({ S, pauseSync })
    apiUpload.mockRejectedValueOnce(Object.assign(new Error('deletion scheduled'), { status: 423, code: 'deletion-scheduled', data: { at: AT } }))
    const sync = make(store)
    await sync.syncMedia({ force: true })
    expect(pauseSync).toHaveBeenCalledWith(AT)
    expect(apiUpload).toHaveBeenCalledTimes(1)   // the run stopped at the first refusal
    expect(toast).not.toHaveBeenCalled()
    expect((await media.get(hex('a'))).rejected).toBe(false)
    expect([...media.pendingNow()].sort()).toEqual([hex('a'), hex('b')])

    // Cancelled: an ordinary (not forced) run sends both, the refused one included, with no backoff to wait out.
    await sync.syncMedia()
    expect(apiUpload).toHaveBeenCalledTimes(3)
    expect([...media.pendingNow()]).toEqual([])
  })

  it('the pause lifting schedules a run', async () => {
    vi.useFakeTimers()
    await put(hex('a'))
    const store = appStore({ S, sync: { lastSynced: 0, paused: AT } })
    const sync = make(store)
    const stop = sync.start(store)
    await vi.advanceTimersByTimeAsync(5000)
    expect(apiUpload).not.toHaveBeenCalled()
    store.setState({ sync: { lastSynced: 0, paused: false } })
    await vi.advanceTimersByTimeAsync(2500)
    expect(apiUpload).toHaveBeenCalledTimes(1)
    stop()
  })
})
