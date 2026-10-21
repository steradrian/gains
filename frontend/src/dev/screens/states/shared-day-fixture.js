// What useDay() would hand DayScreen on the boards' days (Sh1Day to Sh1Skipped), shared by the Day
// states (shared-day.jsx) and DayScreen's test: today is Sun 18 Oct 2026; Push A was logged on Mon
// 12 Oct, Tue 13 Oct was a rest day with food and a weigh-in, Thu 15 Oct has nothing, Legs was
// missed on Fri 16 Oct. In memory only. `fn` makes each tap (the test passes vi.fn).
import { isoOf } from '../../../lib/format.js'
import { pictureOf } from '../../../views/train/use-train.js'

const pic = id => pictureOf({}, id)
const plusDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d) }
const TODAY = '2026-10-18'

// The marks of the three weeks the boards draw: done, rest, missed, today.
const MARKS = {
  '2026-09-28': 'done', '2026-09-30': 'done', '2026-10-01': 'done', '2026-10-02': 'missed', '2026-10-04': 'done',
  '2026-10-05': 'done', '2026-10-07': 'missed', '2026-10-08': 'done', '2026-10-09': 'done', '2026-10-11': 'done',
  '2026-10-12': 'done', '2026-10-14': 'done', '2026-10-16': 'missed', '2026-10-18': 'today',
}
const WEEKS = [['2026-09-28', '2026-W40', 'Week of 28 Sept'], ['2026-10-05', '2026-W41', 'Week of 5 Oct'], ['2026-10-12', '2026-W42', 'Week of 12 Oct']]

/** The rail on `iso`: the week of 12 Oct and the two before it; days before `first` are dimmed. */
export function railOf(iso, first = '2026-09-28') {
  return {
    index: 2, week: '2026-W42',
    weeks: WEEKS.map(([start, isoWeek, title]) => ({
      isoWeek, start, title,
      days: Array.from({ length: 7 }, (_, k) => {
        const day = plusDays(start, k)
        const d = new Date(day + 'T12:00:00')
        const state = day < first ? 'plain' : MARKS[day] || 'rest'
        return {
          iso: day, dow: d.toLocaleDateString('en-GB', { weekday: 'narrow' }), date: d.getDate(), state,
          label: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
          selected: day === iso, today: day === TODAY, future: day > TODAY, disabled: state === 'plain',
        }
      }),
    })),
  }
}

const PUSH_EXERCISES = [
  ['0025', 'Bench press', ['80×6', '80×6', '75×8'], true], ['0426', 'Seated shoulder press', ['22×10', '22×10', '22×9']],
  ['0314', 'Incline bench press', ['28×10', '28×10', '28×9']], ['0334', 'Lateral raise', ['10×14', '10×12', '10×12']],
  ['0201', 'Pushdown', ['30×12', '30×12', '30×10']], ['0662', 'Push-up', ['22', '18'], true],
]
export const PUSH = {
  id: 'w1', workout: { id: 'w1' }, name: 'Push A', line: '52 min · 18 sets · 7,900 kg · 2 new bests', start: '18:30',
  durationMs: 52 * 60000, sets: 18, volume: 7900, unit: 'kg', bests: 2, muscles: 'Chest, shoulders, triceps', load: {},
  levels: { chest: 4, deltoids: 3, triceps: 3 },
  exercises: PUSH_EXERCISES.map(([id, name, sets, best = false]) => ({ id, name, image: pic(id), sets, best })),
}
const LEGS_STILLS = ['0043', '0085', '0739', '0585', '0586'].map(pic)

const meal = (slot, name, items) => ({
  slot, name, kcal: items.reduce((n, [, kcal]) => n + kcal, 0),
  items: items.map(([item, kcal], i) => ({ uuid: `${slot}-${i}`, name: item, kcal })),
})
const food = (meals, macros) => {
  const kcal = meals.reduce((n, m) => n + m.kcal, 0)
  const diff = kcal - 2100
  return {
    tracking: 'on', status: 'ready', kcal, target: 2100, diff, band: Math.abs(diff) <= 150 ? 'on' : diff > 0 ? 'over' : 'under', logged: true,
    macros: [['proteins', macros[0], 150], ['carbohydrates', macros[1], 230], ['fat', macros[2], 70]].map(([id, value, target]) => ({ id, value, target })),
    meals,
  }
}
export const FOOD_ON_TARGET = food([
  meal(0, 'Breakfast', [['Oats with milk', 380], ['Banana', 105]]), meal(1, 'Lunch', [['Chicken rice bowl', 540]]),
  meal(2, 'Dinner', [['Salmon', 480], ['Baked potatoes', 240]]), meal(3, 'Snacks', [['Greek yogurt 2%', 140], ['Protein bar', 190]]),
], [132, 214, 66])
export const FOOD_UNDER = food([
  meal(0, 'Breakfast', [['Usual breakfast', 485]]), meal(1, 'Lunch', [['Chicken rice bowl', 540]]),
  meal(2, 'Dinner', [['Pasta bolognese', 690]]), meal(3, 'Snacks', [['Apple', 95]]),
], [118, 220, 52])
export const FOOD_MISSED = food([
  meal(0, 'Breakfast', [['Oats with milk', 380]]), meal(1, 'Lunch', [['Chicken rice bowl', 540]]),
  meal(2, 'Dinner', [['Pizza margherita', 680]]), meal(3, 'Snacks', []),
], [96, 198, 58])
const MEASUREMENTS = { date: '2026-10-04', items: [{ key: 'waist', label: 'Waist', value: 84, unit: 'cm' }] }

/** A whole day as useDay() returns it: Mon 12 Oct (D1.0) unless `over` says otherwise. */
export function dayFixture(over = {}, fn = () => () => {}) {
  const iso = over.iso || '2026-10-12'
  return {
    iso, title: 'Mon 12 Oct', ago: '6 days ago', state: 'logged', summary: 'Push A done · on target · 6 days ago',
    rail: railOf(iso), workouts: [PUSH], planned: null, next: null, food: FOOD_ON_TARGET,
    water: { ml: 2250, goalMl: 2500, glasses: 9, glassMl: 250, last: '21:10' }, weighIn: null, measurements: MEASUREMENTS, activities: [],
    select: fn(), openWeek: fn(), openWorkout: fn(), openExercise: fn(), markSkipped: fn(), addPastWorkout: fn(), add: fn(),
    logFood: fn(), addWater: fn(), weighInSheet: fn(), openMeasurements: fn(),
    ...over,
  }
}

const LEGS = { ids: ['legs'], name: 'Legs', routines: [{ id: 'legs', name: 'Legs', sub: '5 exercises', images: LEGS_STILLS }] }
const WATER_6 = { ml: 1500, goalMl: 2500, glasses: 6, glassMl: 250, last: null }

/** The boards' other days, each as `over` for dayFixture. */
export const DAYS = {
  rest: {
    iso: '2026-10-13', title: 'Tue 13 Oct', ago: '5 days ago', state: 'rest', summary: 'Rest day · 1,810 kcal · 5 days ago',
    workouts: [], next: { name: 'Pull A', iso: '2026-10-14', date: 'Wed 14 Oct' }, food: FOOD_UNDER,
    water: { ml: 1750, goalMl: 2500, glasses: 7, glassMl: 250, last: null }, weighIn: { w: 81.7, unit: 'kg' }, measurements: null,
  },
  missed: {
    iso: '2026-10-16', title: 'Fri 16 Oct', ago: '2 days ago', state: 'missed', summary: 'Legs missed · 1,600 kcal · 2 days ago',
    workouts: [], planned: LEGS, food: FOOD_MISSED, water: WATER_6, measurements: null,
  },
  skipped: {
    iso: '2026-10-16', title: 'Fri 16 Oct', ago: '2 days ago', state: 'skipped', summary: 'Legs skipped · 1,600 kcal · 2 days ago',
    workouts: [], planned: LEGS, food: FOOD_MISSED, water: WATER_6, measurements: null,
  },
  empty: {
    iso: '2026-10-15', title: 'Thu 15 Oct', ago: '3 days ago', state: 'empty', summary: 'Rest day in your Plan · 3 days ago',
    workouts: [], food: { ...FOOD_MISSED, kcal: 0, diff: -2100, band: 'under', logged: false, meals: FOOD_MISSED.meals.map(m => ({ ...m, kcal: 0, items: [] })) },
    water: null, measurements: null,
  },
  off: {
    summary: 'Push A done · 6 days ago', food: { tracking: 'off' }, water: null, addWater: null,
  },
}
