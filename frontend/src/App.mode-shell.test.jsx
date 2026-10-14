// @vitest-environment happy-dom
// The two-mode shell end to end, on the real HashRouter and the page's own history: switching
// modes during a running workout, the Android-style run of back presses afterwards (it must walk
// down one mode and never bounce into the other), each mode's last page and scroll position, and
// the launch into the last mode used or the running workout.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

vi.mock('./lib/sound.js', async importOriginal => ({ ...(await importOriginal()), setPlayOnSilent: vi.fn(), setVibrate: vi.fn(), setAlarmBuzzer: vi.fn() }))
vi.mock('./lib/api.js', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, originalS, scrolls
// A switch can take a few history walks, each landing on a later task: give them room.
const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) }) }
const hash = () => window.location.hash
const idx = () => window.history.state?.idx
const seg = label => [...document.querySelectorAll('.seg-mode button')].find(b => b.textContent === label)
const tab = label => [...document.querySelectorAll('#tabbar button')].find(b => b.textContent.includes(label))
const click = async el => { await act(async () => { el.click() }); await settle() }
const back = async () => { await act(async () => { window.history.back() }); await settle() }

async function launch(at) {
  window.history.replaceState(null, '', at)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<App />) })
  await settle()
}
function quit() {
  act(() => root.unmount())
  host.remove()
}

beforeEach(() => {
  originalS = useStore.getState().S
  localStorage.setItem('gym_guest', '1')
  localStorage.removeItem('gym_last_mode')
  sessionStorage.clear()
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)) })
  scrolls = []
  window.scrollTo = vi.fn((x, y) => scrolls.push(y))
})
afterEach(() => {
  quit()
  useUI.getState().closeAll()
  useStore.setState({ S: originalS })
  localStorage.removeItem('gym_guest')
})

const running = () => useStore.getState().update(s => { s.active = { id: 'a', name: 'Push A', entries: [], cur: 0, start: Date.now() - 60_000 } }, false)

describe('switching modes', () => {
  it('replaces history instead of pushing, so back never bounces between modes', async () => {
    running()
    await launch('#/train/home')
    await click(tab('Stats'))
    expect(hash()).toBe('#/train/stats')
    expect(idx()).toBe(1)

    await click(seg('Nutrition'))
    expect(hash()).toBe('#/food/diary')
    // Back to the first entry, not one more on top: one back press from here leaves the app.
    expect(idx()).toBe(0)
    expect(tab('Diary').getAttribute('aria-current')).toBe('page')

    await click(tab('Goals'))
    expect(hash()).toBe('#/food/goals')
    await back()
    expect(hash()).toBe('#/food/diary')
    expect(idx()).toBe(0)
  })

  it('comes back to the page each mode was left on, its own back stack under it', async () => {
    running()
    await launch('#/train/home')
    await click(tab('Stats'))
    await click(seg('Nutrition'))
    await click(tab('Goals'))

    // The running workout shows on the Training segment from Nutrition.
    expect(seg('Training').getAttribute('aria-label')).toBe('Training, workout in progress')
    await click(seg('Training'))
    expect(hash()).toBe('#/train/stats')
    expect(idx()).toBe(1)
    await back()
    expect(hash()).toBe('#/train/home')

    await click(seg('Nutrition'))
    expect(hash()).toBe('#/food/goals')
    await back()
    expect(hash()).toBe('#/food/diary')
  })

  it('puts each mode\'s page back where it was scrolled to', async () => {
    await launch('#/train/home')
    await click(tab('Stats'))
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true })
    await act(async () => { window.dispatchEvent(new Event('scroll')) })
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })

    await click(seg('Nutrition'))
    expect(scrolls[scrolls.length - 1]).toBe(0)
    await click(seg('Training'))
    expect(hash()).toBe('#/train/stats')
    expect(scrolls[scrolls.length - 1]).toBe(640)
  })

  it('the + sheet\'s workout row goes into Training on top of its stack', async () => {
    await launch('#/train/home')
    await click(seg('Nutrition'))
    await click(tab('Add'))
    const row = [...document.querySelectorAll('.plus-sheet .lrow')].find(r => r.textContent.includes('Start workout'))
    await click(row)
    await settle()
    expect(hash()).toBe('#/train/workout')
    expect(idx()).toBe(1)
    await back()
    expect(hash()).toBe('#/train/home')
  })
})

describe('a history the mirror does not match', () => {
  it('a sheet\'s entry left under the page does not stop the walk short', async () => {
    await launch('#/train/stats')
    // What Modals.jsx leaves behind when a sheet closes as the app moves on.
    window.history.pushState({ ...window.history.state, openGymSheet: true }, '')
    await click(tab('Exercises'))
    const t0 = Date.now()
    await click(seg('Nutrition'))
    expect(hash()).toBe('#/food/diary')
    // Landed by walking, not by the watchdog giving up on the walk.
    expect(Date.now() - t0).toBeLessThan(300)
    // On the app's first entry itself, not on the sheet's entry above it: back leaves the app.
    expect(idx()).toBe(0)
    expect(window.history.state.openGymSheet).toBeUndefined()
  })

  it('a walk back that never lands does not freeze the screen', async () => {
    // A position the browser cannot walk back from: history.go does nothing, no popstate.
    window.history.replaceState({ idx: 5, key: 'odd', usr: null }, '', '#/train/home')
    await launch('#/train/home')
    await act(async () => { seg('Nutrition').click() })
    await act(async () => { await new Promise(r => setTimeout(r, 450)) })
    await settle()
    expect(hash()).toBe('#/food/diary')
    expect(document.querySelector('.seg-mode button.on').textContent).toBe('Nutrition')
    await click(tab('Goals'))
    expect(hash()).toBe('#/food/goals')
  })

  it('browser Forward onto the mode that was left steps straight back', async () => {
    await launch('#/train/home')
    await click(tab('Stats'))
    await click(seg('Nutrition'))
    expect(hash()).toBe('#/food/diary')
    await act(async () => { window.history.forward() })
    await settle()
    expect(hash()).toBe('#/food/diary')
  })
})

describe('a shared page', () => {
  it('Me opened from Nutrition keeps the Nutrition bar and goes back there', async () => {
    await launch('#/train/home')
    await click(seg('Nutrition'))
    await click(document.querySelector('.mode-avatar'))
    expect(hash()).toBe('#/me')
    expect(tab('Diary')).toBeTruthy()
    expect(document.querySelector('.seg-mode')).toBeNull()   // a pushed page: back + title instead
    await click(document.querySelector('.sp-back'))
    expect(hash()).toBe('#/food/diary')
    expect(idx()).toBe(0)
  })
})

describe('the launch', () => {
  it('opens the mode used last', async () => {
    await launch('#/train/home')
    await click(seg('Nutrition'))
    quit()
    sessionStorage.clear()
    await launch('#/')
    expect(hash()).toBe('#/food/diary')
  })

  it('opens the workout when one is running', async () => {
    localStorage.setItem('gym_last_mode', 'food')
    running()
    await launch('#/')
    expect(hash()).toBe('#/train/workout')
  })

  it('takes an old route to where it lives now, query kept', async () => {
    await launch('#/stats?focus=weekly-volume')
    expect(hash()).toBe('#/train/stats?focus=weekly-volume')
  })
})
