// @vitest-environment happy-dom
// SettingsRoute: /me and /me/<page>. Redirects, an unknown page, the search hit handed on, and
// /me/account/delete, which resolves ahead of /me/:page the way App.jsx orders the routes.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DeleteAccountPage from './pages/DeleteAccountPage.jsx'
import StartedOverScreen from './pages/StartedOverScreen.jsx'
import { SettingsRoute } from './SettingsRoute.jsx'

const seenProps = vi.hoisted(() => ({ last: null }))
vi.mock('../Settings.jsx', () => ({ default: props => { seenProps.last = props; return <p>settings:{props.page || 'root'}</p> } }))
vi.mock('../train/gym/GymSetup.jsx', () => ({ default: () => <p>gym</p> }))
// The pages themselves are tested on their own; here only which route draws them.
vi.mock('./pages/DeleteAccountPage.jsx', () => ({ default: () => <p>delete account</p> }))
vi.mock('./pages/StartedOverScreen.jsx', () => ({ default: () => <p>started over</p> }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, seen
function Where() { seen = useLocation().pathname; return null }
beforeEach(() => { seenProps.last = null; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const open = entry => act(() => root.render(
  <MemoryRouter key={JSON.stringify(entry)} initialEntries={[entry]}>
    <Where />
    <Routes>
      <Route path="/me" element={<SettingsRoute />} />
      <Route path="/me/account/delete" element={<DeleteAccountPage />} />
      <Route path="/me/account/started-over" element={<StartedOverScreen />} />
      <Route path="/me/:page" element={<SettingsRoute />} />
    </Routes>
  </MemoryRouter>,
))

describe('SettingsRoute', () => {
  it('the root draws Settings with no page', () => {
    open('/me')
    expect(host.textContent).toBe('settings:root')
    expect(seenProps.last).toMatchObject({ page: null, find: null, via: null })
  })

  it('a page draws Settings with that page', () => {
    open('/me/units')
    expect(seenProps.last.page).toBe('units')
  })

  it('a renamed page goes to its new name, an unknown one to the root', () => {
    open('/me/look')
    expect(seen).toBe('/me/appearance')
    open('/me/nope')
    expect(seen).toBe('/me')
  })

  it('hands on the row a search hit asked for, and the row to flash if it is missing', () => {
    open({ pathname: '/me/units', state: { find: 'Weight unit', via: 'Language' } })
    expect(seenProps.last).toMatchObject({ page: 'units', find: 'Weight unit', via: 'Language' })
  })

  it('/me/account/delete is its own page, not an unknown Settings page', () => {
    open('/me/account/delete')
    expect(seen).toBe('/me/account/delete')
    expect(host.textContent).toBe('delete account')
    expect(seenProps.last).toBeNull()
  })

  it('/me/account/started-over is Start over\'s result, and /me/danger (the old page) opens Account', () => {
    open('/me/account/started-over')
    expect(host.textContent).toBe('started over')
    expect(seenProps.last).toBeNull()
    open('/me/danger')
    expect(seen).toBe('/me/account')
  })

  it('/me/equipment is Gym setup', () => {
    open('/me/equipment')
    expect(host.textContent).toBe('gym')
  })
})
