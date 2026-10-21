// @vitest-environment happy-dom
// Dismissing the Coach's suggestions with Undo (PR02 T11.0, T11.3; owner question 7): hidden at
// once, recorded and sent only when the 8 s window closes, nothing at all after an Undo or a reload.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sent = vi.hoisted(() => [])
vi.mock('./coach-api.js', () => ({ resolvePending: async body => { sent.push(body); return { ok: true } } }))

const { useStore } = await import('../store/useStore.js')
const { TOAST_ACTION_MS } = await import('../store/useUI.js')
const { emptyCoach } = await import('./coach.js')
const { dismissWithUndo, isDismissPending } = await import('./coach-dismiss.js')

const proposal = (id = 'p1', kind = 'review') => ({
  id, kind, summary: 'Three things.', evidence: null, notes: [],
  changes: [{ id: 'c1', type: 'sets' }, { id: 'c2', type: 'sets' }, { id: 'c3', type: 'week' }]
})
const coach = () => useStore.getState().S.coach

beforeEach(() => {
  vi.useFakeTimers()
  sent.length = 0
  useStore.setState(s => ({ S: { ...s.S, coach: emptyCoach() } }))
})
afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('dismissWithUndo', () => {
  it('hides the suggestions at once and records nothing until the window closes', () => {
    const { count } = dismissWithUndo(proposal())
    expect(count).toBe(3)
    expect(isDismissPending('p1')).toBe(true)
    vi.advanceTimersByTime(TOAST_ACTION_MS - 1)
    expect(coach().log).toEqual([])
    expect(sent).toEqual([])
  })

  it('records the dismissal and resolves it on the server when the window closes', () => {
    const onCommit = vi.fn()
    dismissWithUndo(proposal(), { onCommit })
    vi.advanceTimersByTime(TOAST_ACTION_MS)
    expect(isDismissPending('p1')).toBe(false)
    expect(coach().log).toHaveLength(1)
    expect(coach().log[0]).toMatchObject({ proposalId: 'p1', dismissed: true })
    expect(coach().lastReview?.at).toBeGreaterThan(0)
    expect(coach().chat.at(-1)).toMatchObject({ role: 'coach', kind: 'dismissed', ref: coach().log[0].id })
    expect(sent).toEqual([{ dismissed: true }])
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('Undo clears the flag and sends nothing, then or later', () => {
    const { undo } = dismissWithUndo(proposal())
    expect(undo()).toBe(true)
    expect(isDismissPending('p1')).toBe(false)
    vi.advanceTimersByTime(TOAST_ACTION_MS * 2)
    expect(coach().log).toEqual([])
    expect(sent).toEqual([])
    expect(undo()).toBe(false)
  })

  it('Undo after the window closed changes nothing', () => {
    const { undo } = dismissWithUndo(proposal())
    vi.advanceTimersByTime(TOAST_ACTION_MS)
    expect(undo()).toBe(false)
    expect(coach().log).toHaveLength(1)
  })

  it('a second dismissal commits the first at once', () => {
    dismissWithUndo(proposal('p1'))
    dismissWithUndo(proposal('p2'))
    expect(coach().log.map(e => e.proposalId)).toEqual(['p1'])
    expect(isDismissPending('p2')).toBe(true)
    vi.advanceTimersByTime(TOAST_ACTION_MS)
    expect(coach().log.map(e => e.proposalId)).toEqual(['p1', 'p2'])
    expect(sent).toHaveLength(2)
  })

  it('a reload inside the window drops the dismissal: nothing recorded, nothing sent, the suggestions back', async () => {
    dismissWithUndo(proposal())
    // The page goes away: its timers with it, and the module comes back fresh.
    vi.clearAllTimers()
    vi.resetModules()
    const fresh = await import('./coach-dismiss.js')
    expect(fresh.isDismissPending('p1')).toBe(false)
    expect(coach().log).toEqual([])
    expect(sent).toEqual([])
  })
})
