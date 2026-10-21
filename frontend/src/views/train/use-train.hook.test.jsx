// @vitest-environment happy-dom
// useTrain against the store: Move to today and Skip it write the plan and the seen state and
// their Undo puts both back; the card's intents run what they name; a rail day selects locally.
import React, { act } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../../store/useStore.js'
import { useTrain } from './use-train.js'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
const sheets = vi.hoisted(() => ({
  startFlow: vi.fn(), dayOverrideSheet: vi.fn(), dayNoteSheet: vi.fn(), logPastWorkoutSheet: vi.fn(), starterPlanSheet: vi.fn(),
  menuSheet: vi.fn(), workoutDetailSheet: vi.fn(),
}))
vi.mock('../../sheets.jsx', () => sheets)

const TODAY = '2026-10-18', FRI = '2026-10-16', TUE = '2026-10-20'
const routine = (id, name) => ({ id, name, ex: [{ id: '0025', sets: 3, reps: 8 }] })
const setS = (over = {}) => useStore.setState(s => ({
  S: {
    ...s.S, active: null, dayNotes: {}, missedSeen: {}, dayPlan: {}, queue: null,
    routines: [routine('push', 'Push A'), routine('pull', 'Pull A'), routine('legs', 'Legs')],
    week: { 0: ['push'], 1: ['legs'], 3: ['pull'], 5: ['legs'] },
    workouts: [{ id: 'w1', d: '2026-10-14', name: 'Pull A', start: 1, end: 2, routineIds: ['pull'], entries: [] }],
    ...over,
  },
}))

let host, root, train
function Probe() { train = useTrain(); return null }
const mount = async () => { await act(async () => { root.render(<Probe />) }) }

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(TODAY + 'T09:00:00')) })
afterAll(() => vi.useRealTimers())
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  nav.mockClear()
  Object.values(sheets).forEach(f => f.mockClear())
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('useTrain', () => {
  it('Move to today: today takes Legs, Push A goes to Tuesday; Undo puts the plan and the banner back', async () => {
    setS()
    await mount()
    expect(train.missed.iso).toBe(FRI)
    let toast
    await act(async () => { toast = train.missed.move() })
    expect(toast.text).toMatch(/^Moved Legs to today\. Push A is now /)
    expect(useStore.getState().S.dayPlan).toEqual({ [TODAY]: 'legs', [TUE]: 'push' })
    expect(train.missed).toBeNull()
    expect(train.card().title).toBe('Legs')
    await act(async () => { toast.undo() })
    expect(useStore.getState().S.dayPlan).toEqual({})
    expect(train.missed.iso).toBe(FRI)
    expect(train.card().title).toBe('Push A')
  })

  it('Move’s Undo marks the plan days it put back, as Plan’s Undo does, so sync reads it as undone', async () => {
    setS()
    await mount()
    let toast
    await act(async () => { toast = train.missed.move() })
    await act(async () => { toast.undo() })
    expect(Object.keys(useStore.getState().S.undone || {})).toEqual(expect.arrayContaining(['dayPlan.' + TODAY, 'dayPlan.' + TUE]))
  })

  it('Move’s Undo leaves a plan day another change touched since alone: that change still wins', async () => {
    setS()
    await mount()
    let toast
    await act(async () => { toast = train.missed.move() })
    await act(async () => { useStore.getState().update(s => { s.dayPlan[TUE] = 'pull' }) })
    await act(async () => { toast.undo() })
    const undone = Object.keys(useStore.getState().S.undone || {})
    expect(undone).toContain('dayPlan.' + TODAY)
    expect(undone).not.toContain('dayPlan.' + TUE)
  })

  it('Skip it: the plan is untouched and the banner goes; Undo brings it back', async () => {
    setS()
    await mount()
    let toast
    await act(async () => { toast = train.missed.skip() })
    expect(toast.text).toMatch(/^Skipped Legs on .*\. Push A stays today$/)
    expect(useStore.getState().S.dayPlan).toEqual({})
    expect(useStore.getState().S.missedSeen[FRI].seen).toBe(true)
    expect(train.missed).toBeNull()
    await act(async () => { toast.undo() })
    expect(train.missed.iso).toBe(FRI)
  })

  it('runs a card’s intents: Start with its ids, Change this day, Log this workout, See routine', async () => {
    setS()
    await mount()
    act(() => train.onIntent(train.card().primary))
    expect(sheets.startFlow).toHaveBeenCalledWith(['push'])
    act(() => train.onIntent(train.card(FRI).primary))
    expect(sheets.logPastWorkoutSheet).toHaveBeenCalledWith({ iso: FRI, routineIds: ['legs'] })
    const later = train.card('2026-10-19')
    act(() => later.secondary.forEach(train.onIntent))
    expect(sheets.dayOverrideSheet).toHaveBeenCalledWith('2026-10-19')
    expect(nav).toHaveBeenCalledWith('/train/routines/legs')
  })

  it('a session in progress wins over Start: the routines’ play resumes it', async () => {
    setS({ active: { name: 'Pull A', start: 5, entries: [] } })
    await mount()
    act(() => train.onRoutineStart(train.routines[0]))
    expect(sheets.startFlow).not.toHaveBeenCalled()
    expect(nav).toHaveBeenCalledWith('/train/workout')
  })

  it('selects a rail day locally, and See that day selects it from a rest day', async () => {
    setS({ week: { 1: ['legs'] } })
    await mount()
    expect(train.selected).toBe(TODAY)
    expect(train.card().kind).toBe('rest')
    await act(async () => { train.onIntent(train.card().secondary[0]) })
    expect(train.selected).toBe('2026-10-19')
    expect(train.card().kind).toBe('upcoming')
  })
})
