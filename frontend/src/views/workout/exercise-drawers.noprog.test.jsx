// @vitest-environment happy-dom
// "Don't count for progression" for one exercise, from its How to drawer (guard-M2a), ported from
// Workout.noprog.test.jsx: the switch, and what the next session is then built from, against the
// real store and progression engine. The old ⋯ menu is the How to drawer; the card's `.noprog`
// marker and its Undo are gone (the switch is the way back); see the it.todo.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { buildCompletedWorkout } from '../../lib/finish-workout.js'
import { nextPrescription } from '../../lib/progression.js'
import { lastEntryFor } from '../../lib/history.js'
import { buildSessionEntries, plannedConfigOf } from '../../lib/session-start.js'
import { EXIDX } from '../../lib/exercises.js'
import { howToSheet } from './drawers.js'
import { applyExerciseSettingsAt, setNoProgAt, swapEntryWithUndo } from './workout-actions.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const BENCH = '0025'
const ROW = '0027'
const LABEL = 'Don’t count for progression'
const routines = [
  { id: 'main', name: 'Main', ex: [{ id: BENCH, sets: 1, reps: 5, weight: 100 }] },
  { id: 'deload', name: 'Deload', excludeFromProgression: true, ex: [{ id: ROW, sets: 1, reps: 8, weight: 40 }] },
]
const history = [{
  id: 'w1', d: '2026-09-20', routineIds: ['main'],
  entries: [{ id: BENCH, rid: 'main', target: { sets: 1, reps: 5, weight: 100 }, sets: [{ w: 100, r: 5, done: true }] }],
}]
const entry = (id, rid, w, extra = {}) => ({ id, rid, target: { sets: 1, reps: 5, weight: w }, sets: [{ w, r: 5, done: false }], ...extra })

function seed(entries, { withRoutines = routines, withHistory = history } = {}) {
  const S = clone(DEF)
  S.routines = clone(withRoutines)
  S.workouts = clone(withHistory)
  S.active = { id: 'noprog-test', d: '2026-09-23', start: Date.now(), routineIds: ['main'], routineId: 'main', name: 'Main', bw: null, cur: 0, entries: clone(entries) }
  useStore.setState({ S, user: null })
}
const A = () => useStore.getState().S.active
const mounted = []
function top() {
  const sheet = useUI.getState().sheets.at(-1)
  expect(sheet).toBeTruthy()
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const switchRow = host => [...host.querySelectorAll('.g-switchrow')].find(r => r.textContent.includes(LABEL))
const tap = el => { expect(el).toBeTruthy(); act(() => el.click()) }
const openSwitch = (idx = 0) => {
  howToSheet(idx)
  const host = top()
  return { host, row: switchRow(host), sw: switchRow(host)?.querySelector('[role="switch"]') }
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], timer: null, work: null, toastMsg: '', toastAction: null })
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) })
  useUI.getState().closeAll()
  useStore.setState({ S: clone(DEF) })
})

describe('don’t count this session for progression', () => {
  it('the switch stamps the entry and says what it covers; a second tap takes it back', () => {
    seed([entry(BENCH, 'main', 80)])
    expect(A().entries[0].noProg).toBeUndefined()

    const { row, sw } = openSwitch()
    expect(row.textContent).toContain('This exercise, this session only')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    tap(sw)

    expect(A().entries[0].noProg).toBe(true)
    // the routine is not touched
    expect(useStore.getState().S.routines.find(r => r.id === 'main').excludeFromProgression).toBeUndefined()
    expect(sw.getAttribute('aria-checked')).toBe('true')

    tap(sw)
    expect(A().entries[0].noProg).toBeUndefined()
  })

  it('shows it is on for an exercise already kept out, and a tap turns it off', () => {
    seed([entry(BENCH, 'main', 80, { noProg: true })])
    const { sw } = openSwitch()
    expect(sw.getAttribute('aria-checked')).toBe('true')
    tap(sw)
    expect(A().entries[0].noProg).toBeUndefined()
  })

  it('only that exercise: the others in the session still count', () => {
    seed([entry(BENCH, 'main', 80), entry(ROW, 'main', 50)])
    tap(openSwitch(0).sw)
    expect(A().entries.map(e => e.noProg === true)).toEqual([true, false])
  })

  it('the saved workout keeps it, and the next session progresses from the last one that counted', () => {
    seed([entry(BENCH, 'main', 80)])
    tap(openSwitch().sw)
    useStore.getState().update(s => { s.active.entries[0].sets[0].done = true })

    const saved = buildCompletedWorkout(A(), { end: Date.now() })
    expect(saved.entries[0].noProg).toBe(true)

    const S = { ...useStore.getState().S, active: null, workouts: [...history, saved] }
    const cfg = routines[0].ex[0]
    const plan = nextPrescription(S, cfg, routines[0])
    // 100 × 5 on the 20th was the last session that counted, not today's 80
    expect(plan.weight).toBe(102.5)
    expect(lastEntryFor(S, BENCH, 'main').d).toBe('2026-09-20')
  })

  // The flag set by hand only stops the session from counting; the rows stay at the
  // prescription. A rebuild that read it as "a deload routine's exercise" put them back at the
  // routine's own numbers with no prescription, and the Undo then let those numbers count.
  describe('a rebuild of an exercise kept out by hand keeps its prescription', () => {
    // Main plans 60; the last session that counted was 100 × 5, so today opens at 102.5.
    const planned = [{ id: 'main', name: 'Main', ex: [{ id: BENCH, sets: 1, reps: 5, weight: 60 }, { id: ROW, sets: 1, reps: 8, weight: 30 }] }]
    const logged = [{
      id: 'w1', d: '2026-09-20', routineIds: ['main'],
      entries: [
        { id: BENCH, rid: 'main', target: { sets: 1, reps: 5, weight: 100 }, sets: [{ w: 100, r: 5, done: true }] },
        { id: ROW, rid: 'main', target: { sets: 1, reps: 8, weight: 70 }, sets: [{ w: 70, r: 8, done: true }] },
      ],
    }]
    const start = () => {
      const S = { ...clone(DEF), routines: clone(planned), workouts: clone(logged) }
      const [bench] = buildSessionEntries(S, planned[0]).map(e => ({ ...e, rid: 'main' }))
      seed([bench], { withRoutines: planned, withHistory: logged })
      expect(A().entries[0].sets.map(set => set.w)).toEqual([102.5])
      setNoProgAt(0, true)
      expect(A().entries[0].noProg).toBe(true)
    }
    const undoAndFinish = () => {
      setNoProgAt(0, false)
      expect(A().entries[0].noProg).toBeUndefined()
      useStore.getState().update(s => { s.active.entries[0].sets.forEach(set => { set.done = true }) })
      const saved = buildCompletedWorkout(A(), { end: Date.now() })
      return { ...useStore.getState().S, active: null, workouts: [...logged, saved] }
    }

    it('Exercise settings saved unchanged, then counting again: the session counts at 102.5 and the next one goes on from there', () => {
      start()
      const at = { activeId: A().id, entryId: BENCH, entryCount: A().entries.length }
      const opened = plannedConfigOf(A().entries[0])
      expect(applyExerciseSettingsAt(0, { ...opened }, opened, at)).toBe(true)

      const [bench] = A().entries
      expect(bench.noProg).toBe(true)
      expect(bench.sets.map(set => set.w)).toEqual([102.5])
      expect(bench.target.weight).toBe(102.5)
      expect(bench.plan.kind).not.toBe('off')

      const S = undoAndFinish()
      expect(nextPrescription(S, planned[0].ex[0], planned[0]).weight).toBe(105)
    })

    it('a swap, then counting again: the replacement counts at its own prescription, not the routine’s numbers', () => {
      start()
      expect(swapEntryWithUndo(0, EXIDX[ROW])).toBe(true)

      const [row] = A().entries
      expect(row.id).toBe(ROW)
      // The mark stays on the slot, with the switch to count it again.
      expect(row.noProg).toBe(true)
      // 70 × 8 last time, and a row goes up in 5s: 75, the way the routine's own start builds it.
      const S0 = { ...clone(DEF), routines: clone(planned), workouts: clone(logged) }
      expect(buildSessionEntries(S0, planned[0])[1].sets.map(set => set.w)).toEqual([75])
      expect(row.sets.map(set => set.w)).toEqual([75])
      expect(row.plan.kind).not.toBe('off')

      const S = undoAndFinish()
      expect(nextPrescription(S, planned[0].ex[1], planned[0]).weight).toBe(80)
    })
  })

  it('a deload routine’s exercise saved in Exercise settings stays at the routine’s own numbers', () => {
    // 70 × 8 in Main would put a counting row at 75; the deload keeps its 40.
    const rowInMain = { id: 'w0', d: '2026-09-18', routineIds: ['main'], entries: [{ id: ROW, rid: 'main', target: { sets: 1, reps: 8, weight: 70 }, sets: [{ w: 70, r: 8, done: true }] }] }
    seed([{ ...entry(ROW, 'deload', 40, { noProg: true }), target: { sets: 1, reps: 8, weight: 40 }, sets: [{ w: 40, r: 8, done: false }] }], { withHistory: [...history, rowInMain] })
    const at = { activeId: A().id, entryId: ROW, entryCount: 1 }
    const opened = plannedConfigOf(A().entries[0])
    expect(applyExerciseSettingsAt(0, { ...opened }, opened, at)).toBe(true)
    const [row] = A().entries
    expect(row.noProg).toBe(true)
    expect(row.plan.kind).toBe('off')
    expect(row.sets.map(set => set.w)).toEqual([40])
  })

  it('a deload routine’s exercise offers no switch in How to', () => {
    seed([entry(ROW, 'deload', 40, { noProg: true })])
    howToSheet(0)
    expect(switchRow(top())).toBeUndefined()
  })
})

describe('what the old cards showed', () => {
  it.todo('a kept-out exercise shows "Not counted for progression" on its card, with an Undo button; a deload routine’s shows it with no button [old Workout.noprog.test.jsx:96, :112, :236; no marker in views/workout]')
})
