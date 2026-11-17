// @vitest-environment happy-dom
// Import done (board St1Imported) and Importing (St1Importing): the numbers are the import's own,
// and the progress screen does not promise what the app does not do.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))

const { default: ImportDoneScreen } = await import('./ImportDoneScreen.jsx')
const { default: ImportProgressScreen } = await import('./ImportProgressScreen.jsx')

let host, root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const outcome = (extra = {}) => ({ kind: 'workouts', source: 'Strong', from: '2023-09-04', to: '2025-06-20', imported: 212, sets: 1204, matched: 38, newNames: ['landmine press', 'belt squat', 'cable y raise'], leftAlone: 4, ...extra })
const text = () => host.textContent

describe('ImportDoneScreen', () => {
  it('shows the import’s numbers, the new exercises by name, and the days left alone', () => {
    act(() => root.render(<ImportDoneScreen outcome={outcome()} onOpen={vi.fn()} />))
    expect(text()).toContain('212 workouts imported')
    expect(text()).toContain('1204')
    expect(text()).toContain('38')
    expect(text()).toContain('3 became your own exercises')
    expect(text()).toContain('landmine press, belt squat, cable y raise')
    expect(text()).toContain('4 days left alone')
    expect(text()).toContain('They already had a workout in Gains')
  })

  it('shows neither card when nothing became new or was left alone', () => {
    act(() => root.render(<ImportDoneScreen outcome={outcome({ newNames: [], leftAlone: 0, imported: 1 })} onOpen={vi.fn()} />))
    expect(text()).toContain('1 workout imported')
    expect(text()).not.toContain('Worth a look')
    expect(text()).not.toContain('left alone')
  })

  it('opens History for workouts and Body for a body-weight file', () => {
    const onOpen = vi.fn()
    act(() => root.render(<ImportDoneScreen outcome={outcome()} onOpen={onOpen} />))
    act(() => { [...host.querySelectorAll('button')].find(b => b.textContent === 'See it in History').click() })
    expect(onOpen).toHaveBeenLastCalledWith('/train/history')
    act(() => root.render(<ImportDoneScreen outcome={{ kind: 'bodyweight', source: 'Apple Health', imported: 9, leftAlone: 0, from: '2026-01-01', to: '2026-01-09' }} onOpen={onOpen} />))
    act(() => { [...host.querySelectorAll('button')].find(b => b.textContent === 'See it in Body').click() })
    expect(onOpen).toHaveBeenLastCalledWith('/me/body')
  })
})

describe('ImportProgressScreen', () => {
  it('shows the percentage and the line, asks to keep the page open, and cancels', () => {
    const onCancel = vi.fn()
    act(() => root.render(<ImportProgressScreen source="Hevy" label="Fetching workouts… (2/5)" fraction={0.64} onCancel={onCancel} />))
    expect(text()).toContain('64%')
    expect(text()).toContain('Fetching workouts… (2/5)')
    expect(text()).toContain('Keep this page open until it finishes.')
    expect(text()).not.toMatch(/notification/i)
    act(() => { [...host.querySelectorAll('button')].find(b => b.textContent === 'Cancel').click() })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
