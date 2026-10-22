// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { DEF } from '../../store/useStore.js'
import { CATALOGUE } from '../exercises.js'
import { GROUP_ORDER, bestMatch, listAll, scopedSections, scopedSummary, searchLocal, stageSub, summaryOf } from './results.js'
import { PAGE_INDEX } from './pages.js'
import { beforeTypingOf, shortcutsFor, suggestionsFor } from './start.js'
import { placeholderFor, searchTab } from './scopes.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const today = '2026-10-15'
const readApp = () => readFileSync(join(process.cwd(), 'src', 'App.jsx'), 'utf8')
const bench = CATALOGUE.find(e => e.n === 'barbell bench press')
const workout = (id, d, name, exId = bench.id) => ({ id, d, start: Date.parse(d + 'T18:00:00'), end: Date.parse(d + 'T18:52:00'), name, entries: [{ id: exId, sets: [{ w: 80, r: 5, done: true }, { w: 80, r: 5, done: true }] }], prs: [] })

function data(over = {}) {
  const S = { ...structuredClone(DEF), routines: [{ id: 'r1', name: 'Push day', ex: [{ id: bench.id }] }], workouts: [workout('w1', '2026-10-13', 'Push day'), workout('w2', '2026-10-01', 'Legs')], ...over.S }
  return {
    S, exercises: CATALOGUE, nameOf: id => (id === bench.id ? 'Barbell bench press' : ''), nutrition: true, ntSettings: null, today, weekStart: 1,
    foods: [{ id: 11, name: 'Rolled oats', brand: 'Bio', portion: 100, unit: 'g', nutrition: { calories: 380 }, usage_count: 9 }, { id: 12, name: 'Chicken breast', portion: 100, unit: 'g', nutrition: { calories: 165 } }],
    meals: [{ id: 21, name: 'Chicken bowl', is_recipe: false, items: [{ name: 'Rice' }], nutrition: {} }], recipes: [],
    days: [{ date: '2026-10-11', rev: 'x', kcal: 1840, items: [{ uuid: 'u1', name: 'Chicken bowl', meal: 1, kcal: 640, food_id: null }, { uuid: 'u2', name: 'Chicken soup', meal: 2, kcal: 300, food_id: null }] }],
    mealNames: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
    pagesCtx: { nutrition: true, checkIn: true, coach: false, fastingOn: false },
    settingsCtx: { user: { id: 1 }, mobile: false, nutrition: true, ntSettings: null, lang: 'en' },
    ...over,
  }
}

describe('the local search', () => {
  it('orders its groups by the real tab it was opened from, a feature card first, Online always last', () => {
    expect(Object.keys(GROUP_ORDER)).toEqual(['home', 'train', 'food', 'me'])
    for (const tab of Object.keys(GROUP_ORDER)) {
      expect(GROUP_ORDER[tab][0]).toBe('features')
      expect(GROUP_ORDER[tab].at(-1)).toBe('online')
    }
    expect(GROUP_ORDER.train.slice(1, 4)).toEqual(['exercises', 'routines', 'workouts'])
    expect(GROUP_ORDER.food.slice(1, 3)).toEqual(['foods', 'days'])
    expect(searchLocal('push', data(), 'me').order.slice(1, 3)).toEqual(['pages', 'settings'])
  })

  it('keys Me by its own name: Progress\'s pages and Profile are Me\'s, and an old `progress` key reads as Me', () => {
    expect(searchTab('progress')).toBe('me')
    expect(searchTab('nowhere')).toBe('home')
    expect(PAGE_INDEX.filter(p => p.path.startsWith('/progress')).every(p => p.tab === 'me')).toBe(true)
    expect(PAGE_INDEX.some(p => p.tab === 'progress')).toBe(false)
    const found = q => { const l = searchLocal(q, data(), 'me'); return [...l.groups.pages, l.best?.result].filter(Boolean) }
    expect(found('profile').find(r => r.path === '/me')).toMatchObject({ tab: 'me', subtitle: 'Me' })
    expect(found('strength').find(r => r.path === '/progress/strength')).toMatchObject({ tab: 'me', subtitle: 'Me › Strength' })
  })

  it('says each tab\'s placeholder', () => {
    expect(['home', 'train', 'food', 'me'].map(placeholderFor)).toEqual(['Search Gains', 'Search training', 'Search food', 'Search Gains'])
  })

  it('finds settings with a typo, and shows their current value', () => {
    const { groups } = searchLocal('thme', data())
    const theme = groups.settings.find(r => r.title === 'Theme')
    expect(theme).toMatchObject({ subtitle: 'Profile › Appearance', value: 'Dark' })
  })

  it('offers a switched-off feature as one Turn on card, not as its page, and hides one that cannot be had', () => {
    const { groups, best } = searchLocal('fast', data())
    expect(groups.features).toEqual([expect.objectContaining({
      type: 'feature', id: 'fasting', key: 'feature:fasting', title: 'Fasting', off: { page: 'features', find: 'Fasting' }, pageTitle: 'Features',
      line: 'A timer for your fasts with a goal and history. It is off in Features, so Eat doesn’t show it.',
    })])
    expect(groups.features[0].ranges.length).toBeGreaterThan(0)
    expect(groups.pages.find(r => r.path === '/food/fasting')).toBeUndefined()
    expect(best?.group).not.toBe('features')
    expect(searchLocal('check in', data({ pagesCtx: { nutrition: true, checkIn: false } })).groups.features.map(r => r.id)).toEqual(['checkIn'])
    // On: no card, the page is a page again.
    const on = searchLocal('fasting', data({ pagesCtx: { nutrition: true, checkIn: true, fastingOn: true } }))
    expect(on.groups.features).toEqual([])
    expect([...on.groups.pages, on.best?.result].some(r => r?.path === '/food/fasting')).toBe(true)
    // Nutrition off: Fasting cannot be had at all.
    expect(searchLocal('fasting', data({ pagesCtx: { nutrition: false } })).groups.features).toEqual([])
    expect(searchLocal('coach', data()).groups.pages.find(r => r.path === '/train/coach')).toBeUndefined()
  })

  it('names the workouts an exercise was in, with the exercise in bold', () => {
    const { groups } = searchLocal('barbell bench', data())
    const hit = groups.workouts.find(r => r.id === 'w2')
    expect(hit.subtitle).toBe('Includes Barbell bench press')
    expect(hit.subRanges.length).toBeGreaterThan(0)
  })

  it('reads date words: workouts and days of that date', () => {
    const { groups } = searchLocal('tuesday', data())
    expect(groups.workouts.map(r => r.id)).toEqual(['w1'])
    expect(searchLocal('chicken sunday', data()).groups.days).toMatchObject([{ date: '2026-10-11', title: 'Chicken bowl', uuid: 'u1', value: 1840 }])
  })

  it('finds a day by what was eaten, with the meal and how many more matched', () => {
    const { groups } = searchLocal('chicken', data())
    expect(groups.days[0]).toMatchObject({ type: 'day', subtitle: expect.stringContaining('Lunch'), uuid: 'u1' })
    expect(groups.days[0].subtitle).toContain('+1 more')
    expect(groups.foods.map(r => r.type)).toEqual(expect.arrayContaining(['food', 'meal']))
  })

  it('finds a day the index holds only part of by what it holds, and says it is partial', () => {
    const days = [{ ...data().days[0], truncated: true }]
    const [hit] = searchLocal('chicken', data({ days })).groups.days
    expect(hit).toMatchObject({ uuid: 'u1', partial: true, subtitle: expect.stringContaining('partly indexed') })
    expect(listAll('days', data({ days }))[0].subtitle).toBe('2 items · partly indexed')
    expect(searchLocal('chicken', data()).groups.days[0].partial).toBe(false)
  })

  it('every setting row has its own key and glyph', () => {
    const { groups } = searchLocal('rest', data())
    const keys = groups.settings.map(r => r.key)
    expect(keys.every(k => typeof k === 'string' && k.startsWith('setting:'))).toBe(true)
    expect(new Set(keys).size).toBe(keys.length)
    expect(groups.settings.every(r => r.media?.kind === 'glyph' && r.media.glyph)).toBe(true)
  })

  it('leaves nutrition out when it is off', () => {
    const { groups } = searchLocal('chicken', data({ nutrition: false }))
    expect(groups.foods).toEqual([])
    expect(groups.days).toEqual([])
  })

  it('takes the one clear winner out of its group as Best match, and none on a tie', () => {
    const local = searchLocal('history', data())
    expect(local.best).toMatchObject({ group: 'pages', result: { path: '/train/history' } })
    expect(local.groups.pages.some(r => r.path === '/train/history')).toBe(false)
    expect(bestMatch({ pages: [{ exact: true }, { exact: true }] }, ['pages'])).toBeNull()
  })

  it('counts per kind for the chips, the largest marked, each with its noun', () => {
    const s = summaryOf({ features: [1], pages: [1], exercises: [1, 2, 3] }, ['features', 'pages', 'exercises', 'online'], { exercises: 1 })
    expect(s).toEqual([
      { group: 'features', count: 1, text: '1 turned-off feature', noun: 'turned-off feature', emphasized: false },
      { group: 'pages', count: 1, text: '1 page', noun: 'page', emphasized: false },
      { group: 'exercises', count: 4, text: '4 exercises', noun: 'exercises', emphasized: true },
    ])
  })

  it('writes a count the locale\'s way, Open Food Facts\' too, and the noun in the form the count takes', () => {
    const s = summaryOf({ workouts: Array(1200).fill(0) }, ['workouts', 'online'], { online: 1500 })
    expect(s.map(e => [e.text, e.noun])).toEqual([['1,200 workouts', 'workouts'], ['1,500 online', 'online']])
    expect(scopedSummary('workouts', 1200, 'press')).toBe('1,200 workouts with “press”, newest first')
  })

  it('lists a whole group when scoped with nothing typed', () => {
    expect(listAll('exercises', data()).length).toBe(CATALOGUE.length)
    expect(listAll('workouts', data()).map(r => r.id)).toEqual(['w1', 'w2'])
  })

  it('scoped to workouts: newest first, a section a month, the year only when it is not this one', () => {
    const S = { workouts: [workout('a', '2026-09-28', 'Push A'), workout('b', '2026-10-12', 'Push A'), workout('c', '2025-12-30', 'Legs'), workout('d', '2026-10-01', 'Push A')] }
    const rows = [...listAll('workouts', data({ S }))].reverse()
    const sections = scopedSections('workouts', rows, today)
    expect(sections.map(s => s.key)).toEqual(['2026-10', '2026-09', '2025-12'])
    expect(sections.map(s => s.rows.map(r => r.id))).toEqual([['b', 'd'], ['a'], ['c']])
    expect(sections[0].title).toBe('October')
    expect(sections[2].title).toBe('December 2025')
    expect(scopedSections('exercises', [{ key: 'x' }])).toEqual([{ key: 'exercises', title: null, rows: [{ key: 'x' }] }])
    expect(scopedSections('exercises', [])).toEqual([])
  })

  it('scoped to workouts: one with no date goes last in its own untitled section, never under this month', () => {
    const rows = [
      { key: 'workout:u', id: 'u', workout: { id: 'u', entries: [] } },
      { key: 'workout:b', id: 'b', workout: { id: 'b', d: '2026-10-12', entries: [] } },
      { key: 'workout:x', id: 'x', workout: { id: 'x', d: 'garbage', entries: [] } },
    ]
    const sections = scopedSections('workouts', rows, today)
    expect(sections.map(s => [s.key, s.title, s.rows.map(r => r.id)])).toEqual([['2026-10', 'October', ['b']], ['undated', null, ['u', 'x']]])
  })

  it('says what a scoped group holds', () => {
    expect(scopedSummary('workouts', 6, ' press ')).toBe('6 workouts with “press”, newest first')
    expect(scopedSummary('exercises', 4, 'press')).toBe('4 exercises with “press”')
    expect(scopedSummary('foods', 12, '')).toBe('12 foods')
  })

  it('a row\'s line on the stage says its kind first', () => {
    expect(stageSub({ type: 'exercise', subtitle: 'Chest · Barbell' })).toBe('Exercise · Chest · Barbell')
    expect(stageSub({ type: 'food', subtitle: '170 g' })).toBe('Your food · 170 g')
    expect(stageSub({ type: 'meal', subtitle: 'Saved meal · 3 items' })).toBe('Saved meal · 3 items')
    expect(stageSub({ type: 'routine', subtitle: 'x', sub: 'Routine · planned today' })).toBe('Routine · planned today')
  })
})

describe('before typing', () => {
  const now = new Date(today + 'T12:00:00')
  // Thursday 15 Oct 2026: Push day planned every Thursday, Legs every Tuesday.
  const planned = (over = {}) => ({
    ...structuredClone(DEF),
    routines: [{ id: 'r1', name: 'Push day', ex: [{ id: bench.id }] }, { id: 'r2', name: 'Legs', ex: [{ id: bench.id }] }],
    week: { 4: ['r1'], 2: ['r2'] },
    ...over,
  })

  it('has the board\'s Go to chips per tab, each to a real place, training ones in place of nutrition when it is off', () => {
    const ids = (tab, n = true) => shortcutsFor(tab, n).map(c => c.id)
    expect(ids('home')).toEqual(['history', 'exercises', 'foods', 'body'])
    expect(ids('me')).toEqual(ids('home'))
    expect(ids('train')).toEqual(['routines', 'plan', 'strength', 'workout-settings'])
    expect(ids('food')).toEqual(['meals', 'recipes', 'trends', 'days'])
    expect(ids('home', false)).toEqual(['history', 'exercises', 'routines', 'body'])
    expect(ids('food', false)).toEqual(ids('train'))
    expect(shortcutsFor('train', true).map(c => c.label)).toEqual(['Routines', 'Plan', 'Strength', 'Workout settings'])
    // Days has no page: it scopes the search to the diary's days.
    expect(shortcutsFor('food', true).at(-1).target).toEqual({ kind: 'scope', group: 'days' })
    const src = readApp()
    for (const tab of ['home', 'train', 'food']) {
      for (const c of shortcutsFor(tab, true).filter(x => x.target.kind === 'route')) {
        const path = c.target.path.startsWith('/me/') ? '/me/:page' : c.target.path.split('?')[0]
        expect(src, c.target.path).toContain(`path="${path}"`)
      }
    }
  })

  it('suggests from real data only, at most three, each with its line', () => {
    expect(suggestionsFor('home', data({ S: { routines: [], workouts: [], bodyweight: [], week: {}, dayPlan: {} }, days: [] }), now)).toEqual([])
  })

  it('Today and Me: today\'s planned session, the food logged most this week, the last weigh-in', () => {
    const days = [
      { date: '2026-10-13', items: [{ uuid: 'a', name: 'Rolled oats', meal: 0, food_id: 11 }] },
      { date: '2026-10-14', items: [{ uuid: 'b', name: 'Rolled oats', meal: 0, food_id: 11 }, { uuid: 'c', name: 'Chicken breast', meal: 1, food_id: 12 }] },
      { date: '2026-10-05', items: [{ uuid: 'd', name: 'Chicken breast', meal: 1, food_id: 12 }, { uuid: 'e', name: 'Chicken breast', meal: 1, food_id: 12 }] },
    ]
    const S = planned({ bodyweight: [{ d: '2026-10-08', w: 80 }, { d: '2026-10-01', w: 81 }] })
    const rows = suggestionsFor('me', data({ S, days }), now)
    expect(rows.map(r => r.type)).toEqual(['routine', 'food', 'weighin'])
    expect(rows[0]).toMatchObject({ id: 'r1', sub: 'Routine · planned today' })
    expect(rows[1]).toMatchObject({ id: 11, sub: 'Breakfast, 2 times this week' })
    expect(rows[2]).toMatchObject({ title: 'Weigh-in', sub: 'Last one 7 days ago', date: today })
    // Weighed today, done today, nothing logged twice this week: all three left out.
    const done = planned({ bodyweight: [{ d: today, w: 80 }], workouts: [{ ...workout('w9', today, 'Push day'), routineId: 'r1', routineIds: ['r1'] }] })
    expect(suggestionsFor('home', data({ S: done, days: days.slice(2) }), now)).toEqual([])
  })

  it('Train: today\'s planned session, a new best, a missed day to move', () => {
    const S = planned({ workouts: [{ ...workout('w1', '2026-10-12', 'Push day'), prs: [bench.id] }, workout('w0', '2026-10-01', 'Push day')] })
    const rows = suggestionsFor('train', data({ S }), now)
    expect(rows.map(r => r.type)).toEqual(['routine', 'exercise', 'missed'])
    expect(rows[1]).toMatchObject({ id: bench.id, reason: 'new best on Mon 12 Oct', sub: 'Exercise · new best on Mon 12 Oct' })
    expect(rows[2]).toMatchObject({ title: 'Legs', date: '2026-10-13', sub: 'Missed Tue 13 Oct · move it', path: '/train/schedule' })
    // Before training began nothing counts as missed.
    expect(suggestionsFor('train', data({ S: planned({ workouts: [] }) }), now).map(r => r.type)).toEqual(['routine'])
  })

  it('Eat: the food logged most this week, the one usual at this meal, the top saved meal', () => {
    const days = [
      { date: '2026-10-13', items: [{ uuid: 'a', name: 'Chicken breast', meal: 1, food_id: 12 }] },
      { date: '2026-10-14', items: [{ uuid: 'b', name: 'Chicken breast', meal: 1, food_id: 12 }, { uuid: 'c', name: 'Rolled oats', meal: 1, food_id: 11 }] },
    ]
    const meals = [{ id: 21, name: 'Usual breakfast', is_recipe: false, items: [{ name: 'Oats' }], nutrition: {}, usage_count: 4 }]
    const rows = suggestionsFor('food', data({ days, meals, ntSettings: null }), now)
    expect(rows[0]).toMatchObject({ type: 'food', id: 12, sub: 'Lunch, 2 times this week' })
    expect(rows.at(-1)).toMatchObject({ type: 'meal', id: 21, sub: expect.stringMatching(/^Saved meal/) })
    expect(new Set(rows.map(r => r.key)).size).toBe(rows.length)
  })

  it('Eat: "Usual at" a meal takes two logs of the food at it, and a meal with a name', () => {
    const at = (date, ...items) => ({ date, items: items.map(([food_id, meal], i) => ({ uuid: date + i, name: 'x', meal, food_id })) })
    const usual = rows => rows.find(r => r.reason?.startsWith('Usual at'))
    const twice = [at('2026-10-13', [12, 2], [11, 1]), at('2026-10-14', [12, 2], [12, 2], [11, 1])]
    expect(usual(suggestionsFor('food', data({ days: twice, meals: [] }), now))).toMatchObject({ type: 'food', id: 11, reason: 'Usual at Lunch' })
    const once = [at('2026-10-13', [12, 2]), at('2026-10-14', [12, 2], [12, 2], [11, 1])]
    expect(usual(suggestionsFor('food', data({ days: once, meals: [] }), now))).toBeUndefined()
    const unnamed = ['Breakfast', ' ', 'Dinner', 'Snacks']
    expect(usual(suggestionsFor('food', data({ days: twice, meals: [], mealNames: unnamed }), now))).toBeUndefined()
  })

  it('first use until a search is run; a suggestion already in Recent shows once, in Recent', () => {
    const view = beforeTypingOf({ tab: 'train', data: data({ S: planned() }), list: [], searched: false, now })
    expect(view).toMatchObject({ firstUse: true, placeholder: 'Search training' })
    expect(view.suggested.map(r => r.key)).toEqual(['routine:r1'])
    expect(beforeTypingOf({ tab: 'train', data: data({ S: planned() }), list: [], searched: true, now }).firstUse).toBe(false)
    const list = [{ kind: 'result', type: 'routine', id: 'r1', label: 'Push day' }, { kind: 'query', query: 'press' }, { kind: 'result', type: 'routine', id: 'gone' }]
    const seen = beforeTypingOf({ tab: 'train', data: data({ S: planned() }), list, searched: true, now })
    expect(seen.firstUse).toBe(false)
    expect(seen.recents.map(e => [e.key, e.sub])).toEqual([['routine:r1', expect.stringMatching(/^Routine · /)], ['q:press', 'Search']])
    expect(seen.entries.find(e => e.key === 'routine:gone')).toMatchObject({ gone: true })
    expect(seen.suggested).toEqual([])
  })

  it('a Recent food is only called gone once the foods have loaded', () => {
    const list = [{ kind: 'result', type: 'food', id: 99, label: 'Old' }]
    expect(beforeTypingOf({ tab: 'home', data: data({ foodsReady: false }), list, searched: true, now }).entries[0].gone).toBe(false)
    expect(beforeTypingOf({ tab: 'home', data: data({ foodsReady: true }), list, searched: true, now }).entries[0].gone).toBe(true)
  })

  it('a Recent food, meal or day stays in its place from its stored label until its list has loaded, then goes if it is gone', () => {
    const list = [
      { kind: 'result', type: 'food', id: 99, label: 'Greek yogurt 2%', query: 'yog' },
      { kind: 'query', query: 'press' },
      { kind: 'result', type: 'meal', id: 'm9', label: 'Usual breakfast', query: '' },
      { kind: 'result', type: 'day', id: '2026-10-01', label: '', query: 'oats' },
    ]
    const shown = e => [e.row ? e.row.title : e.pending ? e.title : e.r.query, e.sub]
    const loading = beforeTypingOf({ tab: 'home', data: data({ foodsReady: false, mealsReady: false, daysReady: false }), list, searched: true, now })
    expect(loading.recents.map(shown)).toEqual([['Greek yogurt 2%', 'Your food'], ['press', 'Search'], ['Usual breakfast', 'Saved meal'], ['oats', 'Day']])
    expect(loading.recents.filter(e => e.pending).map(e => e.key)).toEqual(['food:99', 'meal:m9', 'day:2026-10-01'])
    const loaded = beforeTypingOf({ tab: 'home', data: data({ foodsReady: true, mealsReady: true, daysReady: true }), list, searched: true, now })
    expect(loaded.recents.map(e => e.key)).toEqual(['q:press'])
  })
})

describe('the pages registry', () => {
  it('has every path routed in App.jsx', () => {
    const src = readApp()
    for (const p of PAGE_INDEX) expect(src, p.path).toContain(`path="${p.path}"`)
  })
})
