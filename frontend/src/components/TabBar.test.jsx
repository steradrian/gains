// @vitest-environment happy-dom
// The tab bar is fixed on screen and re-renders on every store write — once a second for the
// whole of a rest. Its buttons must survive that: a component declared inside the render body is
// a new function each time, which React reads as a different type and rebuilds from scratch.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TabBar from './TabBar.jsx'
import { DEF, useStore } from '../store/useStore.js'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, originalS, originalUser, frames

beforeEach(() => {
  const store = useStore.getState()
  originalS = store.S
  originalUser = store.user
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)), user: { id: 1, name: 'test' } })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  navigate.mockClear()
  // Frames run only when a test says so: what the first paint looks like stays observable.
  frames = []
  window.requestAnimationFrame = vi.fn(cb => { frames.push(cb); return frames.length })
  window.cancelAnimationFrame = vi.fn()
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useStore.setState({ S: originalS, user: originalUser })
})

const tabs = () => [...host.querySelectorAll('#tabbar button')]
const bar = props => <TabBar mode="train" pathname="/train/home" onStart={() => {}} onPlus={() => {}} {...props} />
const runFrames = () => act(() => { const due = frames; frames = []; due.forEach(cb => cb()) })
const pillSlot = () => host.querySelector('.tab-pill-slot')

describe('the tab bar across a store write', () => {
  it('keeps the very same buttons instead of rebuilding them every tick', () => {
    act(() => { root.render(bar()) })
    const before = tabs()
    expect(before).toHaveLength(5)

    // What a rest does once a second: S is replaced, so everything reading it re-renders.
    act(() => { useStore.getState().update(s => { s.restSec = 91 }, false) })

    const after = tabs()
    expect(after).toHaveLength(before.length)
    after.forEach((el, i) => expect(el).toBe(before[i]))
  })

  it('still lights the tab for the route it is on, and follows a change of state', () => {
    act(() => { root.render(bar()) })
    expect(tabs()[0].className).toBe('on')
    expect(tabs()[0].getAttribute('aria-current')).toBe('page')
    expect(tabs()[1].className).toBe('')
    expect(tabs()[1].getAttribute('aria-current')).toBeNull()
    expect(tabs()[2].className).toBe('start')

    act(() => { useStore.getState().update(s => { s.active = { id: 'a', entries: [], cur: 0 } }, false) })
    expect(tabs()[2].className).toBe('start rec')
    expect(tabs()[0].className).toBe('on')
  })

  it('lights the tab a pushed page belongs to', () => {
    act(() => { root.render(bar({ pathname: '/train/history' })) })
    expect(tabs()[3].className).toBe('on')
    act(() => { root.render(bar({ pathname: '/train/muscles' })) })
    expect(tabs()[4].className).toBe('on')
  })
})

// v1.3.11 icon sweep: one icon per concept. Every tab carries its name under the icon, Start is a
// play button whether or not a session runs, and Exercises is the dumbbell (no more generic list).
describe('the tab icons and labels', () => {
  const icon = el => el.querySelector('svg')?.getAttribute('data-icon')
  const label = el => el.querySelector('span:last-child').textContent
  it('labels every tab and uses one icon per concept', () => {
    act(() => { root.render(bar()) })
    expect(tabs().map(icon)).toEqual(['house', 'calendar', 'play', 'chart', 'dumbbell'])
    expect(tabs().map(label)).toEqual(['Home', 'Plan', 'Start', 'Stats', 'Exercises'])

    act(() => { useStore.getState().update(s => { s.active = { id: 'a', entries: [], cur: 0 } }, false) })
    expect(icon(tabs()[2])).toBe('play')
    expect(label(tabs()[2])).toBe('Resume')
  })

  it('shows a minimized session’s running time, still named Resume', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 9, 5, 18, 0, 0))
      act(() => { useStore.getState().update(s => { s.active = { id: 'a', entries: [], cur: 0, start: Date.now() - 754_000 } }, false) })
      act(() => { root.render(bar()) })
      const start = tabs()[2]
      expect(label(start)).toBe('12:34')
      expect(start.getAttribute('aria-label')).toBe('Resume')
      act(() => { vi.advanceTimersByTime(2000) })
      expect(label(start)).toBe('12:36')
      expect(tabs()[2]).toBe(start)   // the same button, only its text ticks

      // a past workout being edited has no clock running
      act(() => { useStore.getState().update(s => { s.active.editingWorkoutId = 'w1' }, false) })
      expect(label(tabs()[2])).toBe('Edit workout')
    } finally { vi.useRealTimers() }
  })
})

describe('the Nutrition bar', () => {
  it('has Diary · Foods · + · Stats · Goals, the + opening a sheet rather than a route', () => {
    const onPlus = vi.fn()
    act(() => { root.render(bar({ mode: 'food', pathname: '/food/diary', onPlus })) })
    expect(tabs().map(b => b.textContent)).toEqual(['Diary', 'Foods', 'Add', 'Stats', 'Goals'])
    const plus = tabs()[2]
    expect(plus.getAttribute('aria-haspopup')).toBe('dialog')
    act(() => { plus.click() })
    expect(onPlus).toHaveBeenCalledOnce()
    expect(navigate).not.toHaveBeenCalled()
    act(() => { tabs()[4].click() })
    expect(navigate).toHaveBeenCalledWith('/food/goals')
  })

  it('keeps the + the accent while a workout runs: the Training segment carries that', () => {
    useStore.getState().update(s => { s.active = { id: 'a', entries: [], cur: 0, start: Date.now() } }, false)
    act(() => { root.render(bar({ mode: 'food', pathname: '/food/diary' })) })
    expect(tabs()[2].className).toBe('start')
  })

  it('keeps the disc the same element across a mode switch, and swaps the tabs', () => {
    act(() => { root.render(bar()) })
    const disc = tabs()[2]
    const home = tabs()[0]
    act(() => { root.render(bar({ mode: 'food', pathname: '/food/diary' })) })
    expect(tabs()[2]).toBe(disc)
    expect(tabs()[0]).not.toBe(home)
  })
})

describe('the sliding pill', () => {
  const slot = () => pillSlot().style.getPropertyValue('--slot')
  it('maps the four tabs onto the five slots, skipping the disc', () => {
    const at = { '/train/home': '0', '/train/plan': '1', '/train/stats': '3', '/train/library': '4' }
    for (const [pathname, s] of Object.entries(at)) {
      act(() => { root.render(bar({ pathname })) })
      expect(slot(), pathname).toBe(s)
      expect(pillSlot().className).toBe('tab-pill-slot')
    }
  })

  it('fades out where no tab is lit: the workout, a shared page', () => {
    act(() => { root.render(bar({ pathname: '/train/workout' })) })
    expect(pillSlot().className).toBe('tab-pill-slot off')
    act(() => { root.render(bar({ pathname: '/me' })) })
    expect(pillSlot().className).toBe('tab-pill-slot off')
  })

  it('does not slide on its first paint, only once two frames have gone by', () => {
    act(() => { root.render(bar({ pathname: '/train/stats' })) })
    const track = () => host.querySelector('.tab-pill-track')
    expect(track().className).toBe('tab-pill-track')
    runFrames()
    expect(track().className).toBe('tab-pill-track')
    runFrames()
    expect(track().className).toBe('tab-pill-track ready')
  })

  it('starts static again in the other mode instead of sliding across', () => {
    act(() => { root.render(bar()) })
    runFrames(); runFrames()
    expect(host.querySelector('.tab-pill-track.ready')).not.toBeNull()
    act(() => { root.render(bar({ mode: 'food', pathname: '/food/goals' })) })
    expect(host.querySelector('.tab-pill-track').className).toBe('tab-pill-track')
    expect(slot()).toBe('4')
  })

  it('is decorative', () => {
    act(() => { root.render(bar()) })
    expect(host.querySelector('.tab-pill-track').getAttribute('aria-hidden')).toBe('true')
  })
})
