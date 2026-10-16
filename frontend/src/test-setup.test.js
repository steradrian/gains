// @vitest-environment happy-dom
// The guard in src/test-setup.js: a request nobody stubbed is refused by name, not sent.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { takeRefused } from './test-setup.js'

afterEach(() => vi.unstubAllGlobals())

describe('the network guard', () => {
  it('refuses an unstubbed fetch and names the URL, instead of connecting to the page origin', async () => {
    await expect(fetch('/api/anything')).rejects.toThrow(/Unstubbed fetch to \/api\/anything/)
    expect(takeRefused()).toHaveLength(1)
  })

  it('fails the test that made the request even when the caller swallows the rejection', async () => {
    await fetch('/api/anything').catch(() => {})
    const [refused] = takeRefused()   // what the afterEach hook would otherwise throw
    expect(refused.message).toMatch(/Unstubbed fetch to \/api\/anything/)
  })

  it('refuses an unstubbed XMLHttpRequest', () => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', '/api/anything')
    expect(() => xhr.send()).toThrow(/Unstubbed XMLHttpRequest to \/api\/anything/)
    expect(takeRefused()).toHaveLength(1)
  })

  it('leaves a test that stubs fetch alone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}')))
    await expect((await fetch('/api/anything')).json()).resolves.toEqual({ ok: true })
  })
})
