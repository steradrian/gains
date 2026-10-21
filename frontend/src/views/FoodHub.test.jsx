// @vitest-environment happy-dom
// The Eat root against the foundation's fake, routed: the rail's taps (a past day to the Day page,
// today to Today, a day to come not tappable), the week hero's numbers, the action row, food
// tracking off and Set up food tracking, the redirects of the old library addresses. The diary the
// old root held lives on Today and the Day page (views/shared); its tests went with it.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { navToDay } from '../lib/day-route.js'
import { foodPickerSheet } from '../components/FoodPickerSheet.jsx'
import { scanToSelection } from '../components/scan-to-selection.js'
import { __test as diaryIndex, useDiaryIndex } from '../lib/nutrition/diary-index.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { createFakeNutriTrace, fixtureDay, fixtureSettings } from '../lib/nutrition/fake-nutritrace.js'
import FoodRedirect from './eat/FoodRedirect.jsx'
import FoodHub from './FoodHub.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../lib/day-route.js', async importOriginal => ({ ...(await importOriginal()), navToDay: vi.fn() }))
vi.mock('../components/FoodPickerSheet.jsx', () => ({ foodPickerSheet: vi.fn() }))
vi.mock('../components/scan-to-selection.js', () => ({ scanToSelection: vi.fn() }))
vi.mock('../ds/Illustration.jsx', () => ({ default: ({ name }) => <i data-scene={name} /> }))

// The board's Sunday. Only Date is faked, so the polling below still runs on real timers.
const TODAY = '2026-10-18'
const day = n => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
let host, nt
const mounted = []

const settle = async check => {
  const end = Date.now() + 3000
  for (;;) {
    try { check(); return } catch (e) {
      if (Date.now() > end) throw e
      await act(async () => { await new Promise(r => setTimeout(r, 25)) })
    }
  }
}
const tap = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
const named = label => [...host.querySelectorAll('button, a')].find(el => (el.getAttribute('aria-label') || el.textContent).trim() === label)
const cells = () => [...host.querySelectorAll('.g-rail-page:not([inert]) .g-rd')]

function Where() { const l = useLocation(); return <div data-where>{l.pathname + l.search}</div> }

function mount(path = '/food') {
  host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/food" element={<FoodHub />} />
        <Route path="/food/foods" element={<FoodRedirect to="/food/my-foods?tab=foods" />} />
        <Route path="/food/meals" element={<FoodRedirect to="/food/my-foods?tab=meals" />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  ))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(TODAY + 'T12:00:00'))
  // Mon 12 to Sat 17 logged at about the goal, Tue well over it.
  const days = Object.fromEntries([-6, -5, -4, -3, -2, -1].map(n => [day(n), fixtureDay(day(n))]))
  nt = createFakeNutriTrace({ days })
  vi.stubGlobal('fetch', nt.fetch)
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
  diaryIndex.restore()
  useDiaryIndex.setState({ status: 'ready' })
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  vi.mocked(navToDay).mockClear()
})
afterEach(() => {
  mounted.forEach(r => { try { act(() => r.unmount()) } catch { /* already unmounted */ } })
  mounted.length = 0
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the rail', () => {
  it('opens a past day through navToDay and today through the same call, under Eat', async () => {
    mount()
    await settle(() => expect(cells()).toHaveLength(7))
    tap(cells()[2])
    expect(navToDay).toHaveBeenLastCalledWith('2026-10-14', 'food')
    tap(cells()[6])
    expect(navToDay).toHaveBeenLastCalledWith(TODAY, 'food')
  })

  it('never writes the shared diary selection', async () => {
    const { useDiarySelection } = await import('../lib/nutrition/selection.js')
    useDiarySelection.getState().reset()
    mount()
    await settle(() => expect(cells()).toHaveLength(7))
    tap(cells()[1])
    expect(useDiarySelection.getState().date).toBeNull()
  })
})

describe('the week hero', () => {
  it('counts the logged days against the goal, today left out, and opens Trends', async () => {
    mount()
    await settle(() => expect(host.querySelectorAll('.g-rc-slide').length).toBeGreaterThan(0))
    const first = host.querySelector('.g-rc-slide')
    expect(first.getAttribute('aria-label')).toContain('days on target')
    expect(first.getAttribute('aria-label')).toContain('Open details')
    tap(first)
    await settle(() => expect(host.querySelector('[data-where]').textContent).toBe('/food/trends'))
  })
})

describe('the actions', () => {
  it('Log food opens the picker for today, Scan scans, Saved meals opens the library tab', async () => {
    mount()
    await settle(() => expect(named('Log food')).toBeTruthy())
    tap(named('Log food'))
    expect(foodPickerSheet).toHaveBeenLastCalledWith({ date: TODAY })
    tap(named('Scan'))
    expect(scanToSelection).toHaveBeenCalledTimes(1)
    tap(named('Saved meals'))
    await settle(() => expect(host.querySelector('[data-where]').textContent).toBe('/food/my-foods?tab=meals'))
  })

  it('+250 ml adds a glass to Today with an Undo toast', async () => {
    mount()
    await settle(() => expect(named('+250 ml')).toBeTruthy())
    tap(named('+250 ml'))
    await settle(() => expect(useUI.getState().toastMsg).toBe('Added 250 ml of water to Today'))
    expect(useUI.getState().toastAction).toBeTruthy()
  })
})

describe('food tracking off', () => {
  beforeEach(() => {
    nt = createFakeNutriTrace({ days: {}, settings: { ...fixtureSettings(), goals: {} } })
    vi.stubGlobal('fetch', nt.fetch)
  })

  it('is an invitation, and Set up food tracking opens Daily targets', async () => {
    mount()
    await settle(() => expect(named('Set up food tracking')).toBeTruthy())
    expect(host.querySelector('.g-rail')).toBeNull()
    tap(named('Set up food tracking'))
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('is not off once a goal is set', async () => {
    nt = createFakeNutriTrace({ days: {}, settings: fixtureSettings() })
    vi.stubGlobal('fetch', nt.fetch)
    mount()
    await settle(() => expect(host.querySelector('.g-rail')).not.toBeNull())
    expect(named('Set up food tracking')).toBeUndefined()
  })
})

describe('the old library addresses', () => {
  it.each([
    ['/food/foods', '/food/my-foods?tab=foods'],
    ['/food/meals', '/food/my-foods?tab=meals'],
    ['/food/meals?q=soup', '/food/my-foods?tab=meals&q=soup'],
  ])('%s lands on %s', async (from, to) => {
    mount(from)
    await settle(() => expect(host.querySelector('[data-where]')?.textContent).toBe(to))
  })
})
