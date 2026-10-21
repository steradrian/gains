// @vitest-environment happy-dom
// useTrain's pure parts (PR02 T2.0 and its states): the rail and its edges, the rings, the card of
// every kind of day with its intents, the routines, muscles this week, Your training, the
// training-off profile and the missed-day banner with its toasts.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fmtDate } from '../../lib/format.js'
import { moveToToday, skipMissed } from '../../lib/missed-day.js'
import { DEF } from '../../store/useStore.js'
import {
  cardOf, finishedLine, missedOf, moreOf, movedText, musclesThisWeekOf, profileOf, railOf, ringsOf, routineRows, runningLine, skippedText,
} from './use-train.js'

// Sun 18 Oct 2026 is today, as on the boards. Push A on Sundays, Legs on Mondays and Fridays,
// Pull A on Wednesdays.
const TODAY = '2026-10-18'
const clone = o => JSON.parse(JSON.stringify(o))
const at = (d, h) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime()
const bench = (sets = 3) => ({ id: '0025', sets: Array.from({ length: sets }, () => ({ w: 60, r: 8, done: true })) })
const routine = (id, name, n = 1) => ({ id, name, ex: Array.from({ length: n }, () => ({ id: '0025', sets: 3, reps: 8, weight: 60 })) })
const workout = (id, d, routineIds, extra = {}) => ({ id, d, name: extra.name || 'Pull A', start: at(d, 10), end: at(d, 11), routineIds, entries: [bench()], prs: [], ...extra })
const S = over => ({
  ...clone(DEF),
  routines: [routine('push', 'Push A', 2), routine('pull', 'Pull A'), routine('legs', 'Legs'), routine('arms', 'Arms')],
  week: { 0: ['push'], 1: ['legs'], 3: ['pull'], 5: ['legs'] },
  workouts: [workout('w1', '2026-10-14', ['pull'])],
  ...over,
})
const intents = list => list.map(i => i.intent)

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(TODAY + 'T09:00:00')) })
afterAll(() => vi.useRealTimers())

describe('the rail', () => {
  it('weeks run Thu–Wed with today fourth, titled This week, Next week, then by their first day', () => {
    const rail = railOf(S(), TODAY)
    const week = rail.weeks.find(w => w.offset === 0)
    expect(week.days.map(d => d.iso)).toEqual(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'])
    expect(week.days.map(d => d.date)).toEqual([15, 16, 17, 18, 19, 20, 21])
    expect(week.title).toBe('This week')
    expect(rail.weeks.find(w => w.offset === 1).title).toBe('Next week')
    expect(rail.weeks.find(w => w.offset === 2).title).toBe('Week of ' + fmtDate('2026-10-29'))
  })

  it('marks each day: done, missed, rest, today, planned, with the name of what it holds', () => {
    const days = railOf(S(), TODAY).weeks.find(w => w.offset === 0).days
    expect(days.map(d => d.state)).toEqual(['rest', 'missed', 'rest', 'today', 'planned', 'rest', 'planned'])
    expect(days.map(d => d.name)).toEqual([null, 'Legs', null, 'Push A', 'Legs', null, 'Pull A'])
    expect(days[1].mark).toBe('plan')
    expect(days[1].label).toMatch(/Planned, not logged$/)
    expect(railOf(S(), TODAY).weeks.find(w => w.offset === -1).days[6]).toMatchObject({ iso: '2026-10-14', state: 'done', mark: 'done', name: 'Pull A' })
  })

  it('a noted past day reads as noted, a changed later day as planned with its own routine', () => {
    const state = S({ dayNotes: { '2026-10-16': { tag: 'sick', _ts: 1 } }, dayPlan: { '2026-10-20': 'arms' } })
    const days = railOf(state, TODAY).weeks.find(w => w.offset === 0).days
    expect(days[1].state).toBe('noted')
    expect(days[5]).toMatchObject({ state: 'planned', mark: 'ovr', name: 'Arms' })
  })

  it('before the first workout: only this week, its past days plain numbers with no marks', () => {
    const rail = railOf(S({ workouts: [] }), TODAY)
    expect(rail.from).toBe(0)
    expect(rail.weeks[0].offset).toBe(0)
    const past = rail.weeks[0].days.slice(0, 3)
    expect(past.map(d => [d.state, d.mark, d.name])).toEqual([['plain', undefined, null], ['plain', undefined, null], ['plain', undefined, null]])
  })

  it('swiping back stops at the week of the first workout; days before it in that week are plain', () => {
    const rail = railOf(S({ workouts: [workout('w0', '2026-10-03', ['pull'])] }), TODAY)
    expect(rail.from).toBe(-2)
    const first = rail.weeks[0]
    expect(first.start).toBe('2026-10-01')
    expect(first.days.slice(0, 3).map(d => d.state)).toEqual(['plain', 'plain', 'done'])
  })

  it('reaches back 8 weeks at most, however old the first workout: the rail is bounded by today', () => {
    const rail = railOf(S({ workouts: [workout('w0', '2023-10-05', ['pull']), workout('w1', '2026-10-14', ['pull'])] }), TODAY)
    expect(rail.from).toBe(-8)
    expect(rail.weeks).toHaveLength(17)
    expect(rail.weeks[0]).toMatchObject({ offset: -8, start: '2026-08-20' })
    // A missed day the banner can name (a week back at most) is on the rail, so "See" reaches it.
    expect(rail.weeks.some(w => w.days.some(d => d.iso === '2026-10-11'))).toBe(true)
  })

  it('stops 8 weeks ahead, the plan repeating there as Planned', () => {
    const rail = railOf(S(), TODAY)
    expect(rail.to).toBe(8)
    const last = rail.weeks.at(-1)
    expect(last.offset).toBe(8)
    const sunday = last.days.find(d => new Date(d.iso + 'T12:00:00').getDay() === 0)
    expect(sunday).toMatchObject({ state: 'planned', name: 'Push A', mark: 'plan' })
  })
})

describe('the rings', () => {
  it('workouts this week against the plan, today’s session on its pill; running while one is', () => {
    const [workouts] = ringsOf(S(), TODAY)
    expect(workouts).toMatchObject({ key: 'workouts', big: '1', unit: 'of 4 workouts', pill: 'Push A today' })
    const running = ringsOf(S({ active: { name: 'Push A', start: at(TODAY, 8), entries: [] } }), TODAY)[0]
    expect(running.pill).toBe('Push A running')
  })

  it('volume this week against last week, and the week’s newest best', () => {
    const big = { id: '0025', sets: Array.from({ length: 20 }, () => ({ w: 100, r: 10, done: true })) }
    const state = S({
      workouts: [workout('a', '2026-10-07', ['pull'], { entries: [big] }), workout('b', '2026-10-14', ['pull'], { entries: [big, bench()], prs: ['0025'] })],
      exWeights: { '0025': { w: 82.5, d: '2026-10-14' } },
    })
    const volume = ringsOf(state, TODAY)[1]
    expect(volume).toMatchObject({ key: 'volume', top: 'Volume this week', big: '21.4', unit: 't of 20 t last week' })
    expect(volume.pill).toMatch(/best: 82.5 kg$/)
    expect(ringsOf(S(), TODAY)[1]).toMatchObject({ big: '1,440', unit: 'kg', pill: null })
  })

  it('the streak, weeks in a row, with the best ever on its pill', () => {
    const weeks = ['2026-08-03', '2026-08-10', '2026-08-17', '2026-10-07', '2026-10-14']
    const streak = ringsOf(S({ workouts: weeks.map((d, i) => workout('w' + i, d, ['pull'])) }), TODAY)[2]
    expect(streak).toMatchObject({ key: 'streak', top: 'On plan', big: '2', unit: 'weeks in a row', pill: 'Best: 3 weeks', hint: 'Open Plan' })
    expect(ringsOf(S({ workouts: [] }), TODAY)[2]).toMatchObject({ big: '0', pill: null })
  })
})

describe('the card', () => {
  it('T2.0 planned today: name, muscles and size, the exercises, Start with its ids', () => {
    const card = cardOf(S(), TODAY, TODAY)
    expect(card).toMatchObject({ kind: 'planned', eyebrow: 'Today · planned', title: 'Push A' })
    expect(card.sub).toMatch(/^Chest.* · 2 exercises$/)
    expect(card.exercises).toHaveLength(2)
    expect(card.exercises[0].line).toContain('60 kg')
    expect(card.primary).toMatchObject({ intent: 'start', label: 'Start Push A', ids: ['push'] })
    expect(intents(card.menu)).toEqual(['choose-workout', 'change-day', 'add-note'])
  })

  it('says how long the routine usually takes once it has been timed', () => {
    const timed = workout('p', '2026-10-11', ['push'], { name: 'Push A', end: at('2026-10-11', 10) + 55 * 60000 })
    expect(cardOf(S({ workouts: [timed] }), TODAY, TODAY).sub).toMatch(/2 exercises · about 55 min$/)
  })

  it('T2.7 running: the clock’s start, progress and the next exercise, Resume', () => {
    const active = { name: 'Push A', start: at(TODAY, 8), entries: [bench(2), { id: '0025', sets: [{ w: 60, r: 8, done: false }] }] }
    const card = cardOf(S({ active }), TODAY, TODAY)
    expect(card).toMatchObject({ kind: 'running', eyebrow: 'In progress', since: active.start, title: 'Push A' })
    expect(card.sub).toMatch(/^1 of 2 exercises · 2 sets · next: /)
    expect(card.progress).toBe(0.5)
    expect(card.primary.intent).toBe('resume')
    expect(runningLine({ entries: [] })).toBeNull()
  })

  it('T2.7 editing a saved workout reads as running, Resume back to it', () => {
    const card = cardOf(S({ active: { name: 'Pull A', editingWorkoutId: 'w1', entries: [] } }), TODAY, TODAY)
    expect(card).toMatchObject({ kind: 'editing', eyebrow: 'Editing a saved workout', since: null, primary: { intent: 'resume' } })
  })

  it('T2.10 done: time, sets, volume and new bests, See workout', () => {
    const done = workout('d', TODAY, ['push'], { name: 'Push A', end: at(TODAY, 10) + 52 * 60000, prs: ['0025', '0043'] })
    const card = cardOf(S({ workouts: [done] }), TODAY, TODAY)
    expect(card).toMatchObject({ kind: 'done', eyebrow: 'Workout done', title: 'Push A', sub: '52 min · 3 sets · 1,440 kg · 2 new bests' })
    expect(card.primary).toMatchObject({ intent: 'see-workout', label: 'See workout', workouts: [done] })
    expect(card.thumbs).toEqual(done.entries.map(() => expect.stringContaining('.webp')))
    expect(finishedLine({ entries: [], prs: [] }, 'kg')).toBeNull()
  })

  it('T2.11 rest: Recover, the next session with its day, Train anyway and See that day', () => {
    const card = cardOf(S(), '2026-10-17', '2026-10-17')
    expect(card).toMatchObject({ kind: 'rest', eyebrow: 'Rest day', title: 'Recover', sub: 'Next: Push A, ' + fmtDate('2026-10-18', true) })
    expect(card.primary.intent).toBe('train-anyway')
    expect(card.secondary).toEqual([{ intent: 'see-day', label: 'See Sunday', iso: '2026-10-18' }])
  })

  it('T2.3 a planned day this week: "Mon 19 Oct · planned", its muscles, Change this day and See routine, no Start', () => {
    const card = cardOf(S(), '2026-10-19', TODAY)
    expect(card).toMatchObject({ kind: 'upcoming', title: 'Legs', chip: null, primary: null, eyebrow: fmtDate('2026-10-19', true) + ' · planned' })
    expect(card.sub).not.toMatch(/read-only/)
    expect(card.sub).toMatch(/1 exercise/)
    expect(card.exercises).toEqual([expect.objectContaining({ id: '0025', line: expect.stringContaining('3 × 8'), image: expect.stringContaining('.webp') })])
    expect(card.secondary).toEqual([{ intent: 'change-day', label: 'Change this day', iso: '2026-10-19' }, { intent: 'see-routine', label: 'See routine', id: 'legs' }])
  })

  it('T2.14 a later week: the same, with Edit routine; a day with nothing planned is free', () => {
    const card = cardOf(S(), '2026-10-25', TODAY)
    expect(card).toMatchObject({ kind: 'future', title: 'Push A', chip: 'Planned', primary: null, eyebrow: fmtDate('2026-10-25', true) })
    expect(card.sub).toMatch(/read-only until the day$/)
    expect(card.secondary[1]).toEqual({ intent: 'see-routine', label: 'Edit routine', id: 'push' })
    expect(cardOf(S(), '2026-10-20', TODAY)).toMatchObject({ kind: 'free', title: 'Rest day', primary: null, secondary: [{ intent: 'change-day' }] })
  })

  it('a past day selects in place (conflict 2): logged gives See workout, missed Log this workout with its routines', () => {
    const logged = cardOf(S(), '2026-10-14', TODAY)
    expect(logged).toMatchObject({ kind: 'past-logged', eyebrow: fmtDate('2026-10-14', true), title: 'Pull A', primary: { intent: 'see-workout' } })
    const missed = cardOf(S(), '2026-10-16', TODAY)
    expect(missed).toMatchObject({ kind: 'past-missed', title: 'Legs', sub: 'Planned, not logged' })
    expect(missed.primary).toEqual({ intent: 'log-workout', label: 'Log this workout', iso: '2026-10-16', routineIds: ['legs'] })
    expect(intents(missed.menu)).toEqual(['change-day', 'add-note'])
    expect(cardOf(S(), '2026-10-17', TODAY)).toMatchObject({ kind: 'past-rest', primary: { intent: 'log-workout', label: 'Log workout', iso: '2026-10-17' } })
  })
})

describe('routines', () => {
  it('those in the Plan first with their days, the rest after, Freestyle last', () => {
    const rows = routineRows(S(), TODAY)
    expect(rows.map(r => r.name)).toEqual(['Push A', 'Pull A', 'Legs', 'Arms', 'Freestyle'])
    expect(rows[0]).toMatchObject({ sub: '2 exercises · Sun', inPlan: true, today: true })
    expect(rows[2].sub).toBe('1 exercise · Mon, Fri')
    expect(rows[3]).toMatchObject({ sub: '1 exercise', inPlan: false })
    expect(rows[4]).toMatchObject({ freestyle: true, sub: 'Pick exercises as you go', stills: [] })
    expect(rows[0].stills).toHaveLength(2)
    expect(rows[0].stills.every(id => typeof id === 'string' && id)).toBe(true)
  })

  it('in rotation mode a routine has no weekday to show', () => {
    const state = S({ week: {}, queue: { ids: ['legs', 'push'], since: 0, startsOn: '2026-10-01', rotationId: 'r' }, rotation: { id: 'r', sequence: ['legs', 'push'] } })
    const rows = routineRows(state, TODAY)
    expect(rows.map(r => r.name)).toEqual(['Push A', 'Legs', 'Pull A', 'Arms', 'Freestyle'])
    expect(rows[0].sub).toBe('2 exercises')
  })
})

describe('muscles this week', () => {
  it('BodyMap levels from the sets ticked this week, and the parts not trained yet', () => {
    const m = musclesThisWeekOf(S(), TODAY, at(TODAY, 9))
    expect(m.title).toBe('Week of ' + fmtDate('2026-10-12'))
    expect(m.levels.chest).toBe(4)
    expect(m.levels.quadriceps).toBe(0)
    expect(m.note).toMatch(/Legs not trained yet$/)
  })

  it('counts a session in progress, and says when nothing is trained yet', () => {
    expect(musclesThisWeekOf(S({ workouts: [] }), TODAY).note).toBe('Nothing trained yet this week')
    const active = { name: 'Push A', start: at(TODAY, 8), entries: [bench()] }
    expect(musclesThisWeekOf(S({ workouts: [], active }), TODAY).levels.chest).toBe(4)
  })
})

describe('Your training', () => {
  it('History, Training load, Ready-made plans, Gym setup, and Check in with Coach off', () => {
    const rows = moreOf(S({ equipProfiles: [{ id: 'g', name: 'Home gym', equipment: [] }] }), { coach: false })
    expect(rows.map(r => r.key)).toEqual(['history', 'load', 'plans', 'gym', 'checkin'])
    expect(rows[0]).toMatchObject({ to: '/train/history', sub: '1 workout · last: ' + fmtDate('2026-10-14', true) })
    expect(rows[1].to).toBe('/progress/load')
    expect(rows[2]).toMatchObject({ action: 'plans', sub: 'Full Body, Push / Pull / Legs, Upper / Lower, 5×5' })
    expect(rows[3]).toMatchObject({ to: '/me/equipment', sub: 'Home gym' })
    expect(rows[4]).toMatchObject({ to: '/train/checkin', title: 'Gym card' })
  })

  it('Coach on: its row (with this week’s suggestions when known) and no Check in; check-in off hides it', () => {
    expect(moreOf(S(), { coach: true, suggestions: 3 }).map(r => [r.key, r.sub])).toContainEqual(['coach', '3 suggestions this week'])
    expect(moreOf(S(), { coach: true }).map(r => r.key)).not.toContain('checkin')
    expect(moreOf(S({ checkIn: false }), { coach: false }).map(r => r.key)).not.toContain('checkin')
    expect(moreOf(S({ workouts: [] }), { coach: false })[0].sub).toBe('Nothing logged yet')
  })
})

describe('profile', () => {
  it('T2.9 off with no routines, plan or workouts; on otherwise', () => {
    expect(profileOf(S({ routines: [], week: {}, workouts: [] }))).toEqual({ kind: 'off', activities: [] })
    expect(profileOf(S())).toEqual({ kind: 'on' })
    expect(profileOf(S({ routines: [], week: {} }))).toEqual({ kind: 'on' })
  })
})

describe('the missed day', () => {
  it('T2.8 names the day and what Move would do; Coach only when it is on', () => {
    const banner = missedOf(S(), TODAY, { coach: true })
    expect(banner).toMatchObject({ iso: '2026-10-16', name: 'Legs', moveLabel: 'Move to today', skipLabel: 'Skip it' })
    expect(banner.title).toBe('You missed Legs on ' + fmtDate('2026-10-16', true))
    expect(banner.body).toBe(`Coach suggests doing it today; Push A would move to ${fmtDate('2026-10-20', true)}. Nothing changes until you choose.`)
    expect(missedOf(S(), TODAY, { coach: false }).body).toMatch(/^You can do it today; Push A would move/)
    expect(missedOf(S({ week: { 5: ['legs'] } }), TODAY, { coach: false }).body).toBe('You can do it today. Nothing changes until you choose.')
  })

  it('once per missed day: none after Move or Skip', () => {
    const s = S()
    skipMissed(s, '2026-10-16', 1)
    expect(missedOf(s, TODAY, { coach: true })).toBeNull()
  })

  it('T2.12 and T2.13 toasts', () => {
    const before = S()
    const s = clone(before)
    const moved = moveToToday(s, '2026-10-16', TODAY, 1)
    expect(movedText(before, moved)).toBe('Moved Legs to today. Push A is now ' + fmtDate('2026-10-20', true))
    expect(skippedText(before, { iso: '2026-10-16', ids: ['legs'] }, TODAY)).toBe(`Skipped Legs on ${fmtDate('2026-10-16', true)}. Push A stays today`)
    expect(movedText(before, { id: 'legs', displaced: null })).toBe('Moved Legs to today')
  })

  it('a combined missed day: the body and the toast name the routine Move carries, not a no-op one', () => {
    const before = S({ week: { 0: ['push'], 5: ['push', 'legs'] } })
    const banner = missedOf(before, TODAY, { coach: false })
    expect(banner.title).toBe('You missed Push A + Legs on ' + fmtDate('2026-10-16', true))
    expect(banner.body).toBe(`You can do Legs today; Push A would move to ${fmtDate('2026-10-19', true)}. Nothing changes until you choose.`)
    expect(missedOf(before, TODAY, { coach: true }).body).toMatch(/^Coach suggests doing Legs today; Push A would move/)
    const moved = moveToToday(clone(before), '2026-10-16', TODAY, 1)
    expect(movedText(before, moved)).toBe('Moved Legs to today. Push A is now ' + fmtDate('2026-10-19', true))
  })

  it('no banner while a workout runs; with today already logged, Move moves nothing out', () => {
    expect(missedOf(S({ active: { name: 'Push A', start: 1, routineIds: ['push'], entries: [] } }), TODAY, { coach: false })).toBeNull()
    const logged = S({ workouts: [workout('w1', '2026-10-14', ['pull']), workout('w2', TODAY, ['push'], { name: 'Push A' })] })
    expect(missedOf(logged, TODAY, { coach: false }).body).toBe('You can do it today. Nothing changes until you choose.')
  })
})
