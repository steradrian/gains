// @vitest-environment happy-dom
// T5.1–T5.3 the exercise picker as a drawer: the opt-in multi-select (the routine editor's), the
// single pick every other caller keeps, the By muscle and Favourites tabs, and the no-exact-match edge.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { CATALOGUE, EXDB } from './lib/exercises.js'
import { exCount } from './lib/format.js'
import { musclesOf } from './lib/muscles.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exercisePicker } from './sheets.jsx'

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
function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const items = host => [...host.querySelectorAll('.g-pk-item')]
const nameOf = item => item.querySelector('.g-xrow-b b').textContent
const rowButton = item => item.querySelector('button.g-xrow')
const tab = (host, label) => [...host.querySelectorAll('.g-seg button')].find(b => b.textContent === label)
// A muscle on the map is an SVG path, which has no .click(): the tap is a dispatched click.
const tapMuscle = (host, name) => host.querySelector(`.bm-m[aria-label="${name}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }))
const footer = host => host.querySelector('.g-bs-foot .g-btn')

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: structuredClone(DEF), user: null })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('exercise picker: multi-select', () => {
  const open = (onAdd = vi.fn()) => {
    exercisePicker(vi.fn(), { routine: 'Push A', multi: { label: n => `Add ${n} to Push A`, onAdd } })
    return { host: renderTop(), onAdd }
  }

  it('a tap ticks the row instead of picking it, and the rows have no quick-add', () => {
    const pick = vi.fn()
    exercisePicker(pick, { multi: { label: n => `Add ${n}`, onAdd: vi.fn() } })
    const host = renderTop()
    expect(host.querySelector('.g-pk-add')).toBeNull()
    const first = items(host)[0]
    expect(rowButton(first).getAttribute('aria-pressed')).toBe('false')
    act(() => rowButton(first).click())
    expect(rowButton(items(host)[0]).getAttribute('aria-pressed')).toBe('true')
    expect(items(host)[0].querySelector('.g-pk-tick.on')).toBeTruthy()
    expect(pick).not.toHaveBeenCalled()
    act(() => rowButton(items(host)[0]).click())
    expect(rowButton(items(host)[0]).getAttribute('aria-pressed')).toBe('false')
  })

  it('names the routine in the header, and shows no footer until something is ticked', () => {
    const { host } = open()
    expect(host.querySelector('.g-bs-chip').textContent).toBe('Push A')
    expect(footer(host)).toBeNull()
  })

  it('the footer reads the caller\'s label with the count, and follows ticks and unticks', () => {
    const { host } = open()
    act(() => rowButton(items(host)[0]).click())
    expect(footer(host).textContent).toBe('Add 1 to Push A')
    act(() => rowButton(items(host)[1]).click())
    expect(footer(host).textContent).toBe('Add 2 to Push A')
    act(() => rowButton(items(host)[0]).click())
    expect(footer(host).textContent).toBe('Add 1 to Push A')
    act(() => rowButton(items(host)[1]).click())
    expect(footer(host)).toBeNull()
  })

  it('pressing it hands every tick to onAdd in the order they were ticked, and closes', () => {
    const { host, onAdd } = open()
    const names = items(host).map(nameOf)
    act(() => rowButton(items(host)[2]).click())
    act(() => rowButton(items(host)[0]).click())
    act(() => rowButton(items(host)[4]).click())
    act(() => footer(host).click())
    expect(onAdd).toHaveBeenCalledOnce()
    expect(onAdd.mock.calls[0][0].map(e => e.n)).toEqual([names[2], names[0], names[4]])
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('ticks stay while the list is searched and filtered', () => {
    const { host, onAdd } = open()
    const first = nameOf(items(host)[0])
    act(() => rowButton(items(host)[0]).click())
    act(() => type(host.querySelector('input[type="search"]'), 'squat'))
    act(() => rowButton(items(host)[0]).click())
    expect(footer(host).textContent).toBe('Add 2 to Push A')
    act(() => footer(host).click())
    const added = onAdd.mock.calls[0][0]
    expect(added).toHaveLength(2)
    expect(added[0].n).toBe(first)
    expect(added[1].n).toMatch(/squat/)
  })
})

describe('exercise picker: single pick, as every other caller has it', () => {
  it('a tap picks the exercise and the plus quick-adds it, with no footer', () => {
    const pick = vi.fn()
    exercisePicker(pick)
    const host = renderTop()
    expect(footer(host)).toBeNull()
    const first = items(host)[0]
    act(() => rowButton(first).click())
    expect(pick).toHaveBeenCalledOnce()
    expect(pick.mock.calls[0]).toHaveLength(1)
    expect(pick.mock.calls[0][0].n).toBe(nameOf(first))
    act(() => items(host)[1].querySelector('.g-pk-add').click())
    expect(pick.mock.calls[1]).toEqual([expect.objectContaining({ n: nameOf(items(host)[1]) }), true])
    expect(rowButton(first).hasAttribute('aria-pressed')).toBe(false)
  })

  it('marks what is already in a routine or a workout as Chosen, and the ★ chip lists only those', () => {
    const ex = EXDB[3]
    useStore.setState(s => ({ S: { ...s.S, routines: [{ id: 'r1', name: 'A', ex: [{ id: ex.id }] }] } }))
    exercisePicker(vi.fn())
    const host = renderTop()
    const chip = [...host.querySelectorAll('.g-cgroup .g-cchip')].find(c => c.textContent.startsWith('Chosen'))
    expect(chip.textContent).toBe('Chosen (1)')
    act(() => chip.click())
    expect(items(host).map(nameOf)).toEqual([ex.n])
    expect(items(host)[0].querySelector('.g-tag').textContent).toBe('Chosen')
  })
})

describe('exercise picker: By muscle', () => {
  it('asks for a muscle first, then lists what trains the one tapped on the map, with the count', async () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    await act(async () => { tab(host, 'By muscle').click() })
    expect(host.textContent).toContain('Choose a muscle to see exercises that train it.')
    expect(items(host)).toHaveLength(0)
    expect(host.querySelector('.g-cgroup')).toBeNull()
    await vi.waitFor(() => expect(host.querySelectorAll('.bm-v')).toHaveLength(2))
    act(() => tapMuscle(host, 'Chest'))
    // The picker lists the catalogue (allExercises), whose curated helper muscles add to EXDB's.
    const n = CATALOGUE.filter(e => musclesOf(e).chest).length
    expect(n).toBeGreaterThan(1)
    expect(host.querySelector('.g-pk-head').textContent).toBe(`Chest · ${exCount(n)}`)
    expect(items(host).length).toBeGreaterThan(0)
    // the same tap again clears it
    act(() => tapMuscle(host, 'Chest'))
    expect(items(host)).toHaveLength(0)
  })

  it('a row there is picked like any other', async () => {
    const pick = vi.fn()
    exercisePicker(pick)
    const host = renderTop()
    await act(async () => { tab(host, 'By muscle').click() })
    await vi.waitFor(() => expect(host.querySelectorAll('.bm-v')).toHaveLength(2))
    act(() => tapMuscle(host, 'Chest'))
    act(() => rowButton(items(host)[0]).click())
    expect(pick).toHaveBeenCalledOnce()
    expect(musclesOf(pick.mock.calls[0][0]).chest).toBeTruthy()
  })
})

describe('exercise picker: no exact match', () => {
  it('says so, lists what comes close, and puts Create your own last', () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    act(() => type(host.querySelector('input[type="search"]'), 'dumbbell curl qwxz'))
    expect(host.querySelector('.g-pk-head').textContent).toBe('No exact match. These come close:')
    const list = host.querySelector('.g-pk-list')
    expect(list.firstElementChild.classList.contains('g-pk-head')).toBe(true)
    expect(items(host).length).toBeGreaterThan(0)
    expect(list.lastElementChild.classList.contains('g-pk-new')).toBe(true)
    expect(list.querySelectorAll('.g-pk-new')).toHaveLength(1)
    expect(list.lastElementChild.textContent).toContain('Create your own exercise')
    expect(list.lastElementChild.textContent).toContain('Name it and pick a body part')
  })

  it('with an exact match, Create your own stays at the top', () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    act(() => type(host.querySelector('input[type="search"]'), 'bench press'))
    expect(host.querySelector('.g-pk-list').firstElementChild.classList.contains('g-pk-new')).toBe(true)
  })
})

describe('exercise picker: tabs', () => {
  it('keeps the filters on All only, and Favourites lists the starred ones', () => {
    useStore.setState(s => ({ S: { ...s.S, favEx: [EXDB[2].id] } }))
    exercisePicker(vi.fn())
    const host = renderTop()
    expect(host.querySelector('.g-cgroup')).toBeTruthy()
    act(() => tab(host, 'Favourites').click())
    expect(host.querySelector('.g-cgroup')).toBeNull()
    expect(items(host).map(nameOf)).toEqual([EXDB[2].n])
    act(() => tab(host, 'All').click())
    expect(host.querySelector('.g-cgroup')).toBeTruthy()
  })
})
