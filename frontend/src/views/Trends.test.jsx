// @vitest-environment happy-dom
// Progress › Trends: the calorie and macro tiles, the nutrient explorer with its goal line, the
// ?metric&range deep link and the fasting insights, against NutriTrace faked at the fetch boundary
// (lib/nutrition/fake-nutritrace.js: GET /api/diary, /api/settings, /api/fasts).
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { isoOf } from '../lib/format.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { resetSyncThrottle } from '../lib/nutrition/sync.js'
import { useFasting } from '../lib/nutrition/use-fasting.js'
import { useTrends } from '../lib/nutrition/use-trends.js'
import { createFakeNutriTrace, fixtureFast, fixtureSettings } from '../lib/nutrition/fake-nutritrace.js'
import Trends from './Trends.jsx'

const navigate = vi.fn()
let search = ''
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate, useLocation: () => ({ search }) }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const H = 3600 * 1000
const ago = n => isoOf(new Date(Date.now() - n * 24 * H))
let nt, host, root

const settle = async (ms = 0) => { for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, ms)) }) }
const mount = async () => { await act(async () => { root.render(<Trends />) }); await settle() }
const text = () => host.textContent
const button = label => [...host.querySelectorAll('button, [role="button"]')].find(b => (b.getAttribute('aria-label') || b.textContent).trim().startsWith(label))
const click = async el => { await act(async () => { el.click() }); await settle() }

const meal = (date, kcal, protein, iron) => ({
  date, items: [{ uuid: 'i-' + date, meal: 0, name: 'Food', quantity: 1, nutrition: { calories: kcal, proteins: protein, ...(iron ? { iron } : {}) } }],
  water: [], body_stats: {}, notes: '', completed_at: null, completed_meals: [], tombstones: [],
})
const diary = () => ({ [ago(3)]: meal(ago(3), 2000, 120, 8), [ago(2)]: meal(ago(2), 1000, 60, 4), [ago(1)]: meal(ago(1), 1500, 90) })
const finished = (id, daysAgo, hours) => {
  const end = Date.now() - daysAgo * 24 * H
  return fixtureFast(id, new Date(end - hours * H).toISOString(), new Date(end).toISOString())
}

function useFake(opts = {}) {
  nt = createFakeNutriTrace({ days: diary(), settings: fixtureSettings(), ...opts })
  vi.stubGlobal('fetch', nt.fetch)
}

beforeEach(() => {
  navigate.mockClear()
  search = ''
  useFake()
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
  useTrends.getState().reset()
  useFasting.getState().reset()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  resetSyncThrottle()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  host.remove()
  vi.unstubAllGlobals()
})

describe('Nutrition trends', () => {
  it('opens on calories with the daily average, lowest and highest, and the goal', async () => {
    await mount()
    expect(text()).toContain('Nutrition trends')
    expect(text()).toContain('Calories')
    // (2000 + 1000 + 1500) / 3
    expect(text()).toContain('1,500')
    expect(text()).toContain('Daily average')
    expect(text()).toContain('1,000')
    expect(text()).toContain('2,000')
    expect(text()).toContain('3 days')
    expect(text()).toContain('Goal: 2,200 kcal')
    expect(host.querySelector('.chart polyline')).not.toBeNull()
    expect(nt.requests.filter(r => r.path === '/nt/api/diary')).toHaveLength(1)
  })

  it('shows the four headline averages as tiles that pick the metric', async () => {
    await mount()
    expect(text()).toContain('Protein')
    expect(text()).toContain('90') // (120 + 60 + 90) / 3
    await click(button('Protein'))
    expect(navigate).toHaveBeenCalledWith('/progress/trends?range=90&metric=proteins', { replace: true })
  })

  it('opens on the metric and range in the address', async () => {
    search = '?metric=iron&range=30'
    await mount()
    expect(text()).toContain('Iron')
    expect(text()).toContain('mg')
    // iron: 8, 4, and 0 for the day that carries none
    expect(text()).toContain('4')
    expect(text()).not.toContain('Goal:')
  })

  it('falls back to calories and 3 months for an address it does not know', async () => {
    search = '?metric=nope&range=5'
    await mount()
    expect(text()).toContain('Goal: 2,200 kcal')
    await click(button('1M'))
    expect(navigate).toHaveBeenCalledWith('/progress/trends?range=30', { replace: true })
  })

  it('keeps the metric when the range changes', async () => {
    search = '?metric=fiber&range=90'
    await mount()
    await click(button('1Y'))
    expect(navigate).toHaveBeenCalledWith('/progress/trends?range=365&metric=fiber', { replace: true })
  })

  it('says so when nothing is logged in the range', async () => {
    useFake({ days: {} })
    await mount()
    expect(text()).toContain('Nothing logged in this range')
    expect(host.querySelector('.chart polyline')).toBeNull()
  })

  it('does not count today, which is still being logged', async () => {
    useFake({ days: { [ago(0)]: meal(ago(0), 500, 10) } })
    await mount()
    expect(text()).toContain('Nothing logged in this range')
  })

  it('offers a retry when the diary does not load', async () => {
    nt.failNext('GET', '/nt/api/diary', { status: 500 })
    await mount()
    expect(text()).toContain('The diary did not load.')
    await click(button('Try again'))
    expect(text()).toContain('Daily average')
  })

  it('points a signed-out guest to the web app and asks for nothing', async () => {
    useStore.setState({ user: null })
    await mount()
    expect(text()).toContain('Nutrition trends live in the web app')
    expect(nt.requests).toHaveLength(0)
  })
})

describe('Fasting insights', () => {
  it('follow the explorer when fasting is on, counting only the fasts in the range', async () => {
    useFake({
      settings: { ...fixtureSettings(), fastingEnabled: true },
      fasts: [finished(1, 2, 18), finished(2, 40, 12)],
    })
    search = '?range=30'
    await mount()
    expect(text()).toContain('Fasting')
    expect(text()).toContain('Average fast')
    expect(text()).toContain('1 fast logged')
    await click(button('3M'))
    expect(navigate).toHaveBeenCalledWith('/progress/trends?range=90', { replace: true })
    expect(nt.requests.some(r => r.path === '/nt/api/fasts' && r.query.limit === '365')).toBe(true)
  })

  it('are left out when fasting is off', async () => {
    useFake({ fasts: [finished(1, 2, 18)] })
    await mount()
    expect(text()).not.toContain('Average fast')
    expect(nt.requests.some(r => r.path === '/nt/api/fasts')).toBe(false)
  })
})
