// @vitest-environment happy-dom
// What there is to start today with a coach week or rotation running (S.queue), and the today card
// it gives Train: the cases the old Home queue tests held (review #14).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fmtDate } from '../lib/format.js'
import { DEF } from '../store/useStore.js'
import { cardOf } from '../views/train/use-train.js'
import { startChoices } from './use-start-choices.js'

// Sun 18 Oct 2026. A coach week of Push A, Pull A, Legs, applied on Thursday; no weekday plan.
const TODAY = '2026-10-18', THU = '2026-10-15', SAT = '2026-10-17', TUE = '2026-10-20'
const clone = o => JSON.parse(JSON.stringify(o))
const routine = (id, name) => ({ id, name, ex: [{ id: '0025', sets: 3, reps: 8 }] })
const since = new Date(THU + 'T00:00:00').getTime()
const logged = (id, d, routineId) => ({ id, d, name: routineId, start: new Date(d + 'T10:00:00').getTime(), end: new Date(d + 'T11:00:00').getTime(), routineIds: [routineId], entries: [], prs: [] })
const S = over => ({
  ...clone(DEF),
  routines: [routine('push', 'Push A'), routine('pull', 'Pull A'), routine('legs', 'Legs')],
  week: {}, dayPlan: {}, dayNotes: {}, workouts: [],
  queue: { ids: ['push', 'pull', 'legs'], since, startsOn: THU, label: 'Coach week 3' },
  ...over,
})

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(TODAY + 'T09:00:00')) })
afterAll(() => vi.useRealTimers())

describe('start choices with a coach week', () => {
  it('today is the next session of the week, not rescheduled', () => {
    expect(startChoices(S(), TODAY).today).toMatchObject({ ids: ['push'], name: 'Push A', rescheduled: false })
  })

  it('a session pinned to today is today’s, and reads as rescheduled (the pin is still open)', () => {
    expect(startChoices(S({ dayPlan: { [TODAY]: 'legs' } }), TODAY).today).toMatchObject({ ids: ['legs'], rescheduled: true })
  })

  it('a fulfilled pin is not "rescheduled": the session pinned here is done, so the queue’s next is offered', () => {
    const state = S({ dayPlan: { [TODAY]: 'push' }, workouts: [logged('w1', SAT, 'push')] })
    expect(startChoices(state, TODAY).today).toMatchObject({ ids: ['pull'], rescheduled: false })
  })

  it('a queue session done today offers the next one', () => {
    const state = S({ workouts: [logged('w1', TODAY, 'push')] })
    expect(startChoices(state, TODAY).today.ids).toEqual(['pull'])
  })

  it('a rest set for today beats the queue', () => {
    const state = S({ dayPlan: { [TODAY]: 'rest' } })
    expect(startChoices(state, TODAY).today.ids).toEqual([])
    expect(cardOf(state, TODAY, TODAY).kind).toBe('rest')
  })
})

describe('the today card with a coach week', () => {
  it('a week waiting for its start day: today rests, and the card names the day it starts', () => {
    const card = cardOf(S({ queue: { ids: ['push', 'pull', 'legs'], since, startsOn: TUE, label: 'Coach week 4' } }), TODAY, TODAY)
    expect(card.kind).toBe('rest')
    expect(card.sub).toBe('Next: Push A, ' + fmtDate(TUE, true))
  })
})
