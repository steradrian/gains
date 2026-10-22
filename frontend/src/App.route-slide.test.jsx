// @vitest-environment happy-dom
// Page slides in the real shell (HashRouter, the tab machinery, Modals): a pushed page slides in over
// the one it leaves and a Back slides it out, while a tab switch, a replace, a drawer and a Back onto
// the same page do not; each page keeps its own scroll and the slide leaves one #app behind.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { nav } from './lib/nav.js'
import { back as tabBack } from './lib/use-tab-nav.js'
import { dsAccentFor } from './lib/ds-accent.js'
import { SLIDE_MS } from './lib/route-transition.js'

vi.mock('./lib/sound.js', async importOriginal => ({ ...(await importOriginal()), setPlayOnSilent: vi.fn(), setVibrate: vi.fn(), setAlarmBuzzer: vi.fn() }))
vi.mock('./lib/api.js', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, originalS, scrolls
const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) }) }
const wait = ms => act(async () => { await new Promise(r => setTimeout(r, ms)) })
const hash = () => window.location.hash
const tab = label => [...document.querySelectorAll('#tabbar button')].find(b => b.textContent === label)
const exercises = () => [...document.querySelectorAll('.g-gact')].find(b => b.textContent === 'Exercises')
const click = async el => { await act(async () => { el.click() }); await settle() }
const go = async fn => { await act(async () => { fn() }); await settle() }
const back = async () => { await act(async () => { window.history.back() }); await settle() }
const layers = () => [...document.querySelectorAll('.g-route')]
const sliding = () => layers().map(l => l.dataset.slide).filter(Boolean)
const roles = () => layers().map(l => l.dataset.route)
const apps = () => document.querySelectorAll('#app')
// The slide is over, whichever way it ends.
const finish = () => wait(SLIDE_MS + 200)
const scrolledTo = y => {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

async function launch(at) {
  window.history.pushState({ marker: true }, '', '#/not-the-app')
  window.history.pushState(null, '', at)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<App />) })
  await settle()
}

beforeAll(async () => {
  await Promise.all([import('./components/search/SearchOverlay.jsx'), import('./components/search/header-motion.jsx')])
}, 60_000)

beforeEach(() => {
  originalS = useStore.getState().S
  localStorage.setItem('gym_guest', '1')
  sessionStorage.clear()
  useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), routines: [{ id: 'rt', name: 'Push', emoji: null, ex: [] }] } })
  scrolls = []
  window.scrollTo = vi.fn((x, y) => scrolls.push(y))
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useUI.getState().closeAll()
  useStore.setState({ S: originalS })
  localStorage.removeItem('gym_guest')
  delete document.documentElement.dataset.motion
})

describe('page slides', () => {
  it('rests as one page: a single #app, nothing lifted out of the document', async () => {
    await launch('#/train')
    expect(sliding()).toEqual([])
    expect(apps()).toHaveLength(1)
  })

  it('a pushed page slides in over the page it leaves, which is held still and stops being #app', async () => {
    await launch('#/train')
    await click(exercises())
    expect(hash()).toBe('#/train/exercises')
    expect(sliding()).toEqual(['push', 'push'])
    expect(roles()).toEqual(['out', 'in'])
    // the root is marked, so its pinned header moves with it; the pushed page is not
    expect(layers().map(l => l.hasAttribute('data-root'))).toEqual([true, false])
    expect(apps()).toHaveLength(1)
    const leaving = layers()[0]
    expect(leaving.querySelector('#app')).toBeNull()
    // it keeps #app's layout (index.css :is(#app, .app-out)), and both layers start from the same box
    expect(leaving.firstElementChild.classList.contains('app-out')).toBe(true)
    expect(layers().map(l => l.style.getPropertyValue('--route-y'))).toEqual(['0px', '0px'])
    expect(leaving.firstElementChild.hasAttribute('inert')).toBe(true)
    expect(leaving.firstElementChild.getAttribute('aria-hidden')).toBe('true')
    expect(leaving.textContent).toContain('Exercises')
    expect(layers()[1].querySelector('#app')).not.toBeNull()
    // the tab bar is not a page: it stays out of the layers
    expect(layers().some(l => l.contains(document.querySelector('#tabbar')))).toBe(false)

    await finish()
    expect(sliding()).toEqual([])
    expect(layers()).toHaveLength(1)
    expect(apps()).toHaveLength(1)
  })

  it('Back slides the other way, and each page comes back where it was scrolled', async () => {
    await launch('#/train')
    scrolledTo(300)
    await click(exercises())
    await finish()
    scrolledTo(40)
    scrolls.length = 0
    await back()
    expect(hash()).toBe('#/train')
    expect(sliding()).toEqual(['pop', 'pop'])
    expect(roles()).toEqual(['out', 'in'])
    // the document is too short to hold a position while both pages are lifted: it lands at the end
    expect(scrolls).not.toContain(300)
    await finish()
    expect(sliding()).toEqual([])
    expect(scrolls.at(-1)).toBe(300)
  })

  it('the stage is the app\'s: one ground behind the layers, the same element through a push and a Back', async () => {
    await launch('#/train')
    const stage = document.querySelector('.g-app-stage')
    expect(document.querySelectorAll('.g-app-stage')).toHaveLength(1)
    expect(stage.hasAttribute('data-pushed')).toBe(false)
    await click(exercises())
    // two layers slide, but neither carries a ground of its own, and the shared one never remounts
    expect(layers()).toHaveLength(2)
    expect(document.querySelector('.g-app-stage')).toBe(stage)
    expect(document.querySelectorAll('.g-app-stage')).toHaveLength(1)
    expect(layers().every(l => l.hasAttribute('data-shared'))).toBe(true)
    expect(layers().some(l => l.contains(stage))).toBe(false)
    expect(stage.hasAttribute('data-pushed')).toBe(true)
    await finish()
    await back()
    expect(document.querySelector('.g-app-stage')).toBe(stage)
    await finish()
    expect(document.querySelector('.g-app-stage')).toBe(stage)
    expect(stage.hasAttribute('data-pushed')).toBe(false)
  })

  it('every root tab sits on the stage art in the person\'s accent', async () => {
    await launch('#/train')
    {
      const stage = document.querySelector('.g-app-stage')
      expect(stage.querySelector('.g-stage-art')).not.toBeNull()
      expect(stage.querySelectorAll('.g-stage-glow')).toHaveLength(2)
      expect(stage.querySelector('.g-stage-rings')).not.toBeNull()
      expect(stage.getAttribute('data-accent')).toBe(dsAccentFor(useStore.getState().S))
      expect(document.querySelector('.g-route .g-stage')).not.toBeNull()
      expect(stage.hasAttribute('data-pushed')).toBe(false)
    }
  })

  it('does not slide between root tabs', async () => {
    await launch('#/train')
    await click(tab('Me'))
    expect(hash()).toBe('#/me')
    expect(sliding()).toEqual([])
    expect(layers()).toHaveLength(1)
  })

  it('does not slide on a replace', async () => {
    await launch('#/train')
    await go(() => nav('/train/history', { replace: true }))
    expect(hash()).toBe('#/train/history')
    expect(sliding()).toEqual([])
    expect(layers()).toHaveLength(1)
  })

  it('does not slide for a drawer opening or closing', async () => {
    await launch('#/train')
    await go(() => useUI.getState().openSheet(close => <div role="dialog" aria-label="Drawer"><button onClick={close}>Close drawer</button></div>))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(sliding()).toEqual([])
    await back()
    expect(hash()).toBe('#/train')
    expect(sliding()).toEqual([])
    expect(layers()).toHaveLength(1)
  })

  // Profile sits at the first history entry, with the origin tab put aside: Back is the shell's back
  // (lib/back.js sends a pushed page there), not history.back(), which would leave the app's own entries.
  it('the avatar pushes Profile with a push slide; the shell back returns to the origin tab with a pop', async () => {
    await launch('#/train')
    await click(document.querySelector('.g-shdr .g-sbtn:not(.g-bell)'))
    expect(sliding()).toEqual(['push', 'push'])
    await finish()
    expect(hash()).toBe('#/me')
    await go(() => tabBack())
    expect(hash()).toBe('#/train')
    expect(sliding()).toEqual(['pop', 'pop'])
    await finish()
    expect(layers()).toHaveLength(1)
  })

  it('cross-fades instead, with no transform, when the app is told to keep still', async () => {
    // Profile › Appearance › Reduce motion; the shell marks the root for it (App.jsx).
    useStore.setState({ S: { ...useStore.getState().S, reduceMotion: true } })
    await launch('#/train')
    await click(exercises())
    expect(sliding()).toEqual(['fade', 'fade'])
    await wait(400)
    expect(sliding()).toEqual([])
  })
})
