// @vitest-environment happy-dom
// The Today card's "seen" mark: per person, only moves forward, survives a reload through
// localStorage, still works where storage throws, and never touches real storage in the gallery.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../../store/useStore.js', () => ({ useStore: { getState: () => ({ user: { id: 'u1' } }) } }))

import { __resetCardSeen, markCardSeen, readCardSeen, subscribeCardSeen } from './card-seen.js'
import { __setMockFriends } from './store.js'

beforeEach(() => { localStorage.clear(); __resetCardSeen() })
afterEach(() => { vi.restoreAllMocks() })

describe('the card seen mark', () => {
  it('is nothing until the person hides or opens the card', () => {
    expect(readCardSeen('u1')).toBe(0)
  })

  it('is kept per person on this device', () => {
    markCardSeen('u1', 500)
    expect(readCardSeen('u1')).toBe(500)
    expect(readCardSeen('u2')).toBe(0)
    expect(localStorage.getItem('gains_friends_card_seen:u1')).toBe('500')
  })

  it('only moves forward', () => {
    markCardSeen('u1', 500)
    markCardSeen('u1', 100)
    expect(readCardSeen('u1')).toBe(500)
  })

  it('tells the subscriber when it changes, not when it does not', () => {
    const fn = vi.fn()
    const stop = subscribeCardSeen(fn)
    markCardSeen('u1', 500)
    markCardSeen('u1', 100)
    expect(fn).toHaveBeenCalledTimes(1)
    stop()
    markCardSeen('u1', 900)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('still holds for this page where storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    markCardSeen('u1', 500)
    expect(readCardSeen('u1')).toBe(500)
  })

  it('the gallery\'s mock keeps it in memory and never reads or writes real storage', () => {
    localStorage.setItem('gains_friends_card_seen:u1', '900')
    const undo = __setMockFriends({ me: null, groups: [] })
    expect(readCardSeen('u1')).toBe(0)
    markCardSeen('u1', 500)
    expect(readCardSeen('u1')).toBe(500)
    expect(localStorage.getItem('gains_friends_card_seen:u1')).toBe('900')
    undo()
    expect(readCardSeen('u1')).toBe(900)
  })
})
