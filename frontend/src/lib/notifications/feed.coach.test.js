import { describe, expect, it } from 'vitest'
import { feedKey, feedOf } from './feed.js'
import { EMPTY_READ, isUnread, withRead } from './read-state.js'

// Wednesday 21 Oct 2026, noon: the feed reaches back 30 days.
const NOW = new Date(2026, 9, 21, 12).getTime()
const DAY = 86400000

const profile = (planChanges, over = {}) => ({
  unit: 'kg', workouts: [], routines: [], week: {}, dayPlan: {}, queue: null, bodyweight: [], customEx: [],
  coach: { planChanges }, ...over,
})
const stamp = (id, at, extra) => ({ id, at, ...extra })
const coachItems = (S, opts) => feedOf(S, { now: NOW, ...opts }).filter(i => i.kind === 'coach')

describe('feedOf: Coach plan changes', () => {
  it('no stamp, no coach item (no back-fill)', () => {
    expect(coachItems(profile([]))).toEqual([])
    expect(coachItems(profile(undefined))).toEqual([])
    expect(coachItems({ unit: 'kg' })).toEqual([])
  })

  it('renders the title, body and target of each type', () => {
    const at = NOW - DAY
    const items = coachItems(profile([
      stamp('p1:a', at, { type: 'week', weekday: 4, routineName: 'Legs' }),
      stamp('p1:b', at - 1, { type: 'week', weekday: 0 }),
      stamp('p1:c', at - 2, { type: 'add-routine', routineName: 'Pull B' }),
      stamp('p1:d', at - 3, { type: 'remove-routine', routineName: 'Pull B' }),
      stamp('p1:e', at - 4, { type: 'rename-routine', from: 'Push', to: 'Push A' }),
      stamp('p1:plan', at - 5, { type: 'create' }),
    ]))
    expect(items.map(i => i.title)).toEqual([
      'Coach set Thursday to Legs',
      'Coach made Sunday a rest day',
      'Coach added Pull B',
      'Coach removed Pull B',
      'Coach renamed Push to Push A',
      'Coach set up a new plan',
    ])
    expect(items[0]).toEqual({
      id: 'coach:p1:a', kind: 'coach', at, title: 'Coach set Thursday to Legs', body: 'See your plan', target: { route: '/train/schedule' },
    })
    expect(new Set(items.map(i => i.body))).toEqual(new Set(['See your plan']))
  })

  it('a stamp whose routine is gone still renders from its stored names', () => {
    const S = profile([stamp('p1:a', NOW - DAY, { type: 'week', weekday: 4, routineName: 'Legs' })], { routines: [], week: {} })
    expect(coachItems(S)[0].title).toBe('Coach set Thursday to Legs')
  })

  it('leaves out a stamp older than the window, one in the future, one reverted and one malformed', () => {
    const S = profile([
      stamp('old', NOW - 31 * DAY, { type: 'create' }),
      stamp('future', NOW + DAY, { type: 'create' }),
      stamp('undone', NOW - DAY, { type: 'create', reverted: true }),
      stamp('bad', NOW - DAY, { type: 'week', weekday: 9 }),
      stamp('edge', NOW - 30 * DAY, { type: 'create' }),
    ])
    expect(coachItems(S).map(i => i.id)).toEqual(['coach:edge'])
  })

  it('orders by time, newest first, and the id breaks a tie', () => {
    const S = profile([
      stamp('b', NOW - 2 * DAY, { type: 'create' }),
      stamp('a', NOW - 2 * DAY, { type: 'create' }),
      stamp('c', NOW - DAY, { type: 'create' }),
    ])
    expect(coachItems(S).map(i => i.id)).toEqual(['coach:c', 'coach:a', 'coach:b'])
  })

  it('at the same moment as another kind, the Coach comes first', () => {
    const at = new Date(2026, 9, 20, 19).getTime()
    const S = profile([stamp('p1:a', at, { type: 'create' })], { routines: [{ id: 'r1', name: 'Push', ex: [] }] })
    const reminders = [{ at, kind: 'workout', iso: '2026-10-20', time: '19:00', routines: [{ id: 'r1', name: 'Push' }] }]
    const kinds = feedOf(S, { now: NOW, reminders }).filter(i => i.at === at).map(i => i.kind)
    expect(kinds).toEqual(['coach', 'reminder'])
  })

  it('an item keeps its id across a recompute, so a read survives it', () => {
    const planChanges = [stamp('p1:a', NOW - DAY, { type: 'create' })]
    const first = coachItems(profile(planChanges))[0]
    const second = coachItems(profile(JSON.parse(JSON.stringify(planChanges))))[0]
    expect(second.id).toBe(first.id)
    expect(isUnread(first, EMPTY_READ)).toBe(true)
    const read = withRead(EMPTY_READ, first, NOW)
    expect(isUnread(second, read)).toBe(false)
  })

  it('the feed key changes when a stamp is added or reverted', () => {
    const a = profile([stamp('p1:a', NOW - DAY, { type: 'create' })])
    const b = profile([stamp('p1:a', NOW - DAY, { type: 'create' }), stamp('p2:a', NOW, { type: 'create' })])
    const c = profile([stamp('p1:a', NOW - DAY, { type: 'create', reverted: true })])
    expect(new Set([feedKey(a), feedKey(b), feedKey(c)]).size).toBe(3)
  })
})
