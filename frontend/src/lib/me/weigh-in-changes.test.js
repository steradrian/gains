// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import '../recent-changes-kinds.js'
import { listChanges, restoreChange, undoRestore } from '../recent-changes.js'
import { removeEntries } from '../recent-changes-store.js'
import { convertStateUnit } from '../units.js'
import { deleteWeighIn, saveWeighIn, weighInOn } from './weigh-in.js'
import {
  WEIGHIN_DELETE, WEIGHIN_EDIT, recordWeighInDelete, recordWeighInEdit, restoreWeighInDelete, restoreWeighInEdit,
} from './weigh-in-changes.js'

vi.mock('../api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../nutrition/sync.js', () => ({ syncNow: vi.fn(() => Promise.resolve()) }))

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const DAY = '2026-10-11'

beforeEach(() => {
  localStorage.clear()
  removeEntries()
  useStore.setState({ S: Object.assign(clone(DEF), { unit: 'kg', bodyweight: [{ d: '2026-10-04', w: 82.1, t: 1000 }, { d: DAY, w: 81.8, t: 2000 }] }), user: null })
})
afterEach(() => { localStorage.clear() })

// What the Edit drawer does on Save and on Delete.
const edit = w => { const before = saveWeighIn(DAY, w); recordWeighInEdit(before, w, 'kg'); return before }
const remove = () => { const removed = deleteWeighIn(DAY); recordWeighInDelete(removed, 'kg'); return removed }

describe('the journal entries', () => {
  it('journals an edit with the old and new value, structured, and no wording', () => {
    edit(81.7)
    const [row, ...rest] = listChanges()
    expect(rest).toEqual([])
    expect(row).toMatchObject({ kind: WEIGHIN_EDIT, day: DAY, subject: '', facts: { from: 81.8, to: 81.7, unit: 'kg' }, action: 'restore', state: 'open' })
  })

  it('journals a delete with the weight', () => {
    remove()
    expect(listChanges()[0]).toMatchObject({ kind: WEIGHIN_DELETE, day: DAY, facts: { weight: 81.8, unit: 'kg' }, state: 'open' })
  })

  it('journals nothing for a day that had no weigh-in', () => {
    expect(recordWeighInEdit(null, 80, 'kg')).toBeNull()
    expect(recordWeighInDelete(null, 'kg')).toBeNull()
    expect(listChanges()).toEqual([])
  })
})

describe('restoring a deleted weigh-in', () => {
  it('re-adds the entry with a fresh stamp and clears the tombstone', async () => {
    remove()
    expect(S().deleted.bodyweight[DAY]).toBeGreaterThan(0)
    const res = await restoreChange(listChanges()[0].id)
    expect(res).toMatchObject({ ok: true, where: { day: DAY } })
    expect(weighInOn(S(), DAY)).toMatchObject({ w: 81.8 })
    expect(weighInOn(S(), DAY).t).toBeGreaterThan(2000)
    expect(S().deleted.bodyweight[DAY]).toBeLessThan(0)
    expect(listChanges()[0].state).toBe('restored')
  })

  it('twice is a no-op: one entry for the day', async () => {
    remove()
    const [{ id }] = listChanges()
    await restoreChange(id)
    expect(await restoreChange(id)).toMatchObject({ ok: false, reason: 'restored' })
    expect(restoreWeighInDelete({ before: { d: DAY, w: 81.8 } })).toEqual({ ok: false, reason: 'replaced' })
    expect(S().bodyweight.filter(b => b.d === DAY)).toHaveLength(1)
  })

  it('answers replaced, and adds no second reading, when the day has a weigh-in again', async () => {
    remove()
    saveWeighIn(DAY, 80.9)
    const res = await restoreChange(listChanges()[0].id)
    expect(res).toMatchObject({ ok: false, reason: 'replaced' })
    expect(S().bodyweight.filter(b => b.d === DAY)).toEqual([expect.objectContaining({ w: 80.9 })])
  })

  it('Undo takes the restored entry out again', async () => {
    remove()
    const [{ id }] = listChanges()
    await restoreChange(id)
    expect(await undoRestore(id)).toMatchObject({ ok: true })
    expect(weighInOn(S(), DAY)).toBeNull()
  })
})

describe('restoring an edited weigh-in', () => {
  it('puts the old value back, stamped now', async () => {
    edit(81.7)
    const res = await restoreChange(listChanges()[0].id)
    expect(res).toMatchObject({ ok: true, where: { day: DAY } })
    expect(weighInOn(S(), DAY).w).toBe(81.8)
    expect(S().bodyweight.filter(b => b.d === DAY)).toHaveLength(1)
  })

  it('twice is a no-op', async () => {
    edit(81.7)
    const [{ id }] = listChanges()
    await restoreChange(id)
    expect(await restoreChange(id)).toMatchObject({ ok: false, reason: 'restored' })
    expect(restoreWeighInEdit({ before: { d: DAY, w: 81.8 }, after: 81.7 })).toEqual({ ok: false, reason: 'replaced' })
    expect(weighInOn(S(), DAY).w).toBe(81.8)
  })

  it('answers replaced when the day was changed again after the edit', async () => {
    edit(81.7)
    saveWeighIn(DAY, 80.5)
    expect(await restoreChange(listChanges()[0].id)).toMatchObject({ ok: false, reason: 'replaced' })
    expect(weighInOn(S(), DAY).w).toBe(80.5)
  })

  it('answers gone when the day has no weigh-in any more', async () => {
    edit(81.7)
    deleteWeighIn(DAY)
    expect(await restoreChange(listChanges()[0].id)).toMatchObject({ ok: false, reason: 'gone' })
    expect(weighInOn(S(), DAY)).toBeNull()
  })

  it('Undo puts the edited value back', async () => {
    edit(81.7)
    const [{ id }] = listChanges()
    await restoreChange(id)
    expect(await undoRestore(id)).toMatchObject({ ok: true })
    expect(weighInOn(S(), DAY).w).toBe(81.7)
  })
})

describe('restoring after a kg to lb switch', () => {
  const toLb = () => useStore.setState({ S: convertStateUnit(S(), 'lb') })

  it('a deleted weigh-in comes back in lb, not as a kg number', async () => {
    remove()
    toLb()
    expect(await restoreChange(listChanges()[0].id)).toMatchObject({ ok: true })
    expect(S().unit).toBe('lb')
    expect(weighInOn(S(), DAY).w).toBe(180.3)
    // Undo of the restore finds the converted entry again.
    expect(await undoRestore(listChanges()[0].id)).toMatchObject({ ok: true })
    expect(weighInOn(S(), DAY)).toBeNull()
  })

  it('an edit restores in lb and is not mistaken for a newer reading', async () => {
    edit(81.7)
    toLb()
    expect(await restoreChange(listChanges()[0].id)).toMatchObject({ ok: true })
    expect(weighInOn(S(), DAY).w).toBe(180.3)
  })

  it('an entry without a unit is read in the current unit', () => {
    expect(restoreWeighInDelete({ before: { d: DAY, w: 81.8 } })).toEqual({ ok: false, reason: 'replaced' })
  })
})
