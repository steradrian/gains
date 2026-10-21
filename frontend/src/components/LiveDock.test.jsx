// @vitest-environment happy-dom
// LiveDock: the one dock above the tab bar while a workout runs and you are elsewhere, built on the
// design system's Dock. The dot, the routine and how long it has run; a rest's or a hold's
// countdown and progress, +30 and Skip, Ready and Dismiss; a tap anywhere else opens the workout
// unless a tab switch is in flight; the page keeps room under it. (App.tab-shell.test.jsx has the
// same dock in the whole app.)
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ nav: vi.fn(), switching: false }))
vi.mock('react-router-dom', async importOriginal => ({ ...(await importOriginal()), useNavigate: () => mocks.nav }))
vi.mock('../lib/use-tab-nav.js', async importOriginal => ({ ...(await importOriginal()), isSwitching: () => mocks.switching }))
vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn() }))

import LiveDock from './LiveDock.jsx'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

let host, root, originalS

beforeEach(() => {
  vi.useFakeTimers()
  mocks.nav.mockClear()
  mocks.switching = false
  originalS = useStore.getState().S
  useStore.setState({ S: { ...originalS, sound: false, active: { id: 'a', name: 'Push A', entries: [], cur: 0, start: Date.now() - 125_000 } } })
  useUI.setState({ timer: null, work: null, timerFlashId: 0 })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.render(null))
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useStore.setState({ S: originalS })
  host.remove()
  vi.useRealTimers()
})

const mount = () => act(() => root.render(<LiveDock />))
const dock = () => host.querySelector('#timer')
const main = () => host.querySelector('.g-dock-main')
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)

describe('LiveDock', () => {
  it('is the #timer host the shell places, a design-system root with the Dock inside', () => {
    mount()
    expect(dock().classList.contains('dock')).toBe(true)
    expect(dock().classList.contains('g-root')).toBe(true)
    expect(dock().hasAttribute('data-accent')).toBe(true)
    expect(dock().querySelector('.g-dock.g-dock-running')).not.toBeNull()
  })

  it('shows the live dot, the routine and how long it has run', () => {
    mount()
    expect(host.querySelector('.g-dock-live')).not.toBeNull()
    expect(host.querySelector('.g-dock-text b').textContent).toBe('Push A')
    expect(host.querySelector('.g-dock-clock').textContent).toBe('2:05')
    expect(main().querySelector('.g-sr').textContent).toBe('Open workout')
  })

  it('calls an unnamed session Workout', () => {
    useStore.setState({ S: { ...useStore.getState().S, active: { id: 'a', name: '', entries: [], cur: 0, start: Date.now() } } })
    mount()
    expect(host.querySelector('.g-dock-text b').textContent).toBe('Workout')
  })

  it('keeps room at the bottom of the page while it is there, and gives it back', () => {
    mount()
    expect(document.body.classList.contains('live-docked')).toBe(true)
    act(() => root.render(null))
    expect(document.body.classList.contains('live-docked')).toBe(false)
  })

  it('a tap on the body opens the workout, unless a tab switch is in flight', () => {
    mount()
    act(() => main().click())
    expect(mocks.nav).toHaveBeenCalledWith('/train/workout')
    mocks.nav.mockClear()
    mocks.switching = true
    act(() => main().click())
    expect(mocks.nav).not.toHaveBeenCalled()
  })

  it('has no countdown, progress or buttons while nothing is resting, and a Ready line that is empty', () => {
    mount()
    expect(host.querySelector('.g-dock-count')).toBeNull()
    expect(host.querySelector('.g-dock-bar')).toBeNull()
    expect(host.querySelector('.g-dock-acts')).toBeNull()
    expect(dock().querySelector('[role="status"]').textContent).toBe('')
  })

  it('carries a rest: its countdown and progress, +30 and Skip', () => {
    act(() => useUI.getState().startRest(60))
    mount()
    expect(host.querySelector('.g-dock-count').textContent).toBe('1:00')
    expect(host.querySelector('.g-dock-bar i').style.transform).toBe('scaleX(1)')
    expect([...host.querySelectorAll('.g-dock-acts button')].map(b => b.textContent)).toEqual(['30s', 'Skip'])
    expect(button('30s').getAttribute('aria-label')).toBe('Add 30 seconds')
    act(() => button('30s').click())
    expect(useUI.getState().timer.left).toBeGreaterThan(80)
    act(() => button('Skip').click())
    expect(useUI.getState().timer).toBeNull()
    expect(dock()).not.toBeNull()
  })

  it('stops offering +30 at the longest rest', () => {
    act(() => useUI.getState().startRest(900))
    mount()
    expect(button('30s').disabled).toBe(true)
  })

  it('says Ready when the rest is over, in the count and aloud, and offers Dismiss alone', () => {
    act(() => useUI.getState().startRest(1))
    act(() => vi.advanceTimersByTime(1000))
    mount()
    expect(host.querySelector('.g-dock-count').textContent).toBe('Ready')
    expect(dock().querySelector('[role="status"]').textContent).toBe('Ready')
    expect([...host.querySelectorAll('.g-dock-acts button')].map(b => b.textContent)).toEqual(['Dismiss'])
    act(() => button('Dismiss').click())
    expect(useUI.getState().timer).toBeNull()
    expect(dock().querySelector('[role="status"]').textContent).toBe('')
  })

  it('shows a timed hold\'s countdown and outlines the dock, with no rest buttons', () => {
    act(() => useUI.getState().startWork(30, 'Hold', vi.fn()))
    mount()
    expect(host.querySelector('.g-dock').classList.contains('g-dock-hold')).toBe(true)
    expect(host.querySelector('.g-dock-count').textContent).toBe('0:30')
    expect(host.querySelector('.g-dock-bar')).not.toBeNull()
    expect(host.querySelector('.g-dock-acts')).toBeNull()
  })
})
