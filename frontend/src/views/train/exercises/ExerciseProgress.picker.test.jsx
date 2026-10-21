// @vitest-environment happy-dom
// Progress, /progress/strength: the exercise picker sheet (with search), the chosen exercise on the
// page and in the address, and duplicate / legacy records folding into one point.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXIDX } from '../../../lib/exercises.js'
import ExerciseProgress from './ExerciseProgress.jsx'
import Modals from '../../../components/Modals.jsx'
import { bindUI } from '../../../components/ui.jsx'
import { useUI } from '../../../store/useUI.js'

const BASE_NOW = Date.UTC(2026, 0, 22, 12)
const LEGACY_SNAPSHOT_ID = 'legacy-snapshot-only'

// The page reads the address on every render, so nav() to /progress/strength replaces the query
// and re-renders it, as the router would.
const mocks = vi.hoisted(() => {
  const m = {
    charts: [], search: '', listeners: new Set(),
    S: { unit: 'kg', body: 'male', effort: 'rir', targetW: null, bodyweight: [], routines: [], exWeights: {}, workouts: [] },
  }
  m.nav = vi.fn(to => {
    const [path, query] = String(to).split('?')
    if (path !== '/progress/strength') return
    m.search = query ? '?' + query : ''
    m.listeners.forEach(f => f())
  })
  return m
})

vi.mock('../../../store/useStore.js', () => ({ useStore: selector => selector({ S: mocks.S }) }))
vi.mock('react-router-dom', async () => {
  const { useSyncExternalStore } = await import('react')
  const subscribe = f => { mocks.listeners.add(f); return () => mocks.listeners.delete(f) }
  return {
    useNavigate: () => mocks.nav,
    useLocation: () => ({ search: useSyncExternalStore(subscribe, () => mocks.search), pathname: '/progress/strength' }),
  }
})
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn(), isSwitching: () => false, switchTab: vi.fn(), popToRoot: vi.fn() }))
vi.mock('../../../sheets.jsx', () => ({ exerciseDetailSheet: vi.fn(), workoutDetailSheet: vi.fn() }))
vi.mock('../../../ds/LineChart.jsx', () => ({ default: props => {
  mocks.charts.push(props)
  return React.createElement('div')
} }))
vi.mock('../../../components/Icon.jsx', () => ({ default: props => React.createElement('span', props) }))

bindUI(useUI)

let dom
let root
let container

const iso = timestamp => new Date(timestamp).toISOString().slice(0, 10)
const set = (done, extra = {}) => ({ done, w: 80, r: 8, unit: 'kg', ...extra })
const workout = (id, start, entries) => ({ id, d: iso(start), start, unit: 'kg', entries })
const entry = (id, sets) => ({ id, sets })

function exercisePickerWorkouts(now = BASE_NOW) {
  const DAY = 86400000
  return [
    workout('bench', now, [entry('0025', [set(true, { w: 80 })])]),
    workout('squat', now - DAY, [entry('0043', [set(true, { w: 60 })])]),
    workout('legacy', now - 2 * DAY, [
      {
        id: LEGACY_SNAPSHOT_ID,
        muscleSnapshot: {
          n: 'Legacy shoulder press',
          bp: 'shoulders',
          primaries: ['deltoids'],
          secondaries: ['triceps'],
          muscleGroups: ['deltoids', 'triceps'],
        },
        sets: [set(true, { w: 50 })],
      },
    ]),
  ]
}

function resetFixture(workouts) {
  mocks.S.unit = 'kg'
  mocks.S.workouts = workouts
  mocks.charts.length = 0
  mocks.nav.mockClear()
  mocks.search = ''
  useUI.setState({ sheets: [] })
}

function installDom() {
  dom = new Window({ url: 'http://localhost/' })
  dom.scrollTo = vi.fn()
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  Object.defineProperty(globalThis, 'location', { configurable: true, value: dom.location })
  Object.defineProperty(globalThis, 'history', { configurable: true, value: dom.history })
  for (const key of ['HTMLElement', 'HTMLIFrameElement', 'Node', 'Element', 'Event', 'MouseEvent']) {
    globalThis[key] = dom[key]
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
}

async function mountPage() {
  installDom()
  await act(async () => { root.render(React.createElement(React.Fragment, null, React.createElement(ExerciseProgress), React.createElement(Modals))) })
}

async function click(button) {
  expect(button, `expected a button named ${button?.textContent || 'unknown'}`).toBeTruthy()
  await act(async () => { button.dispatchEvent(new dom.MouseEvent('click', { bubbles: true })) })
}

async function tick(milliseconds) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds) })
}

// The metric switch: the top set is the figure these records are about. An exercise with nothing but
// the top set has no switch to press.
const showTopSet = async () => {
  const top = [...container.querySelectorAll('[role="radio"]')].find(b => b.textContent === 'Top')
  if (top) await click(top)
}
const hero = () => container.querySelector('.g-xp-big')?.textContent
const chosenName = () => container.querySelector('.g-snav-title').textContent
const chartWith = y => mocks.charts.find(chart => chart.values?.includes(y))
const tilesOf = () => Object.fromEntries([...container.querySelectorAll('.g-stat')].map(s => [s.children[0].textContent, s.children[1].textContent]))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE_NOW)
})

afterEach(async () => {
  if (root) await act(async () => { root.unmount() })
  root = null
  container = null
  dom?.close()
  dom = null
  useUI.setState({ sheets: [] })
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// One session is one point, so the line itself is not drawn (it says to log it twice): the figures
// and the session count are what show that the records folded into one.
describe('Progress exercise records', () => {
  it('keeps a legacy reps record whose load is stored only in topW', async () => {
    resetFixture([workout('legacy-topw', BASE_NOW, [
      { id: '0025', target: { mode: 'reps' }, topW: 70, sets: [] },
    ])])
    await mountPage()
    await showTopSet()

    expect(hero()).toBe('70 kg')
    expect(tilesOf().Sessions).toBe('1')
  })

  it('keeps the strongest topW across repeated legacy records', async () => {
    resetFixture([workout('legacy-topw-duplicates', BASE_NOW, [
      { id: '0025', target: { mode: 'reps' }, topW: 70, sets: [] },
      { id: '0025', target: { mode: 'reps' }, topW: 60, sets: [] },
    ])])
    await mountPage()
    await showTopSet()

    expect(hero()).toBe('70 kg')
    expect(tilesOf().Sessions).toBe('1')
  })

  it('keeps a legacy topW when a modern occurrence shares the workout', async () => {
    resetFixture([workout('modern-and-legacy', BASE_NOW, [
      entry('0025', [set(true, { w: 50, r: 5 })]),
      { id: '0025', target: { mode: 'reps' }, topW: 70, sets: [] },
    ])])
    await mountPage()
    await showTopSet()

    expect(hero()).toBe('70 kg')
    expect(tilesOf().Sessions).toBe('1')
  })

  it('aggregates duplicate exercise occurrences into one progress point', async () => {
    resetFixture([workout('duplicate', BASE_NOW, [
      entry('0025', [set(true, { w: 60, r: 5 })]),
      entry('0025', [set(true, { w: 80, r: 5 })]),
    ])])
    mocks.search = '?view=sets'
    await mountPage()

    expect([...container.querySelectorAll('.g-ps-card')]).toHaveLength(1)
    expect([...container.querySelectorAll('.g-ps-sets b')].map(b => b.textContent)).toEqual(['60×5', '80×5'])
  })

  it('shows the best of duplicate occurrences in the hero', async () => {
    resetFixture([workout('duplicate', BASE_NOW, [
      entry('0025', [set(true, { w: 60, r: 5 })]),
      entry('0025', [set(true, { w: 80, r: 5 })]),
    ])])
    await mountPage()
    await showTopSet()

    expect(hero()).toBe('80 kg')
    expect(tilesOf().Sessions).toBe('1')
  })

  it('aggregates repeated assisted occurrences by the lightest load', async () => {
    resetFixture([workout('assisted-duplicate', BASE_NOW, [
      entry('0017', [set(true, { w: 30, r: 8 })]),
      entry('0017', [set(true, { w: 20, r: 8 })]),
    ])])
    await mountPage()
    await showTopSet()

    expect(hero()).toBe('20 kg')
    expect(tilesOf().Sessions).toBe('1')
    // an assistance machine has no one-rep max to calculate
    expect(container.querySelector('.g-xp-light')).toBeNull()
  })

  it('draws the aggregated point with others once there are two sessions', async () => {
    resetFixture([
      workout('before', BASE_NOW - 86400000, [entry('0025', [set(true, { w: 60, r: 5 })])]),
      workout('duplicate', BASE_NOW, [entry('0025', [set(true, { w: 60, r: 5 })]), entry('0025', [set(true, { w: 80, r: 5 })])]),
    ])
    await mountPage()
    await showTopSet()

    expect(chartWith(80)?.values).toEqual([60, 80])
  })
})

describe('Progress exercise picker', () => {
  it('filters with the shared exercise matcher and still selects from the mounted sheet', async () => {
    resetFixture(exercisePickerWorkouts())
    await mountPage()
    expect(EXIDX[LEGACY_SNAPSHOT_ID]).toBeUndefined()

    await click(container.querySelector('.g-xp-pick'))

    const modal = document.querySelector('#modal-root')
    const input = modal.querySelector('input')
    expect(input).toBeTruthy()
    expect(input.getAttribute('aria-label')).toBe('Search…')
    expect(input.getAttribute('placeholder')).toBe('Search…')
    expect(modal.querySelector('.picker-search')).toBeTruthy()
    const optionButtons = () => [...modal.querySelectorAll('.sect-b button')]
    const initialOptionCount = optionButtons().length
    expect(initialOptionCount).toBe(3)
    expect(modal.textContent).toContain('Legacy shoulder press')
    expect(input.compareDocumentPosition(optionButtons()[0]) & globalThis.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set
    const setSearch = async value => act(async () => {
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    // A focused search can leave a newly narrowed result below the visual viewport. The
    // correction must advance the sheet's own scroll position, not the page behind it.
    const sheet = modal.querySelector('.sheet')
    const firstOption = optionButtons()[0]
    Object.defineProperties(sheet, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1000 },
    })
    vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue({ bottom: 600 })
    vi.spyOn(firstOption, 'getBoundingClientRect').mockReturnValue({ bottom: 500 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: { height: 300 } })
    input.focus()
    expect(sheet.style.getPropertyValue('--picker-visual-height')).toBe('300px')
    expect(sheet.style.getPropertyValue('--picker-keyboard-bottom')).toBe(`${Math.max(0, window.innerHeight - 300)}px`)
    await setSearch('bench')
    await tick(100)
    expect(sheet.scrollTop).toBeGreaterThan(0)

    await setSearch('no such historical exercise')
    expect(modal.textContent).toContain('No match')
    expect(optionButtons()).toHaveLength(0)

    await click(modal.querySelector('button[aria-label="Clear"]'))
    expect(input.value).toBe('')
    expect(optionButtons()).toHaveLength(initialOptionCount)
    expect(modal.textContent).toContain('Legacy shoulder press')

    await setSearch('legacy shoulder press shoulders deltoids triceps')
    expect(optionButtons()).toHaveLength(1)
    expect(optionButtons()[0].textContent).toContain('Legacy shoulder press')

    await click(modal.querySelector('button[aria-label="Clear"]'))
    await setSearch('squat full bárbell')

    // A catalogue name is title-cased like it is in every list (exerciseNameText); the legacy
    // snapshot above keeps the name as it was typed.
    expect(modal.textContent).toContain('Barbell Full Squat')
    expect(modal.textContent).not.toContain('Barbell Bench Press')

    const matching = [...modal.querySelectorAll('button')].find(button => button.textContent.includes('Barbell Full Squat'))
    await click(matching)

    expect(useUI.getState().sheets).toHaveLength(0)
    expect(chosenName()).toContain('Barbell Full Squat')
  })

  it('picking an exercise shows it, and puts it in the address without a history entry', async () => {
    resetFixture(exercisePickerWorkouts())
    mocks.search = '?range=30'
    await mountPage()
    expect(chosenName()).toBe('Barbell Bench Press')
    expect(mocks.nav).not.toHaveBeenCalled()

    await click(container.querySelector('.g-xp-pick'))
    const modal = document.querySelector('#modal-root')
    await click([...modal.querySelectorAll('.sect-b button')].find(b => b.textContent.includes('Barbell Full Squat')))

    expect(mocks.nav).toHaveBeenCalledTimes(1)
    const [url, opts] = mocks.nav.mock.calls[0]
    expect(opts).toEqual({ replace: true })
    const [path, query] = url.split('?')
    expect(path).toBe('/progress/strength')
    expect(Object.fromEntries(new URLSearchParams(query))).toEqual({ range: '30', ex: '0043' })
    expect(chosenName()).toBe('Barbell Full Squat')
    await showTopSet()
    expect(hero()).toBe('60 kg')
  })
})
