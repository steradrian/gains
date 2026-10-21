// @vitest-environment happy-dom
// The left-open check (board W1.27): once per launch, at launch or on the way back to the front,
// a session left open hours ago is put to the user over Today. Never over the workout, never for
// a fresh session, an edit of a saved workout or a workout logged into the past.
import { act, useLayoutEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { DEF, useStore } from '../store/useStore.js'
import { setNav } from '../lib/nav.js'
import { staleWorkoutSheet } from '../views/workout/finish-drawers.js'
import StaleWorkoutCheck, { resetStaleCheck } from './StaleWorkoutCheck.jsx'

vi.mock('../views/workout/finish-drawers.js', () => ({ staleWorkoutSheet: vi.fn() }))

const BENCH = '0025'
const NOW = new Date('2026-10-18T19:30:00').getTime()
const HOUR = 60 * 60 * 1000
const clone = v => JSON.parse(JSON.stringify(v))
let where, root, host, pathAtOpen

function install(active) {
  const st = clone(DEF)
  st.active = active
  useStore.setState({ S: st, user: null })
}
const session = (startAgo, lastAgo, over = {}) => ({
  id: 'a1', d: '2026-10-17', start: NOW - startAgo, routineIds: [], name: 'Push A', bw: null, cur: 0,
  entries: [{ id: BENCH, target: { mode: 'reps', sets: 1, reps: 8 }, sets: [{ w: 80, r: 8, done: true, at: NOW - lastAgo }] }],
  ...over,
})

function Bridge() {
  const navigate = useNavigate()
  useLayoutEffect(() => { setNav(navigate) }, [navigate])
  return null
}
function Where() {
  where = useLocation().pathname
  return null
}
function launch(path) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(
    <MemoryRouter initialEntries={[path]}>
      <Bridge /><Where /><StaleWorkoutCheck />
    </MemoryRouter>,
  ))
}
const unmount = () => { if (root) act(() => root.unmount()); root = null }
const toFront = () => act(() => { document.dispatchEvent(new Event('visibilitychange')) })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  resetStaleCheck()
  pathAtOpen = null
  vi.mocked(staleWorkoutSheet).mockReset()
  vi.mocked(staleWorkoutSheet).mockImplementation(() => { pathAtOpen = where })
  document.body.innerHTML = ''
})
afterEach(() => {
  unmount()
  vi.useRealTimers()
})

describe('StaleWorkoutCheck', () => {
  it('on Today at launch: the drawer opens once, and not again on a remount or a return to the front', () => {
    install(session(23 * HOUR, 22 * HOUR))
    launch('/home')
    expect(staleWorkoutSheet).toHaveBeenCalledTimes(1)
    toFront()
    unmount()
    launch('/home')
    expect(staleWorkoutSheet).toHaveBeenCalledTimes(1)
  })

  it('elsewhere: goes to Today first and opens once it has landed there', () => {
    install(session(23 * HOUR, 22 * HOUR))
    launch('/food')
    expect(where).toBe('/home')
    expect(staleWorkoutSheet).toHaveBeenCalledTimes(1)
    expect(pathAtOpen).toBe('/home')
  })

  it('a launch onto the workout (where a running session opens) goes to Today and asks there', () => {
    install(session(23 * HOUR, 22 * HOUR))
    launch('/train/workout')
    expect(where).toBe('/home')
  })

  it('never over the summary, nor over the workout on a return to the front', () => {
    install(session(23 * HOUR, 22 * HOUR))
    launch('/train/workout/summary/w1')
    toFront()
    expect(where).toBe('/train/workout/summary/w1')
    expect(staleWorkoutSheet).not.toHaveBeenCalled()
  })

  it('a fresh session asks nothing; hours later, back at the front, it asks', () => {
    install(session(30 * 60000, 5 * 60000))
    launch('/home')
    expect(staleWorkoutSheet).not.toHaveBeenCalled()
    vi.setSystemTime(NOW + 4 * HOUR)
    toFront()
    expect(staleWorkoutSheet).toHaveBeenCalledTimes(1)
  })

  it('nothing for an edit of a saved workout, a workout logged into the past, or no session', () => {
    install(session(23 * HOUR, 22 * HOUR, { editingWorkoutId: 'w-old' }))
    launch('/home')
    unmount()
    install(session(23 * HOUR, 22 * HOUR, { backfill: true }))
    launch('/home')
    unmount()
    install(null)
    launch('/home')
    toFront()
    expect(staleWorkoutSheet).not.toHaveBeenCalled()
    expect(where).toBe('/home')
  })
})
