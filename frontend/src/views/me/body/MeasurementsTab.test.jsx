// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { measureOf } from './measure-data.js'
import MeasurementsTab, { measureSub } from './MeasurementsTab.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const S = (patch = {}) => ({
  unit: 'kg', customMeasurements: [], measurementEnabled: ['waist', 'chest'],
  measurements: [
    { d: '2026-08-01', t: 1, waist: 88, chest: 101 },
    { d: '2026-09-12', t: 2, waist: 85.5 },
    { d: '2026-10-17', t: 3, waist: 84, chest: 102.5 },
  ],
  ...patch,
})

let host, root, onLog, onChoose, onRange
const mount = (state = S(), props = {}) => act(() => root.render(
  <MeasurementsTab data={measureOf(state)} range={0} onRange={onRange} onLog={onLog} onChoose={onChoose} {...props} />))
const text = sel => host.querySelector(sel).textContent
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent === label)
const tap = el => act(() => { el.click() })

beforeEach(() => {
  onLog = vi.fn(); onChoose = vi.fn(); onRange = vi.fn()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('MeasurementsTab', () => {
  it('shows the waist first: the value, the change on the previous and since the first, and the curve', () => {
    mount()
    expect(text('.bd-eyebrow')).toMatch(/^Waist · /)
    expect(text('.bd-big')).toBe('84cm')
    expect(text('.bd-lines')).toContain('−1.5 cm since previous')
    expect(text('.bd-lines')).toMatch(/−4 cm since /)
    expect(host.querySelector('.g-tc')).not.toBeNull()
    expect(host.querySelector('.g-tc-target')).toBeNull()
  })

  it('picks another measurement from the chips', () => {
    mount()
    tap(button('Chest'))
    expect(text('.bd-big')).toBe('102.5cm')
    expect(text('.bd-lines')).toContain('+1.5 cm since previous')
    expect(host.querySelector('.bd-lines').textContent).not.toMatch(/since \d|since [A-Z]/)
  })

  it('a row of Latest with a reading opens its day for editing; one without picks its chip', () => {
    const onOpen = vi.fn()
    mount(S({ measurementEnabled: ['waist', 'chest', 'hips'] }), { onOpen })
    const row = name => [...host.querySelectorAll('.g-gvr')].find(r => r.textContent.startsWith(name))
    tap(row('Chest'))
    expect(onOpen).toHaveBeenCalledWith('2026-10-17')
    tap(row('Hips'))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(text('.bd-eyebrow')).toBe('Hips')
  })

  it('lists the latest of each tracked measurement with its date, change and value', () => {
    mount()
    const rows = [...host.querySelectorAll('.g-gvr')]
    expect(rows.map(r => r.querySelector('b').textContent)).toEqual(['Chest', 'Waist'])
    expect(rows[0].closest('.g-glist').classList.contains('g-glass')).toBe(true)
    expect(rows[1].textContent).toContain('−1.5 cm since previous')
    expect(rows[1].querySelector('.g-gvr-val').textContent).toBe('84 cm')
  })

  it('says No measurements yet on a tracked measurement with no reading, and draws no curve for it', () => {
    mount(S({ measurementEnabled: ['waist', 'hips'] }))
    tap(button('Hips'))
    expect(text('.bd-lines')).toBe('No measurements yet')
    expect(host.querySelector('.g-tc')).toBeNull()
    expect([...host.querySelectorAll('.g-gvr')].find(r => r.textContent.startsWith('Hips')).textContent).toContain('No measurements yet')
  })

  it('names a custom measurement by its own word', () => {
    mount(S({
      customMeasurements: [{ id: 'c1', name: 'Calf wrap', enabled: true }],
      measurements: [{ d: '2026-10-17', t: 1, waist: 84, other: [{ id: 'c1', name: 'Calf wrap', value: 38 }] }],
    }))
    expect([...host.querySelectorAll('.g-cchip')].map(c => c.textContent)).toContain('Calf wrap')
  })

  it('Choose and Log measurements call back; the range chips report a pick', () => {
    mount()
    tap(button('Choose'))
    expect(onChoose).toHaveBeenCalledTimes(1)
    tap(button('Log measurements'))
    expect(onLog).toHaveBeenCalledTimes(1)
    tap([...host.querySelectorAll('.g-sseg button')].find(b => b.textContent === '1M'))
    expect(onRange).toHaveBeenCalledWith(30)
  })

  it('is the chart scene with Log measurements when nothing is tracked or nothing logged', () => {
    mount(S({ measurementEnabled: [] }))
    expect(host.querySelector('.g-sempty').className).not.toContain('g-sempty-card')
    expect(text('.g-sempty')).toContain('Nothing to chart yet')
    tap(button('Log measurements'))
    expect(onLog).toHaveBeenCalledTimes(1)
    mount(S({ measurements: [] }))
    expect(text('.g-sempty')).toContain('No measurements yet')
    expect(host.querySelector('.g-cchip')).toBeNull()
  })
})

describe('measureSub', () => {
  it('reads what is tracked and the last day', () => {
    expect(measureSub(measureOf(S()))).toMatch(/^2 tracked · last on /)
    expect(measureSub(measureOf(S({ measurements: [] })))).toBe('2 tracked')
    expect(measureSub(measureOf(S({ measurementEnabled: [] })))).toBe('Nothing tracked yet')
  })
})
