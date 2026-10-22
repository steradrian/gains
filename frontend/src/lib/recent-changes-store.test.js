// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  KEY_PREFIX, MAX_BYTES, MAX_ENTRIES, capEntries, changesKey, readEntries, removeEntries, setChangesOwner, writeEntries,
} from './recent-changes-store.js'

const entry = (n, over = {}) => ({ id: 'e' + n, kind: 'routine-delete', at: 1000 + n, day: '2026-10-20', subject: 'Push A', facts: {}, snapshot: { n }, action: 'restore', state: 'open', ...over })

afterEach(() => {
  vi.restoreAllMocks()
  setChangesOwner(() => null)
  localStorage.clear()
  removeEntries()
})

describe('the journal store', () => {
  it('keeps the entries across a reload, newest first', () => {
    expect(writeEntries([entry(1), entry(3), entry(2)])).toBe(true)
    expect(readEntries().map(e => e.id)).toEqual(['e3', 'e2', 'e1'])
    expect(readEntries()[0].snapshot).toEqual({ n: 3 })
  })

  it('is empty when nothing was stored, or what is stored cannot be read', () => {
    expect(readEntries()).toEqual([])
    localStorage.setItem(changesKey(), '{not json')
    expect(readEntries()).toEqual([])
    localStorage.setItem(changesKey(), JSON.stringify({ not: 'a list' }))
    expect(readEntries()).toEqual([])
    localStorage.setItem(changesKey(), JSON.stringify([entry(1), null, { id: 5 }, entry(2, { state: 'weird' })]))
    expect(readEntries().map(e => e.id)).toEqual(['e1'])
  })

  it('keeps a key per account and one for a guest, none of them in the synced state', () => {
    expect(changesKey()).toBe(KEY_PREFIX + 'guest')
    setChangesOwner(() => ({ id: 7 }))
    expect(changesKey()).toBe(KEY_PREFIX + 'u7')
    writeEntries([entry(1)])
    setChangesOwner(() => ({ id: 8 }))
    expect(readEntries()).toEqual([])
    setChangesOwner(() => null)
    expect(readEntries()).toEqual([])
    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem(KEY_PREFIX + 'u7')).not.toBeNull()
  })

  it('holds the newest MAX_ENTRIES', () => {
    const many = Array.from({ length: MAX_ENTRIES + 15 }, (_, i) => entry(i))
    expect(capEntries(many)).toHaveLength(MAX_ENTRIES)
    expect(capEntries(many)[0].id).toBe('e' + (MAX_ENTRIES + 14))
    writeEntries(many)
    expect(readEntries()).toHaveLength(MAX_ENTRIES)
  })

  it('drops the oldest first once the snapshots pass about 1 MB', () => {
    const big = n => entry(n, { snapshot: { blob: 'x'.repeat(MAX_BYTES / 4) } })
    const kept = capEntries([big(1), big(2), big(3), big(4), big(5)])
    expect(kept.map(e => e.id)).toEqual(['e5', 'e4', 'e3'])
    expect(JSON.stringify(kept).length).toBeLessThanOrEqual(MAX_BYTES)
  })

  it('removeEntries empties one profile', () => {
    writeEntries([entry(1)])
    removeEntries()
    expect(readEntries()).toEqual([])
    expect(localStorage.getItem(changesKey())).toBeNull()
  })

  it('never throws when storage is full: older entries give way, then the list is held in memory', () => {
    const real = localStorage.setItem.bind(localStorage)
    const limit = JSON.stringify([entry(1), entry(2)]).length + 5
    const quota = vi.spyOn(localStorage, 'setItem').mockImplementation((k, v) => {
      if (v.length > limit) throw new DOMException('full', 'QuotaExceededError')
      return real(k, v)
    })
    try {
      const six = Array.from({ length: 6 }, (_, i) => entry(i))
      expect(() => writeEntries(six)).not.toThrow()
      expect(readEntries().length).toBeGreaterThan(0)
      expect(readEntries().length).toBeLessThan(6)
      expect(readEntries()[0].id).toBe('e5')
    } finally { quota.mockRestore() }

    const full = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    const blocked = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    try {
      expect(() => writeEntries([entry(9)])).not.toThrow()
      expect(writeEntries([entry(9)])).toBe(false)
      expect(readEntries().map(e => e.id)).toEqual(['e9'])
    } finally { full.mockRestore(); blocked.mockRestore() }
  })
})
