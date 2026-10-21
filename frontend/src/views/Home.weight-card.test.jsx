// @vitest-environment happy-dom
// The body-weight card Home showed (components/WeightCard.jsx). Today has no slot for it (PR-01),
// so it is not on Today in any profile; the card stays until M6 sweeps the old Home parts.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import WeightCard from '../components/WeightCard.jsx'
import Home from './Home.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ pathname: '/home' }) }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(), workoutDetailSheet: vi.fn(),
}))

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useStore.setState(s => ({
    S: { ...s.S, routines: [], workouts: [], bodyweight: [], dayPlan: {}, week: {}, active: null, showWeightCard: true },
    user: null,
  }))
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const weightHeading = () => [...host.querySelectorAll('h2')].find(el => el.textContent === 'Body weight')

describe('the body-weight card', () => {
  it('with no weigh-in yet, says so under the scale inside the card', () => {
    act(() => root.render(<WeightCard date={todayISO()} />))
    const empty = weightHeading().closest('.card').querySelector('.empty')
    expect(empty.dataset.surface).toBe('card')
    expect(empty.querySelector('.lineart[data-scene=scale]')).not.toBeNull()
    expect(empty.querySelector('h3').textContent).toBe('No weigh-ins yet')
  })

  it('is not on Today, whatever the preference says', () => {
    act(() => root.render(<Home />))
    expect(weightHeading()).toBeFalsy()
  })
})
