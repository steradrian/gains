// Cardio speed in mph on the running workout (guard-M2a), ported from Workout.speed.test.jsx: the
// speed field reads, steps and takes typing in the profile's speed unit, and what it stores is
// always km/h. The old column head is the field's label (`setFields`, workout-view.js); a tap or a
// typed number is `changeSetField` (set-field-change.js). The reference line is `sessionLine`.
// WorkoutScreen.focus.test.jsx 'cardio speed in the profile's unit' covers the same field through
// the rendered hero; these cases keep the old numbers and the unit rules.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { setFields, sessionLine } from './workout-view.js'
import { changeSetField } from './set-field-change.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const BIKE = '2138' // stationary bike, cardio

function seed(settings = {}) {
  const S = { ...JSON.parse(JSON.stringify(DEF)), ...settings }
  S.active = {
    id: 'speed-test', d: '2026-09-23', start: Date.now(), routineId: null, name: 'Cardio', bw: null, cur: 0,
    entries: [{ id: BIKE, target: { mode: 'cardio', sets: 1, min: 20, speed: 8 }, sets: [{ min: 20, speed: 8, done: false }] }],
  }
  useStore.setState({ S, user: null })
}
const field = () => setFields(useStore.getState().S, useStore.getState().S.active.entries[0], 0).fields.find(f => f.f === 'speed')
const stored = () => useStore.getState().S.active.entries[0].sets[0].speed
const step = dir => changeSetField(0, 0, field(), field().value + dir * field().step)

afterEach(() => { useStore.setState({ S: JSON.parse(JSON.stringify(DEF)) }) })

describe('cardio speed in the set fields', () => {
  it('reads, steps and takes typing in mph for a profile in pounds, and stores km/h', () => {
    seed({ unit: 'lb' })
    expect(field().label).toBe('mph')
    expect(field().value).toBeCloseTo(4.97, 2) // 8 km/h
    // A tap is half a mile an hour, not half a kilometre.
    step(1)
    expect(stored()).toBe(8.8)
    expect(field().value).toBeCloseTo(5.47, 2)
    changeSetField(0, 0, field(), 6)
    expect(stored()).toBe(9.66)
    changeSetField(0, 0, field(), 6.5)
    expect(stored()).toBe(10.46)
    expect(field().value).toBeCloseTo(6.5, 2)
  })

  it('follows a chosen speed unit over the weight unit', () => {
    seed({ unit: 'kg', speedUnit: 'mph' })
    expect(field().label).toBe('mph')
    seed({ unit: 'lb', speedUnit: 'kmh' })
    expect(field().label).toBe('km/h')
    expect(field().value).toBe(8)
  })

  it('leaves a km/h profile exactly as it was', () => {
    seed()
    expect(field().label).toBe('km/h')
    expect(field().value).toBe(8)
    step(1)
    expect(stored()).toBe(8.5)
    changeSetField(0, 0, field(), 10.25)
    expect(stored()).toBe(10.25)
  })
})

// The line under the exercise reads the past in the same unit as the row it sits over (#173).
describe('the reference line in mph', () => {
  const past = { id: 'w0', d: '2026-09-20', entries: [{ id: BIKE, target: { mode: 'cardio', sets: 1, min: 20, speed: 16.09344 }, sets: [{ min: 20, speed: 16.09344, done: true }] }] }

  it('shows a past cardio session in mph for a profile in pounds, and in km/h otherwise', () => {
    const [e] = past.entries
    expect(sessionLine(BIKE, 'cardio', e.sets, e.target, 'mph')).toContain('20 min @ 10 mph')
    expect(sessionLine(BIKE, 'cardio', e.sets, e.target, 'kmh')).toContain('20 min @ 16.1 km/h')
  })

  it.todo('the best set of a cardio exercise is also said in mph [old Workout.speed.test.jsx:97, logRef "best"; history.best for cardio is not asserted]')
})
