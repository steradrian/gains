// @vitest-environment happy-dom
// Add past workout (PR07 D1.6): the planned routine first and picked, the other routines, the
// start and the length; Start opens the workout for that date through the existing past-workout
// path (sheets submitPastWorkout), with the choice, the time and the minutes as given.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { click, type, useView } from '../../ds/render.test-util.js'
import { submitPastWorkout } from '../../sheets.jsx'
import { PastWorkoutSheet, pastWorkoutOf } from './PastWorkoutSheet.jsx'

vi.mock('../../sheets.jsx', async importOriginal => ({ ...(await importOriginal()), submitPastWorkout: vi.fn(() => true) }))

// Sun 18 Oct 2026 is today. Push A on Mondays, Legs on Fridays; Legs was missed on Fri 16 Oct.
const TODAY = '2026-10-18'
const clone = o => JSON.parse(JSON.stringify(o))
const at = (d, h) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime()
const routine = (id, name, n = 1) => ({ id, name, ex: Array.from({ length: n }, () => ({ id: '0025', sets: 3, reps: 8, weight: 60 })) })
const legsDone = (d, minutes) => ({ id: 'l' + d, d, name: 'Legs', start: at(d, 18), end: at(d, 18) + minutes * 60000, routineIds: ['legs'], entries: [], prs: [] })
const S = over => ({
  ...clone(DEF),
  routines: [routine('push', 'Push A', 6), routine('pull', 'Pull A', 6), routine('legs', 'Legs', 5)],
  week: { 1: ['push'], 5: ['legs'] },
  workouts: [legsDone('2026-10-02', 53), legsDone('2026-10-09', 57)],
  dayPlan: {}, missedSeen: {}, active: null,
  ...over,
})

const view = useView()
const sheet = () => view.host.querySelector('.g-bs')
const radios = () => [...sheet().querySelectorAll('[role="radio"]')]
const start = () => sheet().querySelector('.g-bs-foot .g-btn')

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(TODAY + 'T09:00:00')) })
afterAll(() => vi.useRealTimers())
beforeEach(() => { submitPastWorkout.mockClear(); useStore.setState({ S: S() }) })

describe('pastWorkoutOf', () => {
  it('starts at the planned routine’s usual length, rounded to 5 minutes, at 18:00', () => {
    const p = pastWorkoutOf(S(), '2026-10-16', TODAY)
    expect(p).toMatchObject({ iso: '2026-10-16', time: '18:00', durationMin: 55 })
    expect(p.choices[0]).toMatchObject({ key: 'legs', planned: true })
  })

  it('starts at an hour on a day with nothing planned', () => {
    expect(pastWorkoutOf(S(), '2026-10-13', TODAY).durationMin).toBe(60)
  })
})

describe('Add past workout', () => {
  it('names the day, lists the planned routine first and picked, then the others and Freestyle', () => {
    view.render(<PastWorkoutSheet iso="2026-10-16" close={() => {}} />)
    expect(sheet().querySelector('h2').textContent).toBe('Add past workout')
    expect(sheet().querySelector('.g-bs-chip').textContent).toBe('Fri 16 Oct')
    expect(radios().map(r => r.querySelector('b').textContent)).toEqual(['Legs', 'Push A', 'Pull A', 'Freestyle'])
    expect(radios()[0].querySelector('.g-radio-body span').textContent).toBe('Planned for this day · 5 exercises')
    expect(radios()[0].getAttribute('aria-checked')).toBe('true')
    expect(start().textContent).toBe('Log Legs for Fri 16 Oct')
    expect(sheet().querySelector('.g-bs-note').textContent).toBe('Opens the workout to fill in sets. It saves to Fri 16 Oct.')
  })

  it('Start opens the planned workout for that date with the start and the length', () => {
    const close = vi.fn()
    view.render(<PastWorkoutSheet iso="2026-10-16" close={close} />)
    click(start())
    expect(submitPastWorkout).toHaveBeenCalledWith({ iso: '2026-10-16', time: '18:00', durationMin: 55, routineIds: ['legs'] }, { before: close })
  })

  it('another routine, start and length go as picked and typed', () => {
    view.render(<PastWorkoutSheet iso="2026-10-16" close={() => {}} />)
    click(radios()[1])
    expect(radios()[1].getAttribute('aria-checked')).toBe('true')
    expect(start().textContent).toBe('Log Push A for Fri 16 Oct')
    const [time, minutes] = sheet().querySelectorAll('.g-tfield input')
    type(time, '07:30')
    type(minutes, '40')
    click(start())
    expect(submitPastWorkout).toHaveBeenCalledWith(expect.objectContaining({ time: '07:30', durationMin: 40, routineIds: ['push'] }), expect.anything())
  })

  it('Freestyle opens an empty workout', () => {
    view.render(<PastWorkoutSheet iso="2026-10-13" close={() => {}} />)
    click(radios().at(-1))
    click(start())
    expect(submitPastWorkout).toHaveBeenCalledWith(expect.objectContaining({ iso: '2026-10-13', routineIds: [] }), expect.anything())
  })
})
