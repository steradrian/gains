// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fmtDate, todayISO } from '../../../lib/format.js'
import { listChanges } from '../../../lib/recent-changes.js'
import { removeEntries } from '../../../lib/recent-changes-store.js'
import '../../../lib/recent-changes-kinds.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { editWeighInSheet, logWeightSheet } from './weigh-in-drawers.jsx'

vi.mock('../../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../../../lib/nutrition/sync.js', () => ({ syncNow: vi.fn(() => Promise.resolve()) }))

const mounted = []
const S = () => useStore.getState().S
const DAY_MS = 864e5
const daysAgo = n => new Date(Date.now() - n * DAY_MS)
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const PAST = isoOf(daysAgo(7))

function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  const button = label => [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent.trim()) === label)
  return { host, button, input: host.querySelector('input') }
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  removeEntries()
  document.body.innerHTML = ''
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', targetW: null, bodyweight: [{ d: PAST, w: 81.7, t: daysAgo(7).setHours(7, 40, 0, 0) }] } }))
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('Edit weigh-in', () => {
  const open = () => { editWeighInSheet(S().bodyweight[0]); return renderTop() }

  it('is a design system drawer named for the day, a field with the unit, and the two actions', () => {
    const { host, input } = open()
    expect(useUI.getState().sheets[0].variant).toBe('ds')
    expect(host.querySelector('.g-bs h2').textContent).toBe('Edit weigh-in')
    expect(host.querySelector('.g-bs-chip').textContent).toBe(fmtDate(PAST, true))
    expect(input.value).toBe('81.7')
    expect(host.querySelector('.g-tfield-unit').textContent).toBe('kg')
    expect([...host.querySelectorAll('.g-bs-foot button')].map(b => b.textContent)).toEqual(['Save weigh-in', 'Delete weigh-in'])
    expect(host.querySelector('.g-bs-foot .g-btn-danger').textContent).toBe('Delete weigh-in')
  })

  it('says when it was logged only if the entry has a time on its own day', () => {
    expect(open().host.querySelector('.bd-logged').textContent).toMatch(`Logged ${fmtDate(PAST, true)} at `)
    act(() => { mounted.splice(0).forEach(root => root.unmount()) })
    document.body.innerHTML = ''
    useUI.setState({ sheets: [] })
    editWeighInSheet({ d: PAST, w: 81.7 })
    expect(renderTop().host.querySelector('.bd-logged')).toBeNull()
  })

  it('saves a changed value for that day, with a toast and Undo, and journals it', () => {
    const { input, button, host } = open()
    act(() => type(input, '81.2'))
    act(() => button('Save weigh-in').click())
    expect(S().bodyweight).toEqual([expect.objectContaining({ d: PAST, w: 81.2 })])
    expect(useUI.getState().toastMsg).toBe(`Saved 81.2 kg to ${fmtDate(PAST, true)}`)
    expect(useUI.getState().toastAction.label).toBe('Undo')
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(listChanges()[0]).toMatchObject({ kind: 'weighin-edit', day: PAST, facts: { from: 81.7, to: 81.2, unit: 'kg' } })
    expect(host).toBeTruthy()
    act(() => useUI.getState().runToastAction())
    expect(S().bodyweight[0].w).toBe(81.7)
  })

  it('accepts a comma as the decimal mark', () => {
    const { input, button } = open()
    act(() => type(input, '81,3'))
    act(() => button('Save weigh-in').click())
    expect(S().bodyweight[0].w).toBe(81.3)
  })

  it('closes without a write, a toast or a journal entry when the value is unchanged', () => {
    const { button } = open()
    act(() => button('Save weigh-in').click())
    expect(S().bodyweight[0].t).toBeLessThan(Date.now() - 6 * DAY_MS)
    expect(useUI.getState().toastMsg).toBe('')
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(listChanges()).toEqual([])
  })

  it('refuses a blank or impossible weight and stays open', () => {
    const { input, button } = open()
    act(() => type(input, ''))
    act(() => button('Save weigh-in').click())
    expect(useUI.getState().toastMsg).toBe('Enter a valid weight')
    expect(useUI.getState().sheets).toHaveLength(1)
    act(() => type(input, '9999'))
    act(() => button('Save weigh-in').click())
    expect(useUI.getState().toastMsg).toContain('too heavy')
    expect(S().bodyweight[0].w).toBe(81.7)
    expect(listChanges()).toEqual([])
  })

  it('deletes with no second question: a toast with Undo, the tombstone, and a journal entry', () => {
    const { button } = open()
    act(() => button('Delete weigh-in').click())
    expect(S().bodyweight).toEqual([])
    expect(S().deleted.bodyweight[PAST]).toBeGreaterThan(0)
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(useUI.getState().toastMsg).toBe(`Deleted 81.7 kg from ${fmtDate(PAST, true)}`)
    expect(useUI.getState().toastAction.label).toBe('Undo')
    expect(listChanges()[0]).toMatchObject({ kind: 'weighin-delete', day: PAST, facts: { weight: 81.7, unit: 'kg' } })
    act(() => useUI.getState().runToastAction())
    expect(S().bodyweight).toEqual([expect.objectContaining({ d: PAST, w: 81.7 })])
  })

  it('Undo of a delete refuses, and keeps the newer reading, when the day got one meanwhile', () => {
    const { button } = open()
    act(() => button('Delete weigh-in').click())
    useStore.getState().update(s => { s.bodyweight.push({ d: PAST, w: 80.5, t: Date.now() }) })
    act(() => useUI.getState().runToastAction())
    expect(S().bodyweight).toEqual([expect.objectContaining({ d: PAST, w: 80.5 })])
    expect(useUI.getState().toastMsg).toBe('Not undone, this day has a newer weigh-in')
  })

  it('Undo of an edit refuses, and keeps the newer reading, when the day changed again', () => {
    const { input, button } = open()
    act(() => type(input, '81.2'))
    act(() => button('Save weigh-in').click())
    useStore.getState().update(s => { s.bodyweight[0].w = 79.9 })
    act(() => useUI.getState().runToastAction())
    expect(S().bodyweight[0].w).toBe(79.9)
    expect(useUI.getState().toastMsg).toBe('Not undone, this day has a newer weigh-in')
  })

  it('Undo of an edit refuses when the day lost its weigh-in', () => {
    const { input, button } = open()
    act(() => type(input, '81.2'))
    act(() => button('Save weigh-in').click())
    useStore.getState().update(s => { s.bodyweight = [] })
    act(() => useUI.getState().runToastAction())
    expect(S().bodyweight).toEqual([])
    expect(useUI.getState().toastMsg).toBe('Not undone, this day has a newer weigh-in')
  })
})

describe('Log weight', () => {
  it('is Today\'s weigh-in drawer, titled Log weight', () => {
    logWeightSheet()
    const { host } = renderTop()
    expect(host.querySelector('.g-bs h2').textContent).toBe('Log weight')
    expect(host.querySelector('.g-bs-chip').textContent).toBe('Today')
    expect(host.querySelector('.g-wi-again')).toBeNull()
  })

  it('says a weigh-in already made today is replaced when saved, with Undo to follow', () => {
    useStore.setState(s => ({ S: { ...s.S, bodyweight: [{ d: todayISO(), w: 81.4, t: 1 }] } }))
    logWeightSheet()
    const { host, button } = renderTop()
    expect(host.querySelector('.g-wi-again').textContent).toBe('You weighed in today at 81.4 kg. Saving replaces it; Undo follows.')
    act(() => type(host.querySelector('.g-wi-read input'), '81.0'))
    act(() => button('Save weigh-in').click())
    expect(S().bodyweight).toHaveLength(1)
    expect(S().bodyweight[0].w).toBe(81)
    act(() => useUI.getState().runToastAction())
    expect(S().bodyweight[0].w).toBe(81.4)
  })
})
