// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { memoryIndexStore } from './diary-index-store.js'
import { __test, diaryIndexDays, normalizeRev, patchDiaryDay, resetDiaryIndex, syncDiaryIndex, useDiaryIndex } from './diary-index.js'

// The endpoint per its contract (fitness-eval api-diary-index.md §4): pages answered from a queue,
// every call recorded as { since, limit }.
const failure = (status, code = 'http') => Object.assign(new Error('x'), { status, code })
function fakeApi(...answers) {
  const calls = []
  return {
    calls,
    queue: answers,
    getDiaryIndex: async ({ since, limit }) => {
      calls.push({ since, limit })
      const next = answers.shift()
      if (!next) return { days: [], total: 0, next: since || 'c0', has_more: false }
      if (next instanceof Error) throw next
      return structuredClone(next)
    },
  }
}
const day = (date, rev, items = [{ uuid: 'u-' + date, name: 'Chicken bowl', food_id: 4, meal: 1, kcal: 640 }]) =>
  ({ date, rev, kcal: items.reduce((s, i) => s + i.kcal, 0), items })
const page = (days, { next = 'c1', total = days.filter(d => !d.deleted).length, more = false } = {}) => ({ days, total, next, has_more: more })

let now = 1_000_000
let backend
function setup(api, { store = memoryIndexStore() } = {}) {
  backend = store
  __test.configure({ api, openBackend: () => store, now: () => now, idle: cb => cb() })
}

beforeEach(() => {
  __test.restore()
  now += 60_000
  useStore.setState({ user: { id: 7, name: 'A' } })
})
afterEach(() => { __test.restore() })

describe('normalizeRev', () => {
  it('reads NutriTrace stamps and ISO instants as one format, and nothing else', () => {
    expect(normalizeRev('2026-10-11 19:42:07')).toBe('2026-10-11T19:42:07Z')
    expect(normalizeRev('2026-10-11T19:42:07.123Z')).toBe('2026-10-11T19:42:07Z')
    expect(normalizeRev('2026-10-11T21:42:07+02:00')).toBe('2026-10-11T19:42:07Z')
    expect(normalizeRev('yesterday')).toBe('')
    expect(normalizeRev(null)).toBe('')
  })
})

describe('the first load', () => {
  it('pages to completion and writes the cursor with each page', async () => {
    const api = fakeApi(
      page([day('2026-10-01', '2026-10-01T10:00:00Z')], { next: 'p1', more: true, total: 2 }),
      page([day('2026-10-02', '2026-10-02T10:00:00Z')], { next: 'p2', total: 2 }),
    )
    setup(api)
    await syncDiaryIndex()
    expect(api.calls).toEqual([{ since: undefined, limit: 200 }, { since: 'p1', limit: 200 }])
    expect(diaryIndexDays().map(d => d.date)).toEqual(['2026-10-02', '2026-10-01'])
    expect(useDiaryIndex.getState()).toMatchObject({ status: 'ready', complete: true })
    expect((await backend.load()).meta).toMatchObject({ cursor: 'p2', owner: '7', complete: true, total: 2 })
  })

  it('stopped half way, resumes from the cursor it saved', async () => {
    const api = fakeApi(page([day('2026-10-01', '2026-10-01T10:00:00Z')], { next: 'p1', more: true, total: 2 }), failure(0, 'offline'))
    setup(api)
    await syncDiaryIndex()
    expect(useDiaryIndex.getState()).toMatchObject({ complete: false, stale: true, offline: true })
    api.queue.push(page([day('2026-10-02', '2026-10-02T10:00:00Z')], { next: 'p2', total: 2 }))
    await syncDiaryIndex({ force: true })
    expect(api.calls.at(-1).since).toBe('p1')
    expect(diaryIndexDays()).toHaveLength(2)
  })

  it('a 502 page is asked again with half the days', async () => {
    const api = fakeApi(failure(502), page([day('2026-10-01', '2026-10-01T10:00:00Z')]))
    setup(api)
    await syncDiaryIndex()
    expect(api.calls.map(c => c.limit)).toEqual([200, 100])
    expect(diaryIndexDays()).toHaveLength(1)
  })
})

describe('increments', () => {
  it('replace days, remove deleted ones, and never go back to an older rev', async () => {
    const api = fakeApi(page([day('2026-10-01', '2026-10-01T10:00:00Z'), day('2026-10-02', '2026-10-02T10:00:00Z')]))
    setup(api)
    await syncDiaryIndex()
    api.queue.push(page([
      day('2026-10-01', '2026-10-05T08:00:00Z', [{ uuid: 'x', name: 'Rice', food_id: null, meal: 2, kcal: 300 }]),
      { date: '2026-10-02', rev: '2026-10-05T08:00:01Z', deleted: true },
    ], { next: 'c2', total: 1 }))
    await syncDiaryIndex({ force: true })
    expect(api.calls.at(-1).since).toBe('c1')
    expect(diaryIndexDays()).toEqual([day('2026-10-01', '2026-10-05T08:00:00Z', [{ uuid: 'x', name: 'Rice', food_id: null, meal: 2, kcal: 300 }])])
    // A later local save, then an answer older than it: the save stays.
    patchDiaryDay('2026-10-01', { updated_at: '2026-10-06 09:00:00', items: [{ uuid: 'y', name: 'Toast', meal: 0, quantity: 1, nutrition: { calories: 120 }, id: 12, food_server_id: 12 }] })
    api.queue.push(page([day('2026-10-01', '2026-10-05T08:00:00Z')], { next: 'c3', total: 1 }))
    await syncDiaryIndex({ force: true })
    expect(diaryIndexDays()[0]).toMatchObject({ rev: '2026-10-06T09:00:00Z', kcal: 120, items: [{ uuid: 'y', name: 'Toast', food_id: 12, meal: 0, kcal: 120 }] })
  })

  it('skips a sync asked again within 30 s, unless forced', async () => {
    const api = fakeApi(page([]))
    setup(api)
    await syncDiaryIndex()
    await syncDiaryIndex()
    expect(api.calls).toHaveLength(1)
  })

  it('offline keeps serving the cache and marks it stale, without a storm', async () => {
    const api = fakeApi(page([day('2026-10-01', '2026-10-01T10:00:00Z')]))
    setup(api)
    await syncDiaryIndex()
    api.queue.push(failure(0, 'offline'))
    now += 31_000
    await syncDiaryIndex()
    await syncDiaryIndex()
    expect(api.calls).toHaveLength(2)
    expect(diaryIndexDays()).toHaveLength(1)
    expect(useDiaryIndex.getState()).toMatchObject({ status: 'ready', stale: true, offline: true })
  })
})

describe('local patches', () => {
  it('build the entry from a save answer: kcal, split recipe parts, removals', async () => {
    setup(fakeApi(page([])))
    await syncDiaryIndex()
    const answer = {
      date: '2026-10-11', updated_at: '2026-10-11 19:42:07',
      items: [
        { uuid: 'a', meal: 1, name: 'Chicken bowl', brand: 'Sweetgreen', id: 812, food_server_id: 812, quantity: 1.5, nutrition: { calories: 400 } },
        { uuid: 'b', meal: 2, name: 'Lentil soup', is_recipe: true, id: 22, _splitItems: [{ name: 'Lentils', nutrition: { calories: 200 } }, { name: 'Carrot', nutrition: { calories: 30.4 } }] },
      ],
    }
    patchDiaryDay('2026-10-11', answer)
    expect(diaryIndexDays()[0]).toEqual({
      date: '2026-10-11', rev: '2026-10-11T19:42:07Z', kcal: 830,
      items: [
        { uuid: 'a', name: 'Chicken bowl', brand: 'Sweetgreen', food_id: 812, meal: 1, kcal: 600 },
        { uuid: 'b', name: 'Lentil soup', food_id: null, meal: 2, kcal: 230, parts: ['Lentils', 'Carrot'] },
      ],
    })
    patchDiaryDay('2026-10-11', { ...answer, updated_at: '2026-10-11 19:50:00', items: answer.items.slice(1) })
    expect(diaryIndexDays()[0].items.map(i => i.uuid)).toEqual(['b'])
    expect((await backend.load()).days[0].items.map(i => i.uuid)).toEqual(['b'])
  })

  it('reads a split recipe\'s nested splits as the server does, six levels down, and skips blank names', async () => {
    setup(fakeApi(page([])))
    await syncDiaryIndex()
    const nest = (depth, name) => (depth === 0 ? [] : [{ name: name + depth, _splitItems: nest(depth - 1, name) }])
    patchDiaryDay('2026-10-12', {
      date: '2026-10-12', updated_at: '2026-10-12 10:00:00',
      items: [{ uuid: 'c', meal: 0, name: 'Burrito bowl', is_recipe: true, brand: '  ', nutrition: { calories: 700 }, _splitItems: [
        { name: 'Rice' }, { name: ' ' }, null, { name: 'Salsa', _splitItems: [{ name: 'Tomato' }, { name: 'Onion' }] }, ...nest(8, 'L'),
      ] }],
    })
    const [item] = diaryIndexDays()[0].items
    expect(item.parts).toEqual(['Rice', 'Salsa', 'Tomato', 'Onion', 'L8', 'L7', 'L6', 'L5', 'L4', 'L3'])
    expect(item).not.toHaveProperty('brand')
  })

  it('an answer without a stamp never replaces one with it', async () => {
    setup(fakeApi(page([day('2026-10-01', '2026-10-01T10:00:00Z')])))
    await syncDiaryIndex()
    patchDiaryDay('2026-10-01', { items: [] })
    expect(diaryIndexDays()[0].items).toHaveLength(1)
  })
})

describe('a day the server trimmed to fit its page', () => {
  it('stays searchable over what came, marked partial, kept across a reload, and a whole read replaces it', async () => {
    const big = { ...day('2026-10-03', '2026-10-03T10:00:00Z'), kcal: 9000, truncated: true }
    setup(fakeApi(page([big])))
    await syncDiaryIndex()
    expect(diaryIndexDays()[0]).toMatchObject({ date: '2026-10-03', truncated: true, kcal: 9000 })
    expect((await backend.load()).days[0].truncated).toBe(true)
    // A read of the whole day, at the same change: the full copy wins and the mark goes.
    patchDiaryDay('2026-10-03', { date: '2026-10-03', updated_at: '2026-10-03 10:00:00', items: [
      { uuid: 'u-2026-10-03', meal: 1, name: 'Chicken bowl', quantity: 1, nutrition: { calories: 640 } },
      { uuid: 'late', meal: 2, name: 'Cheesecake', quantity: 1, nutrition: { calories: 8360 } },
    ] })
    expect(diaryIndexDays()[0].truncated).toBeUndefined()
    expect(diaryIndexDays()[0].items).toHaveLength(2)
  })

  it('a trimmed copy of the same change never replaces the whole day held', async () => {
    setup(fakeApi(page([day('2026-10-04', '2026-10-04T10:00:00Z', [
      { uuid: 'a', name: 'Oats', food_id: 1, meal: 0, kcal: 300 }, { uuid: 'b', name: 'Soup', food_id: 2, meal: 1, kcal: 200 },
    ])])))
    await syncDiaryIndex()
    __test.configure({ api: fakeApi(page([{ ...day('2026-10-04', '2026-10-04T10:00:00Z', [{ uuid: 'a', name: 'Oats', food_id: 1, meal: 0, kcal: 300 }]), truncated: true }], { next: 'c2' })) })
    await syncDiaryIndex({ force: true })
    expect(diaryIndexDays()[0].items).toHaveLength(2)
    expect(diaryIndexDays()[0].truncated).toBeUndefined()
  })
})

describe('integrity and accounts', () => {
  it('a total that disagrees rebuilds once and does not loop', async () => {
    const api = fakeApi(page([day('2026-10-01', '2026-10-01T10:00:00Z')], { total: 3 }), page([day('2026-10-01', '2026-10-01T10:00:00Z')], { total: 3 }))
    setup(api)
    await syncDiaryIndex()
    expect(api.calls).toHaveLength(2)
    expect(api.calls[1].since).toBeUndefined()
    now += 31_000
    api.queue.push(page([], { total: 3 }))
    await syncDiaryIndex()
    expect(api.calls).toHaveLength(3)
    expect(useDiaryIndex.getState().status).toBe('ready')
  })

  it('a refused cursor drops it and rebuilds once, then shows the error', async () => {
    const store = memoryIndexStore()
    await store.apply({ put: [day('2026-09-01', '2026-09-01T10:00:00Z')], meta: { v: 1, owner: '7', cursor: 'old', total: 1, complete: true, syncedAt: 0 } })
    const api = fakeApi(failure(400), failure(400))
    setup(api, { store })
    await syncDiaryIndex()
    expect(api.calls.map(c => c.since)).toEqual(['old', undefined])
    expect(useDiaryIndex.getState()).toMatchObject({ status: 'error' })
    expect(diaryIndexDays()).toEqual([])
  })

  it('another owner or an older version wipes before the first load', async () => {
    const store = memoryIndexStore()
    await store.apply({ put: [day('2026-09-01', '2026-09-01T10:00:00Z')], meta: { v: 1, owner: '99', cursor: 'theirs', total: 1, complete: true, syncedAt: 0 } })
    const api = fakeApi(page([day('2026-10-01', '2026-10-01T10:00:00Z')]))
    setup(api, { store })
    await syncDiaryIndex()
    expect(api.calls[0].since).toBeUndefined()
    expect(diaryIndexDays().map(d => d.date)).toEqual(['2026-10-01'])
  })

  it('signing out wipes the saved copy, and an answer still on its way is dropped', async () => {
    let release
    const api = { calls: [], getDiaryIndex: () => new Promise(r => { release = r }) }
    setup(api)
    const running = syncDiaryIndex()
    await new Promise(r => setTimeout(r, 0))
    useStore.setState({ user: null })
    release(page([day('2026-10-01', '2026-10-01T10:00:00Z')]))
    await running
    expect(diaryIndexDays()).toEqual([])
    expect((await backend.load()).days).toEqual([])
  })

  it('reset bumps the store and empties it', async () => {
    setup(fakeApi(page([day('2026-10-01', '2026-10-01T10:00:00Z')])))
    await syncDiaryIndex()
    await resetDiaryIndex()
    expect(diaryIndexDays()).toEqual([])
    expect(useDiaryIndex.getState()).toMatchObject({ status: 'idle', complete: false })
  })
})

describe('storage', () => {
  it('runs on memory when IndexedDB cannot be opened', async () => {
    const broken = { ...memoryIndexStore(), open: async () => false, load: async () => { throw new Error('no') } }
    __test.configure({ api: fakeApi(page([day('2026-10-01', '2026-10-01T10:00:00Z')])), openBackend: () => broken, now: () => now })
    await syncDiaryIndex()
    expect(diaryIndexDays()).toHaveLength(1)
  })

  it('a write that fails (the quota) falls back to memory and keeps the page', async () => {
    const store = { ...memoryIndexStore(), apply: async () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }) } }
    setup(fakeApi(page([day('2026-10-01', '2026-10-01T10:00:00Z')])), { store })
    await syncDiaryIndex()
    expect(diaryIndexDays()).toHaveLength(1)
  })
})
