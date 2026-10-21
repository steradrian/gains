// syncReminder and the notifications inbox's reminder log (lib/notifications/reminder-log.js): a
// reminder that came due while the phone's permission was off never showed, so the sync that finds
// it off forgets it instead of logging it as gone off.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  vi.stubEnv('VITE_MOBILE', '1')   // lib/mobile.js: MOBILE = import.meta.env.VITE_MOBILE === '1'
  return { perm: 'granted', record: null, schedule: null }
})

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    cancel: async () => {},
    checkPermissions: async () => ({ display: h.perm }),
    requestPermissions: async () => ({ display: h.perm }),
    schedule: (...args) => h.schedule(...args),
  },
}))
vi.mock('./notifications/reminder-log.js', () => ({ recordScheduled: (...args) => h.record(...args) }))

const { syncReminder } = await import('./mobile.js')

const S = on => ({ reminder: { on, time: '23:59' }, routines: [{ id: 'r1', name: 'Push A', ex: [] }], week: { 0: ['r1'], 1: ['r1'], 2: ['r1'], 3: ['r1'], 4: ['r1'], 5: ['r1'], 6: ['r1'] }, dayPlan: {}, workouts: [] })

beforeEach(() => {
  h.record = vi.fn()
  h.schedule = vi.fn(async () => {})
})

describe('syncReminder and the reminder log', () => {
  it('with the permission on, what came due is logged and the new ones wait', async () => {
    h.perm = 'granted'
    expect(await syncReminder(S(true))).toBe(true)
    expect(h.record.mock.calls[0][0]).toEqual([])
    expect(h.record.mock.calls[0][2]).toBe(true)
    expect(h.schedule).toHaveBeenCalled()
    expect(h.record.mock.calls[1][0].length).toBeGreaterThan(0)
  })

  it('with the permission off, what came due is forgotten and nothing new is logged', async () => {
    h.perm = 'denied'
    expect(await syncReminder(S(true))).toBe(false)
    expect(h.record).toHaveBeenCalledTimes(1)
    expect(h.record.mock.calls[0][0]).toEqual([])
    expect(h.record.mock.calls[0][2]).toBe(false)
    expect(h.schedule).not.toHaveBeenCalled()
  })

  it('turning the reminder off still logs what went off before, when the phone could show it', async () => {
    h.perm = 'granted'
    expect(await syncReminder(S(false))).toBe(true)
    expect(h.record.mock.calls).toEqual([[[], expect.any(Number), true]])
  })
})
