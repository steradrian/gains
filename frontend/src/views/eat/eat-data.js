// The Eat root's data (PR-04 E1.0), pure: the calendar rail's weeks and the week hero's numbers,
// from the same per-day food the Week page uses (week-data.js dayFoodOf, so a day is judged
// against its own goal by food-target.js). useEat (use-eat.js) feeds it the store and the clock.
// Nothing here invents a number: a day with no goal behind it counts for nothing, and today is
// still being logged, so it stays out of the averages and the on-target count.
import { dateLocale, t, tn } from '../../lib/i18n.js'
import { isoOf, startOfWeek, weekKey } from '../../lib/format.js'
import { plusDays } from '../../lib/missed-day.js'
import { dayFoodOf, rangeOf } from '../shared/week-data.js'

/** The most weeks the rail pages back, whatever the first log. */
export const RAIL_WEEKS_MAX = 52

const dateOf = iso => new Date(iso + 'T12:00:00')
const round = v => Math.round(Number(v) || 0)
const avg = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null)
const daysOf = start => Array.from({ length: 7 }, (_, k) => plusDays(start, k))

/** Weeks from the one holding `first` (or this one) to this one, oldest first, as week starts. */
export function railStarts({ today, ws, first }) {
  const thisStart = weekKey(today, ws)
  const firstStart = first && first < today ? isoOf(startOfWeek(first, ws)) : thisStart
  const starts = []
  for (let s = thisStart; s >= firstStart && starts.length < RAIL_WEEKS_MAX; s = plusDays(s, -7)) starts.unshift(s)
  return starts
}

/** What a rail cell says to a screen reader: the day, and its share of the target when it has one. */
function labelOf(iso, pct) {
  const day = dateOf(iso).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
  return pct == null ? day : t('{0}, {1}% of target', day, pct)
}

/**
 * One rail week: `{ start, title, days }`. A day is `{ iso, dow, date, state, label, disabled, ring }`:
 * `ring.value` its energy over its goal (0 to 1, 0 when it has no goal or nothing logged),
 * `ring.over` when it ran past the goal (amber on the rail), `disabled` for a day to come (never
 * logged ahead). `food` is week-data.js dayFoodOf's input.
 */
export function railWeekOf({ start, today, ws, food }) {
  const days = daysOf(start).map(iso => {
    const f = iso > today ? null : dayFoodOf(food, iso)
    const judged = f?.logged && f.target != null && f.target > 0
    const share = judged ? f.kcal / f.target : 0
    return {
      iso,
      dow: dateOf(iso).toLocaleDateString(dateLocale(), { weekday: 'narrow' }),
      date: dateOf(iso).getDate(),
      state: iso === today ? 'today' : 'plain',
      label: labelOf(iso, judged ? Math.round(share * 100) : null),
      disabled: iso > today,
      ring: { value: Math.min(share, 1), over: !!judged && f.band === 'over' },
    }
  })
  return { start, title: start === weekKey(today, ws) ? t('This week · {0}', rangeOf(start)) : rangeOf(start), days }
}

/**
 * The hero's RingCarousel slides from heroOf's numbers (`units` is useUnits'): the days on target
 * (or, with no goal behind any day, the days logged), then the daily average and the protein
 * average, each only when the week backs it. A figure is judged against its target when it has
 * one; past it the ring turns amber.
 */
export function heroSlides(hero, units) {
  const n = hero.logged
  const days = tn('{0} day logged', '{0} days logged', n)
  const slides = [hero.onTarget
    ? {
      name: t('Days on target'), top: t('This week'), big: t('{0} of {1}', hero.onTarget.days, hero.onTarget.of), unit: t('days on target'),
      value: hero.onTarget.days, max: hero.onTarget.of, pill: hero.range, icon: 'calendar',
    }
    : {
      name: t('Days logged'), top: t('This week'), big: String(n), unit: n === 1 ? t('day logged') : t('days logged'),
      value: n, max: 7, pill: hero.range, icon: 'calendar',
    }]
  const over = (avg, target) => (target > 0 && avg > target ? Math.min((avg - target) / target, 1) : 0)
  if (hero.kcal) {
    const { avg, target } = hero.kcal
    slides.push({
      name: t('Calories'), top: t('Daily average'), big: units.energyValue(avg),
      unit: target != null ? t('{0} of {1}', units.energyUnit, units.energyValue(target)) : units.energyUnit,
      value: avg, max: target ?? 0, over: over(avg, target), pill: days,
    })
  }
  if (hero.protein) {
    const { avg, target } = hero.protein
    slides.push({
      name: t('Protein'), top: t('Protein average'), big: String(avg),
      unit: target != null ? t('g of {0} g', target) : 'g',
      value: avg, max: target ?? 0, over: over(avg, target), pill: days,
    })
  }
  return slides
}

/**
 * The week hero for the week starting `start`: the days counted (every day before today in the
 * week that was logged), and
 *   onTarget  { days, of }       logged days that had a goal, and how many were within range of it
 *   kcal      { avg, target }    the daily average; `target` only when every counted day had a goal
 *   protein   { avg, target }    likewise for protein
 *   logged    how many days were logged
 *   range     "Mon 12 to Sat 17 Oct", the first and last day counted, null with none
 * Each is null when the week cannot back it.
 */
export function heroOf({ start, today, food }) {
  const closed = daysOf(start).filter(iso => iso < today)
  return heroFrom(closed.map(iso => ({ iso, f: dayFoodOf(food, iso) })))
}

/** heroOf from days already read: `days` is [{ iso, f }], `f` week-data.js dayFoodOf's answer (or
 *  null), the days before today in date order. */
export function heroFrom(days) {
  const eaten = days.filter(x => x.f?.logged)
  const foods = eaten.map(x => x.f)
  const judged = foods.filter(f => f.target != null)
  const proteinTargets = foods.map(f => f.proteinTarget)
  const say = (iso, opts) => dateOf(iso).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', ...opts })
  return {
    logged: foods.length,
    range: eaten.length ? t('{0} to {1}', say(eaten[0].iso), say(eaten.at(-1).iso, { month: 'short' })) : null,
    onTarget: judged.length ? { days: judged.filter(f => f.band === 'on').length, of: judged.length } : null,
    kcal: foods.length ? {
      avg: round(avg(foods.map(f => f.kcal))),
      target: judged.length === foods.length ? round(avg(judged.map(f => f.target))) : null,
    } : null,
    protein: foods.length ? {
      avg: round(avg(foods.map(f => f.protein))),
      target: proteinTargets.every(g => g != null) ? round(avg(proteinTargets)) : null,
    } : null,
  }
}
