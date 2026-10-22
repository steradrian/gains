// @vitest-environment happy-dom
// The Friends routes sit behind one gate: someone without Friends lands on Me, not on a page that
// cannot work; and every Friends path is a route of the app, with its screen.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from '../../ds/render.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ available: true, watched: 0 }))
vi.mock('../../store/useStore.js', () => ({ useStore: selector => selector({ user: { id: 'u1' } }) }))
vi.mock('../../lib/friends/api.js', () => ({ friendsAvailable: () => mocks.available }))
vi.mock('../../lib/friends/use-friends.js', () => ({ useFriendsMe: () => { mocks.watched++; return {} } }))

import FriendsGate from './FriendsGate.jsx'

const view = useView()
let here = null
function Probe() { here = useLocation(); return null }

const mount = path => view.render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route element={<FriendsGate />}>
        <Route path="/me/groups" element={<p>groups page</p>} />
      </Route>
      <Route path="/me" element={<p>me page</p>} />
    </Routes>
    <Probe />
  </MemoryRouter>,
)

beforeEach(() => { mocks.available = true; mocks.watched = 0 })

describe('FriendsGate', () => {
  it('shows the page where Friends exists, and keeps the cache fresh while it is on show', () => {
    mount('/me/groups')
    expect(view.host.textContent).toBe('groups page')
    expect(mocks.watched).toBeGreaterThan(0)
  })

  it('sends someone without Friends (signed out, demo, no server, a server without it) to Me', () => {
    mocks.available = false
    mount('/me/groups')
    expect(view.host.textContent).toBe('me page')
    expect(here.pathname).toBe('/me')
  })
})

describe('App.jsx', () => {
  const app = readFileSync(join(process.cwd(), 'src/App.jsx'), 'utf8')

  it('has the seven Friends routes behind the gate, before /me/:page', () => {
    const paths = ['/me/groups', '/me/groups/join/:code', '/me/groups/sharing', '/me/groups/cheers', '/me/groups/:id', '/me/groups/:id/member/:uid', '/me/groups/:id/challenge/:cid']
    const gate = app.indexOf('<Route element={<FriendsGate />}>')
    const generic = app.indexOf('<Route path="/me/:page"')
    expect(gate).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(generic)
    for (const path of paths) {
      const at = app.indexOf(`<Route path="${path}"`)
      expect(at, path).toBeGreaterThan(gate)
      expect(at, path).toBeLessThan(generic)
    }
  })

  it('each screen is its own file with a default export, so a later milestone replaces only its own', () => {
    for (const name of ['Groups', 'Join', 'Sharing', 'Cheers', 'Group', 'Member', 'Challenge']) {
      expect(app).toContain(`import ${name}Screen from './views/friends/${name}Screen.jsx'`)
      expect(readFileSync(join(process.cwd(), `src/views/friends/${name}Screen.jsx`), 'utf8')).toMatch(/export default function \w+Screen/)
    }
  })
})
