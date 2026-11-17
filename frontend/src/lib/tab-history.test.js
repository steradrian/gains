// Per-tab back stacks over one linear history. The property that matters: history only ever holds
// the tab on screen, so walking back never lands in another tab.
import { describe, expect, it } from 'vitest'
import { deadSteps, emptyNav, onVisitPage, planSwitch, record, settle } from './tab-history.js'

const at = (nav, navType, path, idx) => record(nav, { idx, path, navType })
const push = (nav, path) => at(nav, 'PUSH', path, nav.idx + 1)
// What back presses can reach: the entries up to the current one.
const behind = nav => nav.entries.slice(0, nav.idx + 1)

// What the shell does with a plan: walk back to 0, replace, push the rest, settle.
function carryOut(plan) {
  let next = at(plan.nav, 'POP', plan.nav.entries[0], 0)
  const [first, ...rest] = plan.stack
  next = at(next, 'REPLACE', first, 0)
  for (const p of rest) next = push(next, p)
  return settle(next)
}
const go = (nav, tab, opts) => carryOut(planSwitch(nav, tab, opts))
const start = (path = '/home') => at(emptyNav(), 'POP', path, 0)

describe('mirroring the history', () => {
  it('follows pushes, replaces and pops by position', () => {
    let nav = push(push(start('/train'), '/train/routines'), '/train/routines/a')
    expect(nav.entries).toEqual(['/train', '/train/routines', '/train/routines/a'])
    nav = at(nav, 'POP', '/train', 0)
    expect(nav.idx).toBe(0)
    expect(nav.entries).toHaveLength(3)   // forward is still there…
    nav = push(nav, '/train/history')
    expect(nav.entries).toEqual(['/train', '/train/history'])   // …until a push
  })

  it('a page any tab opens keeps the tab under it', () => {
    expect(push(start('/food'), '/train/workout').tab).toBe('food')
  })

  it('Progress is a page of the Me tab, opened from Profile', () => {
    const nav = push(push(start('/me'), '/progress'), '/progress/body')
    expect(nav.tab).toBe('me')
    expect(behind(nav)).toEqual(['/me', '/progress', '/progress/body'])
  })

  it('a new document starts the live history where it is', () => {
    const nav = at(emptyNav(), 'POP', '/progress/body', 0)
    expect(nav.tab).toBe('me')
    expect(nav.top).toBe(0)
  })

  it('an entry with no position counts as the start', () => {
    expect(at(emptyNav(), 'POP', '/home', undefined).idx).toBe(0)
  })
})

describe('switching tabs', () => {
  it('walks back to the first entry and rebuilds the other tab there', () => {
    const nav = push(push(start('/train'), '/train/routines'), '/train/routines/a')
    const plan = planSwitch(nav, 'food')
    expect(plan.back).toBe(2)
    expect(plan.stack).toEqual(['/food'])
    const after = carryOut(plan)
    // Back reaches Nutrition only: one back press from here leaves the app.
    expect(behind(after)).toEqual(['/food'])
    expect(after.tab).toBe('food')
  })

  it('each of the four tabs opens on its root: what it held when it was left is gone', () => {
    let nav = push(start('/home'), '/home?d=1')
    nav = go(nav, 'train')
    nav = push(push(nav, '/train/history'), '/train/exercises')
    nav = go(nav, 'me')
    nav = push(push(nav, '/progress'), '/progress/body')
    nav = go(nav, 'food')
    expect(behind(nav)).toEqual(['/food'])
    nav = go(nav, 'train')
    expect(behind(nav)).toEqual(['/train'])
    nav = go(nav, 'me')
    expect(behind(nav)).toEqual(['/me'])
    nav = go(nav, 'home')
    expect(behind(nav)).toEqual(['/home'])
    expect(nav).not.toHaveProperty('stacks')
  })

  it('takes a page to land on, on top of the tab\'s root', () => {
    const nav = go(start('/home'), 'train')
    const back = go(nav, 'home')
    expect(planSwitch(back, 'train', { path: '/train/checkin' }).stack).toEqual(['/train', '/train/checkin'])
  })

  it('the page that was pushed into the other tab lands on that tab\'s root, and nothing of the leaving tab is kept', () => {
    // A Profile row opened Routines: the push landed at 2 and is handed to Training.
    const nav = push(start('/me'), '/me/workout')
    const plan = planSwitch({ ...nav, idx: 2 }, 'train', { path: '/train/routines' })
    expect(plan.stack).toEqual(['/train', '/train/routines'])
    expect(plan.nav).toEqual({ ...nav, idx: 2, tab: 'train' })
  })

  it('opening a page lands on the root with it on top, even one the tab held before', () => {
    let nav = go(start('/home'), 'me')
    nav = push(nav, '/progress?range=90')
    nav = go(nav, 'train')
    expect(planSwitch(nav, 'me', { path: '/progress?range=30' }).stack).toEqual(['/me', '/progress?range=30'])
    expect(planSwitch(nav, 'me', { path: '/progress/load' }).stack).toEqual(['/me', '/progress/load'])
    // Profile's own root, opened from the avatar of another tab: just the root.
    expect(planSwitch(nav, 'me', { path: '/me' }).stack).toEqual(['/me'])
  })

  it('from the first entry there is nothing to walk back', () => {
    expect(planSwitch(start('/home'), 'food').back).toBe(0)
  })

  it('is nothing to do for the tab on screen, or for no tab', () => {
    expect(planSwitch(start('/home'), 'home')).toBeNull()
    expect(planSwitch(start('/home'), 'progress')).toBeNull()
  })
})

describe('the active tab tapped again', () => {
  it('goes back down to its root', () => {
    const nav = push(push(start('/train'), '/train/routines'), '/train/routines/a')
    const plan = planSwitch(nav, 'train', { toRoot: true })
    expect(plan.back).toBe(2)
    expect(plan.stack).toEqual(['/train'])
    expect(behind(carryOut(plan))).toEqual(['/train'])
  })

  it('a root that was opened cold under a sub-page becomes the root again', () => {
    const plan = planSwitch(start('/progress/body'), 'me', { toRoot: true })
    expect(plan.back).toBe(0)
    expect(plan.stack).toEqual(['/me'])
  })

  it('is nothing to do on the root itself, even one that sat on two positions (a sheet\'s entry the router replaced)', () => {
    expect(planSwitch(start('/train'), 'train', { toRoot: true })).toBeNull()
    expect(planSwitch(at(push(start('/train'), '/train'), 'REPLACE', '/train', 1), 'train', { toRoot: true })).toBeNull()
  })

  it('leaves a workout open on top of the root, which is not the root', () => {
    const plan = planSwitch(push(start('/train'), '/train/workout'), 'train', { toRoot: true })
    expect(plan).toMatchObject({ back: 1, stack: ['/train'] })
  })

  it('with a path, goes down to that page on the root: Progress over Profile', () => {
    const nav = push(push(start('/me'), '/progress'), '/progress/body')
    const plan = planSwitch(nav, 'me', { toRoot: true, path: '/progress' })
    expect(plan.back).toBe(2)
    expect(plan.stack).toEqual(['/me', '/progress'])
    expect(planSwitch(push(start('/me'), '/progress'), 'me', { toRoot: true, path: '/progress' })).toBeNull()
  })
})

describe('the forward history a switch leaves behind', () => {
  it('is dead: a forward step onto it is stepped back off', () => {
    const nav = go(push(push(start('/train'), '/train/history'), '/train/exercises'), 'food')
    expect(deadSteps(nav)).toBe(0)
    const forward = at(nav, 'POP', '/train/history', 1)
    expect(deadSteps(forward)).toBe(1)
    expect(forward.tab).toBe('food')   // not mirrored as a Training page
  })

  it('a page the router puts on a sheet\'s entry is live, not dead forward history', () => {
    // + sheet open on Home (its entry at 1, never a router location), then Start replaces it.
    const nav = at(start('/home'), 'REPLACE', '/train/workout', 1)
    expect(deadSteps(nav)).toBe(0)
    expect(behind(nav)).toEqual(['/home', '/train/workout'])
  })

  it('a back and forward inside one tab is live', () => {
    let nav = push(push(start('/train'), '/train/history'), '/train/exercises')
    nav = at(nav, 'POP', '/train/history', 1)
    nav = at(nav, 'POP', '/train/exercises', 2)
    expect(deadSteps(nav)).toBe(0)
  })
})

describe('a search visit (lib/search/session.js)', () => {
  // Home, its search overlay's entry (pushed by hand, like a sheet's: no location of its own), and
  // another tab's page opened from it.
  const visiting = () => record(start('/home'), { idx: 2, path: '/food?date=2026-10-11&find=u1', navType: 'PUSH', keepTab: true })

  it('keeps another tab\'s page on this tab\'s stack, so back walks to the overlay and Home', () => {
    let nav = visiting()
    expect(nav.tab).toBe('home')
    expect(behind(nav)).toEqual(['/home', undefined, '/food?date=2026-10-11&find=u1'])
    nav = at(nav, 'POP', '/home', 1)
    expect(nav).toMatchObject({ tab: 'home', idx: 1 })
  })

  it('a tab tapped then leaves that page, and the visit, behind', () => {
    const nav = go(visiting(), 'me')
    expect(behind(nav)).toEqual(['/me'])
  })

  it('a link followed from the visited page, or its address replaced, stays on the visit', () => {
    let nav = visiting()
    expect(onVisitPage(nav)).toBe(true)
    nav = at(nav, 'REPLACE', '/food', 2)
    expect(nav).toMatchObject({ tab: 'home', idx: 2 })
    nav = push(nav, '/food/meals')
    expect(nav.tab).toBe('home')
    expect(behind(nav)).toEqual(['/home', undefined, '/food', '/food/meals'])
    // Back down the visit and on to Home, and forward onto it again: still Home's stack.
    nav = at(nav, 'POP', '/food', 2)
    expect(nav.tab).toBe('home')
    nav = at(nav, 'POP', '/home', 0)
    expect(nav.tab).toBe('home')
    expect(onVisitPage(nav)).toBe(false)
    nav = at(nav, 'POP', '/food', 2)
    expect(nav.tab).toBe('home')
    // A tab of its own is never a visit: another tab's page from there is the switch it always was.
    expect(onVisitPage(push(start('/home'), '/home'))).toBe(false)
  })

  it('this tab\'s own button goes back to its root; the lit one goes to that tab\'s root', () => {
    expect(planSwitch(visiting(), 'home', { toRoot: true })).toMatchObject({ stack: ['/home'] })
    let nav = start('/progress')
    nav = push(nav, '/progress/body')
    nav = go(nav, 'home')
    nav = at(nav, 'POP', '/home', 1)
    nav = record(nav, { idx: 2, path: '/progress/strength', navType: 'PUSH', keepTab: true })
    expect(planSwitch(nav, 'me', { toRoot: true })).toMatchObject({ stack: ['/me'] })
  })
})
