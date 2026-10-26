// @vitest-environment happy-dom
// Issue #521: the workout's "Add exercise" picker showed the Muscle and Equipment chip rows but not
// the Type row the Exercise browser has (strength, calisthenics, stretching...). Same row, same
// fallback: a type the muscle group narrows away is ignored for that view, not forgotten.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { EXDB } from './lib/exercises.js'
import { exerciseNameFor } from './lib/i18n.js'
import { exercisePicker } from './sheets.jsx'
import { chipByText, openFilters, unmountPanels } from './picker-test-utils.jsx'

const mounted = []

function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

const isOn = el => el.classList.contains('on')
// Every row's add button carries the exercise's name, so it tells which exercises are listed.
const listed = host => [...host.querySelectorAll('.g-pk-item .g-pk-add')]
  .map(b => b.getAttribute('aria-label'))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: structuredClone(DEF), user: null })
  document.body.innerHTML = ''
})

afterEach(() => {
  unmountPanels()
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('exercise picker type filter', () => {
  it('shows the Type group between the muscle groups and the equipment, like the Library, in the Filters panel', () => {
    exercisePicker(vi.fn())
    const main = renderTop()
    expect(main.querySelector('.g-cgroup')).toBeNull()
    const host = openFilters(main)
    const strips = [...host.querySelectorAll('.g-cgroup')]
    expect(strips).toHaveLength(3)
    expect(strips[1].querySelector('.g-cchip').textContent.trim()).toBe('Any type')
    expect(isOn(chipByText(host, 'Any type'))).toBe(true)
    expect(chipByText(host, 'stretching')).toBeTruthy()
    expect(strips[2].querySelector('.g-cchip').textContent.trim()).toBe('Any equipment')
  })

  it('narrows the list to the picked type', () => {
    exercisePicker(vi.fn())
    const main = renderTop()
    const panel = openFilters(main)
    act(() => chipByText(panel, 'stretching').click())
    expect(isOn(chipByText(panel, 'stretching'))).toBe(true)
    const names = listed(main)
    expect(names.length).toBeGreaterThan(0)
    const catOf = new Map(EXDB.map(e => [`Add “${exerciseNameFor(e)}”`, e.cat]))
    expect(names.filter(n => catOf.get(n) !== 'stretching')).toEqual([])
  })

  it('keeps the type across a muscle group that has none of it, and picks it back up', () => {
    exercisePicker(vi.fn())
    const main = renderTop()
    const host = openFilters(main)
    act(() => chipByText(host, 'yoga').click())
    // Lower arms have no yoga: the group drops the choice for this view instead of listing nothing.
    act(() => chipByText(host, 'lower arms').click())
    expect(chipByText(host, 'yoga')).toBeFalsy()
    expect(listed(main).length).toBeGreaterThan(0)
    act(() => chipByText(host, 'back').click())
    expect(isOn(chipByText(host, 'yoga'))).toBe(true)
  })
})
