// @vitest-environment happy-dom
// The Burned route (boards Ea7Burned; PR04Edges "A big burn day") against the real store and the
// real week rules: the week's rows by day with the real target in the note, a row with no number
// opens the add drawer, + opens Log activity, an empty week says so, and with Burned off (or no
// nutrition here) the address goes to /food. The clock is Wednesday 14 Oct 2026, noon.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'
import { createFakeNutriTrace, fixtureSettings } from '../../lib/nutrition/fake-nutritrace.js'
import { useActivityWrites } from '../../lib/nutrition/activity.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import BurnedPage from './BurnedPage.jsx'

const { navToDay } = vi.hoisted(() => ({ navToDay: vi.fn() }))
vi.mock('react-router-dom', async orig => ({ ...(await orig()), Navigate: ({ to }) => <output data-to={to} /> }))
vi.mock('../../lib/use-tab-nav.js', async orig => ({ ...(await orig()), back: vi.fn() }))
vi.mock('../../lib/day-route.js', async orig => ({ ...(await orig()), navToDay }))
// The chart scene arrives with the motion branch's scenes file; the kit throws on an unknown name.
vi.mock('../../ds/Illustration.jsx', () => ({ default: ({ name }) => <i data-scene={name} /> }))

const view = useView()
const MON = '2026-10-12'
const TUE = '2026-10-13'
const WED = '2026-10-14'
const row = (id, date, name, kcal, extra = {}) => ({ id, date, name, kcal, duration_min: 45, distance: null, source: 'manual', covered_by: null, ...extra })

let nt, saved, openSheet
const realOpenSheet = useUI.getState().openSheet
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) }) }
const rowButton = name => [...view.host.querySelectorAll('.g-glist-row')].find(r => r.querySelector('b').textContent === name)
const text = () => view.host.textContent

// The day sums NutriTrace answers beside the rows: what they add up to, no wearable.
const sumsOf = activity => Object.fromEntries(Object.entries(activity).map(([date, rows]) => {
  const kcal = rows.reduce((sum, r) => sum + r.kcal, 0)
  return [date, { date, manual: kcal, wearable: 0, effective: kcal, covered_by: null, policy: 'wearable_wins' }]
}))

async function open({ settings = fixtureSettings(), activity = {} } = {}) {
  nt = createFakeNutriTrace({ settings, activity, activitySum: sumsOf(activity) })
  vi.stubGlobal('fetch', nt.fetch)
  view.render(<BurnedPage />)
  await settle()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 14, 12))
  navToDay.mockReset()
  saved = useStore.getState().S
  useStore.setState({ user: { id: 3, name: 'Ana' }, S: { ...saved, weekStart: 1, unit: 'kg', bodyweight: [] } })
  useNutrition.getState().reset()
  useActivityWrites.setState({ supported: true })
  openSheet = vi.fn()
  useUI.setState({ openSheet })
})
afterEach(() => {
  useStore.setState({ S: saved })
  useUI.setState({ openSheet: realOpenSheet })
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Burned', () => {
  const week = {
    [MON]: [row(1, MON, 'Legs', 0, { source: 'opengym' })],
    [TUE]: [row(2, TUE, 'Run', 410, { distance: 5.2, duration_min: 31 })],
    [WED]: [row(3, WED, 'Push A', 320, { source: 'opengym', duration_min: 52 })],
  }

  it('shows the week\'s figure, its sources and the rows by day', async () => {
    await open({ activity: week })
    expect(view.host.querySelector('h2').textContent).toBe('730 kcal')
    expect(text()).toContain('Burned this week, from 1 workout and 1 activity')
    const sections = [...view.host.querySelectorAll('.g-ssec h2')].map(h => h.textContent)
    expect(sections).toEqual(['Today', 'Earlier this week'])
    expect(rowButton('Push A').textContent).toContain('320 kcal')
    expect(rowButton('Run').textContent).toContain('5.2 km')
  })

  it('quotes the real target in the note', async () => {
    await open({ activity: week })
    expect(text()).toContain('Never added to your target')
    expect(text()).toContain('Your target stays 2,200 kcal a day.')
  })

  it('does not quote a target when no goal is set', async () => {
    await open({ settings: { ...fixtureSettings(), goals: {} }, activity: week })
    expect(text()).toContain('Never added to your target')
    expect(text()).not.toContain('Your target stays')
  })

  it('opens the day of a row with a number', async () => {
    await open({ activity: week })
    click(rowButton('Run'))
    expect(navToDay).toHaveBeenCalledWith(TUE, 'food')
  })

  it('says a workout has no number and opens the add drawer from it', async () => {
    await open({ activity: week })
    expect(rowButton('Legs').textContent).toContain('0 kcal')
    expect(text()).toContain('Legs has no Burned number: it was logged before Burned was turned on. Tap it to add one.')
    click(rowButton('Legs'))
    expect(openSheet).toHaveBeenCalledTimes(1)
    expect(openSheet.mock.calls[0][1]).toEqual({ variant: 'ds' })
  })

  it('opens Log activity from +', async () => {
    await open({ activity: week })
    click(view.host.querySelector('button[aria-label="Log activity"]'))
    expect(openSheet).toHaveBeenCalledTimes(1)
  })

  it('leaves the figure out of an empty week and says so in one line', async () => {
    await open()
    expect(view.host.querySelector('h2')).toBeNull()
    expect(text()).toContain('Nothing burned logged this week')
    expect(view.host.querySelector('[data-scene="chart"]')).not.toBeNull()
    click([...view.host.querySelectorAll('button')].find(b => b.textContent === 'Log activity' && !b.getAttribute('aria-label')))
    expect(openSheet).toHaveBeenCalledTimes(1)
  })
})

describe('when the hub takes no activity writes yet', () => {
  const week = {
    [MON]: [row(1, MON, 'Legs', 0, { source: 'opengym' })],
    [TUE]: [row(2, TUE, 'Run', 410)],
  }

  it('stays readable but offers no add or edit, and says logging arrives soon', async () => {
    await open({ activity: week })
    expect(view.host.querySelector('button[aria-label="Log activity"]')).not.toBeNull()
    act(() => { useActivityWrites.setState({ supported: false }) })
    await settle()
    expect(view.host.querySelector('button[aria-label="Log activity"]')).toBeNull()
    expect(text()).toContain('Logging activity arrives soon')
    expect(text()).not.toContain('Tap it to add one')
    expect(view.host.querySelector('h2').textContent).toBe('410 kcal')
    // the figure and the rows are still there; a row with no number does nothing
    click(rowButton('Legs'))
    expect(openSheet).not.toHaveBeenCalled()
    click(rowButton('Run'))
    expect(navToDay).toHaveBeenCalledWith(TUE, 'food')
  })

  it('an empty week has no Log activity button either', async () => {
    useActivityWrites.setState({ supported: false })
    await open()
    expect(text()).toContain('Nothing burned logged this week')
    expect(text()).toContain('Logging activity arrives soon')
    expect([...view.host.querySelectorAll('button')].some(b => b.textContent === 'Log activity')).toBe(false)
  })

  it('opening the page sends no activity write', async () => {
    await open({ activity: week })
    expect(nt.writes()).toHaveLength(0)
  })
})

describe('when a day of the week failed to read', () => {
  const rows = { [MON]: [row(1, MON, 'Run', 300)], [WED]: [row(3, WED, 'Push A', 320, { source: 'opengym' })] }

  it('asks for a retry instead of quoting a partial total, then shows the week', async () => {
    nt = createFakeNutriTrace({ settings: fixtureSettings(), activity: rows, activitySum: sumsOf(rows) })
    nt.failNext('GET', `/nt/api/activity/${TUE}`, 'offline')
    vi.stubGlobal('fetch', nt.fetch)
    view.render(<BurnedPage />)
    await settle()
    expect(text()).toContain('Could not load this week')
    expect(view.host.querySelector('h2')).toBeNull()
    expect(text()).not.toContain('Nothing burned logged this week')
    expect(rowButton('Run')).toBeUndefined()
    click([...view.host.querySelectorAll('button')].find(b => b.textContent === 'Retry'))
    await settle()
    expect(text()).not.toContain('Could not load this week')
    expect(view.host.querySelector('h2').textContent).toBe('620 kcal')
    expect(rowButton('Run')).toBeTruthy()
  })

  it('does not say nothing was burned when the only day that read failed', async () => {
    nt = createFakeNutriTrace({ settings: fixtureSettings() })
    nt.failNext('GET', '/nt/api/activity/', 'offline')
    vi.stubGlobal('fetch', nt.fetch)
    view.render(<BurnedPage />)
    await settle()
    expect(text()).toContain('Could not load this week')
    expect(text()).not.toContain('Nothing burned logged this week')
  })
})

describe('with Burned off', () => {
  it('redirects to Eat', async () => {
    await open({ settings: { ...fixtureSettings(), diaryShowActivity: false }, activity: { [WED]: [row(3, WED, 'Push A', 320)] } })
    expect(view.host.querySelector('output').getAttribute('data-to')).toBe('/food')
    expect(text()).not.toContain('Push A')
  })

  it('waits for the settings before deciding, so a cold link to Burned is not sent away early', async () => {
    nt = createFakeNutriTrace({ settings: fixtureSettings() })
    vi.stubGlobal('fetch', nt.fetch)
    view.render(<BurnedPage />)
    expect(view.host.querySelector('output')).toBeNull()
    await settle()
    expect(view.host.querySelector('output')).toBeNull()
  })

  it('redirects without a signed-in user: there is no nutrition behind it', async () => {
    useStore.setState({ user: null })
    await open()
    expect(view.host.querySelector('output').getAttribute('data-to')).toBe('/food')
  })
})
