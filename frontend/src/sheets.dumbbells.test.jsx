// @vitest-environment happy-dom
// The dumbbells drawer (Gym setup → Dumbbells, issue #376) writes the list of bells for the
// profile's unit, stamped, the way lib/dumbbells.js reads it.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore, DEF } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { dumbbellInventorySheet } from './sheets.jsx'

const mounted = []
function mountTopSheet() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const S = () => useStore.getState().S
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(text))
const rows = host => [...host.querySelectorAll('.g-drow-body b')].map(b => b.textContent.trim())
const typeWeight = (host, value) => {
  const input = host.querySelector('.g-tfield input')
  act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('dumbbells drawer', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    useUI.setState({ sheets: [], toasts: [], toastMsg: '', toastAction: null })
    useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), unit: 'kg' }, user: null })
    document.body.innerHTML = ''
  })
  afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

  it('opens as a design-system drawer titled Dumbbells', () => {
    act(() => dumbbellInventorySheet())
    expect(useUI.getState().sheets.at(-1).variant).toBe('ds')
    const host = mountTopSheet()
    expect(host.querySelector('.g-bs-head h2').textContent).toBe('Dumbbells')
  })

  it('starts empty, fills the usual rack, and a row\'s remove takes a bell off', () => {
    act(() => dumbbellInventorySheet())
    const host = mountTopSheet()
    expect(host.textContent).toContain('No list yet')
    act(() => button(host, 'Fill in 2 to 50 kg, every 2').click())
    expect(S().dumbbells.kg.weights).toHaveLength(25)
    expect(S().dumbbells.kg._ts).toEqual(expect.any(Number))
    expect(rows(host)[0]).toBe('2 kg')
    act(() => host.querySelector('[aria-label="Remove 2 kg"]').click())
    expect(S().dumbbells.kg.weights[0]).toBe(4)
    expect(rows(host)[0]).toBe('4 kg')
    act(() => button(host, 'Clear the list').click())
    expect(S().dumbbells.kg.weights).toEqual([])
  })

  it('adds a typed weight in order, clears the field, and keeps the other unit alone', () => {
    useStore.setState(s => ({ S: { ...s.S, dumbbells: { kg: { weights: [3, 9], _ts: 1 }, lb: { weights: [10], _ts: 1 } } } }))
    act(() => dumbbellInventorySheet())
    const host = mountTopSheet()
    typeWeight(host, '6')
    act(() => button(host, 'Add').click())
    expect(S().dumbbells.kg.weights).toEqual([3, 6, 9])
    expect(S().dumbbells.lb).toEqual({ weights: [10], _ts: 1 })
    expect(host.querySelector('.g-tfield input').value).toBe('')
  })

  it('reads a comma as the decimal point, and refuses a weight that is not one', () => {
    act(() => dumbbellInventorySheet())
    const host = mountTopSheet()
    typeWeight(host, '12,5')
    act(() => button(host, 'Add').click())
    expect(S().dumbbells.kg.weights).toEqual([12.5])
    typeWeight(host, '0')
    act(() => button(host, 'Add').click())
    expect(S().dumbbells.kg.weights).toEqual([12.5])
    expect(useUI.getState().toastMsg).toBe('Enter a valid weight')
  })

  it('offers the lb rack to a lb profile', () => {
    useStore.setState(s => ({ S: { ...s.S, unit: 'lb' } }))
    act(() => dumbbellInventorySheet())
    const host = mountTopSheet()
    act(() => button(host, 'Fill in 5 to 100 lb, every 5').click())
    expect(S().dumbbells.lb.weights.slice(0, 3)).toEqual([5, 10, 15])
  })
})
