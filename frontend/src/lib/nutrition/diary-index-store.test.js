import { describe, expect, it } from 'vitest'
import { idbIndexStore, memoryIndexStore } from './diary-index-store.js'

const meta = { v: 1, owner: '7', cursor: 'c1', total: 1, complete: true, syncedAt: 5 }

describe('the diary index stores', () => {
  it('memory: puts, removes and keeps the meta in one apply, and wipes', async () => {
    const s = memoryIndexStore()
    expect(await s.open()).toBe(true)
    expect(await s.load()).toEqual({ meta: null, days: [] })
    await s.apply({ put: [{ date: '2026-10-01', rev: 'a', kcal: 1, items: [] }, { date: '2026-10-02', rev: 'b', kcal: 2, items: [] }], meta })
    await s.apply({ remove: ['2026-10-01'] })
    const read = await s.load()
    expect(read.meta).toEqual(meta)
    expect(read.days.map(d => d.date)).toEqual(['2026-10-02'])
    read.days[0].kcal = 99
    expect((await s.load()).days[0].kcal).toBe(2)
    await s.wipe()
    expect(await s.load()).toEqual({ meta: null, days: [] })
  })

  it('IndexedDB: answers false where there is none, or where opening fails', async () => {
    expect(await idbIndexStore({ idb: undefined }).open()).toBe(false)
    const refusing = { open: () => { const r = {}; setTimeout(() => { r.error = new Error('blocked'); r.onerror?.() }, 0); return r } }
    expect(await idbIndexStore({ idb: refusing }).open()).toBe(false)
  })
})
