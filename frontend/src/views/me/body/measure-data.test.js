import { describe, expect, it } from 'vitest'
import { firstKey, measureOf } from './measure-data.js'

const at = d => new Date(d + 'T12:00:00').getTime()
const base = (patch = {}) => ({
  unit: 'kg', customMeasurements: [], measurementEnabled: ['waist', 'chest'],
  measurements: [
    { d: '2026-08-01', t: 1, waist: 88, chest: 101 },
    { d: '2026-09-12', t: 2, waist: 85.5 },
    { d: '2026-10-17', t: 3, waist: 84, chest: 102.5 },
  ],
  ...patch,
})

describe('measureOf', () => {
  it('counts what is tracked and finds the last day any of it was logged', () => {
    const data = measureOf(base())
    expect(data).toMatchObject({ count: 2, lastDay: '2026-10-17', empty: false })
    expect(data.fields.map(f => f.key)).toEqual(['chest', 'waist'])
  })

  it('gives the latest, the change on the one before, and the change since the first (three readings or more)', () => {
    const waist = measureOf(base()).fields.find(f => f.key === 'waist')
    expect(waist.latest).toEqual({ d: '2026-10-17', v: 84 })
    expect(waist.change).toBe(-1.5)
    expect(waist.since).toEqual({ d: '2026-08-01', change: -4 })
    expect(waist.unit).toBe('cm')
  })

  it('leaves out "since the first" when it would only repeat the change, and the change with one reading', () => {
    const chest = measureOf(base()).fields.find(f => f.key === 'chest')
    expect(chest.change).toBe(1.5)
    expect(chest.since).toBeNull()
    const one = measureOf(base({ measurements: [{ d: '2026-10-17', t: 1, waist: 84 }] })).fields.find(f => f.key === 'waist')
    expect(one.change).toBeNull()
    expect(one.since).toBeNull()
  })

  it('cuts the curve to the range and keeps the latest and the changes whole', () => {
    const waist = measureOf(base(), { from: at('2026-09-01') }).fields.find(f => f.key === 'waist')
    expect(waist.points.map(p => p.d)).toEqual(['2026-09-12', '2026-10-17'])
    expect(waist.latest.v).toBe(84)
    expect(waist.since.change).toBe(-4)
  })

  it('reads centimetres as inches for a pound profile, and body fat as a percent', () => {
    const data = measureOf(base({ unit: 'lb', measurementEnabled: ['waist', 'bodyFat'], measurements: [{ d: '2026-10-17', t: 1, waist: 91.44, bodyFat: 18.5 }] }))
    const waist = data.fields.find(f => f.key === 'waist')
    expect(waist).toMatchObject({ unit: 'in', latest: { v: 36 } })
    expect(data.fields.find(f => f.key === 'bodyFat')).toMatchObject({ unit: '%', latest: { v: 18.5 } })
  })

  it('names a custom field by its own word and flags it', () => {
    const data = measureOf(base({
      customMeasurements: [{ id: 'c1', name: 'Calf wrap', enabled: true }],
      measurements: [{ d: '2026-10-17', t: 1, waist: 84, other: [{ id: 'c1', name: 'Calf wrap', value: 38 }] }],
    }))
    expect(data.fields.find(f => f.key === 'other:c1')).toMatchObject({ label: 'Calf wrap', custom: true, latest: { v: 38 } })
  })

  it('is empty with nothing tracked, or nothing logged', () => {
    expect(measureOf(base({ measurementEnabled: [] }))).toMatchObject({ count: 0, empty: true, lastDay: null })
    expect(measureOf(base({ measurements: [] }))).toMatchObject({ count: 2, empty: true, lastDay: null })
  })

  it('does not show a switched-off measurement, though its readings stay in the state', () => {
    const data = measureOf(base({ measurementEnabled: ['waist'] }))
    expect(data.fields.map(f => f.key)).toEqual(['waist'])
  })
})

describe('firstKey', () => {
  it('picks the waist, else the first with a reading, else the first', () => {
    expect(firstKey(measureOf(base()))).toBe('waist')
    expect(firstKey(measureOf(base({ measurementEnabled: ['chest', 'hips'], measurements: [{ d: '2026-10-17', t: 1, hips: 98 }] })))).toBe('hips')
    expect(firstKey(measureOf(base({ measurements: [] })))).toBe('chest')
    expect(firstKey(measureOf(base({ measurementEnabled: [] })))).toBeNull()
  })
})
