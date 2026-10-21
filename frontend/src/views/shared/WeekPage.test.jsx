// @vitest-environment happy-dom
// The Week route against the real store and the real day and week rules (lib/day-route.js): a past
// cell opens its Day page, today's opens Today, a day to come the Plan day drawer, a day before the
// first log nothing; ‹ and Last 4 weeks replace the address with that week; Trends and Back.
// The clock is Wednesday 14 Oct 2026, noon, in week 2026-W42 (Mon 12 to Sun 18).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'
import { TAB_ROOT } from '../../lib/tab-route.js'
import { useStore } from '../../store/useStore.js'
import WeekPage from './WeekPage.jsx'

const { navMock, sheetMock, backMock, params } = vi.hoisted(() => ({
  navMock: vi.fn(), sheetMock: vi.fn(), backMock: vi.fn(), params: { tab: 'train', week: '2026-W42' },
}))
vi.mock('react-router-dom', async orig => ({ ...(await orig()), useParams: () => params, Navigate: ({ to }) => <output data-to={to} /> }))
vi.mock('../../lib/nav.js', async orig => ({ ...(await orig()), nav: navMock }))
vi.mock('../../sheets.jsx',async orig => ({ ...(await orig()), dayOverrideSheet: sheetMock }))
vi.mock('../../lib/use-tab-nav.js', async orig => ({ ...(await orig()), back: backMock }))

const view = useView()
const at = (iso, hh) => new Date(iso + `T${hh}:00:00`).getTime()
const workout = (id, iso) => ({ id, d: iso, start: at(iso, 18), end: at(iso, 19), entries: [{ id: '0025', sets: [{ w: 80, r: 6, done: true }] }] })

let saved
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 14, 12))
  navMock.mockReset(); sheetMock.mockReset(); backMock.mockReset()
  params.tab = 'train'; params.week = '2026-W42'
  saved = useStore.getState().S
  useStore.setState(s => ({
    S: { ...s.S, unit: 'kg', weekStart: 1, routines: [], week: {}, dayPlan: {}, queue: null, bodyweight: [], measurements: [], workouts: [workout('w1', '2026-10-05'), workout('w2', '2026-10-12')] },
  }))
})
afterEach(() => {
  useStore.setState({ S: saved })
  vi.useRealTimers()
})

const dayCells = () => [...view.host.querySelectorAll('.g-swc-cell')]
const lastNav = () => navMock.mock.calls.at(-1)

describe('WeekPage (the route)', () => {
  it('a past day opens its Day page under the tab', () => {
    view.render(<WeekPage />)
    expect(view.host.querySelector('.week-head h1').textContent).toBe('12 to 18 Oct')
    click(dayCells()[0])
    expect(lastNav()[0]).toBe('/train/day/2026-10-12')
    expect(sheetMock).not.toHaveBeenCalled()
  })

  it('today\'s cell opens Today', () => {
    view.render(<WeekPage />)
    click(dayCells()[2])
    expect(lastNav()[0]).toBe(TAB_ROOT.home)
  })

  it('a day to come opens the Plan day drawer and leaves the page where it is', () => {
    view.render(<WeekPage />)
    click(dayCells()[4])
    expect(sheetMock).toHaveBeenCalledWith('2026-10-16')
    expect(navMock).not.toHaveBeenCalled()
  })

  it('a week before the first log: its days open nothing', () => {
    params.week = '2026-W40'
    view.render(<WeekPage />)
    expect(dayCells()).toHaveLength(7)
    expect(view.host.querySelectorAll('button.g-swc-cell')).toHaveLength(0)
  })

  it('‹ replaces the address with the week before; there is no › on this week', () => {
    view.render(<WeekPage />)
    click(view.host.querySelector('button[aria-label="Previous week"]'))
    expect(lastNav()).toEqual(['/train/week/2026-W41', { replace: true }])
    expect(view.host.querySelector('button[aria-label="Next week"]')).toBeNull()
  })

  it('› on a past week replaces the address with the week after; the week of the first log has no ‹', () => {
    params.week = '2026-W41'
    view.render(<WeekPage />)
    expect(view.host.querySelector('.week-head').textContent).toContain('Week 41 · complete')
    expect(view.host.querySelector('button[aria-label="Previous week"]')).toBeNull()
    click(view.host.querySelector('button[aria-label="Next week"]'))
    expect(lastNav()).toEqual(['/train/week/2026-W42', { replace: true }])
  })

  it('Last 4 weeks replaces the address with the week tapped', () => {
    view.render(<WeekPage />)
    const weeks = [...view.host.querySelectorAll('button.g-w4-cell')]
    expect(weeks).toHaveLength(4)
    click(weeks[0])
    expect(lastNav()).toEqual(['/train/week/2026-W39', { replace: true }])
  })

  it('Trends opens Training load; Back goes down the stack', () => {
    view.render(<WeekPage />)
    click([...view.host.querySelectorAll('.g-ssec-act')].find(b => b.textContent === 'Trends'))
    expect(lastNav()).toEqual(['/progress/load'])
    click(view.host.querySelector('button[aria-label="Back"]'))
    expect(backMock).toHaveBeenCalledTimes(1)
  })

  it('a week after this one goes back to the tab\'s root', () => {
    params.week = '2026-W44'
    view.render(<WeekPage />)
    expect(view.host.querySelector('output').dataset.to).toBe(TAB_ROOT.train)
  })
})
