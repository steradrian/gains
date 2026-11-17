// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { fmtDate, todayISO } from '../../../lib/format.js'
import { listChanges } from '../../../lib/recent-changes.js'
import { removeEntries } from '../../../lib/recent-changes-store.js'
import { manageMeasurementsSheet, measurementLogSheet } from './measure-drawers.jsx'

vi.mock('../../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../../../lib/nutrition/sync.js', () => ({ syncNow: vi.fn(() => Promise.resolve()) }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mounted = []
const S = () => useStore.getState().S
const clone = v => JSON.parse(JSON.stringify(v))
const state = (patch = {}) => Object.assign(clone(DEF), { unit: 'kg', measurements: [], customMeasurements: [], measurementEnabled: ['waist', 'chest'], ...patch })
const PAST = '2026-09-01'

function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

// The drawer on the stack, or its newest sub-panel, drawn the way the sheet frame hands it its close.
function renderTop({ panel = false } = {}) {
  const sheet = useUI.getState().sheets.at(-1)
  const target = panel ? sheet.panels.at(-1) : sheet
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(target.render(() => useUI.getState().closeSheet(target.id))))
  const button = label => [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent.trim()) === label)
  const field = label => [...host.querySelectorAll('.g-tfield')].find(f => f.querySelector('.g-tfield-label').textContent === label)?.querySelector('input')
  return { host, button, field, title: () => host.querySelector('h2').textContent }
}
const tap = el => act(() => { el.click() })
const toastText = () => useUI.getState().toastMsg

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  useStore.setState({ S: { ...state() }, user: null })
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('Log measurements', () => {
  it('is a full design system drawer: Today, the hint, a field per tracked measurement with its unit, Choose, Save', () => {
    measurementLogSheet()
    const { host, button, title } = renderTop()
    expect(useUI.getState().sheets[0].variant).toBe('ds')
    expect(title()).toBe('Log measurements')
    expect(host.querySelector('.g-bs-full')).not.toBeNull()
    expect(host.querySelector('.g-bs-chip').textContent).toBe('Today')
    expect(host.textContent).toContain('Fill only what you measured today. Empty fields stay empty.')
    expect([...host.querySelectorAll('.g-tfield-label')].map(l => l.textContent)).toEqual(['Chest', 'Waist'])
    expect([...host.querySelectorAll('.g-tfield-unit')].map(l => l.textContent)).toEqual(['cm', 'cm'])
    expect(button('Choose measurements')).toBeDefined()
    expect(host.querySelector('.g-bs-foot button').textContent).toBe('Save measurements')
  })

  it('saves what was typed, leaves the other fields empty, closes and says so', () => {
    measurementLogSheet()
    const { field, button } = renderTop()
    act(() => type(field('Waist'), '83,5'))
    tap(button('Save measurements'))
    expect(S().measurements).toHaveLength(1)
    expect(S().measurements[0]).toMatchObject({ d: todayISO(), waist: 83.5, chest: null })
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(toastText()).toBe('Measurements saved')
  })

  it('does not save an empty form', () => {
    measurementLogSheet()
    const { button } = renderTop()
    tap(button('Save measurements'))
    expect(S().measurements).toHaveLength(0)
    expect(toastText()).toBe('Enter at least one measurement')
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('reads inches for a pound profile and stores centimetres', () => {
    useStore.setState({ S: state({ unit: 'lb' }) })
    measurementLogSheet()
    const { host, field, button } = renderTop()
    expect([...host.querySelectorAll('.g-tfield-unit')].map(l => l.textContent)).toEqual(['in', 'in'])
    act(() => type(field('Waist'), '36'))
    tap(button('Save measurements'))
    expect(S().measurements[0].waist).toBe(91.4)
  })

  it('refuses body fat over 100', () => {
    useStore.setState({ S: state({ measurementEnabled: ['bodyFat'] }) })
    measurementLogSheet()
    const { field, button } = renderTop()
    act(() => type(field('Body fat'), '120'))
    tap(button('Save measurements'))
    expect(toastText()).toBe('Body fat must be between 0 and 100%.')
    expect(S().measurements).toHaveLength(0)
  })

  it('opens a past day for editing with its values, and saving replaces that day', () => {
    useStore.setState({ S: state({ measurements: [{ d: PAST, t: 1, waist: 85, chest: 100 }] }) })
    measurementLogSheet(PAST)
    const { host, field, button, title } = renderTop()
    expect(title()).toBe('Edit measurements')
    expect(field('Waist').value).toBe('85')
    expect(field('Chest').value).toBe('100')
    expect(host.querySelector('.g-bs-chip').textContent).not.toBe('Today')
    act(() => type(field('Waist'), '84'))
    tap(button('Save measurements'))
    expect(S().measurements.map(e => [e.d, e.waist, e.chest])).toEqual([[PAST, 84, 100]])
  })

  it('shows a switched-off measurement that the edited day has a value in', () => {
    useStore.setState({ S: state({ measurementEnabled: ['waist'], measurements: [{ d: PAST, t: 1, waist: 85, hips: 99 }] }) })
    measurementLogSheet(PAST)
    const { field } = renderTop()
    expect(field('Hips').value).toBe('99')
  })
})

describe('Log measurements: a date that already has measurements', () => {
  it('opens today\'s entry for editing when today is measured, and says so', () => {
    useStore.setState({ S: state({ measurements: [{ d: todayISO(), t: 1, waist: 83 }] }) })
    measurementLogSheet()
    const { field, title } = renderTop()
    expect(toastText()).toBe('That date already has measurements. Edit it instead.')
    expect(title()).toBe('Edit measurements')
    expect(field('Waist').value).toBe('83')
  })

  it('picking a measured day in the date panel loads that day', () => {
    useStore.setState({ S: state({ measurements: [{ d: PAST, t: 1, waist: 85 }] }) })
    measurementLogSheet()
    const log = renderTop()
    expect(log.title()).toBe('Log measurements')
    tap(log.button('Change date'))
    const sheet = useUI.getState().sheets[0]
    expect(sheet.panels).toHaveLength(1)
    const panel = renderTop({ panel: true })
    expect(panel.title()).toBe('Date')
    const input = panel.host.querySelector('input[type="date"]')
    expect(input.max).toBe(todayISO())
    act(() => type(input, PAST))
    tap(panel.button('Done'))
    expect(useUI.getState().sheets[0].panels).toHaveLength(0)
    expect(toastText()).toBe('That date already has measurements. Edit it instead.')
    expect(log.title()).toBe('Edit measurements')
    expect(log.field('Waist').value).toBe('85')
  })

  it('picking a day with no entry keeps the form and logs to that day', () => {
    measurementLogSheet()
    const log = renderTop()
    act(() => type(log.field('Waist'), '82'))
    tap(log.button('Change date'))
    const panel = renderTop({ panel: true })
    act(() => type(panel.host.querySelector('input[type="date"]'), PAST))
    tap(panel.button('Done'))
    tap(log.button('Save measurements'))
    expect(S().measurements.map(e => [e.d, e.waist])).toEqual([[PAST, 82]])
  })
})

describe('Choose measurements', () => {
  const open = () => { manageMeasurementsSheet(); return renderTop() }

  it('lists every built-in measurement in its group with a switch, on for the tracked ones', () => {
    const { host } = open()
    expect(host.querySelector('h2').textContent).toBe('Choose measurements')
    expect([...host.querySelectorAll('.bd-group-title')].map(h => h.textContent)).toEqual(['Torso', 'Arms', 'Legs', 'Other', 'Your own'])
    const on = [...host.querySelectorAll('[role="switch"][aria-checked="true"]')].map(s => s.getAttribute('aria-label'))
    expect(on).toEqual(['Chest', 'Waist'])
    expect(host.querySelectorAll('[role="switch"]')).toHaveLength(19)
    expect(host.querySelector('[role="switch"][aria-label="Left wrist"]')).not.toBeNull()
    expect(host.querySelector('.g-bs-foot button').textContent).toBe('Done')
  })

  it('switches a measurement on and off', () => {
    const { host } = open()
    tap(host.querySelector('[role="switch"][aria-label="Hips"]'))
    expect(S().measurementEnabled).toContain('hips')
    tap(host.querySelector('[role="switch"][aria-label="Waist"]'))
    expect(S().measurementEnabled).not.toContain('waist')
    expect(host.querySelector('[role="switch"][aria-label="Hips"]').getAttribute('aria-checked')).toBe('true')
  })

  it('adds a custom measurement under Your own, on, and refuses a name that is taken', () => {
    const { host, button, field } = open()
    tap(button('Custom measurement'))
    act(() => type(field('Custom measurement'), 'Calf wrap'))
    tap(button('Add'))
    expect(S().customMeasurements).toMatchObject([{ name: 'Calf wrap', enabled: true }])
    expect(host.querySelector('[role="switch"][aria-label="Calf wrap"]').getAttribute('aria-checked')).toBe('true')
    tap(button('Custom measurement'))
    act(() => type(field('Custom measurement'), 'waist'))
    tap(button('Add'))
    expect(toastText()).toBe('A custom measurement with that name already exists.')
    expect(S().customMeasurements).toHaveLength(1)
  })

  it('switches a custom measurement off', () => {
    useStore.setState({ S: state({ customMeasurements: [{ id: 'c1', name: 'Calf wrap', enabled: true }] }) })
    const { host } = open()
    tap(host.querySelector('[role="switch"][aria-label="Calf wrap"]'))
    expect(S().customMeasurements[0].enabled).toBe(false)
  })

  it('Done closes it', () => {
    const { button } = open()
    tap(button('Done'))
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('opened from inside the log drawer it is a sub-panel, never a second drawer', () => {
    measurementLogSheet()
    const log = renderTop()
    tap(log.button('Choose measurements'))
    const sheets = useUI.getState().sheets
    expect(sheets).toHaveLength(1)
    expect(sheets[0].panels).toHaveLength(1)
    const panel = renderTop({ panel: true })
    expect(panel.title()).toBe('Choose measurements')
    tap(panel.button('Done'))
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().sheets[0].panels).toHaveLength(0)
  })

  it('with nothing tracked, Log measurements opens on Choose measurements first', () => {
    useStore.setState({ S: state({ measurementEnabled: [] }) })
    measurementLogSheet()
    const sheets = useUI.getState().sheets
    expect(sheets).toHaveLength(1)
    expect(sheets[0].panels).toHaveLength(1)
    expect(renderTop({ panel: true }).title()).toBe('Choose measurements')
    const log = renderTop()
    expect(log.host.querySelector('.g-sempty').textContent).toContain('Choose at least one measurement first.')
    expect(log.host.querySelector('.g-bs-foot button').disabled).toBe(true)
  })
})

describe('Edit measurements: Delete and Undo', () => {
  const DAY_ENTRY = { d: PAST, t: 1000, waist: 85, chest: 100 }
  const day = (d = PAST) => S().measurements.find(e => e.d === d) || null
  const values = e => e && { waist: e.waist, chest: e.chest }
  const openEdit = () => { measurementLogSheet(PAST); return renderTop() }
  const runUndo = () => act(() => { useUI.getState().runToastAction() })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    removeEntries()
    useStore.setState({ S: state({ measurements: [{ ...DAY_ENTRY }] }) })
  })
  afterEach(() => { vi.useRealTimers() })

  it('offers Delete measurements only when editing a day', () => {
    expect(openEdit().button('Delete measurements')).toBeDefined()
    useUI.setState({ sheets: [] })
    measurementLogSheet()
    expect(renderTop().button('Delete measurements')).toBeUndefined()
  })

  it('deletes the day at once, with its tombstone, journals it and offers Undo', () => {
    tap(openEdit().button('Delete measurements'))
    expect(day()).toBeNull()
    expect(S().deleted.measurements[PAST]).toBeGreaterThan(1000)
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(toastText()).toBe(`Deleted 2 measurements from ${fmtDate(PAST, true)}`)
    expect(useUI.getState().toastAction.label).toBe('Undo')
    expect(listChanges()).toMatchObject([{ kind: 'measure-delete', day: PAST, facts: { count: 2 }, state: 'open' }])
  })

  it('Undo at 7.9 s puts back the exact readings and marks the day added back', () => {
    tap(openEdit().button('Delete measurements'))
    vi.advanceTimersByTime(7900)
    expect(useUI.getState().toastAction).not.toBeNull()
    runUndo()
    expect(values(day())).toEqual({ waist: 85, chest: 100 })
    expect(S().measurements.filter(e => e.d === PAST)).toHaveLength(1)
    expect(S().deleted.measurements[PAST]).toBeLessThan(0)
  })

  it('after the 8 s window the Undo is gone and the day stays deleted', () => {
    tap(openEdit().button('Delete measurements'))
    vi.advanceTimersByTime(9000)
    expect(useUI.getState().toastAction).toBeNull()
    runUndo()
    expect(day()).toBeNull()
    expect(S().deleted.measurements[PAST]).toBeGreaterThan(0)
  })

  it('Undo never overwrites the day logged again meanwhile', () => {
    tap(openEdit().button('Delete measurements'))
    useStore.getState().update(s => { s.measurements.push({ d: PAST, t: Date.now() + 1, waist: 80, chest: null, other: [] }) })
    runUndo()
    expect(values(day())).toEqual({ waist: 80, chest: null })
  })

  it('an edit can be undone at 7.9 s: the old readings come back', () => {
    const { field, button } = openEdit()
    act(() => type(field('Waist'), '84'))
    tap(button('Save measurements'))
    expect(day().waist).toBe(84)
    expect(toastText()).toBe('Measurements saved')
    vi.advanceTimersByTime(7900)
    runUndo()
    expect(values(day())).toEqual({ waist: 85, chest: 100 })
    expect(S().measurements).toHaveLength(1)
  })

  it('an edit that moved the day is undone back onto its own day', () => {
    const MOVED = '2026-09-02'
    const log = openEdit()
    act(() => type(log.field('Waist'), '84'))
    tap(log.button('Change date'))
    const panel = renderTop({ panel: true })
    act(() => type(panel.host.querySelector('input[type="date"]'), MOVED))
    tap(panel.button('Done'))
    tap(log.button('Save measurements'))
    expect(day(PAST)).toBeNull()
    expect(day(MOVED).waist).toBe(84)
    runUndo()
    expect(values(day(PAST))).toEqual({ waist: 85, chest: 100 })
    expect(day(MOVED)).toBeNull()
    expect(S().deleted.measurements[PAST]).toBeLessThan(0)
    expect(S().deleted.measurements[MOVED]).toBeGreaterThan(0)
  })

  it('after the window an edit stays, and a new check-in offers no Undo', () => {
    const { field, button } = openEdit()
    act(() => type(field('Waist'), '84'))
    tap(button('Save measurements'))
    vi.advanceTimersByTime(9000)
    runUndo()
    expect(day().waist).toBe(84)
    measurementLogSheet()
    const log = renderTop()
    act(() => type(log.field('Waist'), '83'))
    tap(log.button('Save measurements'))
    expect(useUI.getState().toastAction).toBeNull()
  })
})
