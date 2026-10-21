// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetOffBudget } from './off-budget.js'
import { useNutrition } from './store.js'
import { appendWorld, FALLBACK_BELOW, fetchOnline, isFromWorld, resetOnlineSearch } from './use-online-search.js'

const food = (barcode, name = barcode) => ({ barcode, name, client_key: 'k' + barcode })
const many = (n, prefix) => Array.from({ length: n }, (_, i) => food(prefix + i))

let original
let calls
const answer = byCountry => {
  calls = []
  useNutrition.setState({
    searchOnline: vi.fn(async (q, lang, { country }) => {
      calls.push(country ?? null)
      return byCountry[country ?? 'World']
    }),
  })
}

beforeEach(() => {
  original = useNutrition.getState().searchOnline
  resetOnlineSearch()
  resetOffBudget()
})
afterEach(() => useNutrition.setState({ searchOnline: original }))

describe('the World fallback', () => {
  it('runs a second World search only when a country search finds fewer than 5', async () => {
    answer({ Romania: many(FALLBACK_BELOW - 1, 'r'), World: many(2, 'w') })
    const out = await fetchOnline('lapte', { country: 'Romania' })
    expect(calls).toEqual(['Romania', null])
    expect(out).toHaveLength(FALLBACK_BELOW - 1 + 2)
  })

  it('does not run at 5 results, for World, or without a country', async () => {
    answer({ Romania: many(FALLBACK_BELOW, 'r'), World: many(2, 'w') })
    expect(await fetchOnline('lapte', { country: 'Romania' })).toHaveLength(FALLBACK_BELOW)
    expect(calls).toEqual(['Romania'])
    resetOnlineSearch()
    answer({ World: many(1, 'w') })
    await fetchOnline('lapte', { country: 'World' })
    await fetchOnline('lapte2', { country: null })
    expect(calls).toEqual([null, null])
  })

  it('marks only the World products, and keeps the country\'s own first', async () => {
    answer({ Romania: [food('r0')], World: [food('w0')] })
    const out = await fetchOnline('lapte', { country: 'Romania' })
    expect(out.map(f => f.barcode)).toEqual(['r0', 'w0'])
    expect(out.map(isFromWorld)).toEqual([false, true])
  })

  it('the first answer is cached, so asking again sends nothing', async () => {
    answer({ Romania: [food('r0')], World: [food('w0')] })
    await fetchOnline('lapte', { country: 'Romania' })
    await fetchOnline('lapte', { country: 'Romania' })
    expect(calls).toEqual(['Romania', null])
  })

  it('keeps the country\'s results when the World search fails', async () => {
    calls = []
    useNutrition.setState({
      searchOnline: vi.fn(async (q, lang, { country }) => {
        if (!country) throw Object.assign(new Error('down'), { status: 500 })
        return [food('r0')]
      }),
    })
    expect((await fetchOnline('lapte', { country: 'Romania' })).map(f => f.barcode)).toEqual(['r0'])
  })
})

describe('appendWorld', () => {
  it('drops World products already in the list, by code, and any repeated within World', () => {
    const local = [food('1'), food('2')]
    const out = appendWorld(local, [food('2', 'dup'), food('3'), food('3', 'again'), food('4')])
    expect(out.map(f => f.barcode)).toEqual(['1', '2', '3', '4'])
    expect(out.filter(isFromWorld).map(f => f.barcode)).toEqual(['3', '4'])
  })

  it('does not mark the cached World answer itself', () => {
    const world = [food('9')]
    appendWorld([], world)
    expect(isFromWorld(world[0])).toBe(false)
  })
})
