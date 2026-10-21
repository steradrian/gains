// @vitest-environment happy-dom
// Deleting an equipment profile with Undo (T12.1): the profile goes at once, the active one moves to
// the first left, and Undo puts the profile back in its place, the active one with it unless
// another has been picked since.
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../store/useStore.js'
import { deleteProfileWithUndo } from './equipment-delete.js'

const S = () => useStore.getState().S
const a = { id: 'a', name: 'Home', equipment: ['dumbbell'], accV: 1 }
const b = { id: 'b', name: 'City Gym', equipment: ['barbell'], accV: 1 }
const c = { id: 'c', name: 'Hotel', equipment: [], accV: 1 }
const ids = () => S().equipProfiles.map(p => p.id)

beforeEach(() => {
  useStore.setState(s => ({ S: { ...s.S, equipProfiles: [structuredClone(a), structuredClone(b), structuredClone(c)], activeEquipId: 'b' } }))
})

describe('deleteProfileWithUndo', () => {
  it('removes the profile and leaves the active one alone when it was another', () => {
    const res = deleteProfileWithUndo('a')
    expect(ids()).toEqual(['b', 'c'])
    expect(S().activeEquipId).toBe('b')
    expect(res.profile).toEqual(a)
  })

  it('moves the active profile to the first one left when it was the one deleted', () => {
    deleteProfileWithUndo('b')
    expect(ids()).toEqual(['a', 'c'])
    expect(S().activeEquipId).toBe('a')
  })

  it('leaves no active profile when none is left', () => {
    useStore.setState(s => ({ S: { ...s.S, equipProfiles: [structuredClone(a)], activeEquipId: 'a' } }))
    deleteProfileWithUndo('a')
    expect(S().equipProfiles).toEqual([])
    expect(S().activeEquipId).toBeNull()
  })

  it('changes nothing for an id that is not a profile', () => {
    const before = structuredClone(S().equipProfiles)
    expect(deleteProfileWithUndo('nope')).toBeNull()
    expect(S().equipProfiles).toEqual(before)
    expect(S().activeEquipId).toBe('b')
  })

  it('Undo puts the profile back in its place, with its equipment, and the active id with it', () => {
    const { undo } = deleteProfileWithUndo('b')
    expect(undo()).toBe(true)
    expect(ids()).toEqual(['a', 'b', 'c'])
    expect(S().equipProfiles[1]).toEqual(b)
    expect(S().activeEquipId).toBe('b')
  })

  it('Undo does not take the active profile back from one picked since', () => {
    const { undo } = deleteProfileWithUndo('b')
    useStore.getState().update(s => { s.activeEquipId = 'c' })
    expect(undo()).toBe(true)
    expect(ids()).toEqual(['a', 'b', 'c'])
    expect(S().activeEquipId).toBe('c')
  })

  it('Undo does not touch the active profile when the deleted one was not active', () => {
    const { undo } = deleteProfileWithUndo('a')
    undo()
    expect(ids()).toEqual(['a', 'b', 'c'])
    expect(S().activeEquipId).toBe('b')
  })

  it('Undo works once, and does nothing when the profile is already back', () => {
    const first = deleteProfileWithUndo('a')
    expect(first.undo()).toBe(true)
    expect(first.undo()).toBe(false)
    expect(ids()).toEqual(['a', 'b', 'c'])
    const second = deleteProfileWithUndo('c')
    useStore.getState().update(s => { s.equipProfiles.push(structuredClone(c)) })   // another device's Undo, say
    expect(second.undo()).toBe(false)
    expect(ids()).toEqual(['a', 'b', 'c'])
  })

  it('Undo puts it last when the list has shrunk past its place', () => {
    const { undo } = deleteProfileWithUndo('c')
    deleteProfileWithUndo('b')
    undo()
    expect(ids()).toEqual(['a', 'c'])
  })
})
