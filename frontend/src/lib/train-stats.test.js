// Train's ring numbers (PR02 T2.0): the best streak, a week's volume and how the pair reads,
// and how long a routine usually takes.
import { describe, expect, it } from 'vitest'
import { bestStreakWeeks, TONNE_FROM, usualDuration, volumePair, volumeText, weekVolume } from './train-stats.js'

const at = (d, h = 10) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime()
const w = (d, extra = {}) => ({ id: d + (extra.id || ''), d, start: at(d), end: at(d, 11), entries: [], ...extra })
const lift = (wt, r) => ({ id: '0025', sets: [{ w: wt, r, done: true }] })

describe('bestStreakWeeks', () => {
  it('is the longest run of weeks with a workout, wherever it was', () => {
    const workouts = ['2026-09-01', '2026-09-08', '2026-09-16', '2026-09-22', '2026-10-06', '2026-10-13'].map(d => w(d))
    expect(bestStreakWeeks({ workouts })).toBe(4)
    expect(bestStreakWeeks({ workouts: [] })).toBe(0)
  })

  it('counts two workouts in one week once, in the profile’s weeks', () => {
    // Sun 13 Sep and Mon 14 Sep: one week Monday-first, two Sunday-first.
    const workouts = [w('2026-09-13'), w('2026-09-14', { id: 'b' }), w('2026-09-15', { id: 'c' })]
    expect(bestStreakWeeks({ workouts })).toBe(2)
    expect(bestStreakWeeks({ workouts, weekStart: 0 })).toBe(1)
  })
})

describe('weekVolume', () => {
  it('adds the finished sets of the week’s workouts and nothing else', () => {
    const workouts = [
      w('2026-10-12', { entries: [lift(100, 5)] }),
      w('2026-10-14', { id: 'b', entries: [lift(50, 10), { id: '0025', sets: [{ w: 100, r: 5, done: false }] }] }),
      w('2026-10-19', { id: 'c', entries: [lift(200, 5)] }),
    ]
    expect(weekVolume({ workouts }, '2026-10-18')).toBe(1000)
    expect(weekVolume({ workouts }, '2026-10-19')).toBe(1000)
    expect(weekVolume({ workouts }, '2026-10-05')).toBe(0)
  })
})

describe('volumePair', () => {
  it('kilograms below 10 000, tonnes for both once either is past it', () => {
    expect(volumePair(9600, 8000, 'kg')).toEqual({ a: '9,600', b: '8,000', unit: 'kg' })
    expect(volumePair(14300, 9600, 'kg')).toEqual({ a: '14.3', b: '9.6', unit: 't' })
    expect(volumePair(TONNE_FROM, 0, 'kg').unit).toBe('t')
  })

  it('a pound profile stays in pounds', () => {
    expect(volumePair(31000, 20000, 'lb')).toEqual({ a: '31,000', b: '20,000', unit: 'lb' })
  })
})

describe('volumeText', () => {
  it('one volume by the same rule: kilograms, tonnes from 10 000 kg, pounds stay pounds', () => {
    expect(volumeText(9600, 'kg')).toBe('9,600 kg')
    expect(volumeText(12400, 'kg')).toBe('12.4 t')
    expect(volumeText(31000, 'lb')).toBe('31,000 lb')
  })
})

describe('usualDuration', () => {
  const run = (d, mins, ids = ['push']) => ({ id: d, d, start: at(d), end: at(d) + mins * 60000, routineIds: ids })
  it('is the median of the routine’s last five timed sessions', () => {
    const workouts = [run('2026-09-01', 90), run('2026-09-02', 50), run('2026-09-03', 55), run('2026-09-04', 60), run('2026-09-05', 52), run('2026-09-06', 58)]
    expect(usualDuration({ workouts }, 'push')).toBe(55 * 60000)
    expect(usualDuration({ workouts: workouts.slice(0, 2) }, 'push')).toBe(70 * 60000)
  })

  it('leaves out untimed sessions and other routines; null with none', () => {
    const workouts = [run('2026-09-01', 0), run('2026-09-02', 40, ['pull']), { id: 'x', d: '2026-09-03', routineId: 'push' }]
    expect(usualDuration({ workouts }, 'push')).toBeNull()
  })
})
