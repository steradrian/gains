import { describe, expect, it } from 'vitest'
import {
  CHECKIN_NOTE_MAX, checkInFor, checkInWeek, markCheckInRead, markCheckInSent, pendingCheckIn, saveCheckIn, unreadCheckIn
} from './coach-checkin.js'

const WED = '2026-10-14'   // the week of Mon 12 Oct, or of Sun 11 Oct
const state = (over = {}) => ({ weekStart: 1, coachCheckIns: {}, coach: { lastReview: null }, ...over })

describe('checkInWeek', () => {
  it('files a check-in under the first day of its week, as the profile starts it', () => {
    expect(checkInWeek(state(), WED)).toBe('2026-10-12')
    expect(checkInWeek(state({ weekStart: 0 }), WED)).toBe('2026-10-11')
  })

  it('on the week’s first day, files under the week just ended (review #25)', () => {
    expect(checkInWeek(state(), '2026-10-19')).toBe('2026-10-12')               // a Monday
    expect(checkInWeek(state(), '2026-10-20')).toBe('2026-10-19')               // the Tuesday after
    expect(checkInWeek(state({ weekStart: 0 }), '2026-10-18')).toBe('2026-10-11') // a Sunday start
    expect(checkInWeek(state(), '2026-01-05')).toBe('2025-12-29')               // across the year
  })
})

describe('saveCheckIn and checkInFor', () => {
  it('saves the answer under the week and reads it back from any day of it', () => {
    const s = state()
    saveCheckIn(s, '2026-10-12', { feel: 'hard', sleep: 'poor', note: '  Shoulder a bit tight ' }, 100)
    expect(s.coachCheckIns['2026-10-12']).toEqual({ feel: 'hard', sleep: 'poor', note: 'Shoulder a bit tight', _ts: 100 })
    expect(checkInFor(s, '2026-10-18')).toEqual({ feel: 'hard', sleep: 'poor', note: 'Shoulder a bit tight' })
    // The next Monday still looks back at it (checkInWeek); the Tuesday is a new week.
    expect(checkInFor(s, '2026-10-19')).toEqual({ feel: 'hard', sleep: 'poor', note: 'Shoulder a bit tight' })
    expect(checkInFor(s, '2026-10-20')).toBeNull()
  })

  it('drops a word it does not know and cuts the note', () => {
    const s = state()
    saveCheckIn(s, '2026-10-12', { feel: 'meh', sleep: 'good', note: 'x'.repeat(CHECKIN_NOTE_MAX + 50) }, 100)
    expect(checkInFor(s, WED)).toEqual({ feel: null, sleep: 'good', note: 'x'.repeat(CHECKIN_NOTE_MAX) })
  })

  it('undo puts back a stamped clear when the week had none', () => {
    const s = state()
    const undo = saveCheckIn(s, '2026-10-12', { feel: 'right' }, 100)
    undo(s, 200)
    expect(s.coachCheckIns['2026-10-12']).toEqual({ _ts: 200 })
    expect(checkInFor(s, WED)).toBeNull()
  })

  it('undo puts back the earlier check-in of the same week', () => {
    const s = state()
    saveCheckIn(s, '2026-10-12', { feel: 'easy' }, 100)
    const undo = saveCheckIn(s, '2026-10-12', { feel: 'much' }, 150)
    undo(s, 200)
    expect(checkInFor(s, WED).feel).toBe('easy')
  })

  it('reads a state with no check-ins at all (an older copy, or a gallery mock)', () => {
    expect(checkInFor({}, WED)).toBeNull()
    expect(pendingCheckIn({})).toBeNull()
  })
})

describe('pendingCheckIn', () => {
  it('is the latest week saved after the last review, with only what was answered', () => {
    const s = state({
      coach: { lastReview: { at: 1000 } },
      coachCheckIns: {
        '2026-09-28': { feel: 'hard', sleep: null, note: '', _ts: 900 },     // read by that review
        '2026-10-05': { feel: 'right', sleep: 'ok', note: '', _ts: 1100 },
        '2026-10-12': { feel: null, sleep: 'poor', note: 'Late nights', _ts: 1200 },
      },
    })
    expect(pendingCheckIn(s)).toEqual({ week: '2026-10-12', sleep: 'poor', note: 'Late nights' })
  })

  it('is null once the review that read it was decided, and skips a cleared week', () => {
    expect(pendingCheckIn(state({ coach: { lastReview: { at: 1000 } }, coachCheckIns: { '2026-10-12': { feel: 'hard', _ts: 900 } } }))).toBeNull()
    expect(pendingCheckIn(state({ coachCheckIns: { '2026-10-12': { _ts: 900 } } }))).toBeNull()
  })

  it('counts everything as unread before the first review', () => {
    expect(pendingCheckIn(state({ coach: null, coachCheckIns: { '2026-10-12': { feel: 'much', _ts: 5 } } }))).toEqual({ week: '2026-10-12', feel: 'much' })
  })
})

// Review #4: only deciding the review that carried a check-in marks it read.
describe('markCheckInSent and markCheckInRead', () => {
  const saved = (ts = 1000) => state({
    coach: { lastReview: null },
    coachCheckIns: { '2026-10-12': { feel: 'hard', sleep: 'poor', note: '', _ts: ts } },
  })

  it('unreadCheckIn keeps the entry’s stamp beside the payload, and the payload has none', () => {
    const u = unreadCheckIn(saved(1000))
    expect(u).toEqual({ checkIn: { week: '2026-10-12', feel: 'hard', sleep: 'poor' }, ts: 1000 })
    expect(pendingCheckIn(saved(1000))).not.toHaveProperty('ts')
  })

  it('deciding the review that carried it marks it read', () => {
    const s = saved(1000)
    markCheckInSent(s, 'job1', unreadCheckIn(s))
    expect(s.coach.checkInSent).toEqual({ jobId: 'job1', week: '2026-10-12', ts: 1000 })
    markCheckInRead(s, 'job1')
    expect(s.coach.checkInSent).toBeNull()
    expect(s.coach.checkInReadTs).toBe(1000)
    expect(pendingCheckIn(s)).toBeNull()
  })

  it('A: deciding a scheduled review, which never carried it, leaves it unread', () => {
    const s = saved(1000)
    markCheckInRead(s, 'scheduled-job')
    s.coach.lastReview = { at: 5000 }       // what applyChangeSet / recordDismissal then stamp
    expect(pendingCheckIn(s)).toEqual({ week: '2026-10-12', feel: 'hard', sleep: 'poor' })
  })

  it('A: a review that carried it but is still undecided does not let another decision read it', () => {
    const s = saved(1000)
    markCheckInSent(s, 'job1', unreadCheckIn(s))
    markCheckInRead(s, 'scheduled-job')
    expect(pendingCheckIn(s)).not.toBeNull()
    expect(s.coach.checkInSent.jobId).toBe('job1')
  })

  it('B: a check-in saved while a review runs stays unread once that review is applied', () => {
    const s = saved(1000)
    markCheckInSent(s, 'job1', unreadCheckIn(s))                   // the review carried week 12
    saveCheckIn(s, '2026-10-19', { feel: 'easy' }, 3000)            // saved while it ran
    markCheckInRead(s, 'job1')
    s.coach.lastReview = { at: 4000 }
    expect(pendingCheckIn(s)).toEqual({ week: '2026-10-19', feel: 'easy' })
  })

  it('B: a review started with nothing to carry reads nothing when decided', () => {
    const s = state({ coach: { lastReview: null } })
    markCheckInSent(s, 'job1', null)
    saveCheckIn(s, '2026-10-12', { feel: 'right' }, 2000)
    markCheckInRead(s, 'job1')
    s.coach.lastReview = { at: 4000 }
    expect(pendingCheckIn(s)).toEqual({ week: '2026-10-12', feel: 'right' })
  })

  it('a state from before checkInReadTs keeps its read mark from the last decided review', () => {
    const s = state({
      coach: { lastReview: { at: 2000 } },
      coachCheckIns: { '2026-10-05': { feel: 'hard', _ts: 1500 }, '2026-10-12': { feel: 'easy', _ts: 2500 } },
    })
    markCheckInRead(s, 'scheduled-job')
    s.coach.lastReview = { at: 9000 }
    expect(s.coach.checkInReadTs).toBe(2000)
    expect(pendingCheckIn(s)).toEqual({ week: '2026-10-12', feel: 'easy' })
  })
})
