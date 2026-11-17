// @vitest-environment happy-dom
// MonthPage (/food/month): the month is in the address (this month for a missing, bad or future
// one), ‹ › replace the entry and stop at the first log and at this month, a day opens its Day view
// by navToDay (today opens Today), and nutrition off goes back to Eat.
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'
import MonthPage from './MonthPage.jsx'

const mocks = vi.hoisted(() => ({ history: vi.fn(), navToDay: vi.fn() }))
vi.mock('./use-food-history.js', () => ({ useFoodHistory: mocks.history }))
vi.mock('../../lib/nutrition/use-freshness.js', async importOriginal => ({ ...(await importOriginal()), useToday: () => '2026-10-18' }))
vi.mock('../../lib/day-route.js', async importOriginal => ({ ...(await importOriginal()), navToDay: mocks.navToDay }))
vi.mock('../../lib/nutrition/diary-index.js', async importOriginal => ({
  ...(await importOriginal()),
  startDiaryIndex: vi.fn(),
  diaryIndexDays: () => [{ date: '2026-09-01' }],
  useDiaryIndex: selector => selector({ version: 0 }),
}))

const view = useView()
const entry = (date, kcal) => ({ date, water: [], items: [{ uuid: 'i-' + date, meal: 0, name: 'Food', quantity: 1, nutrition: { calories: kcal } }] })
const SETTINGS = { calorieGoalMode: 'fixed', goals: { calories: { sharedGoal: true, max: 2000 } } }
const ready = (over = {}) => ({
  status: 'ready', days: [entry('2026-09-10', 2000), entry('2026-10-09', 2400)], settings: SETTINGS, goalInputs: {}, activity: {}, tried: {},
  today: '2026-10-18', error: null, reload: vi.fn(), ...over,
})

function Probe() {
  const { pathname, search } = useLocation()
  return <output data-testid="at">{pathname + search + ' ' + useNavigationType()}</output>
}
let shown = 0
// A new router each time: a router keeps the entries it started with.
function show(at = '/food/month') {
  view.render(
    <MemoryRouter key={++shown} initialEntries={[at]}>
      <Routes>
        <Route path="/food/month" element={<><MonthPage /><Probe /></>} />
        <Route path="/food" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}
const at = () => view.host.querySelector('[data-testid=at]').textContent
const title = () => view.host.querySelector('.g-mg-top b').textContent
const arrows = () => [...view.host.querySelectorAll('.g-mg-nav')]
const cells = () => [...view.host.querySelectorAll('.g-mg-cell')]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.history.mockReturnValue(ready())
})

describe('MonthPage', () => {
  it('opens on this month, and on this month for a bad or a future one', () => {
    show('/food/month')
    expect(title()).toBe('October 2026')
    show('/food/month?month=2027-01')
    expect(title()).toBe('October 2026')
    show('/food/month?month=banana')
    expect(title()).toBe('October 2026')
    show('/food/month?month=2026-09')
    expect(title()).toBe('September 2026')
  })

  it('asks the history for the whole month', () => {
    show('/food/month?month=2026-09')
    expect(mocks.history).toHaveBeenLastCalledWith({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('goes back a month by replacing the address, and stops at the month of the first log', () => {
    show('/food/month')
    click(arrows()[0])
    expect(at()).toBe('/food/month?month=2026-09 REPLACE')
    expect(title()).toBe('September 2026')
    expect(arrows()[0].disabled).toBe(true)
  })

  it('goes forward again, and stops at this month', () => {
    show('/food/month?month=2026-09')
    click(arrows()[1])
    expect(at()).toBe('/food/month?month=2026-10 REPLACE')
    expect(arrows()[1].disabled).toBe(true)
  })

  it('opens a past day and today by navToDay, and nothing for a day ahead', () => {
    show('/food/month')
    click(cells()[8])
    expect(mocks.navToDay).toHaveBeenLastCalledWith('2026-10-09')
    click(cells()[17])
    expect(mocks.navToDay).toHaveBeenLastCalledWith('2026-10-18')
    expect(cells()[18].tagName).toBe('SPAN')
    expect(mocks.navToDay).toHaveBeenCalledTimes(2)
  })

  it('goes back to Eat when nutrition is not available', () => {
    mocks.history.mockReturnValue(ready({ status: 'off' }))
    show('/food/month')
    expect(at()).toBe('/food REPLACE')
  })
})
