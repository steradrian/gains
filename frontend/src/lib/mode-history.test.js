// Per-mode back stacks over one linear history. The property that matters: history only ever holds
// the mode on screen, so walking back never lands in the other mode.
import { describe, expect, it } from 'vitest'
import { deadSteps, emptyNav, planSwitch, record, settle } from './mode-history.js'

const at = (nav, navType, path, idx) => record(nav, { idx, path, navType })
const push = (nav, path) => at(nav, 'PUSH', path, nav.idx + 1)
const behind = nav => nav.entries.slice(0, nav.idx + 1)

// What the shell does with a plan: walk back to 0, replace, push the rest, settle.
function carryOut(nav, plan) {
  let next = at(plan.nav, 'POP', plan.nav.entries[0], 0)
  const [first, ...rest] = plan.stack
  next = at(next, 'REPLACE', first, 0)
  for (const p of rest) next = push(next, p)
  return settle(next)
}

const start = (path = '/train/home', mode) => at(emptyNav(mode), 'POP', path, 0)

describe('mirroring the history', () => {
  it('follows pushes, replaces and pops by position', () => {
    let nav = push(push(start(), '/train/stats'), '/train/history')
    expect(nav.entries).toEqual(['/train/home', '/train/stats', '/train/history'])
    nav = at(nav, 'POP', '/train/home', 0)
    expect(nav.idx).toBe(0)
    expect(nav.entries).toHaveLength(3)   // forward is still there…
    nav = push(nav, '/train/plan')
    expect(nav.entries).toEqual(['/train/home', '/train/plan'])   // …until a push
    nav = at(nav, 'REPLACE', '/train/plan/r/1', 1)
    expect(nav.entries).toEqual(['/train/home', '/train/plan/r/1'])
  })

  it('a shared page keeps the mode that opened it', () => {
    expect(push(start('/food/diary'), '/me').mode).toBe('food')
  })

  it('a new document starts the live history where it is, whatever the mirror held', () => {
    const stale = { ...push(push(start(), '/train/stats'), '/train/history'), idx: -1 }
    const nav = at(stale, 'POP', '/food/goals', 0)
    expect(nav.idx).toBe(0)
    expect(nav.top).toBe(0)
    expect(planSwitch(nav, 'train').back).toBe(0)
  })

  it('an entry with no position counts as the start', () => {
    expect(at(emptyNav(), 'POP', '/train/home', undefined).idx).toBe(0)
  })
})

describe('switching modes', () => {
  it('walks back to the first entry and rebuilds the other mode there', () => {
    const nav = push(push(start(), '/train/stats'), '/train/history')
    const plan = planSwitch(nav, 'food')
    expect(plan.back).toBe(2)
    expect(plan.stack).toEqual(['/food/diary'])
    const after = carryOut(nav, plan)
    // Back reaches Nutrition only: one back press from here leaves the app.
    expect(behind(after)).toEqual(['/food/diary'])
    expect(after.mode).toBe('food')
  })

  it('comes back to the mode where it was left, its back stack intact', () => {
    let nav = push(push(start(), '/train/stats'), '/train/history')
    nav = carryOut(nav, planSwitch(nav, 'food'))
    nav = push(nav, '/food/goals')
    nav = carryOut(nav, planSwitch(nav, 'train'))
    expect(behind(nav)).toEqual(['/train/home', '/train/stats', '/train/history'])
    expect(nav.idx).toBe(2)
    nav = carryOut(nav, planSwitch(nav, 'food'))
    expect(behind(nav)).toEqual(['/food/diary', '/food/goals'])
  })

  it('takes a page to land on, on top of the mode\'s stack (the + sheet\'s Start)', () => {
    let nav = carryOut(start(), planSwitch(start(), 'food'))
    const plan = planSwitch(nav, 'train', '/train/workout')
    expect(plan.stack).toEqual(['/train/home', '/train/workout'])
    nav = carryOut(carryOut(nav, plan), planSwitch(carryOut(nav, plan), 'food'))
    expect(planSwitch(nav, 'train', '/train/workout').stack).toEqual(['/train/home', '/train/workout'])
  })

  it('from the first entry there is nothing to walk back', () => {
    expect(planSwitch(start(), 'food').back).toBe(0)
  })

  it('is nothing to do for the mode already on screen, or no mode', () => {
    expect(planSwitch(start(), 'train')).toBeNull()
    expect(planSwitch(start(), 'me')).toBeNull()
  })
})

describe('the forward history a switch leaves behind', () => {
  it('is dead: a forward step onto it is stepped back off', () => {
    const nav = carryOut(push(push(start(), '/train/stats'), '/train/history'), planSwitch(push(push(start(), '/train/stats'), '/train/history'), 'food'))
    expect(deadSteps(nav)).toBe(0)
    // Browser Forward: the router lands on what used to be /train/stats.
    const forward = at(nav, 'POP', '/train/stats', 1)
    expect(deadSteps(forward)).toBe(1)
  })

  it('a back and forward inside one mode is live', () => {
    let nav = push(push(start(), '/train/stats'), '/train/history')
    nav = at(nav, 'POP', '/train/stats', 1)
    nav = at(nav, 'POP', '/train/history', 2)
    expect(deadSteps(nav)).toBe(0)
  })
})
