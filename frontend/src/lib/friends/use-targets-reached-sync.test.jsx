// @vitest-environment happy-dom
// S.targetsReached is kept only while Friends and the targets switch are on: written after the
// debounce and only when the value changed, cleared when either goes off, and the diary is not read
// at all while it is off.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from '../../ds/render.test-util.js'
import { DEF, useStore } from '../../store/useStore.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  available: true,
  me: null,
  history: null,
  reads: 0,
}))
vi.mock('./api.js', async importActual => ({ ...(await importActual()), friendsAvailable: () => mocks.available }))
vi.mock('./use-friends.js', () => ({ useFriendsMe: () => ({ me: mocks.me, on: !!mocks.me?.on }) }))
vi.mock('../../views/eat/use-food-history.js', () => ({
  useFoodHistory: () => { mocks.reads++; return mocks.history },
}))

import TargetsReachedSync from '../../views/friends/TargetsReachedSync.jsx'
import { DEBOUNCE_MS } from './use-targets-reached-sync.js'

const TODAY = '2026-10-18'
const entry = (date, kcal, protein) => ({
  date, water: [], items: [{ uuid: 'i-' + date, meal: 0, name: 'Food', quantity: 1, nutrition: { calories: kcal, proteins: protein } }],
})
const settings = { calorieGoalMode: 'fixed', goals: { calories: { sharedGoal: true, max: 2000 }, proteins: { sharedGoal: true, max: 100 } } }
const history = days => ({ status: 'ready', days, settings, goalInputs: {}, activity: {}, tried: {}, today: TODAY })
const ME = (over = {}) => ({ on: true, share: { training: true, consistency: true, targets: true, bests: false }, groups: [], ...over })

const view = useView()
const reached = () => useStore.getState().S.targetsReached
const flush = async () => { await act(async () => { vi.advanceTimersByTime(DEBOUNCE_MS + 50) }) }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(TODAY + 'T12:00:00'))
  useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)) }, user: { id: 'u1', name: 'Ana' } })
  mocks.available = true
  mocks.me = ME()
  mocks.history = history([entry('2026-10-16', 2000, 100), entry('2026-10-17', 3000, 40)])
  mocks.reads = 0
})
afterEach(() => { vi.useRealTimers() })

describe('while Friends and the targets switch are on', () => {
  it('writes the map once the debounce has passed, not before', async () => {
    view.render(<TargetsReachedSync />)
    expect(reached()).toBeUndefined()
    await act(async () => { vi.advanceTimersByTime(DEBOUNCE_MS - 100) })
    expect(reached()).toBeUndefined()
    await flush()
    expect(reached()).toEqual({ '2026-10-16': { all: true, protein: true }, '2026-10-17': { all: false, protein: false } })
  })

  it('writes only when the value changed: the same figures again leave the state alone', async () => {
    view.render(<TargetsReachedSync />)
    await flush()
    const before = useStore.getState().S
    mocks.history = history([entry('2026-10-16', 2000, 100), entry('2026-10-17', 3000, 40)])
    view.render(<TargetsReachedSync />)
    await flush()
    expect(useStore.getState().S).toBe(before)
  })

  it('follows the diary when a day changes', async () => {
    view.render(<TargetsReachedSync />)
    await flush()
    mocks.history = history([entry('2026-10-16', 2000, 100), entry('2026-10-17', 2000, 100)])
    view.render(<TargetsReachedSync />)
    await flush()
    expect(reached()['2026-10-17']).toEqual({ all: true, protein: true })
  })

  it('writes nothing while a logged day\'s target is still loading', async () => {
    mocks.history = { ...history([entry('2026-10-16', 2000, 100)]), settings: { ...settings, calorieGoalMode: 'dynamic', calorieGoalFactor: 1 } }
    view.render(<TargetsReachedSync />)
    await flush()
    expect(reached()).toBeUndefined()
  })
})

describe('when it should not be kept', () => {
  it('the targets switch off: reads nothing and clears a map left over', async () => {
    useStore.getState().update(s => { s.targetsReached = { '2026-10-16': { all: true, protein: true } } })
    mocks.me = ME({ share: { training: true, consistency: true, targets: false, bests: false } })
    view.render(<TargetsReachedSync />)
    await flush()
    expect(mocks.reads).toBe(0)
    expect(reached()).toEqual({})
  })

  it('Friends off: reads nothing and clears the map', async () => {
    useStore.getState().update(s => { s.targetsReached = { '2026-10-16': { all: true, protein: true } } })
    mocks.me = ME({ on: false })
    view.render(<TargetsReachedSync />)
    await flush()
    expect(mocks.reads).toBe(0)
    expect(reached()).toEqual({})
  })

  it('nothing to clear: the state is not touched', async () => {
    mocks.me = ME({ on: false })
    const before = useStore.getState().S
    view.render(<TargetsReachedSync />)
    await flush()
    expect(useStore.getState().S).toBe(before)
  })

  it('Friends unavailable (no server, demo): reads nothing and keeps what is there', async () => {
    mocks.available = false
    useStore.getState().update(s => { s.targetsReached = { '2026-10-16': { all: true, protein: true } } })
    view.render(<TargetsReachedSync />)
    await flush()
    expect(mocks.reads).toBe(0)
    expect(reached()).toEqual({ '2026-10-16': { all: true, protein: true } })
  })

  it('Friends not answered yet (no /me): reads nothing and clears nothing', async () => {
    mocks.me = null
    useStore.getState().update(s => { s.targetsReached = { '2026-10-16': { all: true, protein: true } } })
    view.render(<TargetsReachedSync />)
    await flush()
    expect(mocks.reads).toBe(0)
    expect(reached()).toEqual({ '2026-10-16': { all: true, protein: true } })
  })
})
