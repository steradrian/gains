// @vitest-environment happy-dom
// The header of a mode's root screens: the labelled Training | Nutrition switch, the recording dot
// while a workout runs, and the avatar into Me, which carries the connection dot that used to sit
// on the Home tab and the Settings gear (#369, #330).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ModeHeader from './ModeHeader.jsx'
import { DEF, useStore } from '../store/useStore.js'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, originalS, originalUser, originalSync
beforeEach(() => {
  const store = useStore.getState()
  originalS = store.S; originalUser = store.user; originalSync = store.sync
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)), user: { id: 1, name: 'robin' } })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  navigate.mockClear()
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useStore.setState({ S: originalS, user: originalUser, sync: originalSync })
})

const segs = () => [...host.querySelectorAll('.seg-mode button')]
const avatar = () => host.querySelector('.mode-avatar')

describe('the mode switch', () => {
  it('names both modes and marks the one on screen', () => {
    act(() => { root.render(<ModeHeader mode="food" onSwitch={() => {}} />) })
    expect(segs().map(b => b.textContent)).toEqual(['Training', 'Nutrition'])
    expect(segs().map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
    expect(host.querySelector('.seg-mode').style.getPropertyValue('--i')).toBe('1')
  })

  it('asks for the other mode, and does nothing for the one already on screen', () => {
    const onSwitch = vi.fn()
    act(() => { root.render(<ModeHeader mode="train" onSwitch={onSwitch} />) })
    act(() => { segs()[0].click() })
    expect(onSwitch).not.toHaveBeenCalled()
    act(() => { segs()[1].click() })
    expect(onSwitch).toHaveBeenCalledWith('food')
  })

  it('shows the recording dot on Training while a workout runs, and says so', () => {
    act(() => { root.render(<ModeHeader mode="food" onSwitch={() => {}} />) })
    expect(segs()[0].querySelector('.live-dot')).toBeNull()
    expect(segs()[0].getAttribute('aria-label')).toBeNull()
    act(() => { useStore.getState().update(s => { s.active = { id: 'a', entries: [], cur: 0, start: Date.now() } }, false) })
    expect(segs()[0].querySelector('.live-dot')).not.toBeNull()
    expect(segs()[0].getAttribute('aria-label')).toBe('Training, workout in progress')
    // A past workout being edited is not running.
    act(() => { useStore.getState().update(s => { s.active.editingWorkoutId = 'w1' }, false) })
    expect(segs()[0].querySelector('.live-dot')).toBeNull()
  })
})

describe('the avatar', () => {
  it('opens Me', () => {
    act(() => { root.render(<ModeHeader mode="train" onSwitch={() => {}} />) })
    expect(avatar().textContent).toBe('R')
    act(() => { avatar().click() })
    expect(navigate).toHaveBeenCalledWith('/me')
  })

  it('carries the connection dot only while the banner is switched off', () => {
    useStore.setState({ sync: { status: 'error', lastError: { status: 502 }, pending: true } })
    act(() => { root.render(<ModeHeader mode="train" onSwitch={() => {}} />) })
    expect(avatar().querySelector('.tab-dot')).toBeNull()
    act(() => { useStore.getState().update(s => { s.connStatus = false }, false) })
    expect(avatar().querySelector('.tab-dot')).not.toBeNull()
    expect(avatar().getAttribute('aria-label')).toBe('Me, Connection problem')
    act(() => { useStore.setState({ sync: { status: 'ok', lastError: null, pending: false } }) })
    expect(avatar().querySelector('.tab-dot')).toBeNull()
    expect(avatar().getAttribute('aria-label')).toBe('Me')
  })
})
