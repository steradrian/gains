import { describe, expect, it } from 'vitest'
import { EMPTY_READ, KEEP_DAYS, isUnread, readOf, unreadCount, withAllRead, withRead } from './read-state.js'

const DAY = 86400000
const NOW = new Date(2026, 9, 21, 12).getTime()
const item = (id, at) => ({ id, kind: 'best', at, title: id, body: '', target: null })
const items = [item('a', 300), item('b', 200), item('c', 100)]

describe('read state', () => {
  it('reads a missing or hand-edited field as nothing read', () => {
    expect(readOf({})).toEqual(EMPTY_READ)
    expect(readOf({ notifRead: null })).toEqual(EMPTY_READ)
    expect(readOf({ notifRead: { at: 'x', ids: { a: 5, b: 'x', c: null } } })).toEqual({ at: 0, ids: { a: 5 } })
    expect(readOf({ notifRead: { at: 7, ids: ['a'] } })).toEqual({ at: 7, ids: {} })
  })

  it('an item is unread when newer than Mark all read and not read on its own', () => {
    const read = { at: 150, ids: { a: 300 } }
    expect(items.map(i => isUnread(i, read))).toEqual([false, true, false])
    expect(unreadCount(items, read)).toBe(1)
    expect(unreadCount(items, EMPTY_READ)).toBe(3)
  })

  it('reading one adds its id with its own time; the read survives a recompute of the same feed', () => {
    const read = withRead(EMPTY_READ, items[1], 1000)
    expect(read).toEqual({ at: 0, ids: { b: 200 } })
    const recomputed = items.map(i => ({ ...i }))
    expect(recomputed.map(i => isUnread(i, read))).toEqual([true, false, true])
  })

  it('keeps another device\'s read ids this feed does not hold, while they are inside KEEP_DAYS', () => {
    // A reminder only the phone logged was read there; the desktop's feed has no such item.
    const phone = { at: 0, ids: { 'reminder:workout:2026-10-19': NOW - 2 * DAY } }
    const read = withRead(phone, item('best:0025:w9', NOW - DAY), NOW)
    expect(read.ids).toEqual({ 'reminder:workout:2026-10-19': NOW - 2 * DAY, 'best:0025:w9': NOW - DAY })
  })

  it('drops ids older than KEEP_DAYS, or that Mark all read covers, by their own time', () => {
    const old = NOW - (KEEP_DAYS + 1) * DAY
    const read = withRead({ at: NOW - 5 * DAY, ids: { gone: old, covered: NOW - 6 * DAY, kept: NOW - 4 * DAY } }, item('b', NOW - DAY), NOW)
    expect(read).toEqual({ at: NOW - 5 * DAY, ids: { kept: NOW - 4 * DAY, b: NOW - DAY } })
  })

  it('reading an item that is not unread changes nothing', () => {
    const read = { at: 250, ids: {} }
    expect(withRead(read, items[1], 1000)).toBe(read)
    expect(withRead(read, null, 1000)).toBe(read)
  })

  it('Mark all read reads everything up to now; a later item is new again', () => {
    const read = withAllRead(300)
    expect(unreadCount(items, read)).toBe(0)
    expect(isUnread(item('d', 301), read)).toBe(true)
  })
})
