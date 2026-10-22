// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* The two R5 confirms of signing out (St2SignOutAll, St2SignOutWaiting): what each says, that
   confirming runs the sign-out exactly once, and that Cancel leaves everything as it was. What the
   sign-out does is the store's, through leaveServer (components/ServerSync.leave.test.jsx). */
const mocks = vi.hoisted(() => ({ sheets: [], leaveServer: null }))
vi.mock('../../../store/useStore.js', () => {
  const snap = () => ({ S: {} })
  const useStore = selector => (selector ? selector(snap()) : snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => {
  const snap = () => ({ openSheet: (render, opts) => { mocks.sheets.push({ render, opts }); return {} } })
  const useUI = selector => (selector ? selector(snap()) : snap())
  useUI.getState = snap
  return { useUI }
})
vi.mock('../../../components/ServerSync.jsx', () => ({ leaveServer: (...a) => mocks.leaveServer(...a) }))

const { confirmSignOutEverywhere, signOutWaiting } = await import('./sign-out-sheets.js')

const mounted = []
function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  act(() => root.render(el))
  return host
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent === text)
// The drawer the last call opened, drawn alone.
const opened = () => mount(mocks.sheets.at(-1).render(() => {}))

beforeEach(() => {
  mocks.sheets.length = 0
  mocks.leaveServer = vi.fn(async () => {})
})
afterEach(() => { act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })

describe('A2.5 sign out everywhere', () => {
  it('says what happens, and signs out once on confirm', () => {
    const onConfirm = vi.fn()
    confirmSignOutEverywhere({ onConfirm })
    const host = opened()
    expect(mocks.sheets.at(-1).opts.variant).toBe('ds')
    expect(host.querySelector('h2').textContent).toBe('Sign out everywhere?')
    expect(host.textContent).toContain('Phones paired with it are disconnected and have to be paired again.')
    // The server ends this browser's session too, so the copy does not promise it stays.
    expect(host.textContent).toContain('including this one')
    expect(onConfirm).not.toHaveBeenCalled()
    act(() => button(host, 'Sign out everywhere').click())
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('names the workout that waits on this device, when there is one', () => {
    confirmSignOutEverywhere({ running: ' You have a workout running.', onConfirm: vi.fn() })
    expect(opened().textContent).toContain('You have a workout running.')
  })

  it('Cancel signs nothing out', () => {
    const onConfirm = vi.fn()
    confirmSignOutEverywhere({ onConfirm })
    const host = opened()
    act(() => button(host, 'Cancel').click())
    expect(onConfirm).not.toHaveBeenCalled()
    expect(mocks.leaveServer).not.toHaveBeenCalled()
  })
})

describe('A2.6 sign out with changes waiting', () => {
  it('counts the changes, says they are kept on this device, and Sign out anyway goes ahead with force', () => {
    const done = vi.fn()
    signOutWaiting({ kind: 'signout', count: 3, done })
    const host = opened()
    expect(host.querySelector('h2').textContent).toBe('3 changes not synced')
    expect(host.textContent).toContain('Some changes on this device have not reached your server.')
    expect(host.textContent).toContain('kept on this device, and added back when it connects as this account again')
    expect(host.textContent).toContain('Wait until you’re back online and they sync by themselves.')
    expect(mocks.leaveServer).not.toHaveBeenCalled()
    act(() => button(host, 'Sign out anyway').click())
    expect(mocks.leaveServer).toHaveBeenCalledTimes(1)
    expect(mocks.leaveServer).toHaveBeenCalledWith('signout', { done, force: true })
  })

  it('one change is singular, photos and videos that are waiting are listed, and sign out everywhere keeps its kind', () => {
    const done = vi.fn()
    signOutWaiting({ kind: 'everywhere', count: 1, media: 2, done })
    const host = opened()
    expect(host.querySelector('h2').textContent).toBe('1 change not synced')
    expect(host.querySelector('li').textContent).toBe('2 photos or videos have not reached your server yet.')
    act(() => button(host, 'Sign out anyway').click())
    expect(mocks.leaveServer).toHaveBeenCalledWith('everywhere', { done, force: true })
  })

  it('a count the store does not know says the changes are waiting without a number', () => {
    signOutWaiting({ kind: 'signout', count: 0, media: 1, done: vi.fn() })
    expect(opened().querySelector('h2').textContent).toBe('Changes not synced')
  })

  it('Cancel stays signed in: nothing is attempted', () => {
    signOutWaiting({ kind: 'signout', count: 3, done: vi.fn() })
    const host = opened()
    act(() => button(host, 'Cancel').click())
    expect(mocks.leaveServer).not.toHaveBeenCalled()
  })
})
