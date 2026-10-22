// @vitest-environment happy-dom
// /me/<old page>: a bookmark, a home-screen shortcut or a link from before the §5 merge lands on the
// renamed page (lib/tab-route.js PROFILE_RENAMED), not on Profile's root.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsRoute } from './settings/SettingsRoute.jsx'
import { preloadPages } from './settings/pages/index.js'
import { useStore } from '../store/useStore.js'
import { createFakeNutriTrace } from '../lib/nutrition/fake-nutritrace.js'

await preloadPages()
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.__APP_VERSION__ ??= 'test'

let host, root, seen
function Where() { seen = useLocation().pathname; return null }

beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const open = path => act(() => root.render(
  <MemoryRouter initialEntries={[path]}>
    <Where />
    <Routes>
      <Route path="/me" element={<SettingsRoute />} />
      <Route path="/me/:page" element={<SettingsRoute />} />
    </Routes>
  </MemoryRouter>,
))

describe('renamed Profile pages', () => {
  it.each([['look', 'appearance'], ['plan', 'schedule'], ['data', 'backup']])('/me/%s opens /me/%s', (from, to) => {
    open('/me/' + from)
    expect(seen).toBe('/me/' + to)
  })

  // Reminders need a push server: a guest in a browser has none, so the page itself sends it on.
  it('/me/reminders, which a guest in a browser does not have, goes to Profile', () => {
    open('/me/reminders')
    expect(seen).toBe('/me')
  })

  it('an unknown page still goes to Profile', () => {
    open('/me/nope')
    expect(seen).toBe('/me')
  })
})

// PR07 decision 2: the reminder settings live at /me/reminders; /me/notifications is the inbox.
describe('the reminder settings', () => {
  const user = useStore.getState().user
  // A signed-in Settings loads NutriTrace's settings on mount; the fake answers at the fetch boundary.
  beforeEach(() => {
    useStore.setState({ user: { id: 'u1', name: 'Dana' } })
    vi.stubGlobal('fetch', createFakeNutriTrace().fetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    useStore.setState({ user })
  })

  it('open at /me/reminders for a signed-in profile', async () => {
    open('/me/reminders')
    await act(async () => {})
    expect(seen).toBe('/me/reminders')
    expect(host.textContent).toContain('Reminders')
  })

  it('/me/notifications is not a Profile page any more', () => {
    act(() => root.render(
      <MemoryRouter initialEntries={['/me/notifications']}>
        <Where />
        <Routes>
          <Route path="/me/notifications" element={<p>inbox</p>} />
          <Route path="/me/:page" element={<SettingsRoute />} />
        </Routes>
      </MemoryRouter>,
    ))
    expect(seen).toBe('/me/notifications')
    expect(host.textContent).toBe('inbox')
  })
})
