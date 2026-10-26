// @vitest-environment happy-dom
// T5.1–T5.3 the exercise picker as a drawer: the opt-in multi-select (the routine editor's), the
// single pick every other caller keeps, the By muscle and Favourites tabs, and the no-exact-match edge.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { BODYPARTS, CATALOGUE, EXDB } from './lib/exercises.js'
import { chipByText, openFilters, unmountPanels } from './picker-test-utils.jsx'
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
afterEach(() => { unmountPanels(); act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })
const isOn = el => el.classList.contains('on')

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
    const chip = host.querySelector('.g-pk-chips .g-cchip')
    expect(chip.textContent).toBe('Chosen (1)')
    act(() => chip.click())
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    expect(items(host).map(nameOf)).toEqual([ex.n])
    expect(items(host)[0].querySelector('.g-tag').textContent).toBe('Chosen')
    act(() => chip.click())
    expect(items(host).length).toBeGreaterThan(1)
  })

  it('the Chosen toggle applies to All only: Create your own stays on Favourites with it on', () => {
    useStore.setState(s => ({ S: { ...s.S, favEx: [EXDB[5].id], routines: [{ id: 'r1', name: 'A', ex: [{ id: EXDB[3].id }] }] } }))
    exercisePicker(vi.fn())
    const host = renderTop()
    act(() => host.querySelector('.g-pk-chips .g-cchip').click())
    expect(host.querySelector('.g-pk-new')).toBeNull()
    act(() => tab(host, 'Favourites').click())
    expect(items(host).length).toBeGreaterThan(0)
    expect(host.querySelector('.g-pk-new')).toBeTruthy()
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
    // the map gives way to the list, and the way back is a row at its top
    expect(host.querySelector('.g-pk-map')).toBeNull()
    act(() => host.querySelector('.g-pk-back').click())
    expect(items(host)).toHaveLength(0)
    expect(host.querySelector('.g-pk-map')).toBeTruthy()
  })

  it('draws the map with no stray result count in the search field before a muscle is picked', async () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    await act(async () => { tab(host, 'By muscle').click() })
    await vi.waitFor(() => expect(host.querySelectorAll('.g-pk-map .bm-v')).toHaveLength(2))
    expect(host.querySelector('.g-pk-count')).toBeNull()
    expect(host.querySelector('.g-pk-badge')).toBeNull()
  })

  it('search narrows within the tapped muscle', async () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    await act(async () => { tab(host, 'By muscle').click() })
    await vi.waitFor(() => expect(host.querySelectorAll('.bm-v')).toHaveLength(2))
    act(() => tapMuscle(host, 'Chest'))
    const count = () => Number(host.querySelector('.g-pk-count').textContent)
    const all = Number(host.querySelector('.g-pk-head').textContent.match(/· (\d+)/)[1])
    act(() => type(host.querySelector('input[type="search"]'), 'dumbbell'))
    expect(items(host).length).toBeGreaterThan(0)
    expect(count()).toBeLessThan(all)
    expect(host.querySelector('.g-pk-head').textContent).toBe(`Chest · ${exCount(count())}`)
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
  it('Favourites lists the starred ones under Starred, then what was used lately under Recently used', () => {
    const [a, b, c] = [EXDB[2], EXDB[8], EXDB[12]]
    const workout = { id: 'w1', d: '2026-10-01', start: 1, end: 2, unit: 'kg', name: 'x', routineIds: [], prs: [], entries: [{ id: b.id, sets: [] }, { id: a.id, sets: [] }] }
    useStore.setState(s => ({ S: { ...s.S, favEx: [a.id, c.id], workouts: [workout] } }))
    exercisePicker(vi.fn())
    const host = renderTop()
    act(() => tab(host, 'Favourites').click())
    // a is starred and also used: it is listed once, under Starred
    const listed = items(host).map(nameOf)
    expect(listed).toHaveLength(3)
    expect(listed.slice(0, 2).sort()).toEqual([a.n, c.n].sort())
    expect(listed[2]).toBe(b.n)
    expect([...host.querySelectorAll('.g-pk-list > .g-pk-head')].map(h => h.textContent)).toEqual(['Starred', 'Recently used'])
    act(() => type(host.querySelector('input[type="search"]'), b.n))
    expect(items(host).map(nameOf)[0]).toBe(b.n)
    expect(host.querySelector('.g-pk-list > .g-pk-head')).toBeNull()
    act(() => tab(host, 'All').click())
    expect(host.querySelector('.g-pk-chips')).toBeTruthy()
  })

  it('an empty Favourites says so, with a way to the full list', () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    act(() => tab(host, 'Favourites').click())
    expect(host.querySelector('.g-sempty b').textContent).toBe('No favourites yet')
    expect(items(host)).toHaveLength(0)
    act(() => host.querySelector('.g-sempty-btn').click())
    expect(items(host).length).toBeGreaterThan(0)
    expect(host.querySelector('.g-sempty')).toBeNull()
  })
})

describe('exercise picker: Filters panel', () => {
  const badge = host => host.querySelector('.g-pk-badge')

  it('is a button by the search with no badge until a filter is set; it opens a sub-panel of the same drawer', () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    expect(host.querySelector('.g-cgroup')).toBeNull()
    expect(badge(host)).toBeNull()
    const panel = openFilters(host)
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().sheets[0].panels).toHaveLength(1)
    expect(panel.querySelector('h2').textContent).toBe('Filters')
    expect([...panel.querySelectorAll('.g-cgroup')].map(g => g.getAttribute('aria-label'))).toEqual(['Body part', 'Type', 'Equipment'])
  })

  it('applies a choice to the list, counts it on the button and in the Show N action, and Reset clears all', () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    const total = items(host).length
    const panel = openFilters(host)
    const reset = [...panel.querySelectorAll('.g-bs-foot .g-btn')][0]
    const show = [...panel.querySelectorAll('.g-bs-foot .g-btn')][1]
    expect(reset.disabled).toBe(true)
    act(() => chipByText(panel, 'neck').click())
    act(() => chipByText(panel, 'stretching').click())
    expect(badge(host).textContent).toBe('2')
    expect(host.querySelector('.g-pk-filter').getAttribute('aria-label')).toBe('Filters, 2 active')
    const n = CATALOGUE.filter(e => e.bp === 'neck' && e.cat === 'stretching').length
    expect(show.textContent).toBe(`Show ${exCount(n)}`)
    expect(items(host).length).toBe(Math.min(n, 50))
    expect(items(host).length).toBeLessThan(total)
    expect(reset.disabled).toBe(false)
    act(() => reset.click())
    expect(badge(host)).toBeNull()
    expect(items(host).length).toBe(total)
    expect(isOn(chipByText(panel, 'All'))).toBe(true)
  })

  it('Show N closes the panel and leaves the picker open with the filters applied', () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    const panel = openFilters(host)
    act(() => chipByText(panel, 'neck').click())
    act(() => [...panel.querySelectorAll('.g-bs-foot .g-btn')][1].click())
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().sheets[0].panels).toHaveLength(0)
    expect(badge(host).textContent).toBe('1')
  })

  it('the filters also narrow Favourites, and a filter that leaves nothing says No match', () => {
    useStore.setState(s => ({ S: { ...s.S, favEx: [EXDB[2].id] } }))
    exercisePicker(vi.fn())
    const host = renderTop()
    act(() => tab(host, 'Favourites').click())
    const panel = openFilters(host)
    const other = BODYPARTS.find(b => b !== EXDB[2].bp)
    act(() => chipByText(panel, other).click())
    expect(items(host)).toHaveLength(0)
    expect(host.querySelector('.g-pk-note').textContent).toBe('No match')
  })
})
