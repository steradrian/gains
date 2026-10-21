// @vitest-environment happy-dom
// The app's tab bar: the design system's GlassTabBar (its own tests, the pill's among them:
// ds/GlassTabBar.test.jsx) on the app's tabs, its navigation and its store. It is fixed on screen
// and its buttons must survive a store write (once a second for the whole of a rest) as the very
// same nodes.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TabBar from './TabBar.jsx'
import { DEF, useStore } from '../store/useStore.js'

const nav = vi.hoisted(() => ({ switchTab: vi.fn(), popToRoot: vi.fn(), switching: false }))
vi.mock('../lib/use-tab-nav.js', () => ({
  switchTab: nav.switchTab, popToRoot: nav.popToRoot, isSwitching: () => nav.switching,
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, originalS, originalUser

beforeEach(() => {
  const store = useStore.getState()
  originalS = store.S
  originalUser = store.user
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)), user: { id: 1, name: 'test' } })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  nav.switchTab.mockClear(); nav.popToRoot.mockClear(); nav.switching = false
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useStore.setState({ S: originalS, user: originalUser })
})

const buttons = () => [...host.querySelectorAll('#tabbar button')]
const tabs = () => buttons().filter(b => b.classList.contains('g-tab'))
const plus = () => host.querySelector('#tabbar .g-plus')
const bar = props => <TabBar tab="home" lit onPlus={() => {}} {...props} />
const running = () => useStore.getState().update(s => { s.active = { id: 'a', name: 'Push A', entries: [], cur: 0, start: Date.now() - 60_000 } }, false)

describe('the bar', () => {
  it('is Today · Train · + · Eat · Me in the design system root', () => {
    act(() => { root.render(bar()) })
    expect(host.querySelector('#tabbar').classList.contains('g-root')).toBe(true)
    expect(buttons().map(b => b.textContent)).toEqual(['Today', 'Train', '', 'Eat', 'Me'])
    expect(buttons()[2]).toBe(plus())
  })

  it('is not there for nobody signed in', () => {
    useStore.setState({ user: null })
    act(() => { root.render(bar()) })
    expect(host.querySelector('#tabbar')).toBeNull()
  })

  it('carries the stored accent as the design system preset, and follows it', () => {
    act(() => { useStore.getState().update(s => { s.accent = 'sky' }, false) })
    act(() => { root.render(bar()) })
    expect(host.querySelector('#tabbar').dataset.accent).toBe('cobalt')
    act(() => { useStore.getState().update(s => { s.accent = 'red' }, false) })
    expect(host.querySelector('#tabbar').dataset.accent).toBe('ember')
  })

  it('keeps the very same buttons across a store write', () => {
    act(() => { root.render(bar()) })
    const before = buttons()
    act(() => { useStore.getState().update(s => { s.restSec = 91 }, false) })
    buttons().forEach((el, i) => expect(el).toBe(before[i]))
  })

  it('lights the tab on screen, and none on a page every tab can open', () => {
    const want = { home: 0, train: 1, food: 2, progress: 3 }
    for (const [tab, i] of Object.entries(want)) {
      act(() => { root.render(bar({ tab })) })
      expect(tabs().map(b => b.getAttribute('aria-current')), tab).toEqual(tabs().map((_, j) => (j === i ? 'page' : null)))
    }
    act(() => { root.render(bar({ tab: 'progress', lit: false })) })
    expect(tabs().every(b => !b.getAttribute('aria-current'))).toBe(true)
  })

  it('switches to another tab, and takes the tab on screen back to its root', () => {
    act(() => { root.render(bar({ tab: 'train' })) })
    act(() => { tabs()[2].click() })
    expect(nav.switchTab).toHaveBeenCalledWith('food')
    act(() => { tabs()[3].click() })
    expect(nav.switchTab).toHaveBeenCalledWith('progress')
    act(() => { tabs()[1].click() })
    expect(nav.popToRoot).toHaveBeenCalledWith('train')
  })

  it('takes the unlit tab on screen back to its root too (Profile opened from it)', () => {
    act(() => { root.render(bar({ tab: 'food', lit: false })) })
    act(() => { tabs()[2].click() })
    expect(nav.popToRoot).toHaveBeenCalledWith('food')
  })

  it('does nothing while a switch is rebuilding the history: tabs and + both', () => {
    const onPlus = vi.fn()
    act(() => { root.render(bar({ onPlus })) })
    nav.switching = true
    act(() => { tabs()[1].click(); plus().click() })
    expect(nav.switchTab).not.toHaveBeenCalled()
    expect(onPlus).not.toHaveBeenCalled()
    nav.switching = false
    act(() => { plus().click() })
    expect(onPlus).toHaveBeenCalledOnce()
  })

  it('shows the live dot on Train while a workout runs, and names it', () => {
    act(() => { root.render(bar()) })
    expect(host.querySelector('.g-tab-dot')).toBeNull()
    act(() => { running() })
    expect(tabs()[1].querySelector('.g-tab-dot')).not.toBeNull()
    expect(tabs()[1].getAttribute('aria-label')).toBe('Train, workout in progress')
    // The + stays the +: it is never a Resume button.
    expect(plus().getAttribute('aria-label')).toBe('Add to Today')
  })
})
