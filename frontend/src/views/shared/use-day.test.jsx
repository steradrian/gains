// @vitest-environment happy-dom
// useDay against the store (PR07 D1): Mark skipped writes the seen state, shows the toast with
// Undo, and Undo puts it back; the rail swaps the day in place; the + and Add past workout carry
// the day; the day's weigh-in stays data next to the drawer that adds one.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { useDiarySelection } from '../../lib/nutrition/selection.js'
import { useDay } from './use-day.js'

const libNav = vi.hoisted(() => vi.fn())
vi.mock('../../lib/nav.js', async importOriginal => ({ ...(await importOriginal()), nav: libNav }))
const plus = vi.hoisted(() => vi.fn())
vi.mock('../../components/PlusSheet.jsx', async importOriginal => ({ ...(await importOriginal()), openPlusSheet: plus }))
const past = vi.hoisted(() => vi.fn())
vi.mock('./PastWorkoutSheet.jsx', async importOriginal => ({ ...(await importOriginal()), pastWorkoutSheet: past }))
const picker = vi.hoisted(() => vi.fn())
vi.mock('../../components/FoodPickerSheet.jsx', async importOriginal => ({ ...(await importOriginal()), foodPickerSheet: picker }))

// Sun 18 Oct 2026 is today. Push A on Mondays, Legs on Fridays; Legs was missed on Fri 16 Oct.
const TODAY = '2026-10-18', FRI = '2026-10-16', TUE = '2026-10-13'
const routine = (id, name) => ({ id, name, ex: [{ id: '0025', sets: 3, reps: 8 }] })
const setS = (over = {}) => useStore.setState(s => ({
  user: null,
  S: {
    ...s.S, active: null, dayNotes: {}, missedSeen: {}, dayPlan: {}, queue: null, bodyweight: [], measurements: [],
    routines: [routine('push', 'Push A'), routine('legs', 'Legs')],
    week: { 1: ['push'], 5: ['legs'] },
    // Set long ago, so the past weeks can be held to this plan (lib/notifications/feed.js planKnown).
    edited: { 'week.1': 1, 'week.5': 1 },
    workouts: [{ id: 'w1', d: '2026-10-05', name: 'Push A', start: 1, end: 2, routineIds: ['push'], entries: [] },
      { id: 'w2', d: '2026-10-12', name: 'Push A', start: 3, end: 4, routineIds: ['push'], entries: [] }],
    ...over,
  },
}))

let host, root, day
function Probe({ iso }) { day = useDay(iso, 'train'); return null }
const mount = async iso => { await act(async () => { root.render(<Probe iso={iso} />) }) }

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(TODAY + 'T09:00:00')) })
afterAll(() => vi.useRealTimers())
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  libNav.mockClear(); plus.mockClear(); past.mockClear(); picker.mockClear()
  useDiarySelection.getState().reset()
  useUI.setState({ toastMsg: '', toastAction: null })
  setS()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('useDay', () => {
  it('missed → Mark skipped: the day reads Skipped, the toast offers Undo, and Undo makes it missed again', async () => {
    await mount(FRI)
    expect(day.state).toBe('missed')
    let r
    await act(async () => { r = day.markSkipped() })
    expect(r.text).toBe('Marked Legs skipped on Fri 16 Oct')
    expect(useStore.getState().S.missedSeen[FRI]).toMatchObject({ seen: true, skipped: true })
    expect(day.state).toBe('skipped')
    expect(useUI.getState().toastMsg).toBe('Marked Legs skipped on Fri 16 Oct')
    expect(useUI.getState().toastAction.label).toBe('Undo')
    await act(async () => { useUI.getState().toastAction.run() })
    expect(useStore.getState().S.missedSeen[FRI]?.seen).toBeUndefined()
    expect(day.state).toBe('missed')
  })

  it('has nothing to skip on a day that was not missed', async () => {
    await mount('2026-10-12')
    expect(day.state).toBe('logged')
    expect(day.markSkipped()).toBeNull()
    expect(useStore.getState().S.missedSeen).toEqual({})
  })

  it('a day in the rail swaps in place: the address is replaced, under the same tab', async () => {
    await mount(FRI)
    day.select(TUE)
    expect(libNav).toHaveBeenCalledWith('/train/day/' + TUE, { replace: true })
  })

  it('the rail’s Week link opens the week on show, this day’s by default', async () => {
    await mount(FRI)
    day.openWeek()
    expect(libNav).toHaveBeenLastCalledWith('/train/week/2026-W42', undefined)
    day.openWeek('2026-W41')
    expect(libNav).toHaveBeenLastCalledWith('/train/week/2026-W41', undefined)
  })

  it('the + and Add past workout carry the day', async () => {
    await mount(FRI)
    day.add()
    expect(plus).toHaveBeenCalledWith('/train/day/' + FRI)
    day.addPastWorkout()
    expect(past).toHaveBeenCalledWith(FRI)
  })

  it('Log food goes to this day and meal as parameters, never moving the shared diary day', async () => {
    await mount(FRI)
    day.logFood(2)
    expect(picker).toHaveBeenLastCalledWith({ date: FRI, meal: 2 })
    day.logFood()
    expect(picker).toHaveBeenLastCalledWith({ date: FRI, meal: null })
    expect(useDiarySelection.getState().date).toBeNull()
  })

  it('keeps the day’s weigh-in as data beside the drawer that adds one', async () => {
    setS({ bodyweight: [{ d: TUE, w: 81.7, t: 1 }] })
    await mount(TUE)
    expect(day.weighIn).toEqual({ w: 81.7, unit: useStore.getState().S.unit })
    expect(typeof day.weighInSheet).toBe('function')
  })
})
