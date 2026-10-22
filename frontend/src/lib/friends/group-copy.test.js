import { describe, expect, it } from 'vitest'
import { MEMBER_TONES } from '../../ds/MemberAvatar.jsx'
import {
  GROUP_ALONE, GROUP_AS_MEMBER, GROUP_FULL, GROUP_GAP_WEEK, GROUP_NO_ACTIVITY, GROUP_OVER_GOAL,
} from '../../dev/screens/states/friends-group-fixture.js'
import {
  challengeRow, cheerToastText, headerLine, leaveBy, legendRows, momentKind, momentPeople, ringLabel, ringSegments, sharedLine,
  streakLine, targetsLine, weekCells,
} from './group-copy.js'

describe('the ring', () => {
  it('has a segment per member in join order, each with the member\'s own plan, never sorted or red', () => {
    const segs = ringSegments(GROUP_FULL)
    expect(segs.map(s => [s.value, s.of])).toEqual([[4, 4], [3, 4], [4, 5], [3, 4], [3, 5]])
    expect(new Set(segs.map(s => s.tone)).size).toBe(5)
    for (const s of segs) expect(MEMBER_TONES).toContain(s.tone)
    expect(segs.map(s => s.tone)).not.toContain('red')
  })

  it('gives a member with no plan this week no segment, and "No plan" in the legend', () => {
    expect(ringSegments(GROUP_GAP_WEEK)).toHaveLength(4)
    const radu = legendRows(GROUP_GAP_WEEK).find(r => r.uid === 'u-radu')
    expect(radu.text).toBe('No plan')
  })

  it('names the viewer "You" and writes each member\'s own count', () => {
    const rows = legendRows(GROUP_FULL)
    expect(rows[0]).toMatchObject({ name: 'You', text: '4 of 4' })
    expect(rows[2]).toMatchObject({ name: 'Radu', text: '4 of 5' })
  })

  it('speaks totals with the unit, never bare numbers, and keeps going past the goal', () => {
    expect(ringLabel(GROUP_FULL)).toBe('17 of 22 planned sessions')
    expect(ringLabel(GROUP_OVER_GOAL)).toBe('19 of 17 planned sessions')
  })
})

describe('lines the data must back', () => {
  it('writes the header from the member count and the month it began, and leaves "since" out without a date', () => {
    expect(headerLine(GROUP_FULL)).toMatch(/^5 friends · since /)
    expect(headerLine({ ...GROUP_FULL, since: undefined })).toBe('5 friends')
    expect(headerLine(GROUP_ALONE)).toMatch(/^Just you/)
  })

  it('shows the streak only above 0, as the week-in-a-row line when the week is quiet', () => {
    expect(streakLine(GROUP_FULL)).toBe('4-week streak')
    expect(streakLine(GROUP_NO_ACTIVITY)).toBe('Goal hit 4 weeks in a row')
    expect(streakLine({ ...GROUP_FULL, streak: 0 })).toBeNull()
  })

  it('shows targets only while someone shares them and the week has started', () => {
    expect(targetsLine(GROUP_FULL)).toBe('5 of 7 targets hit')
    expect(targetsLine({ ...GROUP_FULL, targets: { hit: 0, of: 0 } })).toBeNull()
    expect(targetsLine({ ...GROUP_FULL, targets: undefined })).toBeNull()
    expect(targetsLine(GROUP_NO_ACTIVITY)).toBeNull()
  })

  it('marks a day done where anyone logged a workout, and never calls an empty day missed', () => {
    const cells = weekCells(GROUP_FULL, GROUP_FULL.weekDays[3].date)
    expect(cells).toHaveLength(7)
    expect(cells.filter(c => c.today)).toHaveLength(1)
    expect(cells.every(c => ['done', 'rest'].includes(c.training))).toBe(true)
    expect(cells.some(c => c.training === 'done')).toBe(true)
    expect(weekCells(GROUP_NO_ACTIVITY).every(c => c.training === 'rest')).toBe(true)
  })
})

describe('moments and challenges', () => {
  it('tags only a new best and a reached target', () => {
    expect(momentKind('best')).toBe('NEW BEST')
    expect(momentKind('target')).toBe('Target reached')
    expect(momentKind('workout')).toBeNull()
    expect(momentKind('together')).toBeNull()
  })

  it('draws everyone a moment is about, in join order', () => {
    const together = GROUP_FULL.moments.find(m => m.kind === 'together')
    expect(momentPeople(GROUP_FULL, together).map(p => p.uid)).toEqual(['u-adrian', 'u-ioana'])
  })

  it('names whose it was and what in the cheer toast, or just the name without a label', () => {
    const legs = GROUP_FULL.moments[0]
    expect(cheerToastText(GROUP_FULL, legs)).toBe("Cheered Mara's Legs")
    expect(cheerToastText(GROUP_FULL, { ...legs, label: undefined })).toBe('Cheered Mara')
  })

  it('says joined or not joined with the progress and what it counts', () => {
    const joined = challengeRow(GROUP_FULL, GROUP_FULL.challenges[0])
    expect(joined.progress).toBe('Joined 12 of 15 workouts')
    expect(joined.people).toHaveLength(5)
    const not = challengeRow(GROUP_NO_ACTIVITY, GROUP_NO_ACTIVITY.challenges[0])
    expect(not.progress).toBe('Not joined 0 of 25 days')
  })

  it('adds "ends tonight" or "starts today" only when it is true', () => {
    const ch = GROUP_FULL.challenges[0]
    expect(challengeRow(GROUP_FULL, ch, ch.end).dates).toMatch(/ · ends tonight$/)
    expect(challengeRow(GROUP_FULL, ch, ch.start).dates).toMatch(/ · starts today$/)
    expect(challengeRow(GROUP_FULL, ch, '2000-01-01').dates).not.toMatch(/ends|starts/)
  })
})

describe('leaving and sharing lines', () => {
  it('names the creator by first name for Groups, unless the viewer is the creator', () => {
    expect(leaveBy(GROUP_AS_MEMBER)).toBe('Mara')
    expect(leaveBy(GROUP_FULL)).toBeUndefined()
  })

  it('lists the switches that are on, and nothing when none are', () => {
    expect(sharedLine({ training: true, consistency: true, targets: true, bests: false })).toBe('Training, consistency, targets')
    expect(sharedLine({ training: false, consistency: false, targets: false, bests: false })).toBeNull()
    expect(sharedLine(undefined)).toBeNull()
  })
})
