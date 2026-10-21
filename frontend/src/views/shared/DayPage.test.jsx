// @vitest-environment happy-dom
// The Day route (PR07 D1) against the real store and day rules (lib/day-route.js): a day to come
// replaces the address with the tab's root and then opens the Plan day drawer; a cold deep link
// waits for the store and the diary index before calling a day "before the first log" (a food-only
// day is only in the index); a search's Day result hands the page the entry it found.
// The clock is Sunday 18 Oct 2026, noon.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from '../../ds/render.test-util.js'
import { useDiaryIndex } from '../../lib/nutrition/diary-index.js'
import { TAB_ROOT } from '../../lib/tab-route.js'
import { useStore } from '../../store/useStore.js'
import DayPage from './DayPage.jsx'

const { navigateMock, sheetMock, params, location, index, screen } = vi.hoisted(() => ({
  navigateMock: vi.fn(), sheetMock: vi.fn(), params: { tab: 'food', date: '2026-10-12' }, location: { state: null },
  index: { days: [], food: true }, screen: vi.fn(),
}))
vi.mock('react-router-dom', async orig => ({
  ...(await orig()),
  useParams: () => params, useNavigate: () => navigateMock, useLocation: () => location,
  Navigate: ({ to }) => <output data-to={to} />,
}))
vi.mock('../../sheets.jsx', async orig => ({ ...(await orig()), dayOverrideSheet: sheetMock }))
vi.mock('../../lib/nutrition/api.js', async orig => ({ ...(await orig()), nutritionAvailable: () => index.food }))
vi.mock('../../lib/nutrition/diary-index.js', async orig => ({ ...(await orig()), diaryIndexDays: () => index.days, startDiaryIndex: vi.fn() }))
vi.mock('./use-day.js', () => ({ useDay: iso => ({ iso }) }))
vi.mock('./DayScreen.jsx', () => ({ default: props => { screen(props); return <main data-day={props.day.iso} /> } }))

const view = useView()
const workout = (id, iso) => ({ id, d: iso, start: new Date(iso + 'T18:00:00').getTime(), end: new Date(iso + 'T19:00:00').getTime(), entries: [] })
const out = () => view.host.querySelector('output')?.dataset.to ?? null
const page = () => view.host.querySelector('main')?.dataset.day ?? null

let saved
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(new Date(2026, 9, 18, 12))
  navigateMock.mockReset(); sheetMock.mockReset(); screen.mockReset()
  params.tab = 'food'; params.date = '2026-10-12'; location.state = null
  index.days = []; index.food = true
  saved = useStore.getState()
  useStore.setState(s => ({ ready: true, S: { ...s.S, bodyweight: [], measurements: [], workouts: [workout('w1', '2026-10-14')] } }))
  useDiaryIndex.setState({ status: 'ready', complete: true, synced: true, version: 0 })
})
afterEach(() => {
  useStore.setState({ S: saved.S, ready: saved.ready })
  vi.useRealTimers()
})

describe('DayPage (the route)', () => {
  it('a day to come: the address becomes the tab\'s root, then the Plan day drawer opens over it', () => {
    params.date = '2026-10-20'
    view.render(<DayPage />)
    expect(navigateMock).toHaveBeenCalledWith(TAB_ROOT.food, { replace: true })
    expect(sheetMock).not.toHaveBeenCalled()
    act(() => vi.runAllTimers())
    expect(sheetMock).toHaveBeenCalledWith('2026-10-20')
    expect(page()).toBeNull()
  })

  it('a cold deep link to a food-only day waits for the store and the index instead of leaving', () => {
    useStore.setState({ ready: false })
    useDiaryIndex.setState({ status: 'loading', complete: false, synced: false })
    view.render(<DayPage />)
    expect(out()).toBeNull()
    expect(page()).toBeNull()
    act(() => useStore.setState({ ready: true }))
    expect(out()).toBeNull()
    // The index lands with that day's food in it: the day is after the first log after all.
    index.days = [{ date: '2026-10-12' }]
    act(() => useDiaryIndex.setState({ status: 'ready', complete: true, synced: true, version: 1 }))
    expect(page()).toBe('2026-10-12')
  })

  it('once everything is in, a day before the first log goes back to the tab\'s root', () => {
    view.render(<DayPage />)
    expect(out()).toBe(TAB_ROOT.food)
  })

  it('with nutrition off there is no index to wait for', () => {
    index.food = false
    useDiaryIndex.setState({ status: 'idle', complete: false, synced: false })
    view.render(<DayPage />)
    expect(out()).toBe(TAB_ROOT.food)
  })

  it('hands the page the entry a search found', () => {
    params.date = '2026-10-14'
    location.state = { find: 'uuid-1' }
    view.render(<DayPage />)
    expect(screen).toHaveBeenLastCalledWith(expect.objectContaining({ find: 'uuid-1' }))
  })
})
