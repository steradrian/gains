// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../../store/useStore.js'
import {
  RECENT_MAX, addRecent, clearRecents, clearRecentsWithUndo, keepRecentsThroughUserSwap, markSearched, noteOpened, openedScore, pruneRecents, removeRecent,
  restoreRecents, useRecents,
} from './recents.js'

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ user: { id: 1, name: 'A' } })
  clearRecents()
})

describe('Recent', () => {
  it('keeps six, newest first, one entry per query or result', () => {
    for (let i = 0; i < 8; i++) addRecent({ kind: 'query', query: 'q' + i })
    addRecent({ kind: 'query', query: 'Q7 ' })
    addRecent({ kind: 'result', type: 'routine', id: 'r1', label: 'Push', query: 'pu' })
    const list = useRecents.getState().list
    expect(list).toHaveLength(RECENT_MAX)
    expect(list[0]).toEqual({ kind: 'result', type: 'routine', id: 'r1', label: 'Push', query: 'pu' })
    expect(list.filter(r => r.query?.toLowerCase().trim() === 'q7')).toHaveLength(1)
  })

  it('removes one, clears all with an undo, and drops deleted targets', () => {
    addRecent({ kind: 'query', query: 'oats' })
    addRecent({ kind: 'result', type: 'food', id: 11, label: 'Oats' })
    removeRecent({ kind: 'query', query: 'oats' })
    expect(useRecents.getState().list).toHaveLength(1)
    const before = clearRecents()
    expect(useRecents.getState().list).toEqual([])
    restoreRecents(before)
    expect(useRecents.getState().list).toHaveLength(1)
    pruneRecents(() => false)
    expect(useRecents.getState().list).toEqual([])
  })

  it('is per profile, and wiped when that profile signs out', () => {
    addRecent({ kind: 'query', query: 'mine' })
    noteOpened('page:/home')
    expect(openedScore('page:/home')).toBeGreaterThan(0)
    useStore.setState({ user: null })
    useStore.setState({ user: { id: 1, name: 'A' } })
    expect(useRecents.getState().list).toEqual([])
    expect(openedScore('page:/home')).toBe(0)
  })

  it('does not survive a switch to another profile: not on screen, not in storage, not when the first comes back', () => {
    addRecent({ kind: 'query', query: 'mine' })
    noteOpened('page:/home')
    useStore.setState({ user: { id: 2, name: 'B' } })
    expect(useRecents.getState().list).toEqual([])
    expect(localStorage.getItem('gains_search_recent:u1')).toBeNull()
    expect(localStorage.getItem('gains_search_opened:u1')).toBeNull()
    useStore.setState({ user: { id: 1, name: 'A' } })
    expect(useRecents.getState().list).toEqual([])
    expect(openedScore('page:/home')).toBe(0)
  })

  it('Undo restores into the profile that cleared, and into no one else, even one wiped and signed back in', () => {
    addRecent({ kind: 'query', query: 'oats' })
    const undo = clearRecents()
    useStore.setState({ user: { id: 2, name: 'B' } })
    restoreRecents(undo)
    expect(useRecents.getState().list).toEqual([])
    expect(localStorage.getItem('gains_search_recent:u2')).toBeNull()
    useStore.setState({ user: { id: 1, name: 'A' } })
    restoreRecents(undo)
    expect(useRecents.getState().list).toEqual([])
    addRecent({ kind: 'query', query: 'rice' })
    const again = clearRecents()
    restoreRecents(again)
    expect(useRecents.getState().list.map(r => r.query)).toEqual(['rice'])
  })

  it('Clear hands back its Undo', () => {
    addRecent({ kind: 'query', query: 'oats' })
    const undo = clearRecentsWithUndo()
    expect(useRecents.getState().list).toEqual([])
    undo()
    expect(useRecents.getState().list.map(r => r.query)).toEqual(['oats'])
  })

  it('Undo puts the cleared entries back under what was added since, once each, six at most', () => {
    for (const q of ['a', 'b', 'c', 'd', 'e']) addRecent({ kind: 'query', query: q })
    const undo = clearRecentsWithUndo()
    addRecent({ kind: 'query', query: 'new' })
    addRecent({ kind: 'query', query: 'C' })
    undo()
    expect(useRecents.getState().list.map(r => r.query)).toEqual(['C', 'new', 'e', 'd', 'b', 'a'])
    expect(JSON.parse(localStorage.getItem('gains_search_recent:u1')).map(r => r.query)).toEqual(['C', 'new', 'e', 'd', 'b', 'a'])
  })

  it('a user laid over another while held (the screens gallery) wipes neither profile\'s stored Recent', () => {
    addRecent({ kind: 'query', query: 'mine' })
    markSearched()
    const release = keepRecentsThroughUserSwap()
    useStore.setState({ user: { id: 'g', name: 'Gallery' } })
    expect(useRecents.getState().list).toEqual([])
    useStore.setState({ user: { id: 1, name: 'A' } })
    release()
    expect(useRecents.getState().list.map(r => r.query)).toEqual(['mine'])
    expect(localStorage.getItem('gains_search_searched:u1')).toBe('true')
    // Released, a real switch wipes again.
    useStore.setState({ user: { id: 2, name: 'B' } })
    expect(localStorage.getItem('gains_search_recent:u1')).toBeNull()
    useStore.setState({ user: { id: 1, name: 'A' } })
  })
})

describe('the first use', () => {
  it('lasts until a search is run or a Recent entry is kept, and Clear does not bring it back', () => {
    useRecents.setState({ searched: false })
    localStorage.removeItem('gains_search_searched:u1')
    markSearched()
    expect(useRecents.getState().searched).toBe(true)
    expect(localStorage.getItem('gains_search_searched:u1')).toBe('true')
    useRecents.setState({ searched: false })
    addRecent({ kind: 'query', query: 'oats' })
    expect(useRecents.getState().searched).toBe(true)
    clearRecents()
    expect(useRecents.getState().searched).toBe(true)
  })

  it('is per profile, wiped with it on sign-out', () => {
    markSearched()
    useStore.setState({ user: { id: 2, name: 'B' } })
    expect(localStorage.getItem('gains_search_searched:u1')).toBeNull()
    expect(useRecents.getState().searched).toBe(false)
    useStore.setState({ user: { id: 1, name: 'A' } })
  })
})
