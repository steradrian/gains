// @vitest-environment happy-dom
// History: the list of workouts, and the empty state it shows before the first one.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { navToDay } from '../lib/day-route.js'
import { workoutDetailSheet } from '../sheets.jsx'
import History, { openWorkout } from './History.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ S: null }))
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector({ S: mocks.S }) : { S: mocks.S }
  useStore.getState = () => ({ S: mocks.S })
  return { useStore }
})
vi.mock('../sheets.jsx', () => ({
  WorkoutRow: ({ w }) => <div className="item">{w.name}</div>,
  DayNoteRow: () => <div className="item" />,
  workoutDetailSheet: vi.fn(),
  logPastWorkoutSheet: vi.fn(),
}))
vi.mock('../lib/day-route.js', () => ({ navToDay: vi.fn() }))

let host, root
const mount = () => act(() => root.render(<MemoryRouter><History /></MemoryRouter>))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.S ={ unit: 'kg', lang: 'en', workouts: [], dayNotes: {} }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('History', () => {
  it('with no workouts, shows the calendar empty state and still offers to log a past one', () => {
    mount()
    const empty = host.querySelector('.empty[data-surface=page]')
    expect(empty.querySelector('.lineart[data-scene=calendar]')).not.toBeNull()
    expect(empty.querySelector('h2').textContent).toBe('No workouts yet')
    expect([...host.querySelectorAll('button')].some(b => b.textContent.includes('Log a past workout'))).toBe(true)
  })

  it('with workouts, lists them and shows no empty state', () => {
    mocks.S.workouts = [{ id: 'w1', d: '2026-10-01', name: 'Push', start: 1, entries: [] }]
    mount()
    expect(host.querySelector('.empty')).toBeNull()
    expect(host.querySelector('.list .item').textContent).toBe('Push')
  })
})

describe('History — a row opens its day', () => {
  const TODAY = '2026-10-18'
  it('a past workout opens its Day page under Train', () => {
    openWorkout({ id: 'w1', d: '2026-10-12', entries: [] }, TODAY)
    expect(navToDay).toHaveBeenCalledWith('2026-10-12', 'train')
    expect(workoutDetailSheet).not.toHaveBeenCalled()
  })

  it('today’s workout opens its detail: the Day page is never today', () => {
    const w = { id: 'w2', d: TODAY, entries: [] }
    openWorkout(w, TODAY)
    expect(workoutDetailSheet).toHaveBeenCalledWith(w)
    expect(navToDay).not.toHaveBeenCalled()
  })
})
