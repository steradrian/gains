// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearChanges, journalMediaHashes, listChanges, pruneChanges, recordChange, registerRestorer, registerSource, restoreChange,
  setStateReader, undoRestore,
} from './recent-changes.js'
import { changesKey, readEntries, removeEntries, setChangesOwner } from './recent-changes-store.js'

const DAY = 86400000
const NOW = new Date(2026, 9, 22, 12).getTime()

let calls
const restorer = (over = {}) => ({
  restore: vi.fn(async snap => { calls.push(['restore', snap]); return { ok: true, where: { day: '2026-10-20' } } }),
  undo: vi.fn(async (snap, _S, result) => { calls.push(['undo', snap, result]); return { ok: true } }),
  ...over,
})
const add = (over = {}) => recordChange({ kind: 'test-kind', subject: 'Push A', facts: { exercises: 4 }, snapshot: { a: 1 }, ...over })

beforeEach(() => {
  calls = []
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  registerRestorer('test-kind', restorer())
  setStateReader(() => ({ marker: 'S' }))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  setChangesOwner(() => null)
  removeEntries()
  localStorage.clear()
})

describe('recording and listing', () => {
  it('lists newest first with the structured fields and no snapshot', () => {
    const a = add({ subject: 'First' })
    vi.setSystemTime(NOW + 1000)
    const b = add({ subject: 'Second', day: '2026-10-21', action: 'undo' })
    const rows = listChanges(NOW + 1000)
    expect(rows.map(r => r.id)).toEqual([b, a])
    expect(rows[0]).toEqual({ id: b, kind: 'test-kind', at: NOW + 1000, day: '2026-10-21', subject: 'Second', facts: { exercises: 4 }, action: 'undo', state: 'open' })
    expect(rows[1].action).toBe('restore')
    expect(rows[1].day).toBe('2026-10-22')
    expect('snapshot' in rows[0]).toBe(false)
  })

  it('keeps a copy of the snapshot, not the caller object', async () => {
    const snap = { list: [1, 2] }
    const id = add({ snapshot: snap })
    snap.list.push(3)
    await restoreChange(id)
    expect(calls[0][1]).toEqual({ list: [1, 2] })
  })

  it('drops what is older than 7 days on every list and record', () => {
    const old = add()
    vi.setSystemTime(NOW + 6 * DAY)
    const recent = add()
    expect(listChanges(NOW + 7 * DAY - 1000).map(r => r.id)).toEqual([recent, old])
    expect(listChanges(NOW + 7 * DAY + 1).map(r => r.id)).toEqual([recent])
    expect(readEntries().map(e => e.id)).toEqual([recent])
    vi.setSystemTime(NOW + 14 * DAY)
    add()
    expect(readEntries()).toHaveLength(1)
    expect(pruneChanges(NOW + 30 * DAY)).toEqual([])
  })

  it('refuses a record with no kind without throwing', () => {
    expect(recordChange({ snapshot: {} })).toBeNull()
    expect(recordChange()).toBeNull()
  })

  it('survives a reload: the entry is read back from storage and restores', async () => {
    const id = add({ snapshot: { routine: { id: 'r1' } } })
    const raw = localStorage.getItem(changesKey())
    localStorage.clear()
    localStorage.setItem(changesKey(), raw)
    expect(listChanges(NOW).map(r => r.id)).toEqual([id])
    expect(await restoreChange(id)).toEqual({ ok: true, where: { day: '2026-10-20' } })
    expect(calls[0][1]).toEqual({ routine: { id: 'r1' } })
  })

  it('ignores a corrupt stored value', async () => {
    localStorage.setItem(changesKey(), 'nope{')
    expect(listChanges(NOW)).toEqual([])
    expect(await restoreChange('x')).toEqual({ ok: false, reason: 'gone' })
    const id = add()
    expect(listChanges(NOW).map(r => r.id)).toEqual([id])
  })

  it('never throws into a delete path when storage is full', () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    try {
      let id
      expect(() => { id = add() }).not.toThrow()
      expect(typeof id).toBe('string')
      expect(() => listChanges(NOW)).not.toThrow()
    } finally { setItem.mockRestore(); getItem.mockRestore() }
  })
})

describe('restoring', () => {
  it('runs the restorer, marks the entry restored and keeps it listed', async () => {
    const id = add()
    const res = await restoreChange(id)
    expect(res).toEqual({ ok: true, where: { day: '2026-10-20' } })
    expect(calls).toEqual([['restore', { a: 1 }]])
    expect(listChanges(NOW)[0]).toMatchObject({ id, state: 'restored' })
  })

  it('hands the restorer the current state', async () => {
    const seen = []
    registerRestorer('test-kind', restorer({ restore: async (_snap, S) => { seen.push(S); return { ok: true } } }))
    await restoreChange(add())
    expect(seen).toEqual([{ marker: 'S' }])
  })

  it('a second restore is a no-op with reason restored', async () => {
    const id = add()
    await restoreChange(id)
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'restored' })
    expect(calls.filter(c => c[0] === 'restore')).toHaveLength(1)
  })

  it('two taps at once restore once', async () => {
    const id = add()
    const [x, y] = await Promise.all([restoreChange(id), restoreChange(id)])
    expect([x.ok, y.ok].sort()).toEqual([false, true])
    expect(calls.filter(c => c[0] === 'restore')).toHaveLength(1)
  })

  it('passes the restorer\'s refusal on and leaves the entry open', async () => {
    registerRestorer('test-kind', restorer({ restore: async () => ({ ok: false, reason: 'replaced' }) }))
    const id = add()
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'replaced' })
    expect(listChanges(NOW)[0].state).toBe('open')
  })

  it('reports fellBack, and a restorer that throws is an error, not a crash', async () => {
    registerRestorer('test-kind', restorer({ restore: async () => ({ ok: true, where: { day: 'd', meal: 'snacks' }, fellBack: 'snacks' }) }))
    expect(await restoreChange(add())).toEqual({ ok: true, where: { day: 'd', meal: 'snacks' }, fellBack: 'snacks' })
    registerRestorer('test-kind', restorer({ restore: async () => { throw new Error('boom') } }))
    expect(await restoreChange(add())).toEqual({ ok: false, reason: 'error' })
  })

  it('an unknown kind is unsupported; an entry past 7 days is gone', async () => {
    expect(await restoreChange(recordChange({ kind: 'no-such-kind', snapshot: {} }))).toEqual({ ok: false, reason: 'unsupported' })
    const id = add()
    vi.setSystemTime(NOW + 8 * DAY)
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'gone' })
    expect(await restoreChange('nope')).toEqual({ ok: false, reason: 'gone' })
  })
})

describe('undoing a restore', () => {
  it('reverses it with the restorer\'s undo and the entry is open again', async () => {
    const id = add()
    await restoreChange(id)
    expect(await undoRestore(id)).toEqual({ ok: true })
    expect(calls[1]).toEqual(['undo', { a: 1 }, { where: { day: '2026-10-20' } }])
    expect(listChanges(NOW)[0].state).toBe('open')
    expect((await restoreChange(id)).ok).toBe(true)
  })

  it('does nothing for an entry that was not restored, or whose undo cannot run', async () => {
    const id = add()
    expect(await undoRestore(id)).toEqual({ ok: false })
    await restoreChange(id)
    registerRestorer('test-kind', restorer({ undo: async () => ({ ok: false, reason: 'gone' }) }))
    expect(await undoRestore(id)).toEqual({ ok: false, reason: 'gone' })
    expect(listChanges(NOW)[0].state).toBe('restored')
    expect(await undoRestore('nope')).toEqual({ ok: false })
  })
})

describe('clearChanges', () => {
  it('empties the journal of the current profile only', () => {
    setChangesOwner(() => ({ id: 1 }))
    add()
    setChangesOwner(() => ({ id: 2 }))
    add()
    clearChanges()
    expect(listChanges(NOW)).toEqual([])
    setChangesOwner(() => ({ id: 1 }))
    expect(listChanges(NOW)).toHaveLength(1)
    clearChanges({ id: 1 })
    expect(listChanges(NOW)).toEqual([])
  })

  it('clears the guest profile with null', () => {
    add()
    setChangesOwner(() => ({ id: 1 }))
    clearChanges(null)
    setChangesOwner(() => null)
    expect(listChanges(NOW)).toEqual([])
  })
})

describe('sources (a log something else owns)', () => {
  let log, restore
  const entry = (id, at, over = {}) => ({ id, at, subject: id, facts: { n: 1 }, ...over })
  beforeEach(() => {
    log = [entry('src:a', NOW - 1000), entry('src:b', NOW - 3 * DAY)]
    restore = vi.fn(async e => { log = log.filter(x => x.id !== e.id); return { ok: true, where: { day: '2026-10-22' } } })
    registerSource('test-source', () => log, { restore })
  })
  afterEach(() => { registerSource('test-source', () => []) })

  it('lists source entries beside the journal\'s own, newest first, with the kind, an undo action and the day', () => {
    const own = add({ day: '2026-10-21' })
    const rows = listChanges(NOW)
    expect(rows.map(r => r.id)).toEqual([own, 'src:a', 'src:b'])
    expect(rows.find(r => r.id === 'src:a')).toMatchObject({ kind: 'test-source', action: 'undo', state: 'open', day: '2026-10-22', subject: 'src:a', facts: { n: 1 } })
  })

  it('keeps only the last 7 days, whatever the source returns, and ignores malformed entries', () => {
    log.push(entry('src:old', NOW - 8 * DAY), entry('src:future', NOW + 5000), { at: NOW }, null, { id: 3, at: NOW })
    expect(listChanges(NOW).map(r => r.id)).toEqual(['src:a', 'src:b'])
  })

  it('a source that throws lists nothing and breaks nothing else', () => {
    registerSource('test-source', () => { throw new Error('boom') })
    add()
    expect(listChanges(NOW)).toHaveLength(1)
  })

  it('restoreChange runs the source\'s restore with the entry and the state; it is not stored', async () => {
    expect(await restoreChange('src:a')).toEqual({ ok: true, where: { day: '2026-10-22' } })
    expect(restore).toHaveBeenCalledWith(expect.objectContaining({ id: 'src:a', kind: 'test-source' }), { marker: 'S' })
    expect(readEntries()).toEqual([])
    expect(await restoreChange('src:a')).toEqual({ ok: false, reason: 'gone' })
  })

  it('answers unsupported when the source has no restore, and the source\'s own reason when it fails', async () => {
    registerSource('test-source', () => log)
    expect(await restoreChange('src:a')).toEqual({ ok: false, reason: 'unsupported' })
    registerSource('test-source', () => log, { restore: async () => ({ ok: false, reason: 'changed' }) })
    expect(await restoreChange('src:a')).toEqual({ ok: false, reason: 'changed' })
    registerSource('test-source', () => log, { restore: async () => { throw new Error('x') } })
    expect(await restoreChange('src:a')).toEqual({ ok: false, reason: 'error' })
  })

  it('clearChanges does not touch a source', () => {
    add()
    clearChanges()
    expect(listChanges(NOW).map(r => r.id)).toEqual(['src:a', 'src:b'])
    expect(readEntries()).toEqual([])
  })

  it('has no undo of a restore', async () => {
    await restoreChange('src:a')
    expect(await undoRestore('src:a')).toEqual({ ok: false })
  })
})

describe('journalMediaHashes', () => {
  it('names the files of live entries, never lists them, and drops them with the entry', () => {
    add({ media: ['a'.repeat(64), 'b'.repeat(64), 'a'.repeat(64), '', 7] })
    add({ subject: 'no files' })
    expect([...journalMediaHashes(NOW)].sort()).toEqual(['a'.repeat(64), 'b'.repeat(64)])
    expect(JSON.stringify(listChanges(NOW))).not.toContain('a'.repeat(64))
    expect(journalMediaHashes(NOW + 8 * DAY).size).toBe(0)
    expect(readEntries()).toEqual([])
    add({ media: ['c'.repeat(64)] })
    clearChanges()
    expect(journalMediaHashes(NOW).size).toBe(0)
  })
})
