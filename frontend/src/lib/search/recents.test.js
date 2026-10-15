// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { RECENT_MAX, addRecent, clearRecents, noteOpened, openedScore, pruneRecents, removeRecent, restoreRecents, useRecents } from './recents.js'

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
    useStore.setState({ user: { id: 2, name: 'B' } })
    expect(useRecents.getState().list).toEqual([])
    useStore.setState({ user: { id: 1, name: 'A' } })
    expect(useRecents.getState().list.map(r => r.query)).toEqual(['mine'])
    useStore.setState({ user: null })
    useStore.setState({ user: { id: 1, name: 'A' } })
    expect(useRecents.getState().list).toEqual([])
    expect(openedScore('page:/home')).toBe(0)
  })
})
