// @vitest-environment happy-dom
// Routines offers the starter plan to someone who has no routines yet. The button used to be wired
// straight to the loader, which quietly handed the click event in as the plan id and loaded
// nothing at all — so the entry point is pinned here. Train's own (T2.9, "Pick a ready-made plan")
// is covered in TrainHub.test.jsx.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { starterPlanSheet } from '../sheets.jsx'
import RoutinesScreen from './routines/RoutinesScreen.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {}, useLocation: () => ({ pathname: '/train/routines', state: null }) }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(),
  planToolsSheet: vi.fn(), dayNoteSheet: vi.fn(), dayOptionsSheet: vi.fn(), importPlanFile: vi.fn(),
  logPastWorkoutSheet: vi.fn(), startChooserSheet: vi.fn(),
}))

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  starterPlanSheet.mockClear()
  useStore.setState(s => ({ S: { ...s.S, routines: [], week: {}, active: null }, user: null }))
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const starterButton = () => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Pick a ready-made plan')

describe('Routines empty state', () => {
  it('opens the starter plan chooser instead of loading one plan blind', () => {
    act(() => root.render(<RoutinesScreen />))
    const button = starterButton()
    expect(button).toBeTruthy()

    act(() => { button.click() })
    expect(starterPlanSheet).toHaveBeenCalledTimes(1)
    expect(starterPlanSheet.mock.calls[0]).toEqual([])
  })

  it('drops the offer once the user has routines', () => {
    useStore.setState(s => ({ S: { ...s.S, routines: [{ id: 'r', name: 'Mine', emoji: 'star', ex: [] }] } }))
    act(() => root.render(<RoutinesScreen />))
    expect(starterButton()).toBeFalsy()
  })
})
