// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { todayISO } from '../format.js'
import {
  addCustomField, buildEntry, fieldUnit, logFields, measurementOn, parseValue, saveMeasurementEntry,
  setBuiltinTracked, setCustomTracked, startTexts,
} from './measure-log.js'

vi.mock('../api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../nutrition/sync.js', () => ({ syncNow: vi.fn(() => Promise.resolve()) }))

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const state = (patch = {}) => Object.assign(clone(DEF), { unit: 'kg', measurements: [], customMeasurements: [], measurementEnabled: ['waist', 'chest'], ...patch })
const fieldsOf = (...keys) => logFields({ ...state(), measurementEnabled: keys })

beforeEach(() => { useStore.setState({ S: state(), user: null }) })
afterEach(() => { localStorage.clear() })

describe('parseValue', () => {
  it('reads a positive number to one decimal, comma or point', () => {
    expect(parseValue('82.46')).toBe(82.5)
    expect(parseValue('82,5')).toBe(82.5)
  })
  it('reads empty, zero, negative and words as empty', () => {
    for (const text of ['', '  ', '0', '-3', 'abc', null, undefined]) expect(parseValue(text)).toBeNull()
  })
})

describe('buildEntry: empty means empty', () => {
  it('fills only the fields typed in and leaves the rest null', () => {
    const fields = fieldsOf('waist', 'chest')
    const out = buildEntry({ S: S(), date: todayISO(), texts: { waist: '83.5', chest: '' }, fields, now: 5000 })
    expect(out.ok).toBe(true)
    expect(out.entry).toMatchObject({ d: todayISO(), waist: 83.5, chest: null, hips: null, t: 5000 })
  })

  it('refuses a form with nothing in it', () => {
    const out = buildEntry({ S: S(), date: todayISO(), texts: { waist: '', chest: '0' }, fields: fieldsOf('waist', 'chest') })
    expect(out).toEqual({ ok: false, reason: 'empty' })
  })
})

describe('buildEntry: units', () => {
  it('stores centimetres whatever the profile unit', () => {
    useStore.setState({ S: state({ unit: 'lb' }) })
    const out = buildEntry({ S: S(), date: todayISO(), texts: { waist: '36' }, fields: fieldsOf('waist') })
    expect(out.entry.waist).toBe(91.4)
  })

  it('keeps body fat as a percent and refuses over 100', () => {
    const fields = fieldsOf('bodyFat')
    expect(buildEntry({ S: S(), date: todayISO(), texts: { bodyFat: '18.5' }, fields }).entry.bodyFat).toBe(18.5)
    expect(buildEntry({ S: S(), date: todayISO(), texts: { bodyFat: '101' }, fields })).toEqual({ ok: false, reason: 'bodyFat' })
  })

  it('shows the fields in the form unit and the unit beside them', () => {
    const source = { d: '2026-10-01', waist: 91.44, bodyFat: 20 }
    const fields = fieldsOf('waist', 'bodyFat')
    expect(startTexts(source, fields, 'lb')).toEqual({ waist: '36', bodyFat: '20' })
    expect(startTexts(null, fields, 'kg')).toEqual({ waist: '', bodyFat: '' })
    expect(fieldUnit(fields[0], 'lb')).toBe('in')
    expect(fieldUnit(fields[0], 'kg')).toBe('cm')
    expect(fieldUnit(fields[1], 'lb')).toBe('%')
  })
})

describe('buildEntry: dates', () => {
  it('refuses a day to come or a malformed one', () => {
    const base = { S: S(), texts: { waist: '80' }, fields: fieldsOf('waist') }
    expect(buildEntry({ ...base, date: '2999-01-01' })).toEqual({ ok: false, reason: 'date' })
    expect(buildEntry({ ...base, date: 'today' })).toEqual({ ok: false, reason: 'date' })
  })

  it('refuses a second check-in on a day, unless it is the one being edited', () => {
    useStore.setState({ S: state({ measurements: [{ d: '2026-10-01', t: 1, waist: 85 }] }) })
    const base = { S: S(), date: '2026-10-01', texts: { waist: '84' }, fields: fieldsOf('waist') }
    expect(buildEntry(base)).toEqual({ ok: false, reason: 'duplicate' })
    expect(buildEntry({ ...base, sourceDate: '2026-10-01' })).toMatchObject({ ok: true, entry: { d: '2026-10-01', waist: 84 } })
  })

  it('keeps what an edit did not touch', () => {
    useStore.setState({ S: state({ measurements: [{ d: '2026-10-01', t: 1, waist: 85, hips: 99 }] }) })
    const out = buildEntry({ S: S(), sourceDate: '2026-10-01', date: '2026-10-01', texts: { waist: '84', chest: '' }, fields: fieldsOf('waist', 'chest') })
    expect(out.entry).toMatchObject({ waist: 84, hips: 99, chest: null })
  })
})

describe('logFields', () => {
  it('offers a switched-off field when the day being edited has a value in it', () => {
    const source = { d: '2026-10-01', waist: 85, hips: 99, other: [{ id: 'x1', name: 'Calf', value: 38 }] }
    const keys = logFields({ ...state(), measurementEnabled: ['waist'] }, source).map(f => f.key)
    expect(keys).toEqual(['waist', 'hips', 'other:x1'])
  })
})

describe('custom fields', () => {
  it('saves a custom value inside the entry and reads it back', () => {
    expect(addCustomField('Calf wrap')).toEqual({ ok: true })
    const custom = S().customMeasurements[0]
    expect(custom).toMatchObject({ name: 'Calf wrap', enabled: true })
    const fields = logFields(S())
    const out = buildEntry({ S: S(), date: todayISO(), texts: { ['other:' + custom.id]: '40' }, fields })
    expect(out.entry.other).toEqual([{ id: custom.id, name: 'Calf wrap', value: 40 }])
    saveMeasurementEntry(out.entry)
    expect(measurementOn(S(), todayISO()).other[0].value).toBe(40)
  })

  it('refuses a blank name and one that is taken, by a custom or a built-in field, in any case', () => {
    expect(addCustomField('   ')).toEqual({ ok: false, reason: 'empty' })
    addCustomField('Calf wrap')
    expect(addCustomField('calf WRAP')).toEqual({ ok: false, reason: 'exists' })
    expect(addCustomField('waist')).toEqual({ ok: false, reason: 'exists' })
    expect(S().customMeasurements).toHaveLength(1)
  })

  it('switches a custom field off and on without losing its readings', () => {
    addCustomField('Calf wrap')
    const id = S().customMeasurements[0].id
    setCustomTracked(id, false)
    expect(logFields(S()).some(f => f.key === 'other:' + id)).toBe(false)
    expect(S().customMeasurements[0].name).toBe('Calf wrap')
    setCustomTracked(id, true)
    expect(logFields(S()).some(f => f.key === 'other:' + id)).toBe(true)
  })
})

describe('saveMeasurementEntry and tracking', () => {
  it('moves an edited check-in to its new day and keeps one entry per day', () => {
    useStore.setState({ S: state({ measurements: [{ d: '2026-10-01', t: 1, waist: 85 }] }) })
    const out = buildEntry({ S: S(), sourceDate: '2026-10-01', date: '2026-10-02', texts: { waist: '84' }, fields: fieldsOf('waist') })
    saveMeasurementEntry(out.entry, '2026-10-01')
    expect(S().measurements.map(e => [e.d, e.waist])).toEqual([['2026-10-02', 84]])
  })

  it('switching a built-in field off leaves its readings and drops it from the form', () => {
    useStore.setState({ S: state({ measurements: [{ d: '2026-10-01', t: 1, waist: 85, chest: 100 }] }) })
    setBuiltinTracked('chest', false)
    expect(S().measurementEnabled).toEqual(['waist'])
    expect(S().measurements[0].chest).toBe(100)
    setBuiltinTracked('hips', true)
    expect(S().measurementEnabled).toEqual(['waist', 'hips'])
  })
})
