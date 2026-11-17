// @vitest-environment happy-dom
// TrendsScreen (boards Ea3Trends, Ea3Few): the range control, the tiles, the Calories chart against
// the target, the macros, the Fasting block (left out when there is none), the days, and the gate
// that shows Ea3Few instead of charts under 3 logged days.
import { describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'
import { foodTrendsOf } from '../../lib/nutrition/trends.js'
import TrendsScreen from './TrendsScreen.jsx'

// The scenes arrive with ds/empty-scenes.js; this test is about the page, not the drawing.
vi.mock('../../ds/Illustration.jsx', async () => {
  const React = await import('react')
  return { default: ({ name }) => React.createElement('i', { 'data-scene': name }) }
})

const view = useView()
const TODAY = '2026-10-18'
const entry = (date, kcal, protein) => ({ date, water: [], items: [{ uuid: 'i-' + date, meal: 0, name: 'Food', quantity: 1, nutrition: { calories: kcal, proteins: protein } }] })
const SETTINGS = { calorieGoalMode: 'fixed', goals: { calories: { sharedGoal: true, max: 2100 }, proteins: { sharedGoal: true, max: 150 } } }
const WEEK = [entry('2026-10-12', 1450, 90), entry('2026-10-13', 2380, 150), entry('2026-10-14', 2100, 140), entry('2026-10-15', 2080, 130), entry('2026-10-16', 1960, 120), entry('2026-10-17', 2100, 150), entry(TODAY, 1280, 60)]
const FASTING = { avgHours: 15 + 40 / 60, streak: 5, longestHours: 18 + 5 / 60, longestDay: '2026-10-14' }
const data = (days = WEEK, range = 7, settings = SETTINGS) => foodTrendsOf({ days, settings, range, today: TODAY })
const props = (over = {}) => ({
  data: data(), onRange: vi.fn(), onBack: vi.fn(), onTargets: vi.fn(), onFasting: vi.fn(), onDay: vi.fn(), onLog: vi.fn(), onRetry: vi.fn(), ...over,
})
const sections = () => [...view.host.querySelectorAll('.g-ssec h2')].map(h => h.textContent)
const tiles = () => [...view.host.querySelectorAll('.g-stat')].map(s => [...s.children].map(c => c.textContent))
const pressed = label => [...view.host.querySelectorAll('.g-sseg [role=radio]')].find(r => r.textContent === label)

describe('TrendsScreen', () => {
  it('has the range control with 7 days lit, and asks for the range tapped', () => {
    const p = props()
    view.render(<TrendsScreen {...p} />)
    expect(view.host.querySelector('.g-snav-title').textContent).toBe('Food trends')
    expect([...view.host.querySelectorAll('.g-sseg [role=radio]')].map(r => [r.textContent, r.getAttribute('aria-checked')])).toEqual([
      ['7 days', 'true'], ['30 days', 'false'], ['90 days', 'false'],
    ])
    click(pressed('90 days'))
    expect(p.onRange).toHaveBeenCalledWith(90)
  })

  it('says the average, how many days were on target and the protein against its target, today left out', () => {
    view.render(<TrendsScreen {...props()} />)
    expect(tiles().slice(0, 3)).toEqual([
      ['Average', '2,012', 'kcal a day'],
      ['On target', '4 of 6', 'days logged'],
      ['Protein', '130 g', 'of 150 g a day'],
    ])
  })

  it('draws the calories chart a bar a day with today lit, and the dashed target line', () => {
    view.render(<TrendsScreen {...props()} />)
    const bars = [...view.host.querySelectorAll('.g-bar-col i')]
    expect(bars).toHaveLength(7)
    expect(bars.map(b => b.classList.contains('g-bar-dim'))).toEqual([true, true, true, true, true, true, false])
    expect(view.host.querySelector('.g-bars-target')).not.toBeNull()
    expect(view.host.querySelector('.eh-note').textContent).toBe('The dashed line is your target, 2,100 kcal. Today is still open.')
    expect([...view.host.querySelectorAll('.g-sr li')].at(-1).textContent).toMatch(/today is still open/)
  })

  it('draws a tick per bar when the goal differs from day to day, and no line', () => {
    const split = { ...SETTINGS, goals: { ...SETTINGS.goals, calories: { sharedGoal: false, days: [2100, 2100, 1800, 2100, 2100, 2100, 2100] } } }
    view.render(<TrendsScreen {...props({ data: data(WEEK, 7, split) })} />)
    expect(view.host.querySelector('.g-bars-target')).toBeNull()
    expect(view.host.querySelectorAll('.g-bar-tick')).toHaveLength(7)
    expect(view.host.querySelector('.eh-note').textContent).toBe('The dashes mark each day’s target. Today is still open.')
  })

  it('draws no target at all, and says none, for days without a goal', () => {
    view.render(<TrendsScreen {...props({ data: data(WEEK, 7, { calorieGoalMode: 'fixed', goals: {} }) })} />)
    expect(view.host.querySelector('.g-bars-target')).toBeNull()
    expect(view.host.querySelector('.g-bar-tick')).toBeNull()
    expect(view.host.querySelector('.eh-note').textContent).toBe('Today is still open.')
    expect(tiles().map(t => t[0])).toEqual(['Average', 'Protein'])
    expect(view.host.textContent).not.toContain('Under')
  })

  it('draws a bar a week for 30 days, and says so', () => {
    const month = [...WEEK, entry('2026-10-05', 2000, 100), entry('2026-10-06', 2000, 100)]
    view.render(<TrendsScreen {...props({ data: data(month, 30) })} />)
    expect(view.host.querySelectorAll('.g-bar-col i')).toHaveLength(5)
    expect(view.host.querySelector('.eh-note').textContent).toContain('Each bar is the daily average of a week.')
  })

  it('shows the macros with a bar against the target only for the ones that have a goal', () => {
    view.render(<TrendsScreen {...props()} />)
    const rows = [...view.host.querySelectorAll('.eh-macro')]
    expect(rows.map(r => r.querySelector('b').textContent)).toEqual(['Protein', 'Carbs', 'Fat'])
    expect(rows[0].querySelector('.eh-macro-top span').textContent).toBe('130 of 150 g')
    expect(rows[0].querySelector('.eh-track i').style.getPropertyValue('--p')).toBe('87')
    expect(rows[1].querySelector('.eh-track')).toBeNull()
    expect(rows[1].querySelector('.eh-macro-top span').textContent).toBe('0 g')
  })

  it('shows the Fasting block with See all, and leaves it out entirely without one', () => {
    const p = props({ fasting: FASTING })
    view.render(<TrendsScreen {...p} />)
    expect(sections()).toEqual(['Calories', 'Macros, daily average', 'Fasting', 'Days'])
    expect(tiles().slice(3, 6)).toEqual([
      ['Average', '15:40', 'hours a fast'],
      ['Streak', '5 days', 'on goal'],
      ['Longest', '18:05', expect.stringMatching(/14 Oct/)],
    ])
    click([...view.host.querySelectorAll('.g-ssec-act')].find(a => a.textContent === 'See all'))
    expect(p.onFasting).toHaveBeenCalledTimes(1)
    view.render(<TrendsScreen {...props({ fasting: null })} />)
    expect(sections()).toEqual(['Calories', 'Macros, daily average', 'Days'])
    expect(view.host.textContent).not.toContain('Fasting')
  })

  it('opens Daily targets', () => {
    const p = props()
    view.render(<TrendsScreen {...p} />)
    click([...view.host.querySelectorAll('.g-ssec-act')].find(a => a.textContent === 'Daily targets'))
    expect(p.onTargets).toHaveBeenCalledTimes(1)
  })

  it('lists the logged days newest first with their band, each opening its day, and not today', () => {
    const p = props()
    view.render(<TrendsScreen {...p} />)
    const rows = [...view.host.querySelectorAll('.g-gvr')]
    expect(rows).toHaveLength(6)
    expect(rows[0].querySelector('.g-glist-body b').textContent).toMatch(/17 Oct/)
    expect(rows[0].querySelector('.g-glist-body span').textContent).toBe('2,100 kcal · P 150 g')
    expect(rows.map(r => r.querySelector('.g-gvr-val').textContent)).toEqual(['On target', 'On target', 'On target', 'On target', 'Over', 'Under'])
    click(rows[4])
    expect(p.onDay).toHaveBeenCalledWith('2026-10-13')
  })

  it('shows Trends need 3 days instead of charts with fewer logged days, counting logged days', () => {
    const p = props({ data: data([entry('2026-10-01', 2000, 100), entry(TODAY, 1280, 60)], 30) })
    view.render(<TrendsScreen {...p} />)
    expect(view.host.querySelector('.g-sempty b').textContent).toBe('Trends need 3 days')
    expect(view.host.querySelector('[data-scene]').getAttribute('data-scene')).toBe('chart')
    expect([...view.host.querySelectorAll('.eh-pills i')].map(i => i.classList.contains('on'))).toEqual([true, false, false])
    expect(view.host.querySelector('.eh-pills').getAttribute('aria-label')).toBe('1 of 3 so far.')
    expect(view.host.querySelector('.g-bars')).toBeNull()
    expect(view.host.querySelector('.g-stats')).toBeNull()
    expect(view.host.querySelector('.g-sseg')).not.toBeNull()
    click(view.host.querySelector('.g-sempty-btn'))
    expect(p.onLog).toHaveBeenCalledTimes(1)
  })

  it('shows only the range control while loading, and the error with Retry', () => {
    view.render(<TrendsScreen {...props({ status: 'loading' })} />)
    expect(view.host.querySelector('.g-sseg')).not.toBeNull()
    expect(view.host.querySelector('.g-stats')).toBeNull()
    expect(view.host.querySelector('.g-sempty')).toBeNull()
    const p = props({ status: 'error', errorText: 'The diary did not load.' })
    view.render(<TrendsScreen {...p} />)
    expect(view.host.querySelector('.g-sempty b').textContent).toBe('The diary did not load.')
    click(view.host.querySelector('.g-sempty-btn'))
    expect(p.onRetry).toHaveBeenCalledTimes(1)
  })
})
