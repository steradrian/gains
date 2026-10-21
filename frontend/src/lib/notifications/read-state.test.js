import { describe, expect, it } from 'vitest'
import { EMPTY_READ, isUnread, readOf, unreadCount, withAllRead, withRead } from './read-state.js'

const item = (id, at) => ({ id, kind: 'best', at, title: id, body: '', target: null })
const items = [item('a', 300), item('b', 200), item('c', 100)]

describe('read state', () => {
  it('reads a missing or hand-edited field as nothing read', () => {
    expect(readOf({})).toEqual(EMPTY_READ)
    expect(readOf({ notifRead: null })).toEqual(EMPTY_READ)
    expect(readOf({ notifRead: { at: 'x', ids: ['a', 3, null] } })).toEqual({ at: 0, ids: ['a'] })
  })

  it('an item is unread when newer than Mark all read and not read on its own', () => {
    const read = { at: 150, ids: ['a'] }
    expect(items.map(i => isUnread(i, read))).toEqual([false, true, false])
    expect(unreadCount(items, read)).toBe(1)
    expect(unreadCount(items, EMPTY_READ)).toBe(3)
  })

  it('reading one adds its id; the read survives a recompute of the same feed', () => {
    const read = withRead(EMPTY_READ, 'b', items)
    expect(read).toEqual({ at: 0, ids: ['b'] })
    const recomputed = items.map(i => ({ ...i }))
    expect(recomputed.map(i => isUnread(i, read))).toEqual([true, false, true])
  })

  it('drops ids that left the feed (past 30 days) or that Mark all read covers', () => {
    const read = withRead({ at: 150, ids: ['gone', 'c', 'a'] }, 'b', items)
    expect(read).toEqual({ at: 150, ids: ['a', 'b'] })
  })

  it('reading an item that is not unread, or not in the feed, changes nothing', () => {
    const read = { at: 250, ids: [] }
    expect(withRead(read, 'b', items)).toBe(read)
    expect(withRead(read, 'nope', items)).toBe(read)
  })

  it('Mark all read reads everything up to now; a later item is new again', () => {
    const read = withAllRead(300)
    expect(unreadCount(items, read)).toBe(0)
    expect(isUnread(item('d', 301), read)).toBe(true)
  })
})
