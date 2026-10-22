// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { GROUP_FULL } from '../../dev/screens/states/friends-group-fixture.js'
import {
  CHALLENGE_ACTIVE, CHALLENGE_DONE, CHALLENGE_DONE_NO_STREAK, CHALLENGE_MISSED, CHALLENGE_NOT_JOINED, CHALLENGE_THREE,
  PLANNED_TODAY_STATE, REST_TODAY_STATE,
} from '../../dev/screens/states/friends-fixture.js'
import {
  activeCount, barCaption, barSegments, datesLine, doneText, endPhrase, inCount, joinCaption, perPerson, plannedToday,
  progressText, startCaption, streakLine, toReach, totalOf, whoRows,
} from './challenge-copy.js'

const ME = 'u-adrian'

describe('endPhrase', () => {
  it('says tonight on the last day, tomorrow the day before, then the days left', () => {
    expect(endPhrase('2026-10-18', '2026-10-18')).toBe('ends tonight')
    expect(endPhrase('2026-10-18', '2026-10-17')).toBe('ends tomorrow')
    expect(endPhrase('2026-10-18', '2026-10-16')).toBe('2 days left')
    expect(endPhrase('2026-10-18', '2026-10-12')).toBe('6 days left')
  })

  it('says nothing once the last day is over', () => {
    expect(endPhrase('2026-10-18', '2026-10-19')).toBeNull()
  })

  it('counts across a month end', () => {
    expect(endPhrase('2026-11-02', '2026-10-31')).toBe('2 days left')
  })
})

describe('datesLine', () => {
  it('names who started it only when the payload says', () => {
    expect(datesLine(CHALLENGE_ACTIVE, ME)).toMatch(/ · started by Radu$/)
    const { startedBy, ...bare } = CHALLENGE_ACTIVE
    expect(startedBy).toBeTruthy()
    expect(datesLine(bare, ME)).not.toContain('started by')
  })

  it('says you for the viewer', () => {
    expect(datesLine({ ...CHALLENGE_ACTIVE, startedBy: { uid: ME, name: 'Adrian' } }, ME)).toMatch(/ · started by you$/)
  })
})

describe('the numbers', () => {
  it('shares the goal evenly only when it divides', () => {
    expect(perPerson(CHALLENGE_ACTIVE)).toBe(3)
    expect(perPerson({ ...CHALLENGE_ACTIVE, goal: 14 })).toBeNull()
    expect(perPerson({ ...CHALLENGE_ACTIVE, joined: [] })).toBeNull()
  })

  it('takes the total from the payload, else adds up what each counted', () => {
    expect(totalOf(CHALLENGE_ACTIVE)).toBe(12)
    expect(totalOf({ ...CHALLENGE_ACTIVE, total: undefined })).toBe(12)
    expect(progressText(CHALLENGE_ACTIVE)).toBe('12 of 15 workouts')
    expect(progressText(CHALLENGE_THREE)).toBe('8 of 15 days')
  })

  it('names the next one to reach only while the person has more to count', () => {
    expect(toReach(CHALLENGE_ACTIVE, ME)).toEqual({ next: 3, of: 3 })
    expect(startCaption({ next: 3, of: 3 })).toBe("Workout 3 of 3 counts the moment you finish today's workout.")
    const reached = { ...CHALLENGE_ACTIVE, joined: CHALLENGE_ACTIVE.joined.map(j => ({ ...j, count: 3 })) }
    expect(toReach(reached, ME)).toBeNull()
    expect(toReach(CHALLENGE_NOT_JOINED, ME)).toBeNull()
  })

  it('puts the number in the join caption only when it is the same for everyone', () => {
    expect(joinCaption(CHALLENGE_NOT_JOINED)).toBe('Joining adds your 3 to the goal. Leaving later takes them off, nothing else.')
    expect(joinCaption({ ...CHALLENGE_NOT_JOINED, goal: 13 })).toBe('Joining adds your part to the goal. Leaving later takes your count off, nothing else.')
  })

  it('counts only the running challenges against the limit', () => {
    expect(activeCount({ challenges: [{}, { state: 'active' }, { state: 'done' }, { state: 'missed' }] })).toBe(2)
    expect(activeCount(null)).toBe(0)
  })
})

describe('the bar', () => {
  it('has a segment per person in join order, in the colour the person has in the group, adding up to the count', () => {
    const segs = barSegments(CHALLENGE_ACTIVE, GROUP_FULL)
    expect(segs.map(s => s.uid)).toEqual(CHALLENGE_ACTIVE.joined.map(j => j.uid))
    expect(segs.reduce((n, s) => n + s.value, 0)).toBe(CHALLENGE_ACTIVE.total)
    expect(new Set(segs.map(s => s.tone)).size).toBe(segs.length)
    expect(segs[0].label).toBe('Adrian: 2')
  })

  it('keeps a person\'s colour when someone before them has not joined', () => {
    const inGroup = barSegments(CHALLENGE_NOT_JOINED, GROUP_FULL).find(s => s.uid === 'u-mara').tone
    const everyone = barSegments(CHALLENGE_ACTIVE, GROUP_FULL).find(s => s.uid === 'u-mara').tone
    expect(inGroup).toBe(everyone)
  })

  it('falls back to the order joined without the group', () => {
    expect(barSegments(CHALLENGE_ACTIVE, null)).toHaveLength(5)
  })

  it('says what the colours are, in the unit of the template', () => {
    expect(barCaption(CHALLENGE_ACTIVE)).toBe("One shared bar. Each colour is someone's workouts, in the order you joined.")
    expect(barCaption(CHALLENGE_THREE)).toContain("someone's days")
  })
})

describe('Who\'s in', () => {
  it('lists the joined in join order with their counts, then the invited dimmed', () => {
    const rows = whoRows(CHALLENGE_THREE, GROUP_FULL, ME)
    expect(rows.map(r => r.name)).toEqual(['Adrian', 'Mara', 'Radu', 'Ioana', 'Vlad'])
    expect(rows.map(r => r.invited)).toEqual([false, false, false, true, true])
    expect(rows[0]).toMatchObject({ you: true, end: '3 of 5' })
    expect(rows[3].end).toBe('Invited')
  })

  it('works with an empty invited list', () => {
    const rows = whoRows({ ...CHALLENGE_ACTIVE, invited: [] }, GROUP_FULL, ME)
    expect(rows).toHaveLength(5)
    expect(rows.every(r => !r.invited)).toBe(true)
    expect(inCount({ ...CHALLENGE_ACTIVE, invited: [] }, null)).toEqual({ joined: 5, all: 5 })
  })

  it('shows a count as a bare number when no per-person target is known', () => {
    const rows = whoRows({ ...CHALLENGE_ACTIVE, joined: [{ uid: 'u-mara', name: 'Mara', count: 2 }] }, GROUP_FULL, ME)
    expect(rows[0].end).toBe('2')
  })

  it('counts who is in of the whole group', () => {
    expect(inCount(CHALLENGE_NOT_JOINED, GROUP_FULL)).toEqual({ joined: 4, all: 5 })
    expect(inCount(CHALLENGE_ACTIVE, GROUP_FULL)).toEqual({ joined: 5, all: 5 })
  })

  it('leaves out an invited person the group cannot name', () => {
    const rows = whoRows({ ...CHALLENGE_ACTIVE, joined: [], invited: ['u-nobody', 'u-mara'] }, GROUP_FULL, ME)
    expect(rows.map(r => r.uid)).toEqual(['u-mara'])
  })
})

describe('done and missed copy', () => {
  it('builds the done sentences from the data', () => {
    expect(doneText(CHALLENGE_DONE)).toBe('15 of 15 workouts. Everyone trained 3 times this week.')
  })

  it('drops "this week" for a longer challenge and the second sentence for other templates', () => {
    expect(doneText({ ...CHALLENGE_DONE, span: 'month' })).toBe('15 of 15 workouts. Everyone trained 3 times.')
    expect(doneText({ ...CHALLENGE_DONE, template: 'protein' })).toBe('15 of 15 days.')
  })

  it('says the streak and who was in only when the goal was hit in a row', () => {
    expect(streakLine(CHALLENGE_DONE, GROUP_FULL)).toBe('Goal hit 5 weeks in a row · 5 of 5 in')
    expect(streakLine(CHALLENGE_DONE_NO_STREAK, GROUP_FULL)).toBeNull()
    expect(streakLine({ ...CHALLENGE_DONE, streak: 1 }, GROUP_FULL)).toBe('Goal hit 1 week in a row · 5 of 5 in')
  })

  it('says how far a missed challenge got and names nobody', () => {
    expect(progressText(CHALLENGE_MISSED)).toBe('11 of 15 workouts')
  })
})

describe('plannedToday', () => {
  it('names today\'s routine and its ids when one is planned', () => {
    expect(plannedToday(PLANNED_TODAY_STATE)).toEqual({ name: 'Push A', ids: ['r-push'] })
  })

  it('is null on a rest day, while a workout runs and without a state', () => {
    expect(plannedToday(REST_TODAY_STATE)).toBeNull()
    expect(plannedToday({ ...PLANNED_TODAY_STATE, active: { name: 'Push A', entries: [], start: Date.now() } })).toBeNull()
    expect(plannedToday(null)).toBeNull()
  })
})
