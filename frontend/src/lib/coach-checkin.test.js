import { describe, expect, it } from 'vitest'
import { CHECKIN_NOTE_MAX, checkInFor, checkInWeek, pendingCheckIn, saveCheckIn } from './coach-checkin.js'

const WED = '2026-10-14'   // the week of Mon 12 Oct, or of Sun 11 Oct
const state = (over = {}) => ({ weekStart: 1, coachCheckIns: {}, coach: { lastReview: null }, ...over })

describe('checkInWeek', () => {
  it('files a check-in under the first day of its week, as the profile starts it', () => {
    expect(checkInWeek(state(), WED)).toBe('2026-10-12')
    expect(checkInWeek(state({ weekStart: 0 }), WED)).toBe('2026-10-11')
  })
})

describe('saveCheckIn and checkInFor', () => {
  it('saves the answer under the week and reads it back from any day of it', () => {
    const s = state()
    saveCheckIn(s, '2026-10-12', { feel: 'hard', sleep: 'poor', note: '  Shoulder a bit tight ' }, 100)
    expect(s.coachCheckIns['2026-10-12']).toEqual({ feel: 'hard', sleep: 'poor', note: 'Shoulder a bit tight', _ts: 100 })
    expect(checkInFor(s, '2026-10-18')).toEqual({ feel: 'hard', sleep: 'poor', note: 'Shoulder a bit tight' })
    expect(checkInFor(s, '2026-10-19')).toBeNull()
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
