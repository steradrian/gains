import { afterEach, describe, expect, it } from 'vitest'
import { EXIDX, registerCustom } from './exercises.js'
import { defaultConfig } from './history.js'
import { customExDefaults, logChoiceOf, withLogChoice } from './custom-exercise.js'

const custom = (over = {}) => ({ id: 'cmode1', n: 'Landmine press', bp: 'shoulders', eq: 'barbell', custom: true, ...over })
const LIFT = Object.keys(EXIDX).find(id => EXIDX[id].bp === 'chest' && EXIDX[id].eq === 'barbell')

afterEach(() => registerCustom([]))

describe('customExDefaults', () => {
  it('is empty for a built-in exercise and for a custom one saved before the field existed', () => {
    expect(customExDefaults(EXIDX[LIFT])).toEqual({})
    expect(customExDefaults(custom())).toEqual({})
    expect(customExDefaults(custom({ mode: 'sideways' }))).toEqual({})
    expect(customExDefaults(null)).toEqual({})
  })

  it('gives the mode, and the bodyweight flag for a rep exercise', () => {
    expect(customExDefaults(custom({ mode: 'reps' }))).toEqual({ mode: 'reps', bodyweight: false })
    expect(customExDefaults(custom({ mode: 'reps', bodyweight: true }))).toEqual({ mode: 'reps', bodyweight: true })
    expect(customExDefaults(custom({ mode: 'time' }))).toEqual({ mode: 'time' })
    expect(customExDefaults(custom({ mode: 'cardio' }))).toEqual({ mode: 'cardio' })
  })
})

describe('logChoiceOf and withLogChoice', () => {
  it('reads the stored mode back as the form\'s choice', () => {
    expect(logChoiceOf(custom({ mode: 'reps' }))).toBe('weight')
    expect(logChoiceOf(custom({ mode: 'reps', bodyweight: true }))).toBe('reps')
    expect(logChoiceOf(custom({ mode: 'time' }))).toBe('time')
    expect(logChoiceOf(custom({ mode: 'cardio' }))).toBe('cardio')
  })

  it('without one, says what the app already does with the exercise', () => {
    expect(logChoiceOf(custom())).toBe('weight')
    expect(logChoiceOf(custom({ bp: 'cardio' }))).toBe('cardio')
    expect(logChoiceOf(custom({ eq: 'body weight' }))).toBe('reps')
    expect(logChoiceOf(null)).toBe('weight')
  })

  it('writes the mode, and bodyweight only for Reps only', () => {
    expect(withLogChoice(custom({ bodyweight: true }), 'weight')).toMatchObject({ mode: 'reps' })
    expect(withLogChoice(custom({ bodyweight: true }), 'weight')).not.toHaveProperty('bodyweight')
    expect(withLogChoice(custom(), 'reps')).toMatchObject({ mode: 'reps', bodyweight: true })
    expect(withLogChoice(custom({ bodyweight: true }), 'time')).toEqual(custom({ mode: 'time' }))
    expect(withLogChoice(custom(), 'cardio').mode).toBe('cardio')
  })
})

describe('a new routine entry takes the custom exercise\'s mode (defaultConfig)', () => {
  it('a timed custom exercise seeds a timed entry', () => {
    registerCustom([custom({ mode: 'time' })])
    expect(defaultConfig('cmode1')).toEqual({ sets: 3, sec: 45, weight: 0, mode: 'time' })
  })

  it('Reps only seeds a bodyweight rep entry; Weight × reps on body-weight equipment says false', () => {
    registerCustom([custom({ mode: 'reps', bodyweight: true })])
    expect(defaultConfig('cmode1')).toEqual({ sets: 3, reps: 10, weight: 0, mode: 'reps', bodyweight: true })
    registerCustom([custom({ eq: 'body weight', mode: 'reps' })])
    expect(defaultConfig('cmode1')).toEqual({ sets: 3, reps: 10, weight: 0, mode: 'reps', bodyweight: false })
  })

  it('cardio outside the Cardio body part carries its mode; inside it, the config is as it was', () => {
    registerCustom([custom({ mode: 'cardio' })])
    expect(defaultConfig('cmode1')).toEqual({ sets: 1, min: 20, speed: 8, mode: 'cardio' })
    registerCustom([custom({ bp: 'cardio', mode: 'cardio' })])
    expect(defaultConfig('cmode1')).toEqual({ sets: 1, min: 20, speed: 8 })
  })

  it('a mode the caller names wins, and a built-in or an older custom exercise is unchanged', () => {
    registerCustom([custom({ mode: 'time' })])
    expect(defaultConfig('cmode1', 'reps')).toEqual({ sets: 3, reps: 10, weight: 0, mode: 'reps' })
    registerCustom([custom()])
    expect(defaultConfig('cmode1')).toEqual({ sets: 3, reps: 10, weight: 0, mode: 'reps' })
    expect(defaultConfig(LIFT)).toEqual({ sets: 3, reps: 10, weight: 0, mode: 'reps' })
  })
})
