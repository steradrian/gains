// For a test that renders a signed-in page which reads the hub on mount (Settings asks for
// NutriTrace's settings and the sync status) but is not about the hub: the hub is unreachable.
// That is what these tests have always seen, since nothing listens on the jsdom page's port; this
// says it instead of leaving it to a real connection attempt (see src/test-setup.js).
import { vi } from 'vitest'

export function stubHubOffline() {
  const fetch = vi.fn(async () => { throw new TypeError('Failed to fetch') })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
