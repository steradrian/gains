import { describe, expect, it } from 'vitest'
import { deviceKind, joinTime, plannedRoutineNames, plannedWeekdays, reminderCount, splitTime } from './reminder-state.js'

describe('deviceKind', () => {
  const web = { mobile: false, pushOK: true, needsHome: false, permission: 'default' }
  it('is ready on the phone app whatever the browser says', () => {
    expect(deviceKind({ ...web, mobile: true, pushOK: false, permission: 'denied' })).toBe('ready')
  })
  it('asks an iPhone browser tab to install first, before anything else', () => {
    expect(deviceKind({ ...web, needsHome: true, pushOK: false })).toBe('install')
  })
  it('says nopush for a browser without push, blocked for a denied permission, else ready', () => {
    expect(deviceKind({ ...web, pushOK: false, permission: 'unsupported' })).toBe('nopush')
    expect(deviceKind({ ...web, permission: 'denied' })).toBe('blocked')
    expect(deviceKind({ ...web, permission: 'granted' })).toBe('ready')
    expect(deviceKind(web)).toBe('ready')
  })
})

describe('reminderCount', () => {
  it('counts the workout-day reminder and the nudge that rides on it', () => {
    expect(reminderCount({ reminder: { on: false, nudge: true } })).toBe(0)
    expect(reminderCount({ reminder: { on: true } })).toBe(1)
    expect(reminderCount({ reminder: { on: true, nudge: true } })).toBe(2)
    expect(reminderCount({})).toBe(0)
  })
})

describe('time helpers', () => {
  it('splits and joins HH:MM, falling back to 08:00', () => {
    expect(splitTime('18:05')).toEqual([18, 5])
    expect(splitTime('')).toEqual([8, 0])
    expect(splitTime('nonsense')).toEqual([8, 0])
    expect(joinTime(7, 0)).toBe('07:00')
    expect(joinTime(18, 45)).toBe('18:45')
  })
})

describe('the plan', () => {
  const S = { routines: [{ id: 'a', name: 'Push A' }, { id: 'b', name: 'Legs' }], week: { 0: ['b'], 1: ['a'], 3: 'a', 4: ['gone'] } }
  it('lists the weekdays that have a routine that exists', () => {
    expect([...plannedWeekdays(S)].sort()).toEqual([0, 1, 3])
  })
  it('names each planned routine once, Monday first', () => {
    expect(plannedRoutineNames(S)).toEqual(['Push A', 'Legs'])
    expect(plannedRoutineNames({})).toEqual([])
  })
})
