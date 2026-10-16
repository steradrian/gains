// Runs before every test file (vite.config.js, test.setupFiles).
//
// No test may reach a real network. Under happy-dom a relative URL such as '/api/x' resolves
// against vitest's default page URL, http://localhost:3000, so a test that forgot to stub fetch
// did not fail: it connected to whatever was listening on port 3000, and with nothing there the
// rejection was swallowed by the code under test, or came back as ECONNREFUSED only when the
// request outlived the test. That made it a flake that depended on timing and on the machine
// (and a test passing against a dev server running on port 3000). The fetch and XHR installed
// here refuse instead, and the test that made the request fails every time, even when the code
// under test swallows the rejection. A test that wants a response stubs fetch itself
// (vi.stubGlobal, vi.spyOn, or an assignment to globalThis.fetch), which replaces this one.
import { afterEach } from 'vitest'

let refused = []

const refuse = (kind, url) => {
  const err = new Error(
    `Unstubbed ${kind} to ${url} in a test. Stub it in the test (vi.stubGlobal('fetch', ...)); ` +
    'tests do not use the network.'
  )
  refused.push(err)
  return err
}

// The requests refused since the last call, for the one test that refuses on purpose.
export const takeRefused = () => refused.splice(0)

afterEach(() => {
  const [first] = takeRefused()
  if (first) throw first
})

if (typeof globalThis.fetch === 'function') {
  globalThis.fetch = function refuseFetch(input) {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input)
    return Promise.reject(refuse('fetch', url))
  }
}

if (typeof globalThis.XMLHttpRequest === 'function') {
  const { open, send } = globalThis.XMLHttpRequest.prototype
  globalThis.XMLHttpRequest.prototype.open = function refuseOpen(method, url, ...rest) {
    this.refusedUrl = String(url)
    return open.call(this, method, url, ...rest)
  }
  globalThis.XMLHttpRequest.prototype.send = function refuseSend(...args) {
    if (this.refusedUrl !== undefined) throw refuse('XMLHttpRequest', this.refusedUrl)
    return send.apply(this, args)
  }
}
