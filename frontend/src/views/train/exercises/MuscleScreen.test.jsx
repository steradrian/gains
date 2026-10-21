// @vitest-environment happy-dom
// T6.2 By muscle: tap a muscle on the map to switch (the address holds it), what trains it with the
// exercises you have logged first, the same filters as Exercises, and the equipment filter that body
// parts keep (#71) and a new muscle resets.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import MuscleScreen from './MuscleScreen.jsx'
import { CATALOGUE, EXIDX } from '../../../lib/exercises.js'
import { exCount } from '../../../lib/format.js'
import { exercisesForMuscle } from '../../../lib/muscle-explore.js'
import { DEF, useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { exerciseDetailSheet } from '../../../sheets.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
vi.setConfig({ testTimeout: 15000 })
vi.mock('../../../sheets.jsx', async importOriginal => ({ ...(await importOriginal()), exerciseDetailSheet: vi.fn() }))

const BENCH = '0025'   // barbell bench press
const mounted = []
// The geometry of the map is a dynamic import on first render; load it here so the waits cover
// rendering, not a cold module load.
beforeAll(() => import('../../../lib/body-paths.js'))

function Where() {
  const loc = useLocation()
  return <p id="where">{loc.pathname + loc.search}</p>
}
async function mount(path) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <MuscleScreen />
        <Where />
      </MemoryRouter>,
    )
  })
  await vi.waitFor(() => expect(host.querySelector('[role="button"][aria-label="Chest"]')).not.toBeNull())
  return host
}
const muscle = async slug => mount('/train/exercises/muscles' + (slug ? '?muscle=' + slug : ''))
const cards = host => [...host.querySelectorAll('.g-xr')]
const nameOf = row => row.querySelector('.g-xrow-b b').textContent
const chip = (host, text) => [...host.querySelectorAll('.g-fchip')].find(b => b.textContent.startsWith(text))
const bodyPart = (host, text) => [...host.querySelectorAll('.g-cchip')].find(b => b.textContent === text)
const onMap = (host, name) => host.querySelector(`[role="button"][aria-label="${name}"]`)
// A muscle is an SVG path, which has no click() of its own: dispatch the click.
const tapMap = (host, name) => onMap(host, name).dispatchEvent(new MouseEvent('click', { bubbles: true }))
const where = host => host.querySelector('#where').textContent
function type(el, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value)
  act(() => { el.dispatchEvent(new Event('input', { bubbles: true })) })
}
function drawer() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const radio = (host, text) => [...host.querySelectorAll('[role="radio"]')].find(r => r.textContent === text)
const today = () => {
  const d = new Date()
  return { iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, at: d.getTime() }
}
const benchToday = n => {
  const { iso, at } = today()
  return { id: 'wb', d: iso, start: at - 3600000, end: at, name: 'Push', prs: [],
    entries: [{ id: BENCH, target: { mode: 'reps' }, sets: Array.from({ length: n }, () => ({ w: 80, r: 8, done: true })) }] }
}
const seed = over => useStore.setState(s => ({ S: { ...structuredClone(DEF), ...over, unit: 'kg' }, user: s.user }))

beforeEach(() => {
  seed({})
  useUI.setState({ sheets: [], toastMsg: '' })
  vi.mocked(exerciseDetailSheet).mockClear()
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('By muscle: the page and the map', () => {
  it('with no muscle chosen says so under the title, and shows only the map', async () => {
    const host = await muscle(null)
    expect(host.querySelector('.g-spage-title').textContent).toBe('Browse by muscle')
    expect(host.querySelector('.g-spage-sub').textContent).toBe('Tap a muscle to see exercises that train it')
    expect(host.querySelector('.g-xr')).toBeNull()
    expect(host.querySelector('.g-cgroup')).toBeNull()
    expect(host.querySelector('.g-fchip')).toBeNull()
  })

  it('names the chosen muscle, its exercises and the sets this week', async () => {
    seed({ workouts: [benchToday(3)] })
    const host = await muscle('chest')
    expect(host.querySelector('.g-spage-title').textContent).toBe('Chest')
    expect(host.querySelector('.g-spage-sub').textContent).toBe('Tap another muscle to switch')
    const total = exercisesForMuscle(CATALOGUE, 'chest').length
    expect(host.querySelector('.g-xs-mcap b').textContent).toBe('Chest')
    const caption = host.querySelector('.g-xs-mcap span').textContent
    expect(caption.startsWith(exCount(total) + ' · ')).toBe(true)
    expect(caption).toMatch(/ · [1-9]\d* sets this week$/)
    expect(onMap(host, 'Chest').getAttribute('aria-pressed')).toBe('true')
  })

  it('says "0 sets this week" when none was done, and "1 set" for one', async () => {
    expect((await muscle('chest')).querySelector('.g-xs-mcap span').textContent).toMatch(/· 0 sets this week$/)
    act(() => { mounted.splice(0).forEach(root => root.unmount()) })
    seed({ workouts: [benchToday(1)] })
    expect((await muscle('chest')).querySelector('.g-xs-mcap span').textContent).toMatch(/· 1 set this week$/)
  })

  it('tapping another muscle on the map switches to it in place; tapping the chosen one clears', async () => {
    const host = await muscle('chest')
    act(() => { tapMap(host, 'Biceps') })
    expect(where(host)).toBe('/train/exercises/muscles?muscle=biceps')
    expect(host.querySelector('.g-spage-title').textContent).toBe('Biceps')
    act(() => { tapMap(host, 'Biceps') })
    expect(where(host)).toBe('/train/exercises/muscles')
    expect(host.querySelector('.g-spage-title').textContent).toBe('Browse by muscle')
  })

  it('ignores a muscle the map does not know', async () => {
    const host = await muscle('elbow')
    expect(host.querySelector('.g-spage-title').textContent).toBe('Browse by muscle')
  })
})

describe('By muscle: the list', () => {
  it('puts your logged exercises first, with their best, then the library', async () => {
    seed({ workouts: [benchToday(2)] })
    const host = await muscle('chest')
    expect(host.querySelector('.g-ssec h2').textContent).toBe('Exercises for Chest')
    const rows = [...host.querySelectorAll('.g-xrow')]
    expect(nameOf(rows[0]).toLowerCase()).toBe(EXIDX[BENCH].n.toLowerCase())
    expect(rows[0].querySelector('.g-xrow-b > span').textContent).toMatch(/^Best 80 kg × 8/)
    expect(rows[1].querySelector('.g-xrow-b > span').textContent).not.toMatch(/^Best/)
  })

  it('a tap opens the exercise\'s drawer over the page', async () => {
    const host = await muscle('chest')
    act(() => host.querySelector('.g-xrow').click())
    expect(exerciseDetailSheet).toHaveBeenCalledTimes(1)
    expect(where(host)).toBe('/train/exercises/muscles?muscle=chest')
  })

  it('a search with no match says "No match"', async () => {
    const host = await muscle('biceps')
    type(host.querySelector('.g-ssf input'), 'qxzvwjkq')
    expect(host.querySelector('.g-sempty b').textContent).toBe('No match')
    expect(host.querySelector('.g-xrow')).toBeNull()
  })

  it('shows a count while narrowed and a × that empties only the text (#338)', async () => {
    const host = await muscle('biceps')
    const input = host.querySelector('.g-ssf input')
    const count = () => host.querySelector('.g-ssf-count')
    const clear = () => host.querySelector('.g-ssf-clear')
    expect(count()).toBeNull()
    expect(clear()).toBeNull()
    type(input, 'curl')
    expect(clear().getAttribute('aria-label')).toBe('Clear')
    expect(Number(count().textContent)).toBeGreaterThan(0)
    expect(host.querySelectorAll('.g-xrow')).toHaveLength(Math.min(40, Number(count().textContent)))
    act(() => clear().click())
    expect(input.value).toBe('')
    expect(clear()).toBeNull()
    expect(count()).toBeNull()
    act(() => bodyPart(host, 'Upper arms').click())
    expect(count()).toBeTruthy()
    expect(clear()).toBeNull()
  })
})

describe('By muscle: the equipment filter', () => {
  // Biceps has dumbbell exercises under both "lower arms" and "upper arms" in the catalogue, the
  // same shape as issue #71's original repro.
  it('keeps the dumbbell filter when switching from lower arms to upper arms (#71)', async () => {
    const host = await muscle('biceps')
    act(() => bodyPart(host, 'Lower arms').click())
    act(() => chip(host, 'Any equipment').click())
    const sheet = drawer()
    expect(radio(sheet, 'Dumbbell'), 'dumbbell should be offered under lower arms').toBeTruthy()
    act(() => radio(sheet, 'Dumbbell').click())
    expect(chip(host, 'Dumbbell').classList.contains('on')).toBe(true)
    act(() => bodyPart(host, 'Upper arms').click())
    expect(bodyPart(host, 'Upper arms').classList.contains('on')).toBe(true)
    expect(chip(host, 'Dumbbell').classList.contains('on')).toBe(true)
    expect(chip(host, 'Any equipment')).toBeUndefined()
  })

  it('"All" body parts still clears the equipment filter (#71)', async () => {
    const host = await muscle('biceps')
    act(() => bodyPart(host, 'Lower arms').click())
    act(() => chip(host, 'Any equipment').click())
    const sheet = drawer()
    act(() => radio(sheet, 'Dumbbell').click())
    expect(chip(host, 'Dumbbell').classList.contains('on')).toBe(true)
    act(() => bodyPart(host, 'All').click())
    expect(chip(host, 'Any equipment').classList.contains('on')).toBe(false)
  })

  it('a new muscle starts without the equipment filter', async () => {
    const host = await muscle('biceps')
    act(() => chip(host, 'Any equipment').click())
    const sheet = drawer()
    act(() => radio(sheet, 'Dumbbell').click())
    expect(chip(host, 'Dumbbell')).toBeTruthy()
    act(() => { tapMap(host, 'Triceps') })
    expect(chip(host, 'Any equipment')).toBeTruthy()
  })
})
