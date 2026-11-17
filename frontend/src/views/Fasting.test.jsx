// @vitest-environment happy-dom
// Fasting: the page and its drawers, Eat's running-fast row and the + sheet's Fast row, against
// NutriTrace faked at the fetch boundary (lib/nutrition/fake-nutritrace.js: fasts routes, the
// settings write and the hub's rules for them).
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO } from '../lib/format.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { useHubSync, resetSyncThrottle } from '../lib/nutrition/sync.js'
import { useFasting } from '../lib/nutrition/use-fasting.js'
import { createFakeNutriTrace, fixtureDay, fixtureFast, fixtureSettings } from '../lib/nutrition/fake-nutritrace.js'
import Fasting from './Fasting.jsx'
import Home from './Home.jsx'
import TodayFastRow from '../components/TodayFastRow.jsx'
import { openPlusSheet } from '../components/PlusSheet.jsx'
import { setNav } from '../lib/nav.js'
import { localInputValue } from './fasting/fast-format.js'

const navigate = vi.fn()
vi.mock('react-router-dom', async importOriginal => ({ ...(await importOriginal()), useNavigate: () => navigate }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TODAY = todayISO()
const H = 3600 * 1000
const DAY = 24 * H
let nt, host, root

function Sheets() {
  const sheets = useUI(s => s.sheets)
  return sheets.map(s => <div key={s.id} data-sheet="">{s.render(() => useUI.getState().closeSheet(s.id))}</div>)
}
function Search() {
  return <i data-testid="search" data-search={useLocation().search} />
}
const settle = async (ms = 0) => { for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, ms)) }) }
const mount = async (el, path = '/food/fasting') => {
  await act(async () => { root.render(<MemoryRouter initialEntries={[path]}>{el}<Sheets /><Search /></MemoryRouter>) })
  await settle()
}
const text = () => host.textContent
const search = () => host.querySelector('[data-testid="search"]').dataset.search
const button = (label, scope = host) => [...scope.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label)
const buttonStarting = (prefix, scope = host) => [...scope.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(prefix))
const click = async el => { await act(async () => { el.click() }); await settle() }
const lastSheet = () => [...host.querySelectorAll('[data-sheet]')].at(-1)
const typeInto = async (input, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle()
}
const field = (label, scope) => [...scope.querySelectorAll('.g-tfield')].find(f => f.querySelector('.g-tfield-label').textContent === label).querySelector('input')
const setStart = async (sheet, ms) => {
  const value = localInputValue(ms)
  await typeInto(field('Day', sheet), value.slice(0, 10))
  await typeInto(field('Time', sheet), value.slice(11, 16))
}
const on = (extra = {}) => ({ ...fixtureSettings(), fastingEnabled: true, fastingDefaultHours: 16, ...extra })
const running = (agoMs, goal = 16) => fixtureFast(5, new Date(Date.now() - agoMs).toISOString(), null, goal)
const finished = (id, daysAgo, hours) => {
  const end = Date.now() - daysAgo * DAY
  return fixtureFast(id, new Date(end - hours * H).toISOString(), new Date(end).toISOString())
}

function useFake(opts = {}) {
  nt = createFakeNutriTrace({ days: { [TODAY]: fixtureDay(TODAY) }, settings: on(), ...opts })
  vi.stubGlobal('fetch', nt.fetch)
}

beforeEach(() => {
  navigate.mockClear()
  useFake()
  useStore.setState(s => ({
    user: { id: 3, name: 'Ana' },
    pushState: vi.fn(async () => {}),
    S: { ...s.S, routines: [], workouts: [], bodyweight: [], dayPlan: {}, week: {}, active: null, checkIn: false, unit: 'kg' },
  }))
  useNutrition.getState().reset()
  useDiarySelection.getState().reset()
  useHubSync.getState().reset()
  useFasting.getState().reset()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  resetSyncThrottle()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals() })

describe('the Fasting page', () => {
  it('is off until you turn it on: that saves the setting and shows the next fast', async () => {
    useFake({ settings: fixtureSettings() })
    await mount(<Fasting />)
    expect(text()).toContain('Fasting is off')
    expect(text()).toContain('Turning fasting off keeps your history.')
    expect(host.querySelector('.g-sempty svg')).not.toBeNull()
    await click(button('18:6'))
    await click(button('Turn on fasting, 18:6'))
    expect(nt.writes()).toEqual([expect.objectContaining({ method: 'PUT', path: '/nt/api/settings', body: { key: 'fastingEnabled', value: true } })])
    expect(text()).toContain('Next fast')
    expect([...host.querySelectorAll('.g-cchip')].map(b => b.textContent)).toEqual(['14:10', '16:8', '18:6', '20:4', 'OMAD'])
  })

  it('idle shows the next fast with the last plan lit, and an empty history says one line', async () => {
    useFake({ settings: on({ fastingDefaultHours: 18 }) })
    await mount(<Fasting />)
    expect(text()).toContain('Next fast')
    expect(text()).toContain('18:6 · ends')
    expect(button('18:6').getAttribute('aria-pressed')).toBe('true')
    expect(text()).toContain('Your insights show after your first fast.')
    expect(text()).not.toContain('Insights')
    expect(host.querySelector('.g-bars')).toBeNull()
  })

  it('with finished fasts it shows insights, the 14-day chart and the recent list', async () => {
    useFake({ fasts: [finished(1, 1, 17), finished(2, 2, 12)] })
    await mount(<Fasting />)
    expect(text()).toContain('Insights')
    expect(text()).toContain('Average fast')
    expect(text()).toContain('14h 30m')
    expect(host.querySelectorAll('.g-bar').length).toBe(14)
    expect(host.querySelector('.g-bars-target')).not.toBeNull()
    expect(text()).toContain('The dashed line is your 16 h goal. A day without a fast stays empty.')
    expect(host.querySelectorAll('.g-fast-row').length).toBe(2)
    expect(text()).toContain('17h 0m')
  })

  it('a running fast stays out of the average and the longest', async () => {
    useFake({ fasts: [finished(1, 1, 17), finished(2, 2, 12), running(30 * H)] })
    await mount(<Fasting />)
    expect(text()).toContain('14h 30m')
    expect(host.querySelectorAll('.g-fast-row').length).toBe(2)
  })

  it('Start fast opens the drawer in the URL, and closing the drawer takes it out again', async () => {
    await mount(<Fasting />)
    expect(search()).toBe('')
    await click(button('Start fast'))
    expect(search()).toBe('?start=1')
    expect(lastSheet().textContent).toContain('Start a fast')
    expect(lastSheet().textContent).toContain('Start 16 h fast')
    await act(async () => { useUI.getState().closeAll() })
    await settle()
    expect(search()).toBe('')
    expect(useUI.getState().sheets.length).toBe(0)
  })

  it('opens on the Start drawer when the URL says so', async () => {
    await mount(<Fasting />, '/food/fasting?start=1')
    expect(lastSheet().textContent).toContain('Start 16 h fast')
  })

  it('starts the fast on the chosen plan from the drawer, and the page turns to the clock', async () => {
    await mount(<Fasting />)
    await click(button('Start fast'))
    await click(button('20:4', lastSheet()))
    expect(lastSheet().textContent).toContain('Start 20 h fast')
    await click(buttonStarting('Start 20 h fast', lastSheet()))
    expect(nt.writes().find(r => r.path === '/nt/api/fasts/start').body).toEqual({ goal_hours: 20 })
    expect(nt.writes().find(r => r.path === '/nt/api/settings').body).toEqual({ key: 'fastingDefaultHours', value: 20 })
    expect(useUI.getState().sheets.length).toBe(0)
    expect(search()).toBe('')
    expect(host.querySelector('.g-fast-ring b').textContent).toMatch(/^0:00:0\d$/)
    expect(text()).toContain('20h 0m to go')
    expect(button('End fast')).toBeTruthy()
    expect(useUI.getState().toastMsg).toBe('Fast started: 20 h goal')
  })

  it('an earlier start must be within the last 24 hours and not ahead', async () => {
    await mount(<Fasting />)
    await click(button('Start fast'))
    const sheet = lastSheet()
    await click(button('Earlier', sheet))
    const input = sheet.querySelector('input[type="datetime-local"]')
    await typeInto(input, localInputValue(Date.now() + 2 * H))
    expect(sheet.textContent).toContain('The start cannot be in the future.')
    expect(buttonStarting('Start 16 h fast', sheet).disabled).toBe(true)
    await typeInto(input, localInputValue(Date.now() - 25 * H))
    expect(sheet.textContent).toContain('A fast can be started at most 24 hours back.')
    expect(buttonStarting('Start 16 h fast', sheet).disabled).toBe(true)
    await typeInto(input, localInputValue(Date.now() - 5 * H))
    expect(buttonStarting('Start 16 h fast', sheet).disabled).toBe(false)
    await click(buttonStarting('Start 16 h fast', sheet))
    const body = nt.writes().find(r => r.path === '/nt/api/fasts/start').body
    expect(Date.now() - Date.parse(body.start_at)).toBeGreaterThan(4.9 * H)
    expect(text()).toContain('11h 0m to go')
  })

  it('a custom goal outside 1 to 168 hours is refused before any request', async () => {
    await mount(<Fasting />)
    await click(button('Start fast'))
    const sheet = lastSheet()
    await click(button('Custom', sheet))
    await typeInto(field('Goal in hours', sheet), '200')
    expect(sheet.textContent).toContain('Enter a goal between 1 and 168 hours.')
    expect(buttonStarting('Start', sheet).disabled).toBe(true)
    expect(nt.writes()).toEqual([])
  })

  it('says why a fast did not start, keeps the drawer, and works again', async () => {
    await mount(<Fasting />)
    await click(button('Start fast'))
    nt.failNext('POST', '/nt/api/fasts/start', 'offline')
    await click(buttonStarting('Start 16 h fast', lastSheet()))
    expect(lastSheet().querySelector('[role="alert"]').textContent).toBe('Not saved: no connection. Try again when you are back online.')
    await click(buttonStarting('Start 16 h fast', lastSheet()))
    expect(button('End fast')).toBeTruthy()
  })

  it('a start that finds a fast already running elsewhere shows that fast, not an error', async () => {
    await mount(<Fasting />)
    await click(button('Start fast'))
    nt.state.fasts.push(running(2 * H, 18))
    await click(buttonStarting('Start 16 h fast', lastSheet()))
    expect(text()).toContain('16h 0m to go')
    expect(useUI.getState().toastMsg).toBe('A fast is already running')
  })

  it('a running fast shows the clock, the time left and when the goal falls', async () => {
    useFake({ fasts: [running(3.5 * H)] })
    await mount(<Fasting />)
    expect(host.querySelector('.g-fast-ring b').textContent).toMatch(/^3:30:\d\d$/)
    expect(text()).toContain('12h 30m to go')
    expect(text()).toContain('goal 16 h, ends')
    expect(text()).not.toContain('Goal reached')
    expect(button('Change start')).toBeTruthy()
    expect(host.querySelector('.g-sr').textContent).toContain('3 hours, 30 minutes')
  })

  it('the goal is reached from the goal on: the ring is green, past the goal is said, Change start is gone', async () => {
    useFake({ fasts: [running(15.9 * H)] })
    await mount(<Fasting />)
    expect(text()).not.toContain('Goal reached')
    expect(host.querySelector('.g-fast-done')).toBeNull()
    useFasting.getState().reset()
    useFake({ fasts: [running(16 * H + 12 * 60_000)] })
    await mount(<Fasting key="again" />)
    expect(text()).toContain('Goal reached')
    expect(text()).toContain('12 min past your goal')
    expect(host.querySelector('.g-fast-done')).not.toBeNull()
    expect(button('Change start')).toBeUndefined()
    expect(button('End fast')).toBeTruthy()
  })

  it('Change start refuses a future start and 8 days back, takes 7, and the end moves with it', async () => {
    useFake({ fasts: [running(3 * H)] })
    await mount(<Fasting />)
    await click(button('Change start'))
    const sheet = lastSheet()
    const endsLine = () => [...sheet.querySelectorAll('.g-fast-lead')].find(p => p.textContent.startsWith('Now ends'))?.textContent
    const endsBefore = endsLine()
    expect(endsBefore).toBeTruthy()

    await setStart(sheet, Date.now() + 2 * H)
    expect(sheet.textContent).toContain('The start cannot be in the future.')
    expect(button('Move start', sheet).disabled).toBe(true)
    await setStart(sheet, Date.now() - 8 * DAY)
    expect(sheet.textContent).toContain('The start can be at most 7 days back.')
    expect(button('Move start', sheet).disabled).toBe(true)
    expect(nt.writes()).toEqual([])

    await setStart(sheet, Date.now() - 6.9 * DAY)
    expect(endsLine()).toBeTruthy()
    expect(endsLine()).not.toBe(endsBefore)
    expect(buttonStarting('Move start to', sheet).disabled).toBe(false)
    await click(buttonStarting('Move start to', sheet))
    const patch = nt.writes().find(r => r.method === 'PATCH')
    expect(patch.path).toBe('/nt/api/fasts/5')
    expect(Date.now() - Date.parse(patch.body.start_at)).toBeGreaterThan(6.8 * DAY)
    expect(useUI.getState().sheets.length).toBe(0)
    expect(useFasting.getState().active.start_at).toBe(patch.body.start_at)
    expect(text()).toContain('Goal reached')
  })

  it('moving the start of a fast that was ended elsewhere leaves it out of the running slot', async () => {
    useFake({ fasts: [running(3 * H)] })
    await mount(<Fasting />)
    nt.state.fasts[0].end_at = new Date().toISOString()
    await click(button('Change start'))
    await setStart(lastSheet(), Date.now() - 4 * H)
    await click(buttonStarting('Move start to', lastSheet()))
    expect(useFasting.getState().active).toBeNull()
    expect(useFasting.getState().history.map(f => f.id)).toContain(5)
  })

  it('End fast ends it at once, the toast offers Undo, and Undo puts the same fast back', async () => {
    const fast = running(17 * H)
    useFake({ fasts: [fast] })
    await mount(<Fasting />)
    await click(button('End fast'))
    expect(lastSheet()).toBeUndefined()
    expect(nt.writes()).toEqual([expect.objectContaining({ method: 'POST', path: '/nt/api/fasts/5/end' })])
    expect(text()).toContain('Next fast')
    expect(host.querySelectorAll('.g-fast-row').length).toBe(1)
    expect(useUI.getState().toastMsg).toBe('Fast ended: 17h 0m')
    expect(useUI.getState().toastAction.label).toBe('Undo')

    await act(async () => { useUI.getState().runToastAction() })
    await settle()
    const active = useFasting.getState().active
    expect(active.start_at).toBe(fast.start_at)
    expect(active.goal_hours).toBe(16)
    expect(nt.state.fasts.filter(f => !f.end_at).length).toBe(1)
    expect(nt.state.fasts.filter(f => f.end_at).length).toBe(0)
    expect(useFasting.getState().history).toEqual([])
    expect(button('End fast')).toBeTruthy()
  })

  it('a fast too long to start again has no Undo', async () => {
    useFake({ fasts: [running(40 * H, 48)] })
    await mount(<Fasting />)
    await click(button('End fast'))
    expect(useUI.getState().toastMsg).toContain('Fast ended:')
    expect(useUI.getState().toastAction).toBeNull()
  })

  it('turning fasting off keeps the history: nothing is deleted, and the page goes back to off', async () => {
    useFake({ fasts: [finished(1, 1, 17)] })
    await mount(<Fasting />)
    await click(button('Turn off fasting'))
    expect(nt.writes()).toEqual([expect.objectContaining({ method: 'PUT', path: '/nt/api/settings', body: { key: 'fastingEnabled', value: false } })])
    expect(nt.state.fasts.length).toBe(1)
    expect(text()).toContain('Fasting is off')
  })

  it('removes a finished fast after a confirmation', async () => {
    useFake({ fasts: [finished(1, 1, 17), finished(2, 2, 12)] })
    await mount(<Fasting />)
    expect(host.querySelectorAll('.g-fast-row').length).toBe(2)
    await click(host.querySelector('.g-fast-row-x'))
    expect(host.querySelector('.g-fast-row-x').getAttribute('aria-label')).toMatch(/^Delete fast /)
    await click(button('Remove', lastSheet()))
    expect(nt.writes().at(-1)).toMatchObject({ method: 'DELETE', path: '/nt/api/fasts/1' })
    expect(host.querySelectorAll('.g-fast-row').length).toBe(1)
  })

  it('a fast started or ended on another device shows up when the app comes back to the front', async () => {
    await mount(<Fasting />)
    expect(button('Start fast')).toBeTruthy()
    nt.state.fasts.push(running(2 * H))
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await settle()
    expect(button('End fast')).toBeTruthy()
    nt.state.fasts[0].end_at = new Date().toISOString()
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await settle()
    expect(button('Start fast')).toBeTruthy()
  })

  it('says why fasting did not turn on, and the button works again', async () => {
    useFake({ settings: fixtureSettings() })
    await mount(<Fasting />)
    nt.failNext('PUT', '/nt/api/settings', 'offline')
    await click(buttonStarting('Turn on fasting'))
    expect(host.querySelector('[role="alert"]').textContent).toBe('Not saved: no connection. Try again when you are back online.')
    expect(buttonStarting('Turn on fasting').getAttribute('aria-busy')).toBeNull()
  })

  it('says the settings did not load, with Try again that loads the page', async () => {
    useFake({ settings: fixtureSettings() })
    nt.failNext('GET', '/nt/api/settings', { status: 500 })
    await mount(<Fasting />)
    expect(host.querySelector('[role="alert"]').textContent).toContain('Your settings did not load.')
    await click(button('Try again'))
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(text()).toContain('Fasting is off')
  })

  it('needs the web app and a signed-in person', async () => {
    useStore.setState({ user: null })
    await mount(<Fasting />)
    expect(text()).toContain('Fasting lives in the web app')
    expect(host.querySelector('.g-sempty svg')).not.toBeNull()
    expect(nt.requests).toEqual([])
  })
})

// The running fast is Eat's today row (TodayFastRow, on FoodHub); Today has no slot for it.
describe('fasting on Eat, not on Today, and in the + sheet', () => {
  it('the today row shows the running fast and opens the page', async () => {
    useFake({ fasts: [running(3.5 * H)] })
    await useNutrition.getState().loadSettings()
    await mount(<TodayFastRow />)
    const row = host.querySelector('.today-fast')
    expect(row.textContent).toContain('Fasting for 3h 30m')
    expect(row.textContent).toContain('12h 30m to go')
    await click(row)
    expect(navigate).toHaveBeenCalledWith('/food/fasting')
  })

  it('Today shows no fast, even a running one', async () => {
    useFake({ fasts: [running(3.5 * H)] })
    await mount(<Home />, '/home')
    expect(host.querySelector('.today-fast')).toBeNull()
  })

  it('shows nothing about fasting while it is off, or while no fast runs', async () => {
    useFake({ settings: fixtureSettings(), fasts: [running(3 * H)] })
    await useNutrition.getState().loadSettings()
    await mount(<TodayFastRow />)
    expect(host.querySelector('.today-fast')).toBeNull()
    expect(nt.requests.some(r => r.path.includes('/fasts'))).toBe(false)
    useFasting.getState().reset()
    useFake({ fasts: [] })
    await useNutrition.getState().loadSettings({ force: true })
    await mount(<TodayFastRow key="idle" />)
    expect(host.querySelector('.today-fast')).toBeNull()
  })

  it('the + sheet starts a fast on the last plan in one tap', async () => {
    useFake({ settings: on({ fastingDefaultHours: 18 }) })
    await mount(<div />)
    await act(async () => { openPlusSheet('/home') })
    await settle()
    expect(lastSheet().textContent).toContain('Fast')
    await click(button('Start a 18 hour fast', lastSheet()))
    expect(nt.writes().find(r => r.path === '/nt/api/fasts/start').body).toEqual({ goal_hours: 18 })
    expect(useUI.getState().sheets.length).toBe(0)
    expect(useUI.getState().toastMsg).toBe('Fast started: 18 h goal')
  })

  it('the + sheet\'s Fast says when one was already running elsewhere, not that it started', async () => {
    await mount(<div />)
    await act(async () => { openPlusSheet('/home') })
    await settle()
    nt.state.fasts.push(running(H))
    await click(button('Start a 16 hour fast', lastSheet()))
    expect(useUI.getState().sheets.length).toBe(0)
    expect(useUI.getState().toastMsg).toBe('A fast is already running')
  })

  it('a Fast that did not start says why and keeps the + sheet, its item there to try again', async () => {
    await mount(<div />)
    await act(async () => { openPlusSheet('/home') })
    await settle()
    nt.failNext('POST', '/nt/api/fasts/start', 'offline')
    await click(button('Start a 16 hour fast', lastSheet()))
    expect(useUI.getState().toastMsg).toBe('Not saved: no connection. Try again when you are back online.')
    expect(useUI.getState().sheets.length).toBe(1)
    expect(button('Start a 16 hour fast', lastSheet()).disabled).toBe(false)
  })

  it('the + sheet shows the time fasted while one runs, and opens the page', async () => {
    const went = []
    setNav(to => { went.push(to) })
    try {
      useFake({ fasts: [running(2 * H)] })
      await mount(<div />)
      await act(async () => { openPlusSheet('/home') })
      await settle()
      const row = [...lastSheet().querySelectorAll('.g-menuitem')].find(r => r.textContent.startsWith('Fasting'))
      expect(row.textContent).toContain('2h 0m')
      await click(row)
      expect(useUI.getState().sheets.length).toBe(0)
      expect(went).toEqual(['/food/fasting'])
    } finally { setNav(() => {}) }
  })

  it('the + sheet has no Fast row while fasting is off', async () => {
    useFake({ settings: fixtureSettings() })
    await mount(<div />)
    await act(async () => { openPlusSheet('/home') })
    await settle()
    expect([...lastSheet().querySelectorAll('.g-menuitem b')].map(n => n.textContent)).not.toContain('Fast')
  })
})
