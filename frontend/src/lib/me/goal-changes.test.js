// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { NtApi } from '../nutrition/api.js'
import { useNutrition } from '../nutrition/store.js'
import '../recent-changes-kinds.js'
import { listChanges, recordChange, restoreChange, undoRestore } from '../recent-changes.js'
import { removeEntries } from '../recent-changes-store.js'
import { convertStateUnit } from '../units.js'
import { GOAL_CHANGE, applySnapshot, recordGoalChange, snapshotOf } from './goal-changes.js'
import { applyWrites } from './goal-writes.js'

vi.mock('../api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

const clone = v => JSON.parse(JSON.stringify(v))
let server
let calls

beforeEach(() => {
  localStorage.clear()
  removeEntries()
  server = { height_cm: 182, calorieGoalFactor: 1, goals: { calories: { max: 2473 } } }
  calls = []
  useStore.setState({ S: Object.assign(clone(DEF), { unit: 'kg', targetW: 78 }), user: { id: 3 } })
  useNutrition.getState().reset()
  useNutrition.setState({ settings: { status: 'ready', data: clone(server), error: null } })
  vi.spyOn(NtApi, 'getSettings').mockImplementation(async () => clone(server))
  vi.spyOn(NtApi, 'putSetting').mockImplementation(async (key, value) => { calls.push([key, value]); server[key] = clone(value) })
})
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

// A change as use-goal makes it: write, then journal.
async function change(writes, targetW = null) {
  const written = writes.length ? await applyWrites(writes) : { ok: true, order: [] }
  if (targetW) useStore.getState().update(s => { s.targetW = targetW.after })
  const snapshot = snapshotOf(written, targetW)
  return { id: recordGoalChange('goal', 'keep', 'lose', snapshot), snapshot }
}

describe('goal-change journal entries', () => {
  it('records structured facts and no strings', async () => {
    await change([['calorieGoalFactor', 0.8]])
    const [entry] = listChanges()
    expect(entry).toMatchObject({ kind: GOAL_CHANGE, subject: '', facts: { what: 'goal', from: 'keep', to: 'lose' }, action: 'restore', state: 'open' })
    expect(entry.snapshot).toBeUndefined()
  })

  it('snapshotOf keeps the write order and drops a target that did not move', () => {
    const snap = snapshotOf({ ok: true, order: ['a', 'b'], before: { a: 1, b: null }, after: { a: 2, b: 3 } }, { before: 78, after: 78 })
    expect(snap).toEqual({ settings: { order: ['a', 'b'], before: { a: 1, b: null }, after: { a: 2, b: 3 } }, targetW: null })
    expect(snapshotOf({ ok: true, order: [] }, null)).toEqual({ settings: null, targetW: null })
  })

  it('Restore from Recent changes puts the old values back in the written order and marks the entry restored', async () => {
    const { id } = await change([['height_cm', 170], ['calorieGoalFactor', 0.8]], { before: 78, after: 76 })
    calls.length = 0
    expect(await restoreChange(id)).toEqual({ ok: true })
    expect(calls).toEqual([['height_cm', 182], ['calorieGoalFactor', 1]])
    expect(server).toMatchObject({ height_cm: 182, calorieGoalFactor: 1 })
    expect(useStore.getState().S.targetW).toBe(78)
    expect(listChanges()[0].state).toBe('restored')
  })

  it('a second Restore, or Restore after the toast Undo, does not apply twice', async () => {
    const { id } = await change([['calorieGoalFactor', 0.8]])
    expect((await restoreChange(id)).ok).toBe(true)
    calls.length = 0
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'restored' })
    expect(calls).toEqual([])
  })

  it('refuses with "changed" when a key changed since, and writes nothing', async () => {
    const { id } = await change([['height_cm', 170], ['calorieGoalFactor', 0.8]])
    server.calorieGoalFactor = 1.1
    useNutrition.setState({ settings: { status: 'ready', data: clone(server), error: null } })
    calls.length = 0
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'changed' })
    expect(calls).toEqual([])
    expect(server.height_cm).toBe(170)
    expect(listChanges()[0].state).toBe('open')
  })

  it('refuses with "changed" when the target weight moved since', async () => {
    const { id } = await change([], { before: 78, after: 76 })
    useStore.getState().update(s => { s.targetW = 74 })
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'changed' })
    expect(useStore.getState().S.targetW).toBe(74)
  })

  it('restores a target weight in the unit now, after a kg to lb switch', async () => {
    const { id } = await change([], { before: 78, after: 76 })
    useStore.setState({ S: convertStateUnit(useStore.getState().S, 'lb') })
    expect(useStore.getState().S.targetW).toBe(167.6)
    expect(await restoreChange(id)).toEqual({ ok: true })
    expect(useStore.getState().S.targetW).toBe(172)
  })

  it('restoring a target-only change needs no NutriTrace', async () => {
    useStore.setState({ user: null })
    const { id } = await change([], { before: 78, after: 76 })
    expect(await restoreChange(id)).toEqual({ ok: true })
    expect(useStore.getState().S.targetW).toBe(78)
  })

  it('a settings change cannot be restored without NutriTrace', async () => {
    const { snapshot } = await change([['calorieGoalFactor', 0.8]])
    useStore.setState({ user: null })
    calls.length = 0
    expect(await applySnapshot(snapshot)).toEqual({ ok: false, reason: 'gone' })
    expect(calls).toEqual([])
  })

  it('a failed restore write puts back what it had written and leaves the entry open', async () => {
    const { id } = await change([['height_cm', 170], ['calorieGoalFactor', 0.8]])
    NtApi.putSetting.mockImplementation(async (key, value) => {
      calls.push([key, value])
      if (key === 'calorieGoalFactor') throw new Error('down')
      server[key] = clone(value)
    })
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'error' })
    expect(server.height_cm).toBe(170)
    expect(listChanges()[0].state).toBe('open')
  })

  it('undoing a restore applies the change again', async () => {
    const { id } = await change([['height_cm', 170]])
    await restoreChange(id)
    expect(server.height_cm).toBe(182)
    expect(await undoRestore(id)).toEqual({ ok: true })
    expect(server.height_cm).toBe(170)
    expect(listChanges()[0].state).toBe('open')
  })

  it('applySnapshot with nothing in it is gone', async () => {
    expect(await applySnapshot({ settings: null, targetW: null })).toEqual({ ok: false, reason: 'gone' })
    expect(await applySnapshot(null)).toEqual({ ok: false, reason: 'gone' })
  })

  it('the kinds registry knows the kind', async () => {
    const id = recordChange({ kind: GOAL_CHANGE, snapshot: { settings: null, targetW: null } })
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'gone' })
  })
})
