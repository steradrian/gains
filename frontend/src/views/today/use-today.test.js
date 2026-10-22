// @vitest-environment happy-dom
// useToday's pure parts: the profile, the rings a day gives, the meal tiles and the water glass.
// The screen itself, against a faked NutriTrace, is in views/Home.*.test.jsx.
import { describe, expect, it, vi } from 'vitest'
import { todayISO } from '../../lib/format.js'
import { DEF } from '../../store/useStore.js'
import {
  AWAY_DAYS, awayDays, doneLine, exercisesDone, firstStepsOf, foodRings, glassOf, goalSetOf, lastLogOf, mealsOf, todayProfile, upNextOf,
} from './use-today.js'

describe('goalSetOf (T1.9\'s first step)', () => {
  it('is set by a calorie goal of their own or by Adaptive or Dynamic, never by the 2000 fallback', () => {
    const date = '2026-10-21'
    expect(goalSetOf(null, date)).toBe(false)
    expect(goalSetOf({ goals: {} }, date)).toBe(false)
    expect(goalSetOf({ goals: { calories: { max: 2200, sharedGoal: true } } }, date)).toBe(true)
    expect(goalSetOf({ calorieGoalMode: 'adaptive', goals: {} }, date)).toBe(true)
    expect(goalSetOf({ calorieGoalMode: 'dynamic' }, date)).toBe(true)
  })
})

const units = {
  energyUnit: 'kcal',
  energy: v => `${v} kcal`,
  energyValue: v => String(v),
}
const day = over => ({
  totals: { calories: 500, proteins: 40, carbohydrates: 10, fat: 90 },
  target: { target: 2000 },
  left: 1500,
  macros: { proteins: 150, carbohydrates: null, fat: 70 },
  activitySum: null,
  ...over,
})

describe('todayProfile', () => {
  it('is both with food and training, food alone, or training alone', () => {
    expect(todayProfile(true)).toBe('both')
    expect(todayProfile(true, false)).toBe('food')
    expect(todayProfile(false)).toBe('training')
  })
})

describe('foodRings', () => {
  it('energy first, burned before eaten on its pill only when there is some', () => {
    expect(foodRings(day(), units)[0]).toMatchObject({ top: 'Left today', big: '1500', unit: 'of 2000 kcal', pill: '500 eaten', over: 0 })
    expect(foodRings(day({ activitySum: { effective: 320 } }), units)[0].pill).toBe('320 burned · 500 eaten')
  })

  it('a macro without a target shows what was eaten, an empty ring; one past it is over in amber', () => {
    const [, protein, carbs, fat] = foodRings(day(), units)
    expect(protein).toMatchObject({ name: 'Protein', top: 'Protein left', big: '110', unit: 'g of 150 g', over: 0 })
    expect(carbs).toMatchObject({ top: 'Carbs', big: '10', unit: 'g', value: 0, max: 1 })
    expect(fat).toMatchObject({ top: 'Over today', big: '20', unit: 'g over 70 g', value: 90, max: 70 })
    expect(fat.over).toBeCloseTo(20 / 70)
  })

  it('T1.9/T1.10: nothing eaten says so on every pill, after what was burned', () => {
    const empty = day({ totals: { calories: 0, proteins: 0, carbohydrates: 0, fat: 0 }, left: 2000 })
    expect(foodRings(empty, units).map(r => r.pill)).toEqual(['Nothing eaten yet', 'Nothing yet', 'Nothing yet', 'Nothing yet'])
    expect(foodRings({ ...empty, activitySum: { effective: 320 } }, units)[0].pill).toBe('320 burned · Nothing eaten yet')
  })

  it('T1.15: over the energy target, the ring reads how far over and arcs past its end', () => {
    const energy = foodRings(day({ totals: { calories: 2280 }, target: { target: 2100 }, left: -180 }), units)[0]
    expect(energy).toMatchObject({ top: 'Over today', big: '180', unit: 'kcal over 2100', pill: '2280 eaten' })
    expect(energy.over).toBeCloseTo(180 / 2100)
  })
})

const plusDay = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() + n); return d }
const nav = vi.fn()

describe('upNextOf, the variants', () => {
  const routines = [{ id: 'push', name: 'Push A', ex: [{}, {}] }, { id: 'legs', name: 'Legs', ex: [{}] }]
  const set = done => ({ done })

  it('T1.11: a running session resumes, with its clock and the exercises done', () => {
    const active = { name: 'Push A', start: Date.now() - 60_000, entries: [{ sets: [set(true), set(true)] }, { sets: [set(true), set(false)] }, { sets: [] }] }
    const row = upNextOf({ ...DEF, routines, active }, todayISO(), { nav })
    expect(row).toMatchObject({ eyebrow: 'Workout running', title: 'Push A', sub: '1 of 3 exercises done', trailing: 'resume' })
    expect(exercisesDone({ entries: [] })).toBeNull()
  })

  it('T1.12: done today shows how long, the sets and the new bests', () => {
    const w = { start: 0, end: 52 * 60_000, prs: ['a', 'b'], entries: [{ sets: Array.from({ length: 18 }, () => set(true)) }] }
    expect(doneLine(w)).toBe('52 min · 18 sets · 2 new bests')
    expect(doneLine({ entries: [] })).toBeNull()
  })

  it('T1.13: a rest day names the next session, "tomorrow" when it is', () => {
    const today = todayISO()
    const S = { ...DEF, routines, week: { [plusDay(1).getDay()]: ['legs'] } }
    expect(upNextOf(S, today, { nav })).toMatchObject({ eyebrow: 'Rest day', title: 'Recover', sub: 'Next: Legs, tomorrow', trailing: 'chev' })
    const later = { ...DEF, routines, week: { [plusDay(3).getDay()]: ['legs'] } }
    expect(upNextOf(later, today, { nav }).sub).toMatch(/^Next: Legs, [A-Z][a-z]+day$/)
  })

  it('an ad-hoc session on an unplanned day is no Done card: Up next still names the next session', () => {
    const today = todayISO()
    const adhoc = { id: 'x', d: today, start: Date.now() - 300_000, end: Date.now(), name: 'Test', routineIds: [], entries: [{ sets: [set(true)] }] }
    const S = { ...DEF, routines, week: { [plusDay(1).getDay()]: ['legs'] }, workouts: [adhoc] }
    expect(upNextOf(S, today, { nav })).toMatchObject({ eyebrow: 'Rest day', title: 'Recover', sub: 'Next: Legs, tomorrow' })
  })

  it('T1.12: done only when today\'s planned routine was logged', () => {
    const today = todayISO()
    const w = { id: 'x', d: today, start: Date.now() - 300_000, end: Date.now(), name: 'Legs', routineIds: ['legs'], entries: [{ sets: [set(true)] }] }
    const S = { ...DEF, routines, week: { [new Date().getDay()]: ['legs'] }, workouts: [w] }
    expect(upNextOf(S, today, { nav })).toMatchObject({ eyebrow: 'Done today', title: 'Legs', trailing: 'check' })
  })
})

describe('the last log and the welcome back (T1.10)', () => {
  const S = { ...DEF, workouts: [{ d: '2026-10-01' }, { d: '2026-10-05' }], bodyweight: [{ d: '2026-10-03', w: 80 }] }

  it('is the newest workout, weigh-in or food day; unknown while the diary is', () => {
    expect(lastLogOf(S, null)).toBe('2026-10-05')
    expect(lastLogOf(S, '2026-10-09')).toBe('2026-10-09')
    expect(lastLogOf(S, undefined)).toBeUndefined()
    expect(lastLogOf(DEF, null)).toBeNull()
  })

  it(`welcomes back after ${AWAY_DAYS} days or more without one`, () => {
    expect(awayDays('2026-10-05', '2026-10-11')).toBe(0)
    expect(awayDays('2026-10-05', '2026-10-12')).toBe(7)
    expect(awayDays('2026-10-05', '2026-10-13')).toBe(8)
    expect(awayDays(null, '2026-10-13')).toBe(0)
  })
})

describe('firstStepsOf (T1.9)', () => {
  const onMeal = vi.fn()
  const onWeigh = vi.fn()

  it('the goal done in onboarding, then the first meal, the plan and a weigh-in: 1 of 4', () => {
    const { steps, label } = firstStepsOf({ food: true, goalSet: true, nav, onMeal, onWeigh })
    expect(label).toBe('1 of 4')
    expect(steps.map(s => [s.title, s.sub, !!s.done])).toEqual([
      ['Set your goal', 'Done in onboarding', true],
      ['Log your first meal', 'Takes about 20 seconds', false],
      ['Plan your training week', 'Pick your days in Plan', false],
      ['Weigh in', 'Starts your trend', false],
    ])
    steps[1].onClick()
    steps[2].onClick()
    expect(onMeal).toHaveBeenCalled()
    expect(nav).toHaveBeenCalledWith('/train/schedule')
  })

  it('without nutrition only the plan and the weigh-in; a goal not set opens Food goals', () => {
    expect(firstStepsOf({ food: false, nav, onMeal, onWeigh }).steps.map(s => s.title)).toEqual(['Plan your training week', 'Weigh in'])
    const { steps, label } = firstStepsOf({ food: true, goalSet: false, nav, onMeal, onWeigh })
    expect(label).toBe('0 of 4')
    steps[0].onClick()
    expect(nav).toHaveBeenCalledWith('/me/goal?targets=1')
  })
})

describe('mealsOf', () => {
  it('logged meals carry their energy, the meal of the hour is to add now, the rest are empty', () => {
    const entry = { items: [{ meal: 0, nutrition: { calories: 300 } }] }
    const tiles = mealsOf({ dayReady: true, entry, settings: null }, 2, units)
    expect(tiles.map(m => [m.name, m.state, m.sub, m.icon])).toEqual([
      ['Breakfast', 'done', '300 kcal', 'sunrise'],
      ['Lunch', 'empty', 'Nothing yet', 'sun'],
      ['Dinner', 'now', 'Add now', 'moon'],
      ['Snacks', 'empty', 'Nothing yet', 'apple'],
    ])
  })
})

describe('glassOf', () => {
  it('the first container, or a bigger one where the first would draw more than twelve glasses', () => {
    const settings = { waterContainers: [{ id: 'a', name: 'Glass', volumeMl: 250 }, { id: 'b', name: 'Bottle', volumeMl: 500 }] }
    expect(glassOf(null, 2500).ml).toBe(250)
    expect(glassOf(settings, 2500).ml).toBe(250)
    expect(glassOf(settings, 4000).ml).toBe(500)
    expect(glassOf(settings, 9000).ml).toBe(500)
  })
})
