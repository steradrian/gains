// @vitest-environment happy-dom
// WeekScreen (D2.0, D2.1): the header with ‹ ›, the ring line, the cells and what each opens, the
// Numbers ("–" where the week cannot back one, food tiles only with nutrition on), Last 4 weeks,
// Trends and the footer.
import { describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'
import WeekScreen from './WeekScreen.jsx'

const view = useView()
const ISO = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']
const MARKS = ['done', 'rest', 'done', 'rest', 'missed', 'rest', 'planned']
const food = (kcal, band = 'on') => ({ logged: kcal > 0, kcal, target: 2100, band, protein: 120, proteinTarget: 150, waterMl: 1900 })
const FOOD = [food(1980), food(2150), food(2090), food(0), food(1600, 'under'), food(2400, 'over'), null]
const cells = (over = {}) => ISO.map((iso, i) => ({
  iso, dow: 'MTWTFSS'[i], date: 12 + i, today: i === 6, future: false, workout: MARKS[i], food: FOOD[i],
  open: i === 6 ? 'today' : 'day', ...over,
}))
const LAST4 = [
  { isoWeek: '2026-W39', start: '2026-09-21', label: '21 Sep', done: 4, planned: 4, current: false, selected: false },
  { isoWeek: '2026-W40', start: '2026-09-28', label: '28 Sep', done: 3, planned: 4, current: false, selected: false },
  { isoWeek: '2026-W41', start: '2026-10-05', label: '5 Oct', done: 3, planned: 4, current: false, selected: false },
  { isoWeek: '2026-W42', start: '2026-10-12', label: '12 Oct', done: 2, planned: 4, current: true, selected: true },
]
const NUMBERS = {
  streak: { weeks: 6, best: 8 },
  onTarget: { days: 4, of: 6, within: 150 },
  kcal: { avg: 1980, target: 2100 },
  protein: { avg: 118, target: 150 },
  weight: { from: 81.7, to: 81.4, change: -0.3, unit: 'kg' },
  activity: { ms: 9600000, count: 3 },
  volume: { now: 14300, last: 18900, unit: 'kg', sameDays: true, change: -0.243 },
  water: { avgMl: 1900, goalMl: 2500 },
}
const EMPTY_NUMBERS = { streak: null, onTarget: null, kcal: null, protein: null, weight: null, activity: null, volume: null, water: null }

const weekOf = (over = {}) => ({
  isoWeek: '2026-W42', start: '2026-10-12', end: '2026-10-18', current: true, foodOn: true,
  range: '12 to 18 Oct', status: 'This week · Last day',
  ring: { done: 2, planned: 4, today: 'Push A', missed: [{ iso: '2026-10-16', day: 'Fri', name: 'Legs', ids: ['r3'] }], skipped: [] },
  cells: cells(), muscles: { load: {}, levels: { chest: 3, quadriceps: 0 } },
  muscleNote: 'Legs not trained yet. Legs was missed on Fri.',
  numbers: NUMBERS, last4: LAST4, prev: '2026-W41', next: null,
  openDay: vi.fn(), openWeek: vi.fn(() => 'week'), ...over,
})
const show = (over = {}) => {
  const week = weekOf(over)
  const props = { week, onBack: vi.fn(), onTrends: vi.fn() }
  view.render(<WeekScreen {...props} />)
  return props
}
const text = () => view.host.textContent
const byLabel = label => view.host.querySelector(`[aria-label="${label}"]`)
const tiles = () => Object.fromEntries([...view.host.querySelectorAll('.g-stat')].map(s => {
  const [label, sub] = s.querySelectorAll('span')
  return [label.textContent, [s.querySelector('b').textContent, sub?.textContent ?? null]]
}))
const dayCells = () => [...view.host.querySelectorAll('.g-swc-cell')]

describe('WeekScreen', () => {
  it('D2.0: the range and status, the ring line with today\'s workout, the muscle note and the footer', () => {
    show()
    // The range is the page's one heading of its own (StagePageTitle), its status the line under it.
    expect([...view.host.querySelectorAll('h1')].map(h => h.textContent)).toEqual(['12 to 18 Oct'])
    expect(view.host.querySelector('.week-head .g-sptitle p').textContent).toBe('This week · Last day')
    expect(view.host.querySelector('.week-ring-t b').textContent).toBe('2 of 4')
    expect(view.host.querySelector('.week-ring-t > span').textContent).toBe('workouts · Push A is today')
    expect(view.host.querySelector('.week-muscles p').textContent).toBe('Legs not trained yet. Legs was missed on Fri.')
    // A day to come opens its plan drawer, which edits: the footer does not call the page read-only.
    expect(view.host.querySelector('.g-snote').textContent).toBe('A past day opens its Day page, today opens Today, and a day to come opens its plan.')
    expect([...view.host.querySelectorAll('.g-ssec-label h2')].map(h => h.textContent)).toEqual(['Muscles this week', 'Numbers', 'Last 4 weeks'])
  })

  it('D2.1: a past week says what was skipped; no muscle note when there is nothing to say', () => {
    show({ current: false, status: 'Week 41 · complete', ring: { done: 3, planned: 4, today: null, missed: [], skipped: [{ iso: '2026-10-11', day: 'Sun', name: 'Pull A', ids: ['r2'] }] }, muscleNote: null })
    expect(view.host.querySelector('.week-ring-t > span').textContent).toMatch(/^workouts · one skipped on /)
    expect(view.host.querySelector('.week-muscles p')).toBeNull()
  })

  it('every day cell opens its day through openDay; a day before the first log opens nothing', () => {
    const { week } = show({ cells: cells().map((c, i) => (i === 0 ? { ...c, open: 'before' } : c)) })
    expect(dayCells()[0].tagName).toBe('SPAN')
    click(dayCells()[1])
    expect(week.openDay).toHaveBeenLastCalledWith('2026-10-13')
    click(dayCells()[6])
    expect(week.openDay).toHaveBeenLastCalledWith('2026-10-18')
    expect(week.openDay).toHaveBeenCalledTimes(2)
  })

  it('names each cell in words: today, the date, the mark and the kcal', () => {
    show()
    expect(dayCells()[0].getAttribute('aria-label')).toMatch(/, Workout done, 1,980 of 2,100 kcal$/)
    expect(dayCells()[3].getAttribute('aria-label')).toMatch(/, Rest day, No food logged$/)
    expect(dayCells()[4].getAttribute('aria-label')).toMatch(/, Workout missed, /)
    expect(dayCells()[6].getAttribute('aria-label')).toMatch(/^Today, .*, Workout planned, Food not loaded yet$/)
  })

  it('says what a "–" cell means, as the cell shows it: no target, not loaded, nothing for a day to come', () => {
    const noTarget = { ...food(1800), target: null, band: null }
    show({ cells: cells().map((c, i) => (i === 1 ? { ...c, food: noTarget } : i === 2 ? { ...c, food: null } : i === 5 ? { ...c, future: true, food: null } : c)) })
    expect(dayCells()[1].getAttribute('aria-label')).toMatch(/, Rest day, 1,800 kcal, no target$/)
    expect(dayCells()[1].querySelector('.g-swc-none')).not.toBeNull()
    expect(dayCells()[2].getAttribute('aria-label')).toMatch(/, Workout done, Food not loaded yet$/)
    expect(dayCells()[5].getAttribute('aria-label')).toMatch(/, Rest day$/)
  })

  it('‹ opens the week before in place; › is faint and does nothing on this week', () => {
    const { week } = show()
    click(byLabel('Previous week'))
    expect(week.openWeek).toHaveBeenCalledWith('2026-W41')
    expect(view.host.querySelector('button[aria-label="Next week"]')).toBeNull()
    expect(view.host.querySelector('.week-nav-off')).toBeTruthy()
    expect(document.activeElement).toBe(view.host.querySelector('.week-head h1'))
  })

  it('moves focus only when the address really moved to another week', () => {
    show({ openWeek: vi.fn(() => 'future') })
    click(byLabel('Previous week'))
    expect(document.activeElement).not.toBe(view.host.querySelector('.week-head h1'))
  })

  it('has no ‹ before the week of the first log: a faint glyph that does nothing', () => {
    show({ prev: null })
    expect(byLabel('Previous week')).toBeNull()
    expect(view.host.querySelectorAll('.week-nav-off')).toHaveLength(2)
  })

  it('› on a past week opens the week after', () => {
    const { week } = show({ current: false, next: '2026-W42', prev: '2026-W40' })
    click(byLabel('Next week'))
    expect(week.openWeek).toHaveBeenCalledWith('2026-W42')
  })

  it('Last 4 weeks: each week opens in place, the one on screen is current; Trends opens trends', () => {
    const { week, onTrends } = show()
    const cellsOf4 = [...view.host.querySelectorAll('.g-w4-cell')]
    expect(cellsOf4.map(c => c.querySelector('.g-w4-n').textContent)).toEqual(['4 of 4', '3 of 4', '3 of 4', '2 of 4'])
    expect(cellsOf4[3].getAttribute('aria-current')).toBe('page')
    click(byLabel('Week of 21 Sep, 4 of 4 workouts'))
    expect(week.openWeek).toHaveBeenCalledWith('2026-W39')
    click([...view.host.querySelectorAll('.g-ssec-act')].find(b => b.textContent === 'Trends'))
    expect(onTrends).toHaveBeenCalledTimes(1)
  })

  it('Numbers: every tile from the data, in the boards\' order', () => {
    show()
    expect(Object.keys(tiles())).toEqual(['Streak', 'Days on target', 'Average kcal', 'Average protein', 'Weight', 'Activity', 'Volume', 'Water'])
    expect(tiles()['Streak']).toEqual(['6 weeks', 'in a row · best 8'])
    expect(tiles()['Days on target']).toEqual(['4 of 6', 'within 150 kcal'])
    expect(tiles()['Average kcal']).toEqual(['1,980', 'of 2,100 a day'])
    expect(tiles()['Average protein']).toEqual(['118 g', 'of 150 g a day'])
    expect(tiles()['Weight']).toEqual(['−0.3 kg', '81.7 → 81.4 kg'])
    expect(tiles()['Activity'][1]).toBe('3 workouts')
    expect(tiles()['Volume'][1]).toMatch(/ kg by this point last week$/)
    expect(tiles()['Water']).toEqual(['1.9 L', 'a day · goal 2.5 L'])
  })

  it('a weight change that rounds to nothing has no sign; a missing target has no "of" line', () => {
    show({ numbers: { ...NUMBERS, weight: { from: 81.4, to: 81.42, change: 0.02, unit: 'kg' }, kcal: { avg: 1980, target: null }, water: { avgMl: 1900, goalMl: null } } })
    expect(tiles()['Weight'][0]).toBe('0 kg')
    expect(tiles()['Average kcal']).toEqual(['1,980', null])
    expect(tiles()['Water']).toEqual(['1.9 L', 'a day'])
  })

  it('a past week\'s volume compares with the week before', () => {
    show({ current: false, next: '2026-W42', numbers: { ...NUMBERS, streak: { weeks: 5, best: null }, volume: { now: 18900, last: 17800, unit: 'kg', change: 0.062 } } })
    expect(tiles()['Volume'][1]).toBe('+6% on the week before')
    expect(tiles()['Streak']).toEqual(['5 weeks', 'in a row'])
  })

  it('an empty week: the cells and Last 4 weeks still show, every number reads "–", the ring is empty', () => {
    show({
      ring: { done: 0, planned: 0, today: null, missed: [], skipped: [] }, numbers: EMPTY_NUMBERS, muscleNote: null,
      cells: cells({ workout: 'rest', food: null }),
    })
    expect(Object.values(tiles())).toEqual(Array(8).fill(['–', null]))
    expect(dayCells()).toHaveLength(7)
    expect(view.host.querySelectorAll('.g-w4-cell')).toHaveLength(4)
    expect(view.host.querySelector('.week-ring-t b').textContent).toBe('0')
    expect(view.host.querySelector('.week-ring-t > span').textContent).toBe('workouts')
    expect(view.host.querySelector('.g-sring-val')).toBeNull()
    expect(view.host.querySelectorAll('.g-swc-none')).toHaveLength(7)
  })

  it('nutrition off: no food tiles, no kcal row', () => {
    show({ foodOn: false })
    expect(Object.keys(tiles())).toEqual(['Streak', 'Weight', 'Activity', 'Volume'])
    expect(view.host.querySelector('.g-swc-grid .g-mring')).toBeNull()
    expect(dayCells()[0].getAttribute('aria-label')).toMatch(/, Workout done$/)
  })

  it('Back calls onBack', () => {
    const { onBack } = show()
    click(byLabel('Back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
