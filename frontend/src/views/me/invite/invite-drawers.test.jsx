// @vitest-environment happy-dom
// The Invite page's drawers on their own: New invite (M5.1) and a Waiting invite's menu.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type } from '../../../ds/render.test-util.js'
import { useUI } from '../../../store/useUI.js'
import { inviteMenuSheet, newInviteSheet } from './invite-drawers.jsx'

const mounted = []
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
const button = (host, label) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === label)

function draw(render, closeFn) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(render(closeFn)))
  return host
}
const renderTop = () => {
  const sheet = useUI.getState().sheets.at(-1)
  return draw(sheet.render, () => useUI.getState().closeSheet(sheet.id))
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  document.body.innerHTML = ''
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('New invite', () => {
  it('starts the field with the name it was given and cuts typing at the server\'s limit', () => {
    newInviteSheet({ name: 'Vlad', canShare: true, onCreate: async () => null })
    const input = renderTop().querySelector('input')
    expect(input.value).toBe('Vlad')
    expect(input.maxLength).toBe(40)
  })

  it('hands the typed name to onCreate, and closes on success', async () => {
    const onCreate = vi.fn(async () => null)
    newInviteSheet({ canShare: true, onCreate })
    const host = renderTop()
    type(host.querySelector('input'), 'Andrei')
    await act(async () => { button(host, 'Create and share').click() })
    await flush()
    expect(onCreate).toHaveBeenCalledWith({ name: 'Andrei', requestId: undefined, share: true })
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('allows an empty name', async () => {
    const onCreate = vi.fn(async () => null)
    newInviteSheet({ canShare: false, onCreate })
    const host = renderTop()
    await act(async () => { button(host, 'Create and copy link').click() })
    await flush()
    expect(onCreate).toHaveBeenCalledWith({ name: '', requestId: undefined, share: false })
  })

  it('shows the failure as an alert, stays open, and can try again', async () => {
    const onCreate = vi.fn().mockResolvedValueOnce('offline').mockResolvedValueOnce(null)
    newInviteSheet({ canShare: false, onCreate })
    const host = renderTop()
    await act(async () => { button(host, 'Create and copy link').click() })
    await flush()
    expect(host.querySelector('[role="alert"]').textContent).toContain('offline')
    expect(useUI.getState().sheets).toHaveLength(1)
    await act(async () => { button(host, 'Create and copy link').click() })
    await flush()
    expect(onCreate).toHaveBeenCalledTimes(2)
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('ignores a second tap while the first is in flight', async () => {
    let finish
    const onCreate = vi.fn(() => new Promise(resolve => { finish = resolve }))
    newInviteSheet({ canShare: true, onCreate })
    const host = renderTop()
    await act(async () => { button(host, 'Create and copy link').click() })
    await act(async () => { button(host, 'Create and copy link').click() })
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(button(host, 'Create and share').disabled).toBe(true)
    await act(async () => { finish(null) })
  })
})

describe('the Waiting invite menu', () => {
  const props = () => ({ title: 'Mara', line: 'Waiting', canShare: true, onCopy: vi.fn(), onShare: vi.fn(), onRevoke: vi.fn() })

  it('closes, then copies or shares', () => {
    const p = props()
    inviteMenuSheet(p)
    const host = renderTop()
    act(() => { button(host, 'Copy link').click() })
    expect(p.onCopy).toHaveBeenCalledTimes(1)
    expect(useUI.getState().sheets).toHaveLength(0)
    inviteMenuSheet(p)
    const again = renderTop()
    act(() => { button(again, 'Share link').click() })
    expect(p.onShare).toHaveBeenCalledTimes(1)
  })

  it('revokes only after the confirm panel, and closes the menu with it', () => {
    const p = props()
    inviteMenuSheet(p)
    const menu = renderTop()
    act(() => { button(menu, 'Revoke').click() })
    expect(p.onRevoke).not.toHaveBeenCalled()
    const panel = useUI.getState().sheets[0].panels[0]
    const confirm = draw(panel.render, () => useUI.getState().closeSheet(panel.id))
    act(() => { button(confirm, 'Revoke').click() })
    expect(p.onRevoke).toHaveBeenCalledTimes(1)
    expect(useUI.getState().sheets).toHaveLength(0)
  })
})
