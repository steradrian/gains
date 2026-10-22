// @vitest-environment happy-dom
// TrendsPage (/food/trends): the range lives in the address and is replaced, not pushed; nutrition
// off goes back to Eat; the Fasting block shows only with fasting on and a fast in range; a day
// opens its Day view; Log food on the few-days state opens the food picker.
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'
import TrendsPage from './TrendsPage.jsx'

const mocks = vi.hoisted(() => ({
  history: vi.fn(), fastingOn: vi.fn(), fasts: [], navToDay: vi.fn(), foodPickerSheet: vi.fn(), nav: vi.fn(),
}))
// Only what the page calls is replaced; the rest of each module stays, for what else imports it.
vi.mock('./use-food-history.js', () => ({ useFoodHistory: mocks.history }))
vi.mock('../../lib/nutrition/use-fasting.js', async importOriginal => ({
  ...(await importOriginal()),
  useFasting: Object.assign(selector => selector({ history: mocks.fasts }), { getState: () => ({ load: vi.fn() }) }),
  useFastingOn: mocks.fastingOn,
}))
vi.mock('../../lib/nutrition/use-freshness.js', async importOriginal => ({ ...(await importOriginal()), useToday: () => '2026-10-18' }))
vi.mock('../../lib/day-route.js', async importOriginal => ({ ...(await importOriginal()), navToDay: mocks.navToDay }))
vi.mock('../../lib/nav.js', async importOriginal => ({ ...(await importOriginal()), nav: mocks.nav }))
vi.mock('../../components/FoodPickerSheet.jsx', async importOriginal => ({ ...(await importOriginal()), foodPickerSheet: mocks.foodPickerSheet }))
vi.mock('../../ds/Illustration.jsx', async () => {
  const React = await import('react')
  return { default: ({ name }) => React.createElement('i', { 'data-scene': name }) }
})

const view = useView()
const entry = (date, kcal) => ({ date, water: [], items: [{ uuid: 'i-' + date, meal: 0, name: 'Food', quantity: 1, nutrition: { calories: kcal, proteins: 100 } }] })
const SETTINGS = { calorieGoalMode: 'fixed', goals: { calories: { sharedGoal: true, max: 2000 } } }
const DAYS = [entry('2026-10-15', 2000), entry('2026-10-16', 2100), entry('2026-10-17', 1900)]
const FAST = { id: 1, start_at: '2026-10-14T20:00:00.000Z', end_at: '2026-10-15T12:00:00.000Z', goal_hours: 16 }
const ready = (days = DAYS) => ({ status: 'ready', days, settings: SETTINGS, goalInputs: {}, activity: {}, tried: {}, today: '2026-10-18', error: null, reload: vi.fn() })

function Probe() {
  const { pathname, search } = useLocation()
  return <output data-testid="at">{pathname + search + ' ' + useNavigationType()}</output>
}
let shown = 0
// A new router each time: a router keeps the entries it started with.
function show(at = '/food/trends') {
  view.render(
    <MemoryRouter key={++shown} initialEntries={[at]}>
      <Routes>
        <Route path="/food/trends" element={<><TrendsPage /><Probe /></>} />
        <Route path="/food" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}
const at = () => view.host.querySelector('[data-testid=at]').textContent
const radios = () => [...view.host.querySelectorAll('.g-sseg [role=radio]')]
const sections = () => [...view.host.querySelectorAll('.g-ssec h2')].map(h => h.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.history.mockReturnValue(ready())
  mocks.fastingOn.mockReturnValue(false)
  mocks.fasts = []
})

describe('TrendsPage', () => {
  it('reads the range from the address: 7 days by default and for anything else', () => {
    show('/food/trends')
    expect(radios().map(r => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])
    show('/food/trends?range=30')
    expect(radios().map(r => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
    show('/food/trends?range=14')
    expect(radios().map(r => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])
  })

  it('asks the history for the window of the range, ending today', () => {
    show('/food/trends?range=90')
    expect(mocks.history).toHaveBeenLastCalledWith({ from: '2026-07-21', to: '2026-10-18' })
  })

  it('puts the range tapped in the address by replacing the entry, not pushing one', () => {
    show('/food/trends')
    click(radios()[2])
    expect(at()).toBe('/food/trends?range=90 REPLACE')
    expect(radios().map(r => r.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true'])
  })

  it('goes back to Eat when nutrition is not available', () => {
    mocks.history.mockReturnValue({ ...ready(), status: 'off' })
    show('/food/trends')
    expect(at()).toBe('/food REPLACE')
  })

  it('leaves the Fasting block out with fasting off, and with no fast in range', () => {
    mocks.fasts = [FAST]
    show('/food/trends')
    expect(sections()).not.toContain('Fasting')
    mocks.fastingOn.mockReturnValue(true)
    mocks.fasts = []
    show('/food/trends')
    expect(sections()).not.toContain('Fasting')
  })

  it('shows the Fasting block with fasting on and a fast in range, See all opening the Fasting page', () => {
    mocks.fastingOn.mockReturnValue(true)
    mocks.fasts = [FAST]
    show('/food/trends')
    expect(sections()).toContain('Fasting')
    click([...view.host.querySelectorAll('.g-ssec-act')].find(a => a.textContent === 'See all'))
    expect(mocks.nav).toHaveBeenCalledWith('/food/fasting')
  })

  it('opens a day from its row', () => {
    show('/food/trends')
    click(view.host.querySelectorAll('.g-gvr')[0])
    expect(mocks.navToDay).toHaveBeenCalledWith('2026-10-17')
  })

  it('opens the food picker from Log food when fewer than 3 days are logged', () => {
    mocks.history.mockReturnValue(ready([DAYS[0]]))
    show('/food/trends')
    expect(view.host.querySelector('.g-bars')).toBeNull()
    click(view.host.querySelector('.g-sempty-btn'))
    expect(mocks.foodPickerSheet).toHaveBeenCalledTimes(1)
  })
})
