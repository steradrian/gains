// @vitest-environment happy-dom
// The food, meal and recipe editors create their record on the first autosave and then replace
// `/new` with the real id. The route layer must keep the same page (same element, same inputs)
// through that replace, or the form remounts and the keyboard goes.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { nav } from './lib/nav.js'

vi.mock('./lib/sound.js', async importOriginal => ({ ...(await importOriginal()), setPlayOnSilent: vi.fn(), setVibrate: vi.fn(), setAlarmBuzzer: vi.fn() }))
vi.mock('./lib/api.js', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, originalS
const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) }) }
const layers = () => [...document.querySelectorAll('.g-route')]

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
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)) })
  window.scrollTo = vi.fn()
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useUI.getState().closeAll()
  useStore.setState({ S: originalS })
  localStorage.removeItem('gym_guest')
})

describe('the editor route layer', () => {
  it.each(['foods', 'meals', 'recipes'])('%s: /new becoming /12 keeps the same page element', async kind => {
    await launch(`#/food/my-foods/${kind}/new`)
    expect(layers()).toHaveLength(1)
    const before = layers()[0]
    await act(async () => { nav(`/food/my-foods/${kind}/12`, { replace: true }) })
    await settle()
    expect(window.location.hash).toBe(`#/food/my-foods/${kind}/12`)
    expect(layers()).toHaveLength(1)
    expect(layers()[0]).toBe(before)
  })
})
