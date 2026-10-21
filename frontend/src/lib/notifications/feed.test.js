import { describe, expect, it } from 'vitest'
import { fmtDate, isoOf } from '../format.js'
import { dateLocale } from '../i18n-core.js'
import { NUDGE_COPY } from '../nudge.js'
import { FEED_DAYS, feedKey, feedOf, isoWeekOf, milestonesUpTo, targetPath } from './feed.js'

// Wednesday 21 Oct 2026, noon: the feed reaches back to Monday 21 Sep, noon.
const NOW = new Date(2026, 9, 21, 12).getTime()
const BENCH = '0025' // barbell bench press

const at = (d, hh = 18) => new Date(`${d}T${String(hh).padStart(2, '0')}:00:00`).getTime()
// One set of one rep, so the estimated 1RM is the weight itself.
const workout = (id, d, w = 100, exId = BENCH, extra = {}) => ({
  id, d, start: at(d), end: at(d, 19), entries: [{ id: exId, sets: [{ w, r: 1, done: true }] }], ...extra,
})
const profile = (over = {}) => ({
  unit: 'kg', workouts: [], routines: [], week: {}, dayPlan: {}, queue: null, bodyweight: [], customEx: [], ...over,
})
const PUSH = { id: 'r1', name: 'Push A', ex: [{ id: BENCH }] }
// Monday planned since July, before every week these tests look at (the plan's edit stamp,
// lib/sync-merge.js `edited`): the plan today is provably the plan those weeks had.
const SET = { 'week.1': at('2026-07-01') }
// Every Monday from `from`, `n` weeks, at a steady 100 kg (no new bests).
const mondays = (from, n, skip = []) => Array.from({ length: n }, (_, i) => {
  const d = new Date(from + 'T12:00:00')
  d.setDate(d.getDate() + 7 * i)
  return isoOf(d)
}).filter(d => !skip.includes(d))
const of = (items, kind) => items.filter(i => i.kind === kind)

describe('feedOf: new bests', () => {
  it('a logged workout that beats every earlier estimate, with the rise over four weeks', () => {
    const S = profile({ workouts: [workout('w1', '2026-09-10', 90), workout('w2', '2026-10-12', 96)] })
    const [best] = of(feedOf(S, { now: NOW }), 'best')
    expect(best).toMatchObject({
      id: 'best:0025:w2',
      at: at('2026-10-12', 19),
      body: 'Est. 1RM 96 kg, up 6 kg in four weeks.',
      target: { route: '/progress/strength?ex=0025' },
    })
    expect(best.title).toMatch(/^New best: barbell bench press$/i)
  })

  it('leaves the rise out when there is no best from four weeks before', () => {
    const S = profile({ workouts: [workout('w1', '2026-10-05', 90), workout('w2', '2026-10-12', 96)] })
    expect(of(feedOf(S, { now: NOW }), 'best').map(i => i.body)).toEqual(['Est. 1RM 96 kg.'])
  })

  it('a beginner\'s first session of an exercise is never a best, nor one logged at the same moment as it', () => {
    const first = profile({ workouts: [workout('w1', '2026-10-12', 60)] })
    expect(of(feedOf(first, { now: NOW }), 'best')).toEqual([])
    const twin = profile({ workouts: [workout('w1', '2026-10-12', 60), workout('w2', '2026-10-12', 70)] })
    expect(of(feedOf(twin, { now: NOW }), 'best')).toEqual([])
  })

  it('is not a best when it only matches or falls short, nor on the first log ever', () => {
    const S = profile({ workouts: [workout('w1', '2026-10-01', 100), workout('w2', '2026-10-08', 100), workout('w3', '2026-10-15', 95)] })
    expect(of(feedOf(S, { now: NOW }), 'best')).toEqual([])
  })

  it('a best of an exercise deleted since opens its day, saying what changed', () => {
    const S = profile({ workouts: [workout('w1', '2026-09-30', 40, 'c1'), workout('w2', '2026-10-12', 45, 'c1')] })
    const [best] = of(feedOf(S, { now: NOW }), 'best')
    expect(best.title).toBe('New best: Unknown exercise')
    expect(best.target).toEqual({ day: '2026-10-12', changed: 'This exercise was deleted.' })
  })
})

describe('feedOf: streaks', () => {
  it('weeks on plan at each week end from two in a row, with the best run so far', () => {
    // Six weeks from 3 Aug, a week off (14 Sep), then four from 21 Sep: the last is 4 of a best 6.
    const days = mondays('2026-08-03', 11, ['2026-09-14'])
    const S = profile({ routines: [PUSH], week: { 1: ['r1'] }, edited: SET, workouts: days.map((d, i) => workout('w' + i, d)) })
    const streaks = of(feedOf(S, { now: NOW }), 'streak')
    expect(streaks.map(i => i.id)).toEqual(['streak:2026-10-12', 'streak:2026-10-05', 'streak:2026-09-28'])
    expect(streaks[0]).toMatchObject({
      title: '4 weeks on plan',
      body: 'Every planned workout done or moved. Your best is 6.',
      at: new Date(2026, 9, 19).getTime() - 1,
      target: { week: '2026-W42' },
    })
  })

  it('says so when the run is the best yet', () => {
    const S = profile({ routines: [PUSH], week: { 1: ['r1'] }, edited: SET, workouts: mondays('2026-09-21', 4).map((d, i) => workout('w' + i, d)) })
    const [latest] = of(feedOf(S, { now: NOW }), 'streak')
    expect(latest).toMatchObject({ title: '4 weeks on plan', body: 'Every planned workout done or moved. Your best run yet.' })
  })

  it('a week whose plan changed after it began is not held to today\'s plan, and breaks the run', () => {
    // Monday planned on Wed 7 Oct: only the week of 12 Oct provably had today's plan. Every Monday
    // was trained, but the three weeks before it count their workouts alone and no run builds.
    const S = profile({ routines: [PUSH], week: { 1: ['r1'] }, edited: { 'week.1': at('2026-10-07') }, workouts: mondays('2026-09-21', 4).map((d, i) => workout('w' + i, d)) })
    expect(of(feedOf(S, { now: NOW }), 'streak')).toEqual([])
    const recaps = Object.fromEntries(of(feedOf(S, { now: NOW }), 'recap').map(i => [i.id, i.body]))
    expect(recaps).toEqual({
      'recap:2026-09-21': '1 workout', 'recap:2026-09-28': '1 workout', 'recap:2026-10-05': '1 workout', 'recap:2026-10-12': '1 of 1 workouts',
    })
  })

  it('a planned weekday with no stamp was set at a time nobody knows: the done count alone, no streak', () => {
    const S = profile({ routines: [PUSH], week: { 1: ['r1'] }, workouts: mondays('2026-09-21', 4).map((d, i) => workout('w' + i, d)) })
    expect(of(feedOf(S, { now: NOW }), 'streak')).toEqual([])
    expect(feedOf(S, { now: NOW }).find(i => i.id === 'recap:2026-10-12').body).toBe('1 workout')
  })

  it('a routine deleted since the week began, or a coach queue reaching into it, cannot be proven either', () => {
    const base = { routines: [PUSH], week: { 1: ['r1'] }, edited: SET, workouts: [workout('w1', '2026-10-12')] }
    const deleted = profile({ ...base, deleted: { routines: { r9: at('2026-10-14') } } })
    expect(feedOf(deleted, { now: NOW }).find(i => i.id === 'recap:2026-10-12').body).toBe('1 workout')
    const queued = profile({ ...base, queue: { ids: ['r1', 'r1'], since: at('2026-10-09'), startsOn: '2026-10-12', label: 'W1' } })
    expect(feedOf(queued, { now: NOW }).find(i => i.id === 'recap:2026-10-12').body).toBe('1 workout')
  })

  it('a week short of its plan breaks the run', () => {
    // Two planned days a week, one done: never on plan.
    const S = profile({ routines: [PUSH, { id: 'r2', name: 'Pull A', ex: [] }], week: { 1: ['r1'], 4: ['r2'] }, workouts: mondays('2026-09-21', 4).map((d, i) => workout('w' + i, d)) })
    expect(of(feedOf(S, { now: NOW }), 'streak')).toEqual([])
  })
})

describe('feedOf: the weekly recap', () => {
  const week = { routines: [PUSH], week: { 1: ['r1'] }, edited: SET, workouts: [workout('w1', '2026-10-12')] }

  it('workouts done of planned, days on target with nutrition, and the weight change', () => {
    const S = profile({ ...week, bodyweight: [{ d: '2026-10-12', w: 82.1 }, { d: '2026-10-17', w: 81.7 }] })
    const nutrition = { dayOnTarget: iso => iso !== '2026-10-14' }
    const recap = feedOf(S, { now: NOW, nutrition }).find(i => i.id === 'recap:2026-10-12')
    expect(recap).toMatchObject({ kind: 'recap', body: '1 of 1 workouts · 6 of 7 days on target · −0.4 kg', target: { week: '2026-W42' } })
    expect(recap.title).toMatch(/^Your week, /)
  })

  it('leaves out days on target without nutrition, or with a day it cannot say, and the weight with one weigh-in', () => {
    const S = profile({ ...week, bodyweight: [{ d: '2026-10-12', w: 82.1 }] })
    expect(feedOf(S, { now: NOW }).find(i => i.id === 'recap:2026-10-12').body).toBe('1 of 1 workouts')
    const unsure = { dayOnTarget: iso => (iso === '2026-10-18' ? null : true) }
    expect(feedOf(S, { now: NOW, nutrition: unsure }).find(i => i.id === 'recap:2026-10-12').body).toBe('1 of 1 workouts')
  })

  it('a week with nothing planned counts its workouts; the week still running has no recap', () => {
    const S = profile({ workouts: [workout('w1', '2026-10-13'), workout('w2', '2026-10-15'), workout('w3', '2026-10-20')] })
    const recaps = of(feedOf(S, { now: NOW }), 'recap')
    expect(recaps.map(i => [i.id, i.body])).toEqual([['recap:2026-10-12', '2 workouts']])
  })
})

describe('feedOf: milestones', () => {
  it('the workout that reached a count, since the first log', () => {
    const days = mondays('2026-08-03', 11)
    const S = profile({ workouts: days.map((d, i) => workout('w' + i, d)) })
    expect(of(feedOf(S, { now: NOW }), 'milestone')).toEqual([{
      id: 'milestone:10', kind: 'milestone', at: at(days[9], 19),
      title: '10 workouts', body: `Since you started on ${fmtDate('2026-08-03')}.`, target: { day: days[9] },
    }])
  })

  it('counts at 10, 25, 50, 100, every 50 to 500, then every 250', () => {
    expect(milestonesUpTo(9)).toEqual([])
    expect(milestonesUpTo(160)).toEqual([10, 25, 50, 100, 150])
    expect(milestonesUpTo(1000).slice(-4)).toEqual([450, 500, 750, 1000])
  })
})

describe('feedOf: reminders that went off', () => {
  const fired = (over = {}) => ({ kind: 'workout', iso: '2026-10-19', at: at('2026-10-19'), time: '18:00', routines: [{ id: 'r1', name: 'Push A' }], ...over })

  it('a workout-day reminder opens its day', () => {
    const [item] = feedOf(profile({ routines: [PUSH] }), { now: NOW, reminders: [fired()] })
    expect(item).toEqual({
      id: 'reminder:workout:2026-10-19', kind: 'reminder', at: at('2026-10-19'),
      title: 'Workout today: Push A', body: 'Your 18:00 reminder.', target: { day: '2026-10-19' },
    })
  })

  it('says the reminder\'s time the way the UI language writes it', () => {
    const clock = new Date('2026-10-19T07:05:00').toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
    const [item] = feedOf(profile({ routines: [PUSH] }), { now: NOW, reminders: [fired({ time: '7:05' })] })
    expect(item.body).toBe(`Your ${clock} reminder.`)
    expect(item.body).not.toBe('Your 7:05 reminder.')
  })

  it('a nudge in its tone', () => {
    const [item] = feedOf(profile({ routines: [PUSH] }), { now: NOW, reminders: [fired({ kind: 'nudge', tone: 'friendly', at: at('2026-10-19', 20) })] })
    expect(item).toMatchObject({ id: 'reminder:nudge:2026-10-19', title: NUDGE_COPY.friendly.title })
    expect(item.body).toContain('Push A')
  })

  it('a routine deleted since keeps its name and says what changed', () => {
    const [item] = feedOf(profile(), { now: NOW, reminders: [fired()] })
    expect(item.title).toBe('Workout today: Push A')
    expect(item.target).toEqual({ day: '2026-10-19', changed: 'Push A was deleted.' })
  })

  it('none past 30 days or still to come', () => {
    const old = fired({ iso: '2026-09-20', at: at('2026-09-20') })
    const ahead = fired({ iso: '2026-10-22', at: at('2026-10-22') })
    expect(feedOf(profile({ routines: [PUSH] }), { now: NOW, reminders: [old, ahead] })).toEqual([])
  })
})

describe('feedOf: the feed as a whole', () => {
  it('is empty with nothing to say, and never makes up a Coach item', () => {
    expect(feedOf(profile(), { now: NOW })).toEqual([])
    const moved = profile({ routines: [PUSH], week: { 5: ['r1'] }, dayPlan: { '2026-10-19': 'r1', '2026-10-16': 'rest' } })
    expect(of(feedOf(moved, { now: NOW }), 'coach')).toEqual([])
  })

  it(`keeps ${FEED_DAYS} days`, () => {
    // A best on 15 Sep is past the cut; the one on 25 Sep is inside it.
    const S = profile({ workouts: [workout('w1', '2026-09-01', 90), workout('w2', '2026-09-15', 95), workout('w3', '2026-09-25', 99)] })
    expect(of(feedOf(S, { now: NOW }), 'best').map(i => i.id)).toEqual(['best:0025:w3'])
    expect(feedOf(S, { now: NOW }).every(i => i.at >= NOW - FEED_DAYS * 86400000 && i.at <= NOW)).toBe(true)
  })

  it('newest first', () => {
    const days = mondays('2026-08-03', 11)
    const S = profile({ routines: [PUSH], week: { 1: ['r1'] }, workouts: [...days.map((d, i) => workout('w' + i, d)), workout('pr', '2026-10-20', 120)] })
    const ats = feedOf(S, { now: NOW }).map(i => i.at)
    expect(ats).toEqual([...ats].sort((a, b) => b - a))
  })

  it('keeps every id across recomputes: later, and with more logged', () => {
    const days = mondays('2026-08-03', 11)
    const S = profile({ routines: [PUSH], week: { 1: ['r1'] }, workouts: [...days.map((d, i) => workout('w' + i, d)), workout('pr', '2026-10-13', 110)] })
    const ids = feedOf(S, { now: NOW }).map(i => i.id)
    expect(ids.length).toBeGreaterThan(3)
    const later = feedOf({ ...S, workouts: [...S.workouts, workout('w99', '2026-10-21', 100)] }, { now: NOW + 3600000 }).map(i => i.id)
    expect(later).toEqual(expect.arrayContaining(ids))
  })
})

describe('feedKey: what the feed is worked out again for', () => {
  const S = profile({ routines: [PUSH], week: { 1: ['r1'] }, edited: SET, workouts: [workout('w1', '2026-10-12')] })
  const copy = over => JSON.parse(JSON.stringify({ ...S, ...over }))

  it('is the same for a copy of the profile that only changed what the feed does not read', () => {
    expect(feedKey(copy({ restSec: 75, active: { started: 1 }, notifRead: { at: 5, ids: {} }, edited: { ...SET, restSec: 9 } }))).toBe(feedKey(S))
  })

  it('changes with the workouts, the plan and its stamps, the queue, routines and weigh-ins', () => {
    const key = feedKey(S)
    for (const over of [
      { workouts: [...S.workouts, workout('w2', '2026-10-13')] },
      { week: { 1: ['r1'], 3: ['r1'] } },
      { edited: { ...SET, 'week.3': 5 } },
      { queue: { ids: ['r1'], since: 1, startsOn: '2026-10-19' } },
      { routines: [{ ...PUSH, name: 'Push B' }] },
      { bodyweight: [{ d: '2026-10-12', w: 80 }] },
      { deleted: { routines: { r9: 5 } } },
    ]) expect(feedKey(copy(over))).not.toBe(key)
  })
})

describe('isoWeekOf and targetPath', () => {
  it('names a week by its ISO week, whichever day it starts on', () => {
    expect(isoWeekOf('2026-10-12', 1)).toBe('2026-W42')
    expect(isoWeekOf('2026-10-11', 0)).toBe('2026-W42')
    expect(isoWeekOf('2026-12-28', 1)).toBe('2026-W53')
    expect(isoWeekOf('2027-01-04', 1)).toBe('2027-W01')
  })

  it('opens a route as it is; a day in History and a week in Train until the Day and Week pages land', () => {
    expect(targetPath({ route: '/progress/strength?ex=0025' }, 'train')).toBe('/progress/strength?ex=0025')
    expect(targetPath({ day: '2026-10-12', changed: 'x' }, 'home')).toBe('/train/history')
    expect(targetPath({ week: '2026-W42' }, 'food')).toBe('/train')
    expect(targetPath(null)).toBeNull()
  })
})
