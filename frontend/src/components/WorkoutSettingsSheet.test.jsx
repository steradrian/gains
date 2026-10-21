// @vitest-environment happy-dom
// Workout settings (W1.21): the six rows. The old sheet's seven cases map as follows. Rows and
// writes: here. The wheel: here. Vibrate, Flash, Swipe actions and Exercise animations stay in
// Settings > Workout (views/Settings.jsx; their iPhone and write cases belong to its tests). Layout
// left the workout (owner question 1), and All settings with its history-entry case is gone with it.
// The step inside Workout options is covered in views/workout/map-drawers.test.jsx.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkoutSettings } from './WorkoutSettingsSheet.jsx'
import { useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const unlock = vi.hoisted(() => vi.fn())
vi.mock('../lib/sound.js', () => ({
  unlock, beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(),
  vibrateSupported: () => true, appleTouchDevice: () => false,
}))
const wake = vi.hoisted(() => ({ ok: true }))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => wake.ok }))

let host, root, originalS

beforeEach(() => {
  originalS = useStore.getState().S
  useStore.setState({ S: {
    ...originalS, restSec: 90, sound: false, keepAwake: true, autoNext: true, showPlates: true, effort: 'none', effortLast: undefined,
    active: { id: 'a', name: 'Push', start: Date.now(), cur: 0, entries: [] },
  } })
  useUI.setState({ sheets: [] })
  unlock.mockClear()
  wake.ok = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<WorkoutSettings />))
})

afterEach(() => {
  act(() => root.render(null))
  useStore.setState({ S: originalS })
  host.remove()
})

const S = () => useStore.getState().S
const rowOf = title => [...host.querySelectorAll('.g-switchrow, .g-drow')].find(r => r.textContent.includes(title))
const switchOf = title => rowOf(title).querySelector('[role=switch]')
const click = el => act(() => el.click())

describe('the in-workout settings sheet', () => {
  it('has the six rows of the board, then the note about the map', () => {
    expect([...host.querySelectorAll('.g-switch-title, .g-drow-body b')].map(e => e.textContent)).toEqual([
      'Next exercise on its own', 'Rest timer', 'Sound', 'Plate loading', 'Effort per set', 'Keep screen on',
    ])
    expect(rowOf('Rest timer').querySelector('.g-drow-val').textContent).toBe('1:30')
    expect(host.textContent).toContain('Skip either one in the map.')
  })

  it('leaves out the rows that stay in Settings > Workout', () => {
    ;['Vibrate', 'Flash the screen', 'Swipe actions', 'Exercise animations', 'Layout', 'All settings']
      .forEach(label => expect(host.textContent).not.toContain(label))
  })

  it('writes the same fields as Settings', () => {
    click(switchOf('Next exercise on its own'))
    click(switchOf('Plate loading'))
    click(switchOf('Sound'))
    click(switchOf('Keep screen on'))
    expect(S()).toMatchObject({ autoNext: false, showPlates: false, sound: true, keepAwake: false })
  })

  it('unlocks the audio on the tap that turns Sound on', () => {
    click(switchOf('Sound'))
    expect(unlock).toHaveBeenCalledWith(true)
  })

  it('turns Effort on as RIR, and restores the last choice after Off', () => {
    click(switchOf('Effort per set'))
    expect(S().effort).toBe('rir')
    act(() => useStore.getState().update(s => { s.effort = 'rpe' }))
    click(switchOf('Effort per set'))
    expect(S().effort).toBe('none')
    click(switchOf('Effort per set'))
    expect(S().effort).toBe('rpe')
  })

  it('sets the rest timer on the wheel, 0:00 being off, and comes back to the rows', () => {
    click(rowOf('Rest timer'))
    expect(host.querySelector('.dw-read').textContent).toBe('1:30')
    click([...host.querySelectorAll('button')].find(b => b.textContent === 'Done'))
    expect(S().restSec).toBe(90)
    expect(host.textContent).toContain('Plate loading')
  })

  it('greys Keep screen on out where the browser cannot hold the screen', () => {
    wake.ok = false
    act(() => root.render(<WorkoutSettings key="no-wake" />))
    expect(switchOf('Keep screen on').disabled).toBe(true)
  })
})
