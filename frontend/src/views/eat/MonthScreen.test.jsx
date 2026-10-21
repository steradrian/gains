// @vitest-environment happy-dom
// MonthScreen (board Ea1Month): the grid with a ring a day, the tiles for the month so far, and
// what each day does when tapped: a past day and today open, a day ahead is dim and does nothing.
import { describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'
import { monthOf } from '../../lib/nutrition/trends.js'
import MonthScreen from './MonthScreen.jsx'

// The scenes arrive with ds/empty-scenes.js; this test is about the page, not the drawing.
vi.mock('../../ds/Illustration.jsx', async () => {
  const React = await import('react')
  return { default: ({ name }) => React.createElement('i', { 'data-scene': name }) }
})

const view = useView()
const TODAY = '2026-10-18'
const entry = (date, kcal) => ({ date, water: [], items: [{ uuid: 'i-' + date, meal: 0, name: 'Food', quantity: 1, nutrition: { calories: kcal } }] })
const SETTINGS = { calorieGoalMode: 'fixed', goals: { calories: { sharedGoal: true, max: 2000 } } }
const DAYS = [entry('2026-10-09', 2400), entry('2026-10-13', 2100), entry('2026-10-14', 1500), entry('2026-10-15', 2000), entry(TODAY, 900)]
const openOf = iso => (iso === TODAY ? 'today' : iso > TODAY ? 'future' : 'day')
const data = (days = DAYS, month = '2026-10', settings = SETTINGS) => monthOf({ month, days, settings, weekStart: 1, openOf })
const cells = () => [...view.host.querySelectorAll('.g-mg-cell')]
const rings = () => cells().map(c => c.querySelector('.g-mring-val'))
const props = (over = {}) => ({ data: data(), today: TODAY, weekStart: 1, onBack: vi.fn(), onDay: vi.fn(), onRetry: vi.fn(), ...over })

describe('MonthScreen', () => {
  it('names the month in the bar and over the grid, with a ring a day and the week from Monday', () => {
    view.render(<MonthScreen {...props()} />)
    expect(view.host.querySelector('.g-snav-title').textContent).toBe('October')
    expect(view.host.querySelector('.g-mg-top b').textContent).toBe('October 2026')
    expect(cells()).toHaveLength(31)
    expect([...view.host.querySelectorAll('.g-mg-head')].map(h => h.textContent).join('')).toBe('MTWTFSS')
  })

  it('draws on target full, over in amber and under short, and no ring for an empty or a future day', () => {
    view.render(<MonthScreen {...props()} />)
    const ring = day => rings()[day - 1]
    expect(ring(13).classList.contains('g-mring-over')).toBe(false)
    expect(ring(9).classList.contains('g-mring-over')).toBe(true)
    expect(ring(14).classList.contains('g-mring-over')).toBe(false)
    expect(ring(10)).toBeNull()
    expect(ring(25)).toBeNull()
  })

  it('opens a past day and today, and does nothing for a day ahead', () => {
    const p = props()
    view.render(<MonthScreen {...p} />)
    click(cells()[8])
    expect(p.onDay).toHaveBeenLastCalledWith('2026-10-09')
    click(cells()[17])
    expect(p.onDay).toHaveBeenLastCalledWith(TODAY)
    expect(cells()[18].tagName).toBe('SPAN')
    expect(cells()[18].querySelector('.g-mg-future')).not.toBeNull()
    expect(p.onDay).toHaveBeenCalledTimes(2)
  })

  it('names each day with its food for a screen reader', () => {
    view.render(<MonthScreen {...props()} />)
    expect(cells()[12].getAttribute('aria-label')).toMatch(/^Tuesday,? 13 October, 2,100 of 2,000 kcal$/)
    expect(cells()[9].getAttribute('aria-label')).toMatch(/^Saturday,? 10 October, No food logged$/)
    expect(cells()[17].getAttribute('aria-label')).toMatch(/^Today, Sunday,? 18 October, 900 of 2,000 kcal$/)
    expect(cells()[18].getAttribute('aria-label')).toMatch(/^Monday,? 19 October$/)
  })

  it('says October so far with the tiles: on target, the average and the over days with their dates', () => {
    view.render(<MonthScreen {...props()} />)
    expect(view.host.querySelector('.g-ssec h2').textContent).toBe('October so far')
    const tiles = [...view.host.querySelectorAll('.g-stat')].map(s => [...s.children].map(c => c.textContent))
    expect(tiles).toEqual([
      ['On target', '2 of 4', 'days'],
      ['Average', '2,000', 'kcal a day'],
      ['Over', '1 day', '9 Oct'],
    ])
  })

  it('has the month\'s name without "so far" for a month that is over', () => {
    view.render(<MonthScreen {...props({ data: data([entry('2026-09-10', 2000)], '2026-09') })} />)
    expect(view.host.querySelector('.g-ssec h2').textContent).toBe('September')
  })

  it('leaves out a tile no day backs, and all of them for an empty month', () => {
    view.render(<MonthScreen {...props({ data: data(DAYS, '2026-10', { calorieGoalMode: 'fixed', goals: {} }) })} />)
    expect([...view.host.querySelectorAll('.g-stat')].map(s => s.firstChild.textContent)).toEqual(['Average'])
    view.render(<MonthScreen {...props({ data: data([]) })} />)
    expect(view.host.querySelector('.g-stats')).toBeNull()
  })

  it('draws the grid without rings or tiles while loading', () => {
    view.render(<MonthScreen {...props({ status: 'loading' })} />)
    expect(rings().every(r => r === null)).toBe(true)
    expect(view.host.querySelector('.g-stats')).toBeNull()
    expect(view.host.querySelector('.eh').getAttribute('aria-busy')).toBe('true')
  })

  it('shows the error with Retry in place of the grid', () => {
    const p = props({ status: 'error', errorText: 'The diary did not load.' })
    view.render(<MonthScreen {...p} />)
    expect(view.host.querySelector('.g-mg')).toBeNull()
    expect(view.host.querySelector('[data-scene]').getAttribute('data-scene')).toBe('chart')
    click(view.host.querySelector('.g-sempty-btn'))
    expect(p.onRetry).toHaveBeenCalledTimes(1)
  })

  it('moves between months with the arrows, a missing handler drawing that arrow disabled', () => {
    const onPrev = vi.fn()
    view.render(<MonthScreen {...props({ onPrev })} />)
    const [prev, next] = view.host.querySelectorAll('.g-mg-nav')
    expect(next.disabled).toBe(true)
    click(prev)
    expect(onPrev).toHaveBeenCalledTimes(1)
  })
})
