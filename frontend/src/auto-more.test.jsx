// @vitest-environment happy-dom
// The long exercise lists — the Exercises page and the add-exercise picker —
// load their next page by themselves once the "Show more" button at their foot comes near the
// screen (lib/use-auto-more.js). The button stays, and without IntersectionObserver it is the way on.
// happy-dom has no IntersectionObserver, so a fake one stands in and is fired by hand.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exercisePicker } from './sheets.jsx'
import ExercisesScreen from './views/train/exercises/ExercisesScreen.jsx'
import { BODYPARTS, EXDB } from './lib/exercises.js'

const observers = []
class FakeIntersectionObserver {
  constructor(cb) { this.cb = cb; this.els = new Set(); observers.push(this) }
  observe(el) { this.els.add(el) }
  unobserve(el) { this.els.delete(el) }
  disconnect() { this.els.clear() }
}
// The button scrolls into the observed band: every live observer reports what it watches.
const comeIntoView = () => act(() => observers.forEach(o => o.els.size && o.cb([...o.els].map(target => ({ target, isIntersecting: true })))))

const mounted = []
function render(node) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(node))
  return host
}
function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  return render(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
}
const pickerRows = host => host.querySelectorAll('.g-pk-item').length
const page = () => render(<MemoryRouter><ExercisesScreen /></MemoryRouter>)
const pageRows = host => host.querySelectorAll('.g-xr .g-xrow').length
const showMore = host => [...host.querySelectorAll('button')].find(b => b.textContent === 'Show more')

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  observers.length = 0
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: structuredClone(DEF), user: null })
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  vi.unstubAllGlobals()
})

describe('lists load their next page as you scroll', () => {
  it('Exercises page: the button coming into view loads the next 40', () => {
    const host = page()
    expect(pageRows(host)).toBe(40)
    comeIntoView()
    expect(pageRows(host)).toBe(80)
    comeIntoView()
    expect(pageRows(host)).toBe(120)
  })

  it('picker: the next 50, the same way', () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    expect(pickerRows(host)).toBe(50)
    comeIntoView()
    expect(pickerRows(host)).toBe(100)
  })

  it('stops watching once everything is shown', () => {
    // a body part with a few pages, not the whole catalogue
    const count = bp => EXDB.filter(e => e.bp === bp).length
    const bp = BODYPARTS.filter(b => count(b) > 40).sort((a, b) => count(a) - count(b))[0]
    const host = page()
    act(() => [...host.querySelectorAll('.g-cchip')].find(c => c.textContent === bp.charAt(0).toUpperCase() + bp.slice(1)).click())
    for (let i = 0; i < 10 && showMore(host); i++) comeIntoView()
    expect(pageRows(host)).toBe(count(bp))
    expect(showMore(host)).toBeUndefined()
    expect(observers.every(o => o.els.size === 0)).toBe(true)
  })

  it('without IntersectionObserver the button still loads more, and nothing breaks', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const host = page()
    expect(pageRows(host)).toBe(40)
    act(() => showMore(host).click())
    expect(pageRows(host)).toBe(80)
  })
})
