import { useLayoutEffect } from 'react'
import { EXDB } from '../../../lib/exercises-data.js'
import { isoOf, todayISO } from '../../../lib/format.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import WorkoutScreen from '../../../views/workout/WorkoutScreen.jsx'
import { registerScreens } from '../registry.js'

// Workout core-M3, the running workout (boards W1.0 to W1.44). Every state is the real
// WorkoutScreen over a mocked S.active: the boards' Push A (warm-up: glute bridge, dead bug, band
// pull-apart; bench press, dumbbell shoulder press, incline dumbbell press, cable fly, lateral raise
// + pushdown as A1/A2; cool-down: kneeling hip flexor stretch, couch stretch, pec foam roll) with
// three past Push A sessions behind it. A rest is a mocked useUI timer; a tap in `play` runs
// against the gallery's in-memory store (mock-env.js installMocks), and the rest or hold it starts
// is stopped when the state is left.

const NOW = Date.now()
const daysAgo = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() - n); return d }
const rows = (w, r, n) => Array.from({ length: n }, () => ({ w, r, done: false }))
const lift = (id, w, r, n, target = {}, extra = {}) => ({ id, target: { mode: 'reps', sets: n, reps: r, weight: w, ...target }, sets: rows(w, r, n), ...extra })
const hold = (id, sec, rounds, sides, extra = {}) => ({
  id, target: { mode: 'time', sec, sets: rounds, ...(sides ? { side: true } : {}) },
  sets: Array.from({ length: rounds }, () => (sides ? [{ sec, w: 0, side: 'L', done: false }, { sec, w: 0, side: 'R', done: false }] : [{ sec, w: 0, done: false }])).flat(),
  part: 'cooldown', ...extra,
})
const warm = (id, r) => lift(id, 0, r, 2, { bodyweight: true }, { part: 'warmup' })

const PUSH = () => [
  warm('3013', 15), warm('0276', 10), warm('1503', 15),
  lift('0025', 80, 8, 3, { restSec: 120 }),
  lift('0426', 24, 8, 3),
  lift('0314', 26, 10, 3),
  lift('0188', 17.5, 12, 3, { restSec: 90 }),
  lift('0334', 8, 15, 3, { restSec: 60 }, { sg: 'A' }),
  lift('0201', 30, 12, 3, { restSec: 60 }, { sg: 'A' }),
  hold('1053', 30, 2, true), hold('4557', 45, 2, true), hold('2948', 60, 1, false),
]

// Three past Push A sessions: "last 3 times", the best and the e1RM below the fold.
const past = (id, ago, scale) => {
  const day = daysAgo(ago)
  day.setHours(18, 0, 0, 0)
  const entries = PUSH().filter(e => !e.part).map(e => ({ ...e, sets: e.sets.map(s => ({ ...s, w: s.w * scale, done: true })) }))
  return { id, d: isoOf(daysAgo(ago)), start: day.getTime(), end: day.getTime() + 52 * 60000, name: 'Push A', routineIds: [], prs: [], entries }
}
const HISTORY = [past('p-1', 13, 0.95), past('p-2', 9, 0.95), past('p-3', 6, 1)]

/** Push A with `done` sets ticked per entry index ({ 3: 1 } ticks bench set 1), on `cur`. */
const pushA = ({ cur = 3, done = {}, id = 'gal-push', over = {}, list = PUSH() } = {}) => {
  const entries = list.map((e, k) => ({
    ...e, sets: e.sets.map((s, i) => (i < (done[k] ?? 0) ? { ...s, done: true, at: NOW - (40 - k) * 60000 } : s)),
  }))
  return {
    workouts: HISTORY, routines: [], unit: 'kg', restSec: 120, autoNext: true, showPlates: true, effort: 'none', sound: false,
    active: { id, d: todayISO(), start: NOW - 24 * 60000, routineIds: ['push'], name: 'Push A', bw: null, cur, entries, ...over },
  }
}
const WARM_DONE = { 0: 2, 1: 2, 2: 2 }
const MAIN_DONE = { ...WARM_DONE, 3: 3, 4: 3, 5: 3 }
const ALL_DONE = Object.fromEntries(PUSH().map((e, k) => [k, e.sets.length]))

// 20 exercises (W1.44): three warm-ups, fourteen lifts, three stretches.
const pick = (bp, eq, n) => EXDB.filter(e => e.bp === bp && e.eq === eq).slice(0, n).map(e => e.id)
const LONG = () => [
  warm('3013', 15), warm('0276', 10), warm('1503', 15),
  ...[...pick('upper legs', 'barbell', 6), ...pick('upper legs', 'leverage machine', 4), ...pick('lower legs', 'body weight', 2), ...pick('waist', 'body weight', 2)]
    .map(id => lift(id, 60, 10, 3, { restSec: 90 })),
  hold('1053', 30, 2, true), hold('4557', 45, 2, true), hold('2948', 60, 1, false),
]

// A rest, a stopped sync or a hold for as long as the state shows; put back when it is left.
function Live({ timer = null, offline = null, children }) {
  useLayoutEffect(() => {
    const own = { sync: useStore.getState().sync, unsyncedChanges: useStore.getState().unsyncedChanges }
    if (offline) useStore.setState({ sync: { ...own.sync, offline: true }, unsyncedChanges: () => ({ count: offline.waiting }) })
    if (timer) useUI.setState({ timer: { endsAt: Date.now() + timer.left * 1000, forIdx: null, ...timer } })
    return () => {
      useUI.getState().stopRest()
      useUI.getState().stopWork()
      if (offline) useStore.setState(own)
    }
  }, [])
  return children
}
const screen = props => () => <Live {...props}><WorkoutScreen /></Live>
// A set ticked or a hold started by a tap on the screen, then the rest it started left as it is.
const tap = text => async t => { await t.click(text); await t.wait(60) }
const select = cur => async t => { await t.wait(40); useStore.getState().update(s => { s.active.cur = cur }); await t.wait(60) }

registerScreens('Workout', [
  { id: 'W1.0', title: 'Push A, running', note: 'Cable fly, set 2 of 3: the hero, set 1, the steppers, Done set, set 3 planned; below, the last 3 times and Trained so far.',
    render: screen(), mock: { S: pushA({ cur: 6, done: { ...MAIN_DONE, 6: 1 } }) } },
  { id: 'W1.2', title: 'Set 1, live', note: 'The last warm-up set ticked: bench press takes over, with the "Warm-up done" bar toast and its Back.',
    render: screen(), mock: { S: pushA({ cur: 2, done: { 0: 2, 1: 2, 2: 1 }, id: 'gal-w12' }) },
    play: async t => { await t.click('Done · last set'); useUI.getState().stopRest(); await t.wait(60) } },
  { id: 'W1.6', title: 'Set 2, live', note: 'Bench press with set 1 done, the plate line, and the history below.',
    render: screen(), mock: { S: pushA({ done: { ...WARM_DONE, 3: 1 } }) } },
  { id: 'W1.35', title: 'Last set', note: 'Set 3 of 3: Done · last set.',
    render: screen(), mock: { S: pushA({ done: { ...WARM_DONE, 3: 2 } }) } },
  { id: 'W1.32', title: 'Warm-up, live', note: 'Glute bridge, first time, body weight: Tap to add weight, New to you, the first-time block.',
    render: screen(), mock: { S: pushA({ cur: 0, done: { 0: 1 } }) } },
  { id: 'W1.3', title: 'Rest', note: 'The rest ring in the footer, and −15 s, +15 s, pause and Skip.',
    render: screen({ timer: { left: 102, total: 120, forIdx: 3 } }), mock: { S: pushA({ done: { ...WARM_DONE, 3: 1 } }) } },
  { id: 'W1.5', title: 'Rest over', note: 'Ready, +15 s and Go · set 2.',
    render: screen({ timer: { left: 0, total: 120, forIdx: 3, ready: true } }), mock: { S: pushA({ done: { ...WARM_DONE, 3: 1 } }) } },
  { id: 'W1.7', title: 'Next exercise takes over', note: 'Bench press set 3 ticked: the shoulder press takes over with its rest running, and the bar toast with Back.',
    render: screen(), mock: { S: pushA({ done: { ...WARM_DONE, 3: 2 }, id: 'gal-w17' }) }, play: tap('Done · last set') },
  { id: 'W1.8', title: 'A new best', note: 'Cable fly set 2 at 20 kg, above every past session: NEW BEST on the row and the toast with Trend.',
    render: screen(), mock: { S: pushA({ cur: 6, done: { ...MAIN_DONE, 6: 1 }, id: 'gal-w18', list: PUSH().map((e, k) => (k === 6 ? { ...e, sets: e.sets.map((s, i) => (i === 1 ? { ...s, w: 20 } : s)) } : e)) }) },
    play: tap('Done set') },
  { id: 'W1.36', title: 'Previous exercise', note: '‹ from cable fly: the incline press, done, with its sets to fix and "Back to Cable fly · set 2".',
    render: screen(), mock: { S: pushA({ cur: 6, done: { ...MAIN_DONE, 6: 1 } }) }, play: select(5) },
  { id: 'W1.24', title: 'Superset A1', note: 'Lateral raise: the A1/A2 switch, the note, Done · go to A2.',
    render: screen(), mock: { S: pushA({ cur: 7, done: { ...MAIN_DONE, 6: 3 } }) } },
  { id: 'W1.38', title: 'Superset A2', note: 'Pushdown after A1: Done · rest 1:00 after both.',
    render: screen(), mock: { S: pushA({ cur: 8, done: { ...MAIN_DONE, 6: 3, 7: 1 } }) } },
  { id: 'W1.39', title: 'Round rest', note: 'Round 1 done: A1 round 2 of 3, the round rest in the footer.',
    render: screen({ timer: { left: 48, total: 60, forIdx: 8 } }), mock: { S: pushA({ cur: 7, done: { ...MAIN_DONE, 6: 3, 7: 1, 8: 1 } }) } },
  { id: 'W1.41', title: 'Timed hold, left', note: 'Kneeling hip flexor stretch: the ring, Pause, Switch side, and what comes next.',
    render: screen(), mock: { S: pushA({ cur: 9, done: { ...MAIN_DONE, 6: 3, 7: 3, 8: 3 }, over: { offered: { cooldown: true } } }) }, play: tap('Start · 0:30') },
  { id: 'W1.42', title: 'Timed hold, right', note: 'The left side done: the right side held, with Done.',
    render: screen(), mock: { S: pushA({ cur: 9, done: { ...MAIN_DONE, 6: 3, 7: 3, 8: 3, 9: 1 }, over: { offered: { cooldown: true } } }) }, play: tap('Start · 0:30') },
  { id: 'W1.9', title: 'Every set done', note: 'Finish workout, Add another exercise, the list and Trained today.',
    render: screen(), mock: { S: pushA({ cur: 11, done: ALL_DONE }) } },
  { id: 'W1.28', title: 'Editing a saved workout', note: '× with the save prompt, "Editing · …", Save, no timers, Set 1 · editing and Save changes.',
    render: screen(), mock: { S: pushA({ done: ALL_DONE, over: { editingWorkoutId: 'p-3', d: isoOf(daysAgo(6)) } }) } },
  { id: 'W1.28b', title: 'Logging a past workout', note: 'The same chrome with the date line under the title and no timers.',
    render: screen(), mock: { S: pushA({ done: { ...WARM_DONE, 3: 1 }, over: { backfill: {}, d: isoOf(daysAgo(2)) } }) } },
  { id: 'W1.29', title: 'Offline', note: '"Offline · 6 waiting" under the title.',
    render: screen({ offline: { waiting: 6 } }), mock: { S: pushA({ cur: 6, done: { ...MAIN_DONE, 6: 1 } }) } },
  { id: 'W1.29b', title: 'Offline, count unknown', note: 'Only "Offline" when the device cannot say how many changes wait.',
    render: screen({ offline: { waiting: null } }), mock: { S: pushA({ cur: 6, done: { ...MAIN_DONE, 6: 1 } }) } },
  { id: 'W1.30', title: 'Empty workout', note: 'Pick as you go: Add exercise, Bring a routine in, and Discard in the top bar.',
    render: screen(), mock: { S: pushA({ cur: 0, list: [], over: { name: 'Empty workout', routineIds: [] } }) } },
  { id: 'W1.44', title: '20 exercises', note: 'Legs and core: only the current phase is drawn open.',
    render: screen(), mock: { S: pushA({ cur: 9, list: LONG(), done: { ...WARM_DONE, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 1 }, over: { name: 'Legs and core' } }) } },
])
