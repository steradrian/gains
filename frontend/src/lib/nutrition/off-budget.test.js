// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { AUTO_PER_MIN, canSearch, noteAnswer, noteSearch, pausedFor, resetOffBudget, TAP_RESERVE } from './off-budget.js'
import { autoOnline } from '../../components/search/use-online-results.js'
import { useStore } from '../../store/useStore.js'

const res = (status, headers = {}) => ({ status, headers: new Headers(headers) })

beforeEach(() => resetOffBudget())

describe('the Open Food Facts budget (ux-search.md §5)', () => {
  it('without the hub\'s count: 20 automatic searches a minute, and 10 more kept for taps', () => {
    const now = 1_000_000
    for (let i = 0; i < AUTO_PER_MIN; i++) { expect(canSearch('auto', now)).toBe(true); noteSearch('auto', now) }
    expect(canSearch('auto', now)).toBe(false)
    for (let i = 0; i < TAP_RESERVE; i++) { expect(canSearch('tap', now)).toBe(true); noteSearch('tap', now) }
    expect(canSearch('tap', now)).toBe(false)
    expect(canSearch('auto', now + 60_001)).toBe(true)
  })

  it('with RateLimit-Remaining: automatic only above 10, taps down to the last one', () => {
    const now = 2_000_000
    noteAnswer(res(200, { 'RateLimit-Remaining': '11' }), now)
    expect(canSearch('auto', now)).toBe(true)
    noteSearch('auto', now)
    expect(canSearch('auto', now)).toBe(false)
    expect(canSearch('tap', now)).toBe(true)
    noteAnswer(res(200, { 'RateLimit-Remaining': '0' }), now)
    expect(canSearch('tap', now)).toBe(false)
  })

  it('a 429 pauses everything for its Retry-After (15 s when it says nothing, 60 s at most)', () => {
    const now = 3_000_000
    noteAnswer(res(429, { 'Retry-After': '12' }), now)
    expect(canSearch('tap', now)).toBe(false)
    expect(pausedFor(now)).toBe(12)
    expect(canSearch('tap', now + 11_999)).toBe(false)
    expect(canSearch('auto', now + 12_001)).toBe(true) // the hub's window is over: the pause was the wait
    resetOffBudget()
    noteAnswer(res(429), now)
    expect(pausedFor(now)).toBe(15)
    resetOffBudget()
    noteAnswer(res(429, { 'Retry-After': '600' }), now)
    expect(pausedFor(now)).toBe(60)
  })

  it('signing out, or another account, forgets the count and the pause', () => {
    useStore.setState({ user: { id: 1, name: 'A' } })
    const now = Date.now()
    noteAnswer(res(429, { 'Retry-After': '30' }), now)
    expect(pausedFor(now)).toBe(30)
    useStore.setState({ user: null })
    expect(pausedFor(now)).toBe(0)
    expect(canSearch('tap', now)).toBe(true)
    useStore.setState({ user: { id: 1, name: 'A' } })
    for (let i = 0; i < AUTO_PER_MIN; i++) noteSearch('auto', now)
    expect(canSearch('auto', now)).toBe(false)
    useStore.setState({ user: { id: 2, name: 'B' } })
    expect(canSearch('auto', now)).toBe(true)
  })

  it('searches by itself only from three letters, from Home or Nutrition or scoped to foods, with under five of your foods', () => {
    expect(autoOnline({ query: 'nut', tab: 'home', group: null, ownCount: 0 })).toBe(true)
    expect(autoOnline({ query: 'nu', tab: 'home', group: null, ownCount: 0 })).toBe(false)
    expect(autoOnline({ query: 'nutella', tab: 'train', group: null, ownCount: 0 })).toBe(false)
    expect(autoOnline({ query: 'nutella', tab: 'train', group: 'foods', ownCount: 0 })).toBe(true)
    expect(autoOnline({ query: 'nutella', tab: 'food', group: null, ownCount: 5 })).toBe(false)
  })
})
