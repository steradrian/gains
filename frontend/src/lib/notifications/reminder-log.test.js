// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { LOG_DAYS, firedReminders, nextLog, recordScheduled } from './reminder-log.js'

const DAY = 86400000
const NOW = new Date(2026, 9, 21, 12).getTime()
const entry = (iso, at, over = {}) => ({ kind: 'workout', iso, at, time: '18:00', routines: [{ id: 'r1', name: 'Push A' }], ...over })
const signIn = user => useStore.setState({ user })

afterEach(() => { localStorage.clear(); signIn(null) })

describe('nextLog', () => {
  it('what was waiting and came due has gone off; the rest was cancelled by the sync', () => {
    const log = { pending: [entry('2026-10-20', NOW - DAY), entry('2026-10-22', NOW + DAY)], fired: [] }
    const next = nextLog(log, [entry('2026-10-23', NOW + 2 * DAY)], NOW)
    expect(next.fired.map(e => e.iso)).toEqual(['2026-10-20'])
    expect(next.pending.map(e => e.iso)).toEqual(['2026-10-23'])
  })

  it('with the permission off, what came due never showed: it is forgotten, not fired', () => {
    const log = { pending: [entry('2026-10-20', NOW - DAY)], fired: [entry('2026-10-19', NOW - 2 * DAY)] }
    const next = nextLog(log, [], NOW, false)
    expect(next.fired.map(e => e.iso)).toEqual(['2026-10-19'])
    expect(next.pending).toEqual([])
  })

  it('logs a reminder once, keeps LOG_DAYS, and drops anything malformed', () => {
    const old = entry('2026-09-01', NOW - (LOG_DAYS + 1) * DAY)
    const due = entry('2026-10-20', NOW - DAY)
    const next = nextLog({ pending: [due, { kind: 'x' }, null], fired: [old, due] }, [], NOW)
    expect(next.fired).toEqual([due])
    expect(next.pending).toEqual([])
  })

  it('starts from nothing: no back-fill', () => {
    expect(nextLog(null, [entry('2026-10-22', NOW + DAY)], NOW)).toEqual({ pending: [entry('2026-10-22', NOW + DAY)], fired: [] })
  })
})

describe('the device log', () => {
  it('a reminder scheduled at one sync shows as gone off once its time has passed', () => {
    recordScheduled([entry('2026-10-21', NOW + 1000), entry('2026-10-22', NOW + DAY)], NOW)
    expect(firedReminders(NOW)).toEqual([])
    expect(firedReminders(NOW + 2000).map(e => e.iso)).toEqual(['2026-10-21'])
  })

  it('one cancelled before its time (the workout was logged) never shows', () => {
    recordScheduled([entry('2026-10-21', NOW + 1000)], NOW)
    recordScheduled([], NOW + 500)
    expect(firedReminders(NOW + 2000)).toEqual([])
  })

  it('a sync that finds the permission off drops what came due', () => {
    recordScheduled([entry('2026-10-21', NOW + 1000)], NOW)
    recordScheduled([], NOW + 2000, false)
    expect(firedReminders(NOW + 3000)).toEqual([])
  })

  it('each profile on the phone has its own log', () => {
    signIn({ id: 1, name: 'ana' })
    recordScheduled([entry('2026-10-21', NOW + 1000)], NOW)
    expect(firedReminders(NOW + 2000)).toHaveLength(1)
    signIn({ id: 2, name: 'bo' })
    expect(firedReminders(NOW + 2000)).toEqual([])
    signIn(null)
    expect(firedReminders(NOW + 2000)).toEqual([])
    signIn({ id: 1, name: 'ana' })
    expect(firedReminders(NOW + 2000)).toHaveLength(1)
  })

  it('reads as empty when nothing was ever stored, or the store holds junk', () => {
    expect(firedReminders(NOW)).toEqual([])
    localStorage.setItem('gains_reminder_log:guest', '{not json')
    expect(firedReminders(NOW)).toEqual([])
  })
})
