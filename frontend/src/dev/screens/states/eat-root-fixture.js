// What useEat() would hand EatScreen for the board's day, Sunday 18 October 2026, shared by the
// Eat root states (eat-root.jsx): Mon 12 to Sat 17 eaten against 2,100 kcal and 150 g protein,
// Sunday still being logged. The rail and the hero come out of the real eat-data.js functions,
// given the per-day numbers below, so the gallery shows what the screen really computes.
import { heroFrom, heroSlides } from '../../../views/eat/eat-data.js'

export const NOOP = () => {}
export const TODAY = '2026-10-18'
export const THIS_WEEK = '2026-10-12'

const dateOf = iso => new Date(iso + 'T12:00:00')
const plusDays = (iso, n) => { const d = dateOf(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const say = (iso, opts) => dateOf(iso).toLocaleDateString('en-GB', opts)

// A day's food as week-data.js dayFoodOf returns it: kcal against 2,100, protein against 150.
const dayFood = (share, protein = 128) => ({
  logged: share > 0, kcal: Math.round(2100 * share), target: 2100,
  band: Math.abs(2100 * share - 2100) <= 150 ? 'on' : share > 1 ? 'over' : 'under', protein, proteinTarget: 150,
})
// Shares of the target by day, Monday first; null is a day with nothing logged. Per week start.
const SHARES = {
  '2026-09-28': [0.97, 1.0, 0.92, null, 1.0, 1.04, 0.96],
  '2026-10-05': [0.99, 1.02, 0.95, 1.0, 0.9, 1.12, 0.98],
  '2026-10-12': [0.96, 1.08, 0.91, 0.99, 1.0, 0.94, null],
}

const railDay = (iso, share, today) => {
  const f = iso < today && share ? dayFood(share) : null
  const pct = f ? Math.round(share * 100) : null
  const day = say(iso, { weekday: 'short', day: 'numeric', month: 'short' })
  return {
    iso, dow: say(iso, { weekday: 'narrow' }), date: dateOf(iso).getDate(), state: iso === today ? 'today' : 'plain',
    label: pct == null ? day : `${day}, ${pct}% of target`, disabled: iso > today,
    ring: { value: f ? Math.min(share, 1) : 0, over: !!f && f.band === 'over' },
  }
}
const railWeek = (start, shares, today, title) => ({ start, title, days: shares.map((s, i) => railDay(plusDays(start, i), s, today)) })

/** The rail: three weeks, this one last. `shares` overrides this week's days. */
export const rail = (thisShares = SHARES[THIS_WEEK]) => ({
  weeks: [
    railWeek('2026-09-28', SHARES['2026-09-28'], TODAY, '28 Sep to 4 Oct'),
    railWeek('2026-10-05', SHARES['2026-10-05'], TODAY, '5 to 11 Oct'),
    railWeek(THIS_WEEK, thisShares, TODAY, 'This week · 12 to 18 Oct'),
  ],
  week: 2, home: 2, onWeek: NOOP, onDay: NOOP, onMonth: NOOP,
})

const UNITS = { energyUnit: 'kcal', energyValue: v => v.toLocaleString('en') }
/** The hero's slides from the same arithmetic as the screen, for the shares of this week's days. */
export function hero(thisShares = SHARES[THIS_WEEK]) {
  const days = thisShares.map((share, i) => {
    const iso = plusDays(THIS_WEEK, i)
    return { iso, f: share && iso < TODAY ? dayFood(share) : null }
  })
  return { slides: heroSlides(heroFrom(days), UNITS), onOpen: NOOP }
}

export const HEADER = { initial: 'Ana', placeholder: 'Search food', unread: 0, onSettings: NOOP, onBell: NOOP, onSearch: NOOP }

export const ACTIONS = [
  { icon: 'utensils', label: 'Log food', onClick: NOOP },
  { icon: 'scanBarcode', label: 'Scan', onClick: NOOP },
  { icon: 'bookOpen', label: 'Saved meals', onClick: NOOP },
  { icon: 'droplet', label: '+250 ml', onClick: NOOP },
]

export const AGAIN = {
  title: 'Yesterday’s lunch', sub: 'Chicken rice bowl · 540 kcal', done: false, disabled: false, onLog: NOOP, logLabel: 'Log yesterday’s lunch again',
}

export const LIBRARY = [
  { key: 'foods', icon: 'apple', title: 'Foods', sub: '42 foods · 3 favourites', onClick: NOOP },
  { key: 'meals', icon: 'bookOpen', title: 'Saved meals', sub: '4 meals, logged in one tap', onClick: NOOP },
  { key: 'recipes', icon: 'cookingPot', title: 'Recipes', sub: '3 recipes, per serving', onClick: NOOP },
  { key: 'trends', icon: 'chartLine', title: 'Trends', sub: '4 of 6 days on target', onClick: NOOP },
  { key: 'fasting', icon: 'timer', title: 'Fasting', sub: '16:8', onClick: NOOP },
  { key: 'burned', icon: 'flame', title: 'Burned', sub: '730 kcal this week', onClick: NOOP },
  { key: 'goals', icon: 'target', title: 'Daily targets', sub: '2,100 kcal · 150 g protein', onClick: NOOP },
  { key: 'settings', icon: 'slider', title: 'Food settings', sub: 'Meals, water, units, sources', onClick: NOOP },
]

export const base = {
  header: HEADER, status: 'ready', rail: rail(), hero: hero(), actions: ACTIONS, again: AGAIN, library: LIBRARY, setup: { onSetup: NOOP },
}

/** A week with 2 logged days (Mon, Tue), nothing else: the hero says what little it has. */
export const FEW = [0.96, 1.08, null, null, null, null, null]
/** A week with three days past the target (amber on the rail). */
export const OVER = [1.1, 1.14, 0.97, 1.09, 1.0, 0.92, null]
