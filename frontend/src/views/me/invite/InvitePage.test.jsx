// @vitest-environment happy-dom
// Invite a friend, the admin's page (M5.0 to M5.3): the route over the gallery's in-memory backend.
// The list and its groups, the card's two wordings, loading, the load error and Try again, the
// asks, the create flow with its toast and Revoke, a refused create, a Waiting invite's menu and
// revoke confirm, New link on an expired one, and the member's placeholder.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, type, useView } from '../../../ds/render.test-util.js'
import { ASKS, MARA, NAMELESS, memoryBackend } from '../../../dev/screens/states/me-invite-fixture.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import InviteRoute from './InviteRoute.jsx'

const view = useView()
const mounted = []

const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
const text = () => view.host.textContent
const button = (host, label) => [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent.trim()) === label)
const rowFor = title => [...view.host.querySelectorAll('.g-grow')].find(r => r.querySelector('b').textContent === title)

// The drawer on top of the sheet stack, drawn the way the app's host would.
function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

// The sub-panel on top of the drawer on top (the revoke confirm opens from the menu as one).
function renderPanel() {
  const panel = useUI.getState().sheets.at(-1).panels.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(panel.render(() => useUI.getState().closeSheet(panel.id))))
  return host
}

let savedUser
beforeEach(() => {
  savedUser = useStore.getState().user
  useStore.setState({ user: { id: 'u_admin', name: 'Adrian', admin: true } })
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  useStore.setState({ user: savedUser })
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
})

const show = async (options, canShare = true) => {
  const backend = memoryBackend(options)
  vi.spyOn(backend, 'create')
  vi.spyOn(backend, 'revoke')
  view.render(<InviteRoute backend={backend} canShare={canShare} />)
  await flush()
  return backend
}

describe('the page', () => {
  it('titles the page, explains the invite with the lifetime from the constant, and groups the list', async () => {
    await show()
    expect(view.host.querySelector('h1').textContent).toBe('Invite a friend')
    expect(text()).toContain('Admins can invite · links that work once')
    expect(text()).toContain('Bring a friend in')
    expect(text()).toContain('Gains is invite-only, and admins send the invites. Each link works once and lasts 7 days.')
    expect(button(view.host, 'Create an invite link')).toBeTruthy()
    expect([...view.host.querySelectorAll('.g-ssec h2')].map(h => h.textContent)).toEqual(['Waiting', 'Joined', 'Expired'])
    expect(view.host.querySelector('.g-ssec-act').textContent).toBe('2')
    expect(rowFor('Mara').querySelector('.g-grow-k').textContent).toMatch(/^Waiting · expires /)
    expect(rowFor('Radu').querySelector('.g-grow-k').textContent).toMatch(/^Joined /)
    expect(rowFor('Vlad').querySelector('.g-grow-k').textContent).toMatch(/^Expired /)
    expect(text()).not.toContain('never opened')
  })

  it('uses the open sign-up wording when the server says sign-up is open', async () => {
    await show({ inviteOnly: false })
    expect(text()).toContain('Sign-up is open, so invites are optional here. They only record who invited whom.')
    expect(text()).not.toContain('Gains is invite-only')
  })

  it('shows only the card and its button when there is nothing to list', async () => {
    await show({ invites: [] })
    expect(view.host.querySelector('.g-ssec')).toBeNull()
    expect(view.host.querySelector('.g-sempty')).toBeNull()
    expect(button(view.host, 'Create an invite link')).toBeTruthy()
  })

  it('shows skeleton rows while the list loads', async () => {
    await show({ loadNever: true })
    expect(view.host.querySelectorAll('.inv-sk')).toHaveLength(3)
    expect(view.host.querySelector('.g-ssec')).toBeNull()
  })

  it('shows an invite with no name as "Invite" and the first characters of its code', async () => {
    await show({ invites: [MARA, NAMELESS] })
    expect(rowFor('Invite E5F6…')).toBeTruthy()
    expect(text()).not.toContain(NAMELESS.code)
  })

  it('shows a member only the title until the ask is built (invite-M3), and no way to create', async () => {
    useStore.setState({ user: { id: 'u_m', name: 'Mara', admin: false } })
    await show()
    expect(view.host.querySelector('h1').textContent).toBe('Invite a friend')
    expect(button(view.host, 'Create an invite link')).toBeUndefined()
  })
})

describe('Couldn\'t load invites', () => {
  it('keeps the header and card, shows the search scene with Try again, and Create stays usable', async () => {
    await show({ loadFails: 'always' })
    expect(view.host.querySelector('h1').textContent).toBe('Invite a friend')
    const empty = view.host.querySelector('.g-sempty')
    expect(empty.classList.contains('g-glass')).toBe(false)
    expect(empty.querySelector('b').textContent).toBe('Couldn’t load invites')
    expect(empty.textContent).toContain('Check your connection. Links you already sent still work.')
    expect(view.host.querySelector('.g-ssec')).toBeNull()
    click(button(view.host, 'Create an invite link'))
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('loads the list on Try again', async () => {
    await show({ loadFails: 'once' })
    click(button(view.host, 'Try again'))
    await flush()
    expect(view.host.querySelector('.g-sempty')).toBeNull()
    expect(rowFor('Mara')).toBeTruthy()
  })
})

describe('Asked', () => {
  it('lists the asks with their note, or the day when there is none, above Waiting', async () => {
    await show({ requests: ASKS })
    expect([...view.host.querySelectorAll('.g-ssec h2')].map(h => h.textContent)).toEqual(['Asked', 'Waiting', 'Joined', 'Expired'])
    expect(rowFor('Dana').querySelector('.g-grow-k').textContent).toBe('My training partner Andrei')
    expect(rowFor('Paul').querySelector('.g-grow-k').textContent).toMatch(/^Asked /)
  })

  it('answers an ask: the drawer names it, the invite goes with its requestId, and the ask leaves', async () => {
    const backend = await show({ requests: ASKS })
    click(button(view.host, 'New invite: Dana'))
    const drawer = renderTop()
    expect(drawer.querySelector('.inv-ask').textContent).toBe('Dana My training partner Andrei')
    await act(async () => { button(drawer, 'Create and copy link').click() })
    await flush()
    expect(backend.create).toHaveBeenCalledWith({ name: '', requestId: 'ask1' })
    expect(rowFor('Dana')).toBeUndefined()
    expect(rowFor('Paul')).toBeTruthy()
  })
})

describe('creating an invite', () => {
  it('opens New invite with the hint, both buttons, and no note field', async () => {
    await show()
    click(button(view.host, 'Create an invite link'))
    const drawer = renderTop()
    expect(useUI.getState().sheets[0].variant).toBe('ds')
    expect(drawer.querySelector('.g-bs h2').textContent).toBe('New invite')
    expect(drawer.querySelector('.g-tfield-label').textContent).toBe('Their name')
    expect(drawer.querySelector('.g-tfield-hint').textContent).toBe('Fills in their name when they open the link. They can change it.')
    expect(drawer.querySelector('input').maxLength).toBe(40)
    expect(drawer.querySelectorAll('input, textarea')).toHaveLength(1)
    expect([...drawer.querySelectorAll('.g-bs-foot button')].map(b => b.textContent)).toEqual(['Create and copy link', 'Create and share'])
  })

  it('leaves Create and share out where the system has no share sheet', async () => {
    await show({}, false)
    click(button(view.host, 'Create an invite link'))
    expect([...renderTop().querySelectorAll('.g-bs-foot button')].map(b => b.textContent)).toEqual(['Create and copy link'])
  })

  it('puts the new row on top of Waiting, toasts it with Revoke, and Revoke is not an Undo', async () => {
    const backend = await show()
    click(button(view.host, 'Create an invite link'))
    const drawer = renderTop()
    type(drawer.querySelector('input'), 'Andrei')
    await act(async () => { button(drawer, 'Create and copy link').click() })
    await flush()
    expect(backend.create).toHaveBeenCalledWith({ name: 'Andrei', requestId: undefined })
    const first = view.host.querySelector('.inv-group .g-grow')
    expect(first.querySelector('b').textContent).toBe('Andrei')
    expect(first.querySelector('.g-grow-k').textContent).toBe('Waiting · created now · link copied')
    expect(first.querySelector('.g-tag').textContent).toBe('New')
    expect(useUI.getState().toastMsg).toBe('Invite for Andrei created and link copied')
    expect(useUI.getState().toastAction.label).toBe('Revoke')
    expect(useUI.getState().toastAction.ms).toBe(8000)

    await act(async () => { useUI.getState().toastAction.run() })
    await flush()
    expect(backend.revoke).toHaveBeenCalledTimes(1)
    expect(useUI.getState().toastMsg).toBe('Invite revoked')
    expect(useUI.getState().toastAction).toBeNull()
    expect(rowFor('Andrei')).toBeUndefined()
  })

  it('says "link shared" for Create and share when the share sheet resolved', async () => {
    await show()
    click(button(view.host, 'Create an invite link'))
    const drawer = renderTop()
    await act(async () => { button(drawer, 'Create and share').click() })
    await flush()
    expect(view.host.querySelector('.inv-group .g-grow .g-grow-k').textContent).toBe('Waiting · created now · link shared')
    expect(useUI.getState().toastMsg).toBe('Invite created')
  })

  it('sends the admin to the list when the copy failed, and does not say the link was copied', async () => {
    await show({ deliver: null })
    click(button(view.host, 'Create an invite link'))
    const drawer = renderTop()
    await act(async () => { button(drawer, 'Create and copy link').click() })
    await flush()
    expect(useUI.getState().toastMsg).toBe('Invite created. Copy its invite link from the list.')
    expect(view.host.querySelector('.inv-group .g-grow .g-grow-k').textContent).toBe('Waiting · created now')
  })

  it('keeps the drawer open with the error when the server refuses, and adds no row', async () => {
    await show({ createFails: 'Too many invites. Try again later.' })
    click(button(view.host, 'Create an invite link'))
    const drawer = renderTop()
    await act(async () => { button(drawer, 'Create and copy link').click() })
    await flush()
    expect(drawer.querySelector('[role="alert"]').textContent).toContain('Too many invites. Try again later.')
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().toastMsg).toBe('')
    expect(view.host.querySelectorAll('.inv-group')).toHaveLength(3)
  })
})

describe('a Waiting invite', () => {
  const openMenu = async canShare => {
    const backend = await show({}, canShare)
    click(rowFor('Mara'))
    return { backend, menu: renderTop() }
  }

  it('opens a menu with Copy link, Share link and Revoke', async () => {
    const { menu } = await openMenu(true)
    expect(menu.querySelector('.g-bs h2').textContent).toBe('Mara')
    expect([...menu.querySelectorAll('.g-menuitem')].map(b => b.textContent)).toEqual(['Copy link', 'Share link', 'Revoke'])
  })

  it('leaves Share link out where the system has no share sheet', async () => {
    const { menu } = await openMenu(false)
    expect([...menu.querySelectorAll('.g-menuitem')].map(b => b.textContent)).toEqual(['Copy link', 'Revoke'])
  })

  it('asks before revoking, as a sub-panel and not a drawer on a drawer, and revokes on confirm', async () => {
    const { backend, menu } = await openMenu(true)
    click(button(menu, 'Revoke'))
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().sheets[0].panels).toHaveLength(1)
    const confirm = renderPanel()
    expect(confirm.querySelector('.g-bs h2').textContent).toBe('Revoke this invite?')
    expect(confirm.textContent).toContain('Anyone who has it can no longer use it.')
    expect(backend.revoke).not.toHaveBeenCalled()
    await act(async () => { button(confirm, 'Revoke').click() })
    await flush()
    expect(backend.revoke).toHaveBeenCalledWith(MARA.code)
    expect(rowFor('Mara')).toBeUndefined()
    expect(useUI.getState().toastMsg).toBe('Invite revoked')
  })

  it('keeps the invite when the confirm is cancelled', async () => {
    const { backend, menu } = await openMenu(true)
    click(button(menu, 'Revoke'))
    click(button(renderPanel(), 'Cancel'))
    expect(useUI.getState().sheets[0].panels).toHaveLength(0)
    expect(backend.revoke).not.toHaveBeenCalled()
    expect(rowFor('Mara')).toBeTruthy()
  })
})

describe('an expired invite', () => {
  it('offers New link, which opens the drawer with the same name', async () => {
    await show()
    click(button(view.host, 'New link: Vlad'))
    expect(renderTop().querySelector('input').value).toBe('Vlad')
  })
})
