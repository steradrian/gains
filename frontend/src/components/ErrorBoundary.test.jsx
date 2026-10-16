// @vitest-environment happy-dom
// The crash gate: one bad render shows a way back, not a white screen. It is an error, not an empty
// state, so it is a LoadError (role=alert) with the Reload and Discard buttons beside it.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import ErrorBoundary from './ErrorBoundary.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const Boom = () => { throw new Error('bad render') }

let host, root, reload
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  reload = vi.fn()
  vi.stubGlobal('location', { reload })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  vi.restoreAllMocks(); vi.unstubAllGlobals()
})

const mount = () => act(() => root.render(<ErrorBoundary><Boom /></ErrorBoundary>))
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === label)

describe('ErrorBoundary', () => {
  it('renders its children while nothing throws', () => {
    act(() => root.render(<ErrorBoundary><p>fine</p></ErrorBoundary>))
    expect(host.textContent).toBe('fine')
  })

  it('shows the crash as an alert with its title, not as an empty state', () => {
    useStore.setState(s => ({ S: { ...s.S, active: null } }))
    mount()
    const alert = host.querySelector('[role=alert]')
    expect(alert.textContent).toContain('Something went wrong')
    expect(alert.textContent).toContain('This screen could not be drawn. Your data is safe on this device.')
    expect(host.querySelector('.empty')).toBeNull()
  })

  it('Reload Gains reloads the page', () => {
    useStore.setState(s => ({ S: { ...s.S, active: null } }))
    mount()
    act(() => button('Reload Gains').click())
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('offers to discard a running workout, and does so before reloading', () => {
    useStore.setState(s => ({ S: { ...s.S, active: { id: 'w' } } }))
    mount()
    act(() => button('Discard the running workout').click())
    expect(useStore.getState().S.active).toBeNull()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('has no discard button when no workout is running', () => {
    useStore.setState(s => ({ S: { ...s.S, active: null } }))
    mount()
    expect(button('Discard the running workout')).toBeUndefined()
  })
})
