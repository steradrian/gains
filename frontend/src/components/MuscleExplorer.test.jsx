// @vitest-environment happy-dom
// Issue #71 (the same rule the Exercises page and the exercise picker keep): choosing a body part
// after picking an equipment type must not reset the equipment filter back to "any equipment"
// when the new body part still has exercises under it. MuscleExplorer used to clear it on every
// body-part tap regardless — the only one of the three exercise browsers that did.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// The first render indexes all 5,600+ catalogue exercises for search and the muscle map, which
// takes over a second here on its own and longer on a busy runner.
vi.setConfig({ testTimeout: 15000 })
import { createRoot } from 'react-dom/client'
import MuscleExplorer from './MuscleExplorer.jsx'
import { EmptySurface } from './blocks.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({ S: state.S, user: null, update: mut => { const next = structuredClone(state.S); mut(next); state.S = next } })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore }
})

const mounted = []
// `surface` stands in for the container the explorer sits in: the exercise picker's sheet provides
// 'sheet' (Modals.jsx).
function render(props = {}, surface = 'sheet') {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  const explorer = <MuscleExplorer onPick={vi.fn()} {...props} />
  act(() => root.render(surface ? <EmptySurface value={surface}>{explorer}</EmptySurface> : explorer))
  return host
}
const chipByText = (host, text) =>
  [...host.querySelectorAll('.chips .chip')].find(b => b.textContent.trim() === text)
const muscleChip = (host, label) =>
  [...host.querySelectorAll('.chips .chip')].find(b => b.textContent.startsWith(label))
const isOn = el => el.className.split(/\s+/).includes('on')

beforeEach(() => {
  mocks.S = {
    unit: 'kg', lang: 'en', body: 'male', routines: [], workouts: [], customEx: [], exWeights: {},
    equipProfiles: [], activeEquipId: null, equipFilterOn: false, favEx: [],
  }
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('MuscleExplorer body-part chips keep the equipment filter', () => {
  // Biceps has dumbbell exercises under both "lower arms" and "upper arms" in the catalog, the
  // same shape as issue #71's original repro (lower arms/upper arms + dumbbell).
  it('keeps the dumbbell filter when switching from lower arms to upper arms', () => {
    const host = render()
    act(() => { muscleChip(host, 'Biceps').click() })

    act(() => { chipByText(host, 'lower arms').click() })
    const dumbbell = chipByText(host, 'dumbbell')
    expect(dumbbell, 'dumbbell chip should be offered under lower arms').toBeTruthy()
    act(() => { dumbbell.click() })
    expect(isOn(chipByText(host, 'dumbbell'))).toBe(true)

    act(() => { chipByText(host, 'upper arms').click() })
    expect(isOn(chipByText(host, 'upper arms'))).toBe(true)
    const dumbbellAfter = chipByText(host, 'dumbbell')
    expect(dumbbellAfter, 'dumbbell chip should still be present under upper arms').toBeTruthy()
    expect(isOn(dumbbellAfter)).toBe(true)
    expect(isOn(chipByText(host, 'Any equipment'))).toBe(false)
  })

  // "All" body parts is the one chip that does clear the equipment filter — it spans every
  // body part, so there is no "still valid here" question to answer.
  it('"All" body parts still clears the equipment filter', () => {
    const host = render()
    act(() => { muscleChip(host, 'Biceps').click() })
    act(() => { chipByText(host, 'lower arms').click() })
    act(() => { chipByText(host, 'dumbbell').click() })
    expect(isOn(chipByText(host, 'dumbbell'))).toBe(true)

    act(() => { chipByText(host, 'All').click() })
    expect(isOn(chipByText(host, 'Any equipment'))).toBe(true)
  })
})

describe('MuscleExplorer empty states', () => {
  function search(host, value) {
    const input = host.querySelector('.search input')
    act(() => {
      Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('in the exercise picker, a search with no match is the sheet variant under the sheet\'s headings', () => {
    const host = render()
    act(() => { muscleChip(host, 'Biceps').click() })
    expect(host.querySelector('.empty')).toBeNull()
    search(host, 'qxzvwjkq')
    const empty = host.querySelector('.empty[data-surface=sheet]')
    expect(empty.querySelector('.lineart[data-scene=search]')).not.toBeNull()
    expect(empty.querySelector('h4').textContent).toBe('No match')
  })

  it('before a muscle is chosen the picker shows a hint, not an empty state', () => {
    const picker = render()
    expect(picker.querySelector('.inote').textContent).toBe('Choose a muscle to see exercises that train it.')
    expect(picker.querySelector('.empty')).toBeNull()
  })

  it('a tapped result is handed to onPick', () => {
    const onPick = vi.fn()
    const host = render({ onPick })
    act(() => { muscleChip(host, 'Biceps').click() })
    act(() => { host.querySelector('.list .item').click() })
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick.mock.calls[0][0].id).toBeTruthy()
  })
})

describe('MuscleExplorer search: the × and live count of the Exercises page (#338)', () => {
  function type(el, value) {
    Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  it('shows a count while narrowed and a × that empties only the text', () => {
    const host = render()
    act(() => { muscleChip(host, 'Biceps').click() })
    const input = host.querySelector('.search input')
    const count = () => host.querySelector('.search .search-count')
    const clear = () => host.querySelector('.search .clear')
    const rows = () => host.querySelectorAll('.list .item').length
    expect(count()).toBeNull()
    expect(clear()).toBeNull()
    act(() => type(input, 'curl'))
    expect(clear().getAttribute('aria-label')).toBe('Clear')
    expect(Number(count().textContent)).toBeGreaterThan(0)
    expect(rows()).toBe(Math.min(40, Number(count().textContent)))
    act(() => clear().click())
    expect(input.value).toBe('')
    expect(clear()).toBeNull()
    expect(count()).toBeNull()
    act(() => { chipByText(host, 'upper arms').click() })
    expect(count()).toBeTruthy()
    expect(clear()).toBeNull()
  })
})
