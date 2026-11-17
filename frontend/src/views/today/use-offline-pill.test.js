// @vitest-environment happy-dom
// T1.14's pill: Offline while the connection is down, then Syncing, Saved and gone.
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { SAVED_MS, SYNC_MAX_MS, nextPhase, useOfflinePill } from './use-offline-pill.js'

const run = (steps, phase = 'idle') => steps.map(s => (phase = nextPhase(phase, { back: false, online: true, ...s })))

describe('nextPhase', () => {
  it('nothing to say while the connection is fine', () => {
    expect(run([{ off: false, status: 'ok' }, { off: false, status: 'pending' }])).toEqual(['idle', 'idle'])
  })

  it('offline, then syncing once the network is back and the retry is on its way, then saved', () => {
    expect(run([
      { off: true, online: false, status: 'offline' },
      { off: true, online: true, back: true, status: 'offline' },
      { off: false, status: 'ok' },
    ])).toEqual(['offline', 'syncing', 'saved'])
  })

  it('a server out of reach on a working network stays offline', () => {
    expect(run([{ off: true, online: true, status: 'offline' }])).toEqual(['offline'])
  })

  it('a change still waiting after the spell is syncing; a refusal or error leaves it to the banner', () => {
    expect(run([{ off: true, status: 'offline' }, { off: false, status: 'pending' }, { off: false, status: 'ok' }])).toEqual(['offline', 'syncing', 'saved'])
    expect(run([{ off: true, status: 'offline' }, { off: false, status: 'auth' }])).toEqual(['offline', 'idle'])
  })

  it('saved stays saved until its timer, whatever comes next while the connection is up', () => {
    expect(nextPhase('saved', { off: false, online: true, status: 'pending' })).toBe('saved')
  })
})

describe('useOfflinePill', () => {
  let host, root, seen
  function Probe() { seen = useOfflinePill(); return null }
  const sync = status => ({ status, offline: status === 'offline', pending: true, auth: false, lastError: status === 'offline' ? { status: 0, code: 'network' } : null, lastSynced: 0 })
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })

  it('counts the changes waiting while offline, then says Saved and goes', () => {
    vi.useFakeTimers()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    useStore.setState({ user: { id: 'u1' }, sync: sync('offline'), unsyncedChanges: () => ({ owed: true, count: 3 }) })
    host = document.createElement('div')
    root = createRoot(host)
    act(() => root.render(createElement(Probe)))
    expect(seen).toEqual({ state: 'offline', waiting: 3 })
    act(() => useStore.setState({ sync: sync('ok') }))
    expect(seen).toEqual({ state: 'saved', waiting: 0 })
    act(() => { vi.advanceTimersByTime(SAVED_MS) })
    expect(seen).toBeNull()
  })

  it('says nothing for a device with no server', () => {
    useStore.setState({ user: null, sync: sync('offline') })
    host = document.createElement('div')
    root = createRoot(host)
    act(() => root.render(createElement(Probe)))
    expect(seen).toBeNull()
  })

  describe(`Syncing gives up after ${SYNC_MAX_MS / 1000} s`, () => {
    let onLine = false
    const setOnline = value => {
      onLine = value
      act(() => { window.dispatchEvent(new Event(value ? 'online' : 'offline')) })
    }
    // Offline with no network, then the network back while the server is still out of reach:
    // the retry is on its way, so Syncing.
    const toSyncing = () => {
      vi.useFakeTimers()
      globalThis.IS_REACT_ACT_ENVIRONMENT = true
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => onLine })
      onLine = false
      useStore.setState({ user: { id: 'u1' }, sync: sync('offline'), unsyncedChanges: () => ({ owed: true, count: 2 }) })
      host = document.createElement('div')
      root = createRoot(host)
      act(() => root.render(createElement(Probe)))
      expect(seen).toEqual({ state: 'offline', waiting: 2 })
      setOnline(true)
      expect(seen).toEqual({ state: 'syncing', waiting: 0 })
    }
    afterEach(() => { delete navigator.onLine })

    it('back to Offline when the retry never got through', () => {
      toSyncing()
      act(() => { vi.advanceTimersByTime(SYNC_MAX_MS - 1) })
      expect(seen.state).toBe('syncing')
      act(() => { vi.advanceTimersByTime(1) })
      expect(seen).toEqual({ state: 'offline', waiting: 2 })
    })

    it('gone when the connection is up but a change still waits', () => {
      toSyncing()
      act(() => useStore.setState({ sync: sync('pending') }))
      expect(seen.state).toBe('syncing')
      act(() => { vi.advanceTimersByTime(SYNC_MAX_MS) })
      expect(seen).toBeNull()
    })
  })
})
