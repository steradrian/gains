// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import '../recent-changes-kinds.js'
import { listChanges, restoreChange, undoRestore } from '../recent-changes.js'
import { removeEntries } from '../recent-changes-store.js'
import { buildEntry, deleteMeasurementDay, logFields, measurementOn, saveMeasurementEntry } from './measure-log.js'
import { MEASURE_DELETE, readingsOf, recordMeasureDelete, restoreMeasureDelete } from './measure-changes.js'

vi.mock('../api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../nutrition/sync.js', () => ({ syncNow: vi.fn(() => Promise.resolve()) }))

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const DAY = '2025-10-11'
const CUSTOM = [{ id: 'c1', name: 'Neck low', enabled: true }]
const DAY_ENTRY = { d: DAY, t: 2000, waist: 84, chest: 101.5, other: [{ id: 'c1', name: 'Neck low', value: 39 }] }

beforeEach(() => {
  localStorage.clear()
  removeEntries()
  useStore.setState({
    S: Object.assign(clone(DEF), {
      unit: 'kg', measurementEnabled: ['waist', 'chest'], customMeasurements: clone(CUSTOM),
      measurements: [{ d: '2025-10-04', t: 1000, waist: 85 }, clone(DAY_ENTRY)],
    }),
    user: null,
  })
})
afterEach(() => { localStorage.clear() })

// What the Edit drawer's Delete does.
const remove = () => { const removed = deleteMeasurementDay(DAY); recordMeasureDelete(removed); return removed }
// Logging the day again, the way the drawer saves a new check-in.
const relog = waist => {
  const fields = logFields(S())
  const built = buildEntry({ S: S(), date: DAY, texts: { waist: String(waist) }, fields, now: Date.now() })
  saveMeasurementEntry(built.entry)
}

describe('the journal entry', () => {
  it('journals a delete with the day and the count of readings, structured, no wording', () => {
    remove()
    const [row, ...rest] = listChanges()
    expect(rest).toEqual([])
    expect(row).toMatchObject({ kind: MEASURE_DELETE, day: DAY, subject: '', facts: { count: 3 }, action: 'restore', state: 'open' })
  })

  it('journals nothing for a day without readings', () => {
    expect(recordMeasureDelete(null)).toBeNull()
    expect(recordMeasureDelete({ d: DAY, t: 1, waist: null, other: [] })).toBeNull()
    expect(listChanges()).toEqual([])
  })

  it('deleting writes the day\'s tombstone, after the entry\'s own time', () => {
    remove()
    expect(measurementOn(S(), DAY)).toBeNull()
    expect(S().deleted.measurements[DAY]).toBeGreaterThan(2000)
  })
})

describe('restoring a deleted day', () => {
  it('puts back the exact readings, stamped now, and marks the day added back', async () => {
    remove()
    const res = await restoreChange(listChanges()[0].id)
    expect(res).toMatchObject({ ok: true, where: { day: DAY } })
    const back = measurementOn(S(), DAY)
    expect(readingsOf(back)).toEqual({ waist: 84, chest: 101.5, 'other:c1': 39 })
    expect(back.t).toBeGreaterThan(2000)
    expect(S().deleted.measurements[DAY]).toBeLessThan(0)
    expect(S().measurements.filter(e => e.d === DAY)).toHaveLength(1)
    expect(listChanges()[0].state).toBe('restored')
  })

  it('days later, after the day was logged again, answers replaced and keeps the newer readings', async () => {
    remove()
    relog(82)
    const res = await restoreChange(listChanges()[0].id)
    expect(res).toMatchObject({ ok: false, reason: 'replaced' })
    expect(readingsOf(measurementOn(S(), DAY))).toEqual({ waist: 82 })
    expect(listChanges()[0].state).toBe('open')
  })

  it('answers restored, not replaced, when the day already holds the same readings (the drawer\'s Undo)', async () => {
    const removed = remove()
    expect(restoreMeasureDelete({ before: removed })).toMatchObject({ ok: true })
    expect(await restoreChange(listChanges()[0].id)).toMatchObject({ ok: false, reason: 'restored' })
    expect(S().measurements.filter(e => e.d === DAY)).toHaveLength(1)
  })

  it('answers gone for a snapshot without readings', () => {
    expect(restoreMeasureDelete({ before: { d: DAY, waist: null } })).toEqual({ ok: false, reason: 'gone' })
    expect(restoreMeasureDelete(null)).toEqual({ ok: false, reason: 'gone' })
  })

  it('Undo of the restore takes the day out again, with its tombstone', async () => {
    remove()
    const [{ id }] = listChanges()
    await restoreChange(id)
    expect(await undoRestore(id)).toMatchObject({ ok: true })
    expect(measurementOn(S(), DAY)).toBeNull()
    expect(S().deleted.measurements[DAY]).toBeGreaterThan(0)
    expect(listChanges()[0].state).toBe('open')
  })

  it('Undo of the restore leaves alone a day changed since', async () => {
    remove()
    const [{ id }] = listChanges()
    await restoreChange(id)
    useStore.getState().update(s => { s.measurements.find(e => e.d === DAY).waist = 80; s.measurements.find(e => e.d === DAY).t = Date.now() + 5 })
    expect(await undoRestore(id)).toMatchObject({ ok: false })
    expect(measurementOn(S(), DAY).waist).toBe(80)
  })
})
