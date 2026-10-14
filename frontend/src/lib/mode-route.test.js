import { describe, expect, it } from 'vitest'
import { isModeRoot, launchPath, legacyPath, modeOf, slotOf, tabIndex, workoutRunning } from './mode-route.js'

describe('the mode comes from the route', () => {
  it('Training under /train, Nutrition under /food', () => {
    expect(modeOf('/train/home')).toBe('train')
    expect(modeOf('/train/plan/r/abc')).toBe('train')
    expect(modeOf('/food/diary')).toBe('food')
    expect(modeOf('/food')).toBe('food')
  })

  it('the shared pages have none of their own', () => {
    for (const p of ['/me', '/me/workout', '/body/measurements', '/body/photos', '/wellness', '/', ''])
      expect(modeOf(p), p).toBeNull()
  })

  it('does not take a lookalike for a mode', () => {
    expect(modeOf('/training')).toBeNull()
    expect(modeOf('/foods')).toBeNull()
  })
})

describe('the tabs', () => {
  it('lights the root and the pages pushed from it', () => {
    expect(tabIndex('train', '/train/home')).toBe(0)
    expect(tabIndex('train', '/train/checkin')).toBe(0)
    expect(tabIndex('train', '/train/plan/r/x')).toBe(1)
    expect(tabIndex('train', '/train/history')).toBe(2)
    expect(tabIndex('train', '/train/structural-balance')).toBe(2)
    expect(tabIndex('train', '/train/muscles')).toBe(3)
    expect(tabIndex('food', '/food/goals')).toBe(3)
  })

  it('lights none for the workout, a shared page, or the other mode', () => {
    expect(tabIndex('train', '/train/workout')).toBe(-1)
    expect(tabIndex('train', '/me')).toBe(-1)
    expect(tabIndex('train', '/food/diary')).toBe(-1)
  })

  it('never puts a tab on the centre disc', () => {
    expect([0, 1, 2, 3].map(slotOf)).toEqual([0, 1, 3, 4])
  })

  it('the header switch shows on the four root screens of each mode only', () => {
    for (const p of ['/train/home', '/train/plan', '/train/stats', '/train/library', '/food/diary', '/food/foods', '/food/stats', '/food/goals'])
      expect(isModeRoot(p), p).toBe(true)
    for (const p of ['/train/workout', '/train/history', '/train/plan/r/x', '/me', '/body/photos', '/wellness'])
      expect(isModeRoot(p), p).toBe(false)
  })
})

describe('the routes from before the modes', () => {
  it('go where they live now, the rest of the path kept', () => {
    expect(legacyPath('/home')).toBe('/train/home')
    expect(legacyPath('/workout')).toBe('/train/workout')
    expect(legacyPath('/plan/r/abc')).toBe('/train/plan/r/abc')
    expect(legacyPath('/coach')).toBe('/train/coach')
    expect(legacyPath('/coach/intake')).toBe('/train/coach/intake')
    expect(legacyPath('/settings')).toBe('/me')
    expect(legacyPath('/settings/workout')).toBe('/me/workout')
    expect(legacyPath('/admin')).toBe('/me/admin')
    expect(legacyPath('/progress-photos')).toBe('/body/photos')
    expect(legacyPath('/measurements')).toBe('/body/measurements')
  })

  it('leave new and unknown routes alone', () => {
    expect(legacyPath('/train/home')).toBeNull()
    expect(legacyPath('/homes')).toBeNull()
    expect(legacyPath('/nope')).toBeNull()
  })
})

describe('the launch', () => {
  it('opens the running workout first', () => {
    expect(launchPath({ lastMode: 'food', workoutRunning: true })).toBe('/train/workout')
  })
  it('else the mode used last, else Training', () => {
    expect(launchPath({ lastMode: 'food', workoutRunning: false })).toBe('/food/diary')
    expect(launchPath({ lastMode: 'train', workoutRunning: false })).toBe('/train/home')
    expect(launchPath({ lastMode: null, workoutRunning: false })).toBe('/train/home')
    expect(launchPath({ lastMode: 'junk', workoutRunning: false })).toBe('/train/home')
  })
  it('counts a live session only, not a past workout being edited or logged', () => {
    expect(workoutRunning({ active: { start: 1 } })).toBe(true)
    expect(workoutRunning({ active: { start: 1, editingWorkoutId: 'w' } })).toBe(false)
    expect(workoutRunning({ active: { start: 1, backfill: true } })).toBe(false)
    expect(workoutRunning({ active: null })).toBe(false)
  })
})
