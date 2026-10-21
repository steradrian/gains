// What the search's local sources read for the gallery's search states (shared-search.jsx), in
// memory: the shape use-search-data.js hands the panel. Alex trains Push A and Legs, logged a
// Chicken rice bowl four times this week, last weighed in a week ago and keeps Fasting off.
import { DEF } from '../../../store/useStore.js'
import { CATALOGUE, allExercises, exOr } from '../../../lib/exercises.js'
import { exerciseNameText, isoOf, todayISO } from '../../../lib/format.js'

const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return isoOf(d) }
const BENCH = CATALOGUE.find(e => e.n === 'barbell bench press') || CATALOGUE[0]
const LEG_PRESS = CATALOGUE.find(e => /leg press/.test(e.n)) || CATALOGUE[1]
const set = (w, r) => ({ w, r, done: true })
const workout = (id, ago, name, ex, sets, prs = []) => {
  const d = daysAgo(ago)
  return { id, d, start: Date.parse(d + 'T18:00:00'), end: Date.parse(d + 'T18:52:00'), name, entries: [{ id: ex.id, sets }], prs }
}

export const DAY_AGO = daysAgo(9)
export const FOOD_ID = 11
export const BENCH_ID = BENCH.id

function build() {
  const today = todayISO()
  const S = {
    ...structuredClone(DEF),
    routines: [{ id: 'r1', name: 'Push A', ex: [{ id: BENCH.id }] }, { id: 'r2', name: 'Legs', ex: [{ id: LEG_PRESS.id }] }],
    workouts: [
      workout('w1', 2, 'Push A', BENCH, [set(80, 6), set(80, 5)], [BENCH.id]),
      workout('w2', 5, 'Legs', LEG_PRESS, [set(160, 10)]),
      workout('w3', 9, 'Push A', BENCH, [set(77.5, 7)]),
      workout('w4', 40, 'Push A', BENCH, [set(75, 8)]),
    ],
    bodyweight: [{ d: daysAgo(7), w: 80 }],
  }
  const lunch = n => Array.from({ length: n }, (_, i) => ({ uuid: 'l' + i, name: 'Chicken rice bowl', meal: 1, kcal: 640, food_id: 12 }))
  return {
    S,
    exercises: allExercises(S),
    nameOf: id => { const ex = exOr(id); return ex.missing ? '' : exerciseNameText(ex) },
    nutrition: true,
    ntSettings: null,
    today,
    weekStart: 1,
    foods: [
      { id: FOOD_ID, name: 'Greek yogurt 2%', portion: 170, unit: 'g', nutrition: { calories: 120 }, usage_count: 6 },
      { id: 12, name: 'Chicken rice bowl', portion: 1, unit: 'bowl', nutrition: { calories: 640 }, usage_count: 9 },
      { id: 13, name: 'Protein bar', portion: 60, unit: 'g', nutrition: { calories: 210 } },
      { id: 14, name: 'Fasting tea, mint', portion: 250, unit: 'ml', nutrition: { calories: 2 } },
    ],
    meals: [{ id: 21, name: 'Usual breakfast', is_recipe: false, items: [{ name: 'Oats' }, { name: 'Greek yogurt 2%' }], nutrition: { calories: 485 }, usage_count: 12 }],
    recipes: [],
    foodsReady: true,
    mealsReady: true,
    days: [
      { date: today, rev: 'a', kcal: 2560, items: lunch(4) },
      { date: DAY_AGO, rev: 'b', kcal: 2075, items: [{ uuid: 'd1', name: 'Greek yogurt 2%', meal: 0, kcal: 120, food_id: FOOD_ID }] },
    ],
    daysReady: true,
    index: { complete: true, synced: true, status: 'ready', offline: false, version: 1 },
    mealNames: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
    pagesCtx: { nutrition: true, checkIn: true, coach: false, fastingOn: false },
    settingsCtx: { user: { id: 1 }, mobile: false, nutrition: true, ntSettings: null, lang: 'en' },
  }
}

let data = null
/** The fixture, built once: the panel's lists are worked out from it by reference. */
export const searchData = () => (data ||= build())
