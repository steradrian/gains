// @vitest-environment happy-dom
// The workout's start and finish drawers (finish-M2): Finish W1.10 / W1.11 from finishFacts, the
// discard W1.46 inside it or on its own, then W1.26's toast and Undo; the warm-up offer W1.31;
// the cool-down offer W1.40 once, its line from the data only, Skip and finish going on to Finish
// in the same drawer; the workout left open W1.27; the editor of a saved workout saving at once.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { setNav } from '../../lib/nav.js'
import { popToRoot } from '../../lib/use-tab-nav.js'
import { finishFacts } from '../../lib/workout-finish.js'
import { editCompletedSession } from '../../lib/session-edit.js'
import { cooldownOfferSheet, discardSheet, finishSheet, staleWorkoutSheet, takeReopen, warmupOfferSheet } from './finish-drawers.js'

vi.mock('../../lib/use-tab-nav.js', async importOriginal => ({ ...(await importOriginal()), popToRoot: vi.fn() }))

const BENCH = '0025', FLY = '0227', SITUP = '0001', SQUAT = '0043'
const NOW = new Date('2026-10-18T19:30:00').getTime()
const MIN = 60000, HOUR = 60 * MIN
const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const mounted = []
let navigated

const pushA = {
  id: 'push', name: 'Push A', ex: [
    { id: SITUP, sets: 2, reps: 15, part: 'warmup' },
    { id: BENCH, sets: 3, reps: 8, weight: 80 },
    { id: SQUAT, mode: 'time', sets: 2, sec: 30, side: true, part: 'cooldown' },
  ],
}
const row = (w, r, done, at) => ({ w, r, done, ...(done ? { at } : {}) })
const reps = (id, sets, part) => ({ id, target: { mode: 'reps', sets: sets.length, reps: 8, weight: 80 }, sets, ...(part ? { part } : {}) })
const hold = (id, { sets = 2, sec = 30, side = false } = {}) => ({
  id, part: 'cooldown', target: { mode: 'time', sets, ...(sec ? { sec } : {}), ...(side ? { side: true } : {}) },
  sets: Array.from({ length: sets }, () => ({ w: 0, r: 0, sec: sec || 45, done: false })),
})

function install(active, extra = {}) {
  const st = clone(DEF)
  Object.assign(st, { routines: [clone(pushA)], workouts: [], weighIn: false, bodyweight: [], active }, extra)
  useStore.setState({ S: st, user: null })
}
const running = (entries, over = {}) => ({ id: 'a1', d: '2026-10-18', start: NOW - 24 * MIN, routineIds: ['push'], name: 'Push A', bw: null, cur: 0, entries, ...over })

function mountTop() {
  const sheet = useUI.getState().sheets.at(-1)
  expect(sheet, 'an open drawer').toBeTruthy()
  expect(sheet.variant).toBe('ds')
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const title = host => host.querySelector('.g-bs-head h2').textContent
const buttons = host => [...host.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean)
const tap = (host, text) => {
  const target = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
  expect(target, text).toBeTruthy()
  act(() => { target.click() })
}
const sheets = () => useUI.getState().sheets

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  navigated = []
  setNav(to => { navigated.push(to) })
  vi.mocked(popToRoot).mockClear()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null, timer: null, work: null })
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  vi.useRealTimers()
})

describe('W1.10 / W1.11 Finish', () => {
  it('every set done: the title, the three tiles, the bests line and Finish and save', () => {
    // A heavier bench than the history's best: a new best.
    install(running([reps(BENCH, [row(85, 8, true, NOW - 10 * MIN), row(85, 8, true, NOW - 5 * MIN)])]), {
      workouts: [{ id: 'old', d: '2026-10-10', start: NOW - 9 * 24 * HOUR, end: NOW - 9 * 24 * HOUR + HOUR, name: 'Push A', routineIds: ['push'], prs: [],
        entries: [{ id: BENCH, target: { mode: 'reps', reps: 8, weight: 80 }, sets: [{ w: 80, r: 8, done: true }] }] }],
    })
    const facts = finishFacts(S(), S().active, NOW)
    expect(facts.kind).toBe('done')
    finishSheet()
    const host = mountTop()
    expect(title(host)).toBe('Finish Push A?')
    expect([...host.querySelectorAll('.g-stat')].map(s => [s.children[0].textContent, s.children[1].textContent]))
      .toEqual([['Time', '24:00'], ['Sets', '2'], ['Volume', facts.volumeText]])
    expect(facts.bestsCount).toBeTruthy()
    expect(host.querySelector('.g-tag-positive').textContent).toBe(facts.bestsCount)
    expect(host.textContent).toContain(facts.bestsLine)
    expect(buttons(host)).toEqual(['Finish and save', 'Keep going', 'Discard workout'])
  })

  it('Finish and save saves and replaces the workout with its summary, holding Reopen', () => {
    install(running([reps(BENCH, [row(80, 8, true, NOW - 5 * MIN)])]))
    finishSheet()
    tap(mountTop(), 'Finish and save')
    expect(S().active).toBeNull()
    expect(S().workouts).toHaveLength(1)
    const id = S().workouts[0].id
    expect(navigated).toEqual(['/train/workout/summary/' + encodeURIComponent(id)])
    expect(sheets()).toHaveLength(0)
    expect(takeReopen(id)).toBeTruthy()
  })

  it('sets left: Finish early?, what is left from the facts, Finish anyway', () => {
    install(running([reps(BENCH, [row(80, 8, true, NOW - 5 * MIN), row(80, 8, false)]), reps(FLY, [row(17.5, 12, false)])]))
    const facts = finishFacts(S(), S().active, NOW)
    expect(facts.kind).toBe('early')
    finishSheet()
    const host = mountTop()
    expect(title(host)).toBe('Finish early?')
    expect(host.querySelector('.g-confirm p b').textContent).toBe(facts.headline)
    expect(host.textContent).toContain(facts.sentence)
    expect(host.querySelector('.g-tag-positive')).toBeNull()
    expect(buttons(host)).toEqual(['Finish anyway', 'Keep going', 'Discard workout'])
  })

  it('nothing ticked: the message, no tiles, Finish anyway', () => {
    install(running([reps(BENCH, [row(80, 8, false)])]))
    finishSheet()
    const host = mountTop()
    expect(title(host)).toBe('Nothing logged yet')
    expect(host.textContent).toContain('You haven’t checked off any sets. Finish anyway?')
    expect(host.querySelector('.g-stat')).toBeNull()
    expect(buttons(host)).toEqual(['Finish anyway', 'Keep going', 'Discard workout'])
  })

  it('Keep going closes it and the session runs on', () => {
    install(running([reps(BENCH, [row(80, 8, true, NOW - 5 * MIN)])]))
    finishSheet()
    tap(mountTop(), 'Keep going')
    expect(sheets()).toHaveLength(0)
    expect(S().active.id).toBe('a1')
    expect(navigated).toEqual([])
  })

  it('the editor of a saved workout saves at once: no drawer', () => {
    install(null, { routines: [], workouts: [{ id: 'w-old', d: '2026-09-10', start: 1, end: 2, name: 'Push', prs: [],
      entries: [{ id: BENCH, target: { mode: 'reps', reps: 8 }, sets: [{ w: 45, r: 8, done: true }] }] }] })
    useStore.getState().update(st => { editCompletedSession(st, 'w-old'); st.active.entries[0].sets[0].w = 50 })
    finishSheet()
    expect(sheets()).toHaveLength(0)
    expect(S().active).toBeNull()
    expect(S().workouts[0].entries[0].sets[0].w).toBe(50)
    expect(useUI.getState().toastMsg).toBe('Workout updated')
  })

  it('nothing running: nothing opens', () => {
    install(null)
    finishSheet()
    discardSheet()
    expect(sheets()).toHaveLength(0)
  })
})

describe('W1.46 the discard, then W1.26 Undo on Today', () => {
  const logged = () => running([
    reps(SITUP, [row(0, 15, true, NOW - 20 * MIN)], 'warmup'),
    reps(BENCH, [row(80, 8, true, NOW - 10 * MIN), row(80, 8, true, NOW - 5 * MIN), row(80, 8, false)]),
  ])

  it('from Finish, Discard workout is a step inside the same drawer: what goes, then Discard / Keep going', () => {
    install(logged())
    finishSheet()
    const host = mountTop()
    tap(host, 'Discard workout')
    expect(sheets()).toHaveLength(1)
    expect(title(host)).toBe('Discard 3 sets?')
    expect(host.querySelector('.g-confirm > p').textContent).toBe('Push A closes and these go:')
    expect([...host.querySelectorAll('.g-confirm li')].map(li => li.textContent))
      .toEqual(['3 logged sets, warm-up included', '24:00 on the clock', 'Nothing reaches History, bests or the muscle map'])
    expect(host.querySelector('.g-confirm-note').textContent).toBe('You can still undo for 8 s on Today.')
    expect(buttons(host)).toEqual(['Discard workout', 'Keep going'])
  })

  it('Discard workout clears the session, lands on Today and offers Undo for 8 s; Undo goes back into it', () => {
    install(logged())
    discardSheet()
    const host = mountTop()
    expect(title(host)).toBe('Discard 3 sets?')
    tap(host, 'Discard workout')
    expect(S().active).toBeNull()
    expect(S().workouts).toHaveLength(0)
    expect(sheets()).toHaveLength(0)
    expect(popToRoot).toHaveBeenCalledWith('home')
    expect(useUI.getState().toastMsg).toBe('Discarded Push A. The sets go unless you undo.')
    expect(useUI.getState().toastAction).toMatchObject({ label: 'Undo', ms: 8000 })
    act(() => useUI.getState().runToastAction())
    expect(S().active.id).toBe('a1')
    expect(S().active.entries[1].sets.filter(s => s.done)).toHaveLength(2)
    expect(navigated).toEqual(['/train/workout'])
  })

  it('Keep going on the confirm closes it and keeps the session', () => {
    install(logged())
    discardSheet()
    tap(mountTop(), 'Keep going')
    expect(sheets()).toHaveLength(0)
    expect(S().active.id).toBe('a1')
    expect(popToRoot).not.toHaveBeenCalled()
  })

  it('without a warm-up set the count does not claim one', () => {
    install(running([reps(BENCH, [row(80, 8, true, NOW - 5 * MIN)])]))
    discardSheet()
    expect([...mountTop().querySelectorAll('.g-confirm li')][0].textContent).toBe('1 logged set')
  })

  it('nothing logged skips the confirm: discarded at once, still with Undo', () => {
    install(running([reps(BENCH, [row(80, 8, false)])]))
    discardSheet()
    expect(sheets()).toHaveLength(0)
    expect(S().active).toBeNull()
    expect(popToRoot).toHaveBeenCalledWith('home')
    expect(useUI.getState().toastAction.label).toBe('Undo')
  })

  it('from Finish with nothing logged, Discard workout goes at once too', () => {
    install(running([reps(BENCH, [row(80, 8, false)])]))
    finishSheet()
    tap(mountTop(), 'Discard workout')
    expect(S().active).toBeNull()
    expect(sheets()).toHaveLength(0)
    expect(useUI.getState().toastMsg).toBe('Discarded Push A. The sets go unless you undo.')
  })
})

describe('W1.31 Start with your warm-up', () => {
  it('over Ready: the warm-up group, its rows without the kind, Start / Skip', () => {
    install(null)
    warmupOfferSheet(['push'], null)
    const host = mountTop()
    expect(title(host)).toBe('Start with your warm-up')
    expect(host.querySelector('.g-offer-tag').textContent).toBe('Warm-up · 1')
    expect(host.querySelector('.g-offer-warm')).not.toBeNull()
    expect(host.querySelector('.g-offer > p').textContent).toBe('Logged like any exercise: sets and reps count in your history and muscle map, never for new bests.')
    expect([...host.querySelectorAll('.g-offer-t small')].map(s => s.textContent)).toEqual(['2 × 15'])
    expect(buttons(host).slice(-2)).toEqual(['Start warm-up', 'Skip warm-up'])
    expect(S().active).toBeNull()
  })

  it('Start warm-up starts the session at its warm-up, with the weigh-in Ready asked', () => {
    install(null)
    warmupOfferSheet(['push'], 81.5)
    tap(mountTop(), 'Start warm-up')
    expect(sheets()).toHaveLength(0)
    expect(S().active).toMatchObject({ routineIds: ['push'], cur: 0, bw: 81.5 })
    expect(S().active.skipped).toBeUndefined()
    expect(navigated).toEqual(['/train/workout'])
  })

  it('Skip warm-up starts at the first working exercise, the warm-up skipped and not offered again', () => {
    install(null)
    warmupOfferSheet(['push'], null)
    tap(mountTop(), 'Skip warm-up')
    expect(S().active.cur).toBe(1)
    expect(S().active.entries[1].id).toBe(BENCH)
    expect(S().active).toMatchObject({ skipped: { warmup: true }, offered: { warmup: true } })
  })

  it('a session that already runs is not replaced: it is opened instead', () => {
    install(null)
    warmupOfferSheet(['push'], null)
    const host = mountTop()
    useStore.getState().update(st => { st.active = running([]) })
    tap(host, 'Start warm-up')
    expect(S().active.id).toBe('a1')
    expect(navigated).toEqual(['/train/workout'])
  })

  it('without a warm-up there is no offer: the session starts', () => {
    install(null, { routines: [{ id: 'push', name: 'Push A', ex: [{ id: BENCH, sets: 3, reps: 8, weight: 80 }] }] })
    warmupOfferSheet(['push'], null)
    expect(sheets()).toHaveLength(0)
    expect(S().active.routineIds).toEqual(['push'])
  })
})

describe('W1.40 Cool-down', () => {
  const doneMain = () => reps(BENCH, [row(80, 8, true, NOW - 5 * MIN)])

  it('opens once per session and marks it offered; nothing without a cool-down', () => {
    install(running([doneMain(), hold(SQUAT, { side: true })]))
    cooldownOfferSheet()
    cooldownOfferSheet()
    expect(sheets()).toHaveLength(1)
    expect(S().active.offered).toEqual({ cooldown: true })

    install(running([doneMain()]))
    useUI.setState({ sheets: [] })
    cooldownOfferSheet()
    expect(sheets()).toHaveLength(0)
    expect(S().active.offered).toBeUndefined()

    install(running([doneMain(), hold(SQUAT)], { offered: { cooldown: true } }))
    cooldownOfferSheet()
    expect(sheets()).toHaveLength(0)
  })

  it('timed holds with planned seconds: the count, the minutes from seconds × sets × sides, the hold sentence', () => {
    // 2 × 30 s each side + 1 × 60 s = 180 s.
    install(running([doneMain(), hold(SQUAT, { side: true }), hold(FLY, { sets: 1, sec: 60 })]))
    cooldownOfferSheet()
    const host = mountTop()
    expect(title(host)).toBe('Cool-down')
    expect(host.querySelector('.g-offer-tag').textContent).toBe('Cool-down · 2')
    expect(host.querySelector('.g-offer-cool')).not.toBeNull()
    expect(host.querySelector('.g-offer > p').textContent).toBe('2 stretches, about 3 min. Each one is a timed hold; the other side starts on its own.')
    expect([...host.querySelectorAll('.g-offer-t small')].map(s => s.textContent)).toEqual(['2 × 30 s each side', '1 min'])
    expect(buttons(host).slice(-2)).toEqual(['Start cool-down', 'Skip and finish'])
  })

  it('no planned seconds: no minutes; no side: no other-side clause', () => {
    install(running([doneMain(), hold(SQUAT, { sec: 0 })]))
    cooldownOfferSheet()
    expect(mountTop().querySelector('.g-offer > p').textContent).toBe('1 stretch. Each one is a timed hold.')
  })

  it('not every entry a hold: exercises, and no hold sentence', () => {
    install(running([doneMain(), hold(SQUAT, { side: true }), reps(FLY, [row(10, 12, false)], 'cooldown')]))
    cooldownOfferSheet()
    expect(mountTop().querySelector('.g-offer > p').textContent).toBe('2 exercises.')
  })

  it('Start cool-down closes it and puts the session on the first cool-down exercise', () => {
    install(running([doneMain(), hold(SQUAT), hold(FLY)]))
    cooldownOfferSheet()
    tap(mountTop(), 'Start cool-down')
    expect(sheets()).toHaveLength(0)
    expect(S().active.cur).toBe(1)
    expect(S().active.skipped).toBeUndefined()
  })

  it('Skip and finish skips the cool-down and shows Finish inside the same drawer', () => {
    install(running([doneMain(), hold(SQUAT)]))
    cooldownOfferSheet()
    const host = mountTop()
    tap(host, 'Skip and finish')
    expect(S().active.skipped).toEqual({ cooldown: true })
    expect(sheets()).toHaveLength(1)
    expect(title(host)).toBe('Finish Push A?')
    expect(buttons(host)).toEqual(['Finish and save', 'Keep going', 'Discard workout'])
    tap(host, 'Discard workout')
    expect(title(host)).toBe('Discard 1 set?')
    expect(sheets()).toHaveLength(1)
  })
})

describe('W1.27 left open', () => {
  const START = NOW - 23 * HOUR
  const LAST = START + 57 * MIN
  const stale = (sets = [row(80, 8, true, START + 50 * MIN), row(80, 8, true, LAST)]) =>
    running([reps(BENCH, sets)], { start: START })
  const at = ms => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  it('the title, the start and the count, the three rows, Save / Continue / Discard and the foot line', () => {
    install(stale())
    staleWorkoutSheet()
    const host = mountTop()
    expect(title(host)).toBe('Push A is still open')
    expect(host.querySelector('.g-confirm > p').textContent)
      .toBe('Started Sat 17 Oct at ' + at(START) + ' and never finished. 2 sets are logged; the clock is still running.')
    expect([...host.querySelectorAll('.g-drow')].map(r => [r.querySelector('b').textContent, r.querySelector('.g-drow-val').textContent]))
      .toEqual([['Logged', '2 sets'], ['Last set', at(LAST)], ['Open for', '23 h']])
    expect(buttons(host)).toEqual(['Save with 2 sets', 'Continue it', 'Discard workout'])
    expect(host.querySelector('.g-confirm-note').textContent).toMatch(/^Saving ends it at the last set, \d\d:\d\d, so the time stays honest\.$/)
  })

  it('Save with N sets saves it ending at the last set and opens its summary, holding Reopen', () => {
    install(stale())
    staleWorkoutSheet()
    tap(mountTop(), 'Save with 2 sets')
    expect(S().active).toBeNull()
    const w = S().workouts[0]
    expect(w.end).toBeLessThan(NOW - 20 * HOUR)
    expect(navigated).toEqual(['/train/workout/summary/' + encodeURIComponent(w.id)])
    expect(takeReopen(w.id)).toBeTruthy()
  })

  it('Continue it opens the running workout', () => {
    install(stale())
    staleWorkoutSheet()
    tap(mountTop(), 'Continue it')
    expect(sheets()).toHaveLength(0)
    expect(S().active.id).toBe('a1')
    expect(navigated).toEqual(['/train/workout'])
  })

  it('Discard workout confirms in the same drawer, then stays on Today with Undo', () => {
    install(stale())
    staleWorkoutSheet()
    const host = mountTop()
    tap(host, 'Discard workout')
    expect(title(host)).toBe('Discard 2 sets?')
    expect(sheets()).toHaveLength(1)
    tap(host, 'Keep going')
    expect(title(host)).toBe('Push A is still open')
    tap(host, 'Discard workout')
    tap(host, 'Discard workout')
    expect(S().active).toBeNull()
    expect(popToRoot).not.toHaveBeenCalled()
    expect(useUI.getState().toastMsg).toBe('Discarded Push A. The sets go unless you undo.')
    act(() => useUI.getState().runToastAction())
    expect(S().active.id).toBe('a1')
    expect(navigated).toEqual([])
  })

  it('nothing ticked: no Save, no foot line, and Discard goes without a confirm', () => {
    install(running([reps(BENCH, [row(80, 8, false)])], { start: START }))
    staleWorkoutSheet()
    const host = mountTop()
    expect(host.textContent).toContain('Nothing is logged; the clock is still running.')
    expect(buttons(host)).toEqual(['Continue it', 'Discard workout'])
    expect(host.querySelector('.g-confirm-note')).toBeNull()
    expect([...host.querySelectorAll('.g-drow b')].map(b => b.textContent)).toEqual(['Logged', 'Open for'])
    tap(host, 'Discard workout')
    expect(S().active).toBeNull()
    expect(useUI.getState().toastAction.label).toBe('Undo')
  })

  it('a fresh session is not left open: nothing opens', () => {
    install(running([reps(BENCH, [row(80, 8, true, NOW - 5 * MIN)])]))
    staleWorkoutSheet()
    expect(sheets()).toHaveLength(0)
  })
})
