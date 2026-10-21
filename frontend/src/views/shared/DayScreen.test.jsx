// @vitest-environment happy-dom
// The Day page on the stage (PR07 D1.0 to D1.4, D1.7's Skipped): each state draws its parts and
// each tap reaches what useDay() hands it. The data is the boards' (shared-day-fixture.js).
import { describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'
import { DAYS, dayFixture, railOf } from '../../dev/screens/states/shared-day-fixture.js'
import DayScreen from './DayScreen.jsx'

const view = useView()
const day = (over = {}) => dayFixture(over, () => vi.fn())
const q = sel => view.host.querySelector(sel)
const all = sel => [...view.host.querySelectorAll(sel)]
const labels = () => all('.g-ssec-label h2').map(h => h.textContent)
const buttonOf = (text, scope = view.host) => [...scope.querySelectorAll('button')].find(b => b.textContent === text)
const rows = () => all('.g-glist-row').map(r => r.querySelector('.g-glist-body').textContent)

describe('DayScreen', () => {
  it('D1.0: the nav bar, the rail, the date and its line, then Training, Food, and Water and body', () => {
    const d = day()
    view.render(<DayScreen day={d} onBack={() => {}} />)
    // The date is the page's one heading of its own (StagePageTitle); the bar has no title.
    expect(q('.g-snav-title')).toBeNull()
    expect(all('h1').map(h => h.textContent)).toEqual(['Mon 12 Oct'])
    expect(q('.g-sptitle p').textContent).toBe('Push A done · on target · 6 days ago')
    expect(q('.g-rail-title').textContent).toBe('Week of 12 Oct')
    expect(labels()).toEqual(['Training', 'Food', 'Water and body'])
  })

  it('D1.0: the workout with its length, sets, time and new bests, the muscles line, the exercises and their New best tags', () => {
    const d = day()
    view.render(<DayScreen day={d} onBack={() => {}} />)
    expect(q('.g-wcard-head').textContent).toBe('Push A52 min · 18 sets · 18:302 new bests')
    expect(q('.g-wcard-map').textContent).toBe('Chest, shoulders, triceps18 sets · 7,900 kg moved · 52 min')
    const ex = all('.g-wcard-ex')
    expect(ex).toHaveLength(6)
    expect(ex[0].textContent).toBe('Bench press80×6 · 80×6 · 75×8New best')
    expect(ex.filter(e => e.textContent.includes('New best'))).toHaveLength(2)
    click(q('.g-wcard-head'))
    expect(d.openWorkout).toHaveBeenCalledWith(d.workouts[0])
    click(ex[1])
    expect(d.openExercise).toHaveBeenCalledWith(d.workouts[0].exercises[1])
  })

  it('D1.0: the food against that day’s target, the macros and the meals; a meal logs to itself', () => {
    const d = day()
    view.render(<DayScreen day={d} onBack={() => {}} />)
    expect(q('.g-dfood-num').textContent).toBe('2,075 of 2,100 kcalOn target')
    expect(all('.g-dfood-macro').map(m => m.textContent)).toEqual(['Protein132 of 150 g', 'Carbs214 of 230 g', 'Fat66 of 70 g'])
    const meals = all('.g-dfood-meal')
    expect(meals[0].textContent).toBe('BreakfastOats with milk, Banana485 kcal')
    click(meals[2])
    expect(d.logFood).toHaveBeenCalledWith(2)
  })

  it('D1.0: water, no weigh-in with a way to add one, and the last measurements', () => {
    const d = day()
    view.render(<DayScreen day={d} onBack={() => {}} />)
    // No NutriTrace settings in the test: water reads in ml.
    expect(rows()).toEqual(['Water · 2,250 ml9 glasses, last at 21:10', 'No weigh-inAdd one for this day', 'MeasurementsWaist 84 cm, last on Sun 4 Oct'])
    click(all('.g-glist-row')[1])
    expect(d.weighInSheet).toHaveBeenCalled()
  })

  it('D1.1 rest: no workout card; Rest day with what was next, food and the weigh-in', () => {
    view.render(<DayScreen day={day(DAYS.rest)} onBack={() => {}} />)
    expect(q('.g-wcard')).toBeNull()
    expect(q('.g-dstat-b').textContent).toBe('Rest dayNothing planned. Pull A was next, Wed 14 Oct.')
    expect(q('.g-dfood-num').textContent).toBe('1,810 of 2,100 kcal290 under target')
    expect(rows()).toContain('Weigh-in · 81.7 kg')
  })

  it('D1.2 missed: the planned routine, its stills, Add past workout and Mark skipped', () => {
    const d = day(DAYS.missed)
    view.render(<DayScreen day={d} onBack={() => {}} />)
    expect(q('.g-dstat-b').textContent).toBe('Legs was planned, not logged' + 'Log it if you trained and forgot, or mark it skipped.')
    expect(all('.g-dstat-stack > span')).toHaveLength(5)
    expect(all('.g-dstat-btn').map(b => b.textContent)).toEqual(['Add past workout', 'Mark skipped'])
    click(buttonOf('Mark skipped'))
    expect(d.markSkipped).toHaveBeenCalledTimes(1)
    click(buttonOf('Add past workout'))
    expect(d.addPastWorkout).toHaveBeenCalledTimes(1)
    expect(all('.g-dfood-meal').at(-1).textContent).toBe('SnacksNothing logged')
  })

  it('D1.7 skipped: reads Skipped, with nothing left to do', () => {
    view.render(<DayScreen day={day(DAYS.skipped)} onBack={() => {}} />)
    expect(q('.g-dstat-b b').textContent).toBe('Legs, skipped')
    expect(q('.g-dstat .g-tag').textContent).toBe('Skipped')
    expect(q('.g-dstat-btn')).toBeNull()
  })

  it('D1.3 nothing logged: one line and the three ways to add, the first naming the day', () => {
    const d = day(DAYS.empty)
    view.render(<DayScreen day={d} onBack={() => {}} />)
    expect(labels()).toEqual([])
    expect(q('.g-sempty b').textContent).toBe('Nothing logged')
    expect(q('.g-sempty > span:not(.g-sempty-ic)').textContent).toBe('Anything you add from here goes to Thu 15 Oct, not today.')
    expect(all('.g-sempty-btn').map(b => b.textContent)).toEqual(['Log food for Thu 15 Oct', 'Add past workout', 'Log weight'])
    click(buttonOf('Log food for Thu 15 Oct'))
    expect(d.logFood).toHaveBeenCalled()
    click(buttonOf('Log weight'))
    expect(d.weighInSheet).toHaveBeenCalled()
  })

  it('a day with nothing eaten is not judged against its target: no "under target"', () => {
    const empty = { ...DAYS.missed.food, kcal: 0, diff: -2100, band: 'under', logged: false }
    view.render(<DayScreen day={day({ ...DAYS.rest, food: empty })} onBack={() => {}} />)
    expect(q('.g-dfood-num').textContent).toBe('0 of 2,100 kcal')
  })

  it('with no target behind the day, the total stands alone: no "of", no status', () => {
    const none = { ...DAYS.rest.food, target: null, diff: null, band: null }
    view.render(<DayScreen day={day({ ...DAYS.rest, food: none })} onBack={() => {}} />)
    expect(q('.g-dfood-num').textContent).toBe('1,810')
  })

  it('a rest day in a week the plan cannot be held to says nothing of what was planned', () => {
    view.render(<DayScreen day={day({ ...DAYS.rest, next: null, planKnown: false })} onBack={() => {}} />)
    expect(q('.g-dstat-b').textContent).toBe('Rest day')
  })

  it('a search’s Day result: the meal holding the entry is lit and scrolled to', () => {
    const scroll = vi.fn()
    const was = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scroll
    try {
      const d = day()
      const uuid = d.food.meals[2].items[0].uuid
      view.render(<DayScreen day={d} find={uuid} onBack={() => {}} />)
      const found = all('.g-dfood-found')
      expect(found).toHaveLength(1)
      expect(found[0]).toBe(all('.g-dfood-meal')[2])
      expect(scroll).toHaveBeenCalledWith({ block: 'center' })
    } finally {
      Element.prototype.scrollIntoView = was
    }
  })

  it('D1.3 with food tracking off: the two ways that are there', () => {
    view.render(<DayScreen day={day({ ...DAYS.empty, food: { tracking: 'off' } })} onBack={() => {}} />)
    expect(all('.g-sempty-btn').map(b => b.textContent)).toEqual(['Add past workout', 'Log weight'])
  })

  it('D1.4 food tracking off: one grey Food card, no water row', () => {
    view.render(<DayScreen day={day(DAYS.off)} onBack={() => {}} />)
    expect(q('.g-wcard')).not.toBeNull()
    const off = q('.g-dstat-off')
    expect(off.querySelector('b').textContent).toBe('Tracking off')
    expect(q('.g-dfood')).toBeNull()
    expect(rows().some(r => r.startsWith('Water'))).toBe(false)
  })

  it('the rail swaps the day: another day calls select, the day shown does not, a dimmed one cannot', () => {
    // Nothing logged before Thu 1 Oct: 28 to 30 Sept are dimmed.
    const d = day({ rail: railOf('2026-10-12', '2026-10-01') })
    view.render(<DayScreen day={d} onBack={() => {}} />)
    const cells = all('.g-rail-page:not([inert]) .g-rd')
    click(cells[1])
    expect(d.select).toHaveBeenCalledWith('2026-10-13')
    click(cells[0])
    expect(d.select).toHaveBeenCalledTimes(1)
    click(q('.g-rail-btn[aria-label="Week of 5 Oct"]'))
    click(q('.g-rail-btn[aria-label="Week of 28 Sept"]'))
    const earlier = all('.g-rail-page:not([inert]) .g-rd')
    expect(earlier.map(c => c.disabled)).toEqual([true, true, true, false, false, false, false])
    click(earlier[0])
    expect(d.select).toHaveBeenCalledTimes(1)
  })

  it('the Week link opens the week on show', () => {
    const d = day()
    view.render(<DayScreen day={d} onBack={() => {}} />)
    click(q('.g-rail-act'))
    expect(d.openWeek).toHaveBeenCalledWith('2026-W42')
    click(q('.g-rail-btn[aria-label="Week of 5 Oct"]'))
    click(q('.g-rail-act'))
    expect(d.openWeek).toHaveBeenLastCalledWith('2026-W41')
  })

  it('Back goes back, + adds to this day, and a gone target’s line shows under the title', () => {
    const d = day()
    const onBack = vi.fn()
    view.render(<DayScreen day={d} changed="That workout was deleted." onBack={onBack} />)
    click(q('.g-snav-back'))
    expect(onBack).toHaveBeenCalled()
    click(q('.g-snav-btn[aria-label="Add to this day"]'))
    expect(d.add).toHaveBeenCalled()
    expect(q('.day-changed').textContent).toBe('That workout was deleted.')
  })
})
