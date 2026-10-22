// @vitest-environment happy-dom
// The plan chosen at onboarding that openGym could not set up (the hub's state: plan refused, the
// rest of the write in): Today's Up next says so in place of "No plan yet", with Training to pick
// one, until a plan exists.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { _forgetPlanRefused } from '../lib/onboarding/use-plan-refused.js'
import Home from './Home.jsx'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav, useLocation: () => ({ pathname: '/home' }) }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), dayOverrideSheet: vi.fn(), menuSheet: vi.fn(),
  calendarSheet: vi.fn(), readyOrStart: vi.fn(), weighInsSheet: vi.fn(), workoutDetailSheet: vi.fn(), logPastWorkoutSheet: vi.fn(),
}))
// The diary's cards read NutriTrace; this is about the plan only.
vi.mock('../lib/nutrition/use-diary-day.js', () => ({ useDiaryDay: () => ({ on: false, status: 'idle', settings: null, water: { total: 0, goal: 0 } }) }))
const hub = vi.hoisted(() => ({ loadOnboarding: vi.fn() }))
vi.mock('../lib/onboarding/api.js', async original => ({ ...(await original()), ...hub }))

const REFUSED = { completedAt: 1, delivery: { opengym: 'done', nutritrace: 'done' }, plan: { status: 'refused', kind: 'starter', code: 'bad-plan' } }
const routines = [{ id: 'r1', name: 'Push', emoji: null, ex: [{ id: '0025' }] }]

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  nav.mockClear()
  hub.loadOnboarding.mockReset()
  _forgetPlanRefused()
  // Signed in, the other cards ask their servers; there are none here.
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('no server in this test') }))
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals() })

// A weigh-in today: something is logged, so Up next shows rather than a first day's First steps.
const setS = (over = {}) => useStore.setState(s => ({
  S: { ...s.S, routines: [], dayPlan: {}, workouts: [], active: null, weighIn: false, week: {}, bodyweight: [{ d: todayISO(), w: 80 }], ...over },
  user: { id: 'u1', name: 'Maria' },
}))
const mount = async () => { await act(async () => { root.render(<Home />) }); await act(async () => { await Promise.resolve() }) }
const text = () => host.textContent

describe('Today — a plan the onboarding could not set up', () => {
  it('says so in Up next, in place of "No plan yet", and opens Training to pick one', async () => {
    hub.loadOnboarding.mockResolvedValue(REFUSED)
    setS()
    await mount()
    expect(text()).toContain('Your plan couldn’t be set up')
    expect(text()).toContain('Pick one in Training.')
    // The read is for the signed-in person, named to the hub.
    expect(hub.loadOnboarding).toHaveBeenCalledWith('u1')
    act(() => { host.querySelector('.g-grow').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(nav).toHaveBeenCalledWith('/train')
  })

  it('on a first day, First steps\' plan step says so instead (T1.9)', async () => {
    hub.loadOnboarding.mockResolvedValue(REFUSED)
    setS({ bodyweight: [] })
    await mount()
    expect(host.querySelector('.g-grow')).toBeNull()
    expect(host.querySelector('.g-fstep').textContent).toBe('Plan your training weekYour plan couldn’t be set up')
  })

  it('goes away once a plan exists, and asks the hub nothing then', async () => {
    hub.loadOnboarding.mockResolvedValue(REFUSED)
    setS({ routines })
    await mount()
    expect(text()).not.toContain('Your plan couldn’t be set up')
    expect(hub.loadOnboarding).not.toHaveBeenCalled()
  })

  it('says "No plan yet" as before when no plan was refused, or the hub cannot be asked', async () => {
    hub.loadOnboarding.mockResolvedValue({ completedAt: 1, delivery: { opengym: 'done', nutritrace: 'done' }, plan: null })
    setS()
    await mount()
    expect(text()).toContain('No plan yet')
    expect(text()).not.toContain('Your plan couldn’t be set up')
    act(() => root.unmount())
    root = createRoot(host)
    _forgetPlanRefused()
    hub.loadOnboarding.mockRejectedValue(Object.assign(new Error('x'), { code: 'offline' }))
    await mount()
    expect(text()).toContain('No plan yet')
  })
})
