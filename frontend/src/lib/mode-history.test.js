// Per-mode back stacks over one linear history. The property that matters: history only ever holds
// the mode on screen, so walking back never lands in the other mode.
import { describe, expect, it } from 'vitest'
import { emptyNav, planSwitch, record } from './mode-history.js'

let n = 0
const go = (nav, navType, path, key = 'k' + ++n) => record(nav, { key, path, navType })
const paths = nav => nav.entries.map(e => e.path)
// What back presses can reach: the entries up to the current one. A browser keeps the entries
// ahead of a replaced one (forward), and so does the mirror, until the next push drops them.
const behind = nav => paths(nav).slice(0, nav.idx + 1)

// A browser history as a list plus a position, driven by what a switch plan says.
function carryOut(nav, plan) {
  let next = plan.nav
  next = record(next, { key: next.entries[0].key, path: next.entries[0].path, navType: 'POP' })
  const [first, ...rest] = plan.stack
  next = go(next, 'REPLACE', first)
  for (const p of rest) next = go(next, 'PUSH', p)
  return next
}

describe('mirroring the history', () => {
  it('follows pushes, replaces and pops by key', () => {
    let nav = go(emptyNav(), 'POP', '/train/home', 'a')
    nav = go(nav, 'PUSH', '/train/stats', 'b')
    nav = go(nav, 'PUSH', '/train/history', 'c')
    expect(paths(nav)).toEqual(['/train/home', '/train/stats', '/train/history'])
    expect(nav.idx).toBe(2)
    nav = record(nav, { key: 'a', path: '/train/home', navType: 'POP' })
    expect(nav.idx).toBe(0)
    nav = go(nav, 'PUSH', '/train/plan', 'd')
    expect(paths(nav)).toEqual(['/train/home', '/train/plan'])   // forward entries are gone
    nav = go(nav, 'REPLACE', '/train/plan/r/1', 'e')
    expect(paths(nav)).toEqual(['/train/home', '/train/plan/r/1'])
  })

  it('a shared page keeps the mode that opened it', () => {
    let nav = go(emptyNav(), 'POP', '/food/diary', 'a')
    nav = go(nav, 'PUSH', '/me', 'b')
    expect(nav.mode).toBe('food')
  })

  it('a sheet\'s own history entry (no router key) leaves the mirror where it is', () => {
    let nav = go(emptyNav(), 'POP', '/train/home', 'a')
    nav = go(nav, 'PUSH', '/train/stats', 'b')
    nav = record(nav, { key: 'default', path: '/train/stats', navType: 'POP' })
    expect(nav.idx).toBe(1)
    expect(paths(nav)).toEqual(['/train/home', '/train/stats'])
  })

  it('an unknown history starts the mirror over', () => {
    const nav = go(emptyNav('food'), 'POP', '/food/goals', 'fresh')
    expect(paths(nav)).toEqual(['/food/goals'])
    expect(nav.mode).toBe('food')
  })
})

describe('switching modes', () => {
  it('walks back to the first entry and rebuilds the other mode there', () => {
    let nav = go(emptyNav(), 'POP', '/train/home', 'a')
    nav = go(nav, 'PUSH', '/train/stats')
    nav = go(nav, 'PUSH', '/train/history')
    const plan = planSwitch(nav, 'food')
    expect(plan.back).toBe(2)
    expect(plan.stack).toEqual(['/food/diary'])
    nav = carryOut(nav, plan)
    // Back reaches Nutrition only: one back press from here leaves the app.
    expect(behind(nav)).toEqual(['/food/diary'])
    expect(nav.idx).toBe(0)
    expect(nav.mode).toBe('food')
  })

  it('comes back to the mode where it was left, its back stack intact', () => {
    let nav = go(emptyNav(), 'POP', '/train/home', 'a')
    nav = go(nav, 'PUSH', '/train/stats')
    nav = go(nav, 'PUSH', '/train/history')
    nav = carryOut(nav, planSwitch(nav, 'food'))
    nav = go(nav, 'PUSH', '/food/goals')
    nav = carryOut(nav, planSwitch(nav, 'train'))
    expect(behind(nav)).toEqual(['/train/home', '/train/stats', '/train/history'])
    expect(nav.idx).toBe(2)
    // …and Nutrition kept its own.
    nav = carryOut(nav, planSwitch(nav, 'food'))
    expect(behind(nav)).toEqual(['/food/diary', '/food/goals'])
  })

  it('takes a page to land on, on top of the mode\'s stack (the + sheet\'s Start)', () => {
    let nav = go(emptyNav(), 'POP', '/train/home', 'a')
    nav = carryOut(nav, planSwitch(nav, 'food'))
    const plan = planSwitch(nav, 'train', '/train/workout')
    expect(plan.stack).toEqual(['/train/home', '/train/workout'])
    // Already on top: not twice.
    nav = carryOut(nav, plan)
    nav = carryOut(nav, planSwitch(nav, 'food'))
    expect(planSwitch(nav, 'train', '/train/workout').stack).toEqual(['/train/home', '/train/workout'])
  })

  it('from the first entry there is nothing to walk back', () => {
    const nav = go(emptyNav(), 'POP', '/train/home', 'a')
    expect(planSwitch(nav, 'food').back).toBe(0)
  })

  it('is nothing to do for the mode already on screen, or no mode', () => {
    const nav = go(emptyNav(), 'POP', '/train/home', 'a')
    expect(planSwitch(nav, 'train')).toBeNull()
    expect(planSwitch(nav, 'me')).toBeNull()
  })
})
