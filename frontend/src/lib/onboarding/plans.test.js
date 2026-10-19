// The starter plan's marks and its next session (boards O2.10, O2.12).
import { describe, expect, it } from 'vitest'
import { nextSession, sessionMark } from './plans.js'

describe('sessionMark', () => {
  it('is the first letter of each word of the name, at most three', () => {
    expect(sessionMark('Upper A', 0)).toBe('UA')
    expect(sessionMark('Full Body B', 1)).toBe('FBB')
    expect(sessionMark('Push Pull Legs Day', 0)).toBe('PPL')
  })

  it('is the session\'s letter in the plan without a name', () => {
    expect(sessionMark('', 2)).toBe('C')
    expect(sessionMark(undefined, 0)).toBe('A')
  })
})

describe('nextSession', () => {
  const plan = { weekdays: [1, 3, 5], equipment: 'gym' }

  it('is the first planned day from today on, today included', () => {
    expect(nextSession(plan, 3, 3)).toMatchObject({ day: 3, ahead: 0 })
    expect(nextSession(plan, 3, 4)).toMatchObject({ day: 5, ahead: 1 })
    // Saturday: round the week to Monday.
    expect(nextSession(plan, 3, 6)).toMatchObject({ day: 1, ahead: 2 })
  })

  it('carries that day\'s session, as the plan lays them out', () => {
    const next = nextSession(plan, 3, 4)
    expect(next.session.name).toMatch(/^Full Body/)
    expect(next.session.exercises.length).toBeGreaterThan(0)
  })

  it('is null where the plan has no session', () => {
    expect(nextSession(plan, 0, 1)).toBeNull()
  })
})
