// @vitest-environment happy-dom
// The × in the exercise search (the Exercises page and the exercise picker), beside the live result
// count (search-count.test.jsx). It shows while there is text, one tap empties the search, and it
// clears only the text: a body-part filter that also narrows the list keeps its count.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exercisePicker } from './sheets.jsx'
import ExercisesScreen from './views/train/exercises/ExercisesScreen.jsx'
import { EXDB } from './lib/exercises.js'
import { chipByText, openFilters, unmountPanels } from './picker-test-utils.jsx'

const panels = new WeakMap()

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mounted = []
function mount(node) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(node))
  return host
}
const renderTopSheet = () => {
  const sheet = useUI.getState().sheets.at(-1)
  return mount(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
}
function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

// The page is on the stage (StageSearchField, ChipGroup); the picker is the drawer's field (the Log
// food one), which has no has-clear class to check.
const SURFACES = [
  {
    where: 'Exercises page',
    open: () => mount(<MemoryRouter><ExercisesScreen /></MemoryRouter>),
    input: host => host.querySelector('.g-ssf input'),
    clear: host => host.querySelector('.g-ssf-clear'),
    count: host => host.querySelector('.g-ssf-count'),
    chip: (host, text) => [...host.querySelectorAll('.g-cchip')].find(b => b.textContent.trim() === text),
    neck: 'Neck',
    hasClear: () => true,
  },
  {
    where: 'exercise picker',
    open: () => { exercisePicker(vi.fn()); return renderTopSheet() },
    input: host => host.querySelector('.g-lf-search input'),
    clear: host => host.querySelector('.g-lf-search .g-lf-clear'),
    count: host => host.querySelector('.g-lf-search .g-pk-count'),
    // Body part lives in the Filters sub-panel: open it once per picker, then tap its chips.
    chip: (host, text) => {
      if (!panels.has(host)) panels.set(host, openFilters(host))
      return chipByText(panels.get(host), text)
    },
    neck: 'neck',
    hasClear: () => true,
  },
]

beforeEach(() => {
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: structuredClone(DEF), user: null })
  document.body.innerHTML = ''
})
afterEach(() => { unmountPanels(); act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('exercise search clear button', () => {
  for (const s of SURFACES) {
    it(`${s.where}: shows with text, and one tap empties the search`, () => {
      const host = s.open()
      const input = s.input(host)
      expect(s.clear(host)).toBeNull()
      act(() => type(input, 'bench press'))
      expect(s.clear(host).getAttribute('aria-label')).toBe('Clear')
      expect(s.hasClear(host)).toBe(true)
      act(() => s.clear(host).click())
      expect(input.value).toBe('')
      expect(s.clear(host)).toBeNull()
      expect(s.count(host)).toBeNull()
    })

    it(`${s.where}: clears only the text; a body-part filter keeps its count`, () => {
      const host = s.open()
      const neck = s.chip(host, s.neck)
      act(() => neck.click())
      act(() => type(s.input(host), 'stretch'))
      act(() => s.clear(host).click())
      expect(s.input(host).value).toBe('')
      expect(Number(s.count(host).textContent)).toBe(EXDB.filter(e => e.bp === 'neck').length)
    })
  }
})
