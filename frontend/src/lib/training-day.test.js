// The week strip's dot for a day (lib/training-day.js dayMark): trained, excused with a note, a
// changed plan, the plan, nothing. The day's kinds are covered through Home and the Training hub.
import { describe, expect, it } from 'vitest'
import { dayMark } from './training-day.js'

const MON = '2026-10-12', TUE = '2026-10-13', WED = '2026-10-14', THU = '2026-10-15', FRI = '2026-10-16'
const S = over => ({
  routines: [{ id: 'r1', name: 'Push', ex: [{ id: '0025' }] }],
  week: { 1: ['r1'], 3: ['r1'] }, dayPlan: {}, workouts: [], dayNotes: {}, queue: null, ...over,
})

describe('dayMark', () => {
  it('reads each day the way the calendar does', () => {
    const state = S({
      workouts: [{ id: 'w', d: MON, start: 1, end: 2, routineIds: ['r1'] }],
      dayPlan: { [FRI]: 'r1' },
      dayNotes: { [TUE]: { tag: 'sick', text: '', t: 1 } },
    })
    expect(dayMark(state, MON)).toBe('done')
    expect(dayMark(state, TUE)).toBe('noted')
    expect(dayMark(state, WED)).toBe('plan')
    expect(dayMark(state, THU)).toBeUndefined()
    expect(dayMark(state, FRI)).toBe('ovr')
  })

  it('a planned day set to rest has no dot', () => {
    expect(dayMark(S({ dayPlan: { [WED]: 'rest' } }), WED)).toBeUndefined()
  })
})
