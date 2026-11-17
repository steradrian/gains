// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { heroFrom, heroOf, heroSlides, railStarts, railWeekOf } from './eat-data.js'

// The board's day: Sunday 18 October 2026, the week Mon 12 to Sun 18, Monday first.
const TODAY = '2026-10-18'
const START = '2026-10-12'
const MONDAY = 1
const day = (n, base = START) => { const d = new Date(base + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const eaten = (kcal, protein = 120) => ({ items: [{ uuid: 'u' + kcal, quantity: 1, nutrition: { calories: kcal, proteins: protein } }] })
const goalsOf = (kcal = 2100, protein = 150) => ({ calories: { min: kcal, max: kcal, sharedGoal: true }, proteins: { max: protein } })
// A food bundle as useEat gives dayFoodOf: `entries` by date (null is a loaded empty day).
const foodOf = (entries, settings = { goals: goalsOf() }) => ({
  on: true, settings, entries, goalInputs: {}, activity: {}, tried: Object.fromEntries(Object.keys(entries).map(d => [d, true])),
})

describe('railStarts', () => {
  it('runs from the week of the first logged day to this one, oldest first', () => {
    expect(railStarts({ today: TODAY, ws: MONDAY, first: '2026-09-30' })).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
  })
  it('is this week alone before anything is logged', () => {
    expect(railStarts({ today: TODAY, ws: MONDAY, first: null })).toEqual([START])
  })
  it('stops a year back', () => {
    expect(railStarts({ today: TODAY, ws: MONDAY, first: '2020-01-01' })).toHaveLength(52)
  })
})

describe('railWeekOf', () => {
  const entries = { [day(0)]: eaten(2016), [day(1)]: eaten(2268), [day(2)]: null, [day(3)]: eaten(900) }
  const week = railWeekOf({ start: START, today: TODAY, ws: MONDAY, food: foodOf(entries) })

  it('is seven days titled for the week', () => {
    expect(week.days).toHaveLength(7)
    expect(week.title).toContain('This week')
  })
  it('draws a logged day’s share of its own goal', () => {
    expect(week.days[0].ring.value).toBeCloseTo(0.96)
    expect(week.days[0].ring.over).toBe(false)
    expect(week.days[0].label).toContain('96% of target')
  })
  it('turns a day over its goal amber, and caps the ring at full', () => {
    expect(week.days[1].ring).toEqual({ value: 1, over: true })
  })
  it('leaves an empty or unloaded day as a bare ring', () => {
    expect(week.days[2].ring).toEqual({ value: 0, over: false })
    expect(week.days[5].ring).toEqual({ value: 0, over: false })
  })
  it('marks today, and nothing after it can be tapped', () => {
    const future = railWeekOf({ start: '2026-10-19', today: TODAY, ws: MONDAY, food: foodOf(entries) })
    expect(week.days[6].state).toBe('today')
    expect(week.days[6].disabled).toBe(false)
    expect(future.days.every(d => d.disabled)).toBe(true)
  })
  it('judges a day against that day’s goal, not another’s', () => {
    // Mondays 2,000, every other day 2,400 (getDay: 0 is Sunday).
    const goals = { calories: { sharedGoal: false, days: [2400, 2000, 2400, 2400, 2400, 2400, 2400] } }
    const w = railWeekOf({ start: START, today: TODAY, ws: MONDAY, food: foodOf({ [day(0)]: eaten(2000), [day(1)]: eaten(2000) }, { goals }) })
    expect(w.days[0].ring.value).toBe(1)
    expect(w.days[1].ring.value).toBeCloseTo(2000 / 2400)
  })
  it('draws no share for a day with no goal behind it', () => {
    const w = railWeekOf({ start: START, today: TODAY, ws: MONDAY, food: foodOf({ [day(0)]: eaten(1800) }, { goals: {} }) })
    expect(w.days[0].ring).toEqual({ value: 0, over: false })
    expect(w.days[0].label).not.toContain('%')
  })
})

describe('heroOf', () => {
  it('counts days on target among logged days, today left out while it is being logged', () => {
    const entries = {
      [day(0)]: eaten(2016), [day(1)]: eaten(2268), [day(2)]: eaten(1995), [day(3)]: eaten(2079), [day(4)]: null, [day(5)]: eaten(1974),
      [day(6)]: eaten(300),
    }
    const hero = heroOf({ start: START, today: TODAY, food: foodOf(entries) })
    // Mon, Wed, Thu, Sat are within 150 kcal; Tue is over; Fri was not logged; Sunday is today.
    expect(hero.onTarget).toEqual({ days: 4, of: 5 })
    expect(hero.logged).toBe(5)
    expect(hero.kcal).toEqual({ avg: Math.round((2016 + 2268 + 1995 + 2079 + 1974) / 5), target: 2100 })
    expect(hero.range).toContain('12')
  })
  it('judges each day against its own goal', () => {
    const goals = { calories: { sharedGoal: false, days: [2400, 2000, 2400, 2400, 2400, 2400, 2400] }, proteins: { max: 150 } }
    const hero = heroOf({ start: START, today: TODAY, food: foodOf({ [day(0)]: eaten(2000), [day(1)]: eaten(2400) }, { goals }) })
    // Monday 2,000 against 2,000 and Tuesday 2,400 against 2,400 are both on target.
    expect(hero.onTarget).toEqual({ days: 2, of: 2 })
    expect(hero.kcal.target).toBe(2200)
  })
  it('counts a day with no goal for nothing, but still logs it', () => {
    const hero = heroOf({ start: START, today: TODAY, food: foodOf({ [day(0)]: eaten(1800), [day(1)]: eaten(1900) }, { goals: {} }) })
    expect(hero.onTarget).toBeNull()
    expect(hero.logged).toBe(2)
    expect(hero.kcal).toEqual({ avg: 1850, target: null })
    expect(hero.protein.target).toBeNull()
  })
  it('backs nothing with no logged day', () => {
    const hero = heroOf({ start: START, today: TODAY, food: foodOf({ [day(0)]: null }) })
    expect(hero).toMatchObject({ logged: 0, onTarget: null, kcal: null, protein: null, range: null })
  })
  it('keeps the week as it was when today is Monday: nothing yet counts', () => {
    const hero = heroOf({ start: START, today: START, food: foodOf({ [START]: eaten(2000) }) })
    expect(hero.logged).toBe(0)
  })
})

describe('heroSlides', () => {
  const units = { energyUnit: 'kcal', energyValue: v => v.toLocaleString('en') }
  const f = (kcal, protein) => ({ logged: true, kcal, target: 2100, band: Math.abs(kcal - 2100) <= 150 ? 'on' : kcal > 2100 ? 'over' : 'under', protein, proteinTarget: 150 })

  it('is days on target, the daily average and the protein average', () => {
    const hero = heroFrom([{ iso: '1', f: f(2000, 130) }, { iso: '2', f: f(2400, 120) }])
    const [week, calories, protein] = heroSlides(hero, units)
    expect(week).toMatchObject({ big: '1 of 2', value: 1, max: 2 })
    expect(calories).toMatchObject({ big: '2,200', value: 2200, max: 2100 })
    expect(calories.over).toBeCloseTo(100 / 2100)
    expect(protein).toMatchObject({ big: '125', max: 150, over: 0 })
  })
  it('starts with the days logged when no goal backs "on target"', () => {
    const hero = heroFrom([{ iso: '1', f: { logged: true, kcal: 1800, target: null, band: null, protein: 100, proteinTarget: null } }])
    const [first, calories] = heroSlides(hero, units)
    expect(first).toMatchObject({ name: 'Days logged', big: '1', max: 7 })
    expect(calories.unit).toBe('kcal')
    expect(calories.max).toBe(0)
  })
  it('is one slide of nothing for an empty week', () => {
    const slides = heroSlides(heroFrom([]), units)
    expect(slides).toHaveLength(1)
    expect(slides[0]).toMatchObject({ big: '0', value: 0 })
  })
})
