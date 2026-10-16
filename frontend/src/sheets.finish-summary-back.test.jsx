// @vitest-environment happy-dom
/* The PWA's and Android's back on the finish summary: the browser walks the sheet's history entry off
 * (popstate) and the sheet, which is not locked, closes as "Nice!" does and leaves the workout screen
 * once. Run through the real Modals and the real `back` of lib/use-tab-nav.js (wrapped only to count
 * its calls), so the entry bookkeeping is what a phone would do, not a mock's. */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals, { scrollRestorePending } from './components/Modals.jsx'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { finishWorkout } from './sheets.jsx'
import { back } from './lib/use-tab-nav.js'
import { sheetEntriesLive } from './lib/nav.js'
import { EXDB } from './lib/exercises-data.js'

vi.mock('./lib/use-tab-nav.js', async importOriginal => {
  const real = await importOriginal()
  return { ...real, back: vi.fn(real.back) }
})
vi.mock('./lib/media-sync.js', () => ({ syncMedia: vi.fn(async () => {}) }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, popstates
const S = () => useStore.getState().S
const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) }) }
const countPops = () => { popstates += 1 }

beforeEach(async () => {
  localStorage.clear()
  document.body.innerHTML = '<div id="app"></div><div id="root"></div>'
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
  vi.mocked(back).mockClear()
  window.addEventListener('popstate', countPops)
  root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(<Modals />) })
  // A page that mounts on the previous test's sheet entry steps off it once (Modals.jsx): that
  // step is not this test's.
  await settle()
  popstates = 0
  const st = JSON.parse(JSON.stringify(DEF))
  st.active = {
    id: 'fin', d: '2026-09-28', start: Date.now() - 20 * 60000, routineId: null, name: 'Core', bw: null, cur: 0,
    entries: [{ id: EXDB[0].id, target: { mode: 'reps', sets: 1, reps: 5, weight: 40 }, sets: [{ w: 40, r: 5, done: true }] }],
  }
  useStore.setState({ S: st, user: null })
  act(() => finishWorkout())
  await settle()
})
afterEach(async () => {
  await act(async () => { useUI.getState().closeAll(); root.unmount() })
  await settle()
  while (scrollRestorePending()) await act(async () => { await new Promise(r => setTimeout(r, 25)) })
  await settle()
  // The walk off a sheet's entry that closing it started has landed by now, not in the next test.
  window.removeEventListener('popstate', countPops)
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  document.body.innerHTML = ''
})

describe('back on the unlocked finish summary', () => {
  it('rides on a history entry of its own', () => {
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(history.state?.gainsSheet).toBe(true)
    expect(sheetEntriesLive()).toBe(1)
  })

  it('closes the sheet and leaves the workout screen exactly once', async () => {
    await act(async () => { history.back() })
    await settle()
    expect(popstates).toBe(1)
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(back).toHaveBeenCalledTimes(1)
    expect(S().workouts).toHaveLength(1)
    expect(S().active).toBeNull()
  })

  it('spends the entry once: nothing is left to walk, and no second step back is taken', async () => {
    await act(async () => { history.back() })
    await settle()
    await new Promise(r => setTimeout(r, 450))
    await settle()
    expect(sheetEntriesLive()).toBe(0)
    expect(history.state?.gainsSheet).toBeFalsy()
    expect(popstates).toBe(1)
    expect(back).toHaveBeenCalledTimes(1)
  })
})
