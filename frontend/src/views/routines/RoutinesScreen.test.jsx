// @vitest-environment happy-dom
// The Routines page (T4.0, T4.1, T4.4's landing): the groups and their titles, Freestyle, the
// empty state's two ways in, and the "Added from" group a plan import lands on.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { setNav } from '../../lib/nav.js'
import { starterPlanSheet, startFlow } from '../../sheets.jsx'
import RoutinesScreen from './RoutinesScreen.jsx'

const nav = vi.fn()
const route = vi.hoisted(() => ({ state: null }))
vi.mock('react-router-dom', () => ({ useNavigate: () => nav, useLocation: () => ({ pathname: '/train/routines', state: route.state }) }))
vi.mock('../../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), startFlow: vi.fn(), dayNoteSheet: vi.fn(), dayOptionsSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  importPlanFile: vi.fn(), logPastWorkoutSheet: vi.fn(), startChooserSheet: vi.fn(),
}))

const clone = v => JSON.parse(JSON.stringify(v))
const routine = (id, name) => ({ id, name, emoji: null, ex: [{ id: '0025' }] })
let host, root
function mount(extra = {}) {
  useStore.setState({ S: Object.assign(clone(DEF), {
    routines: [routine('a', 'Push A'), routine('b', 'Pull A'), routine('c', 'Upper A')],
    week: { 1: ['a'] }, dayPlan: {}, workouts: [], active: null,
  }, extra), user: null })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  act(() => root.render(<RoutinesScreen />))
}
const click = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const sections = () => [...host.querySelectorAll('.g-ssec h2')].map(h => h.textContent)

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  nav.mockClear(); setNav(nav); route.state = null
  starterPlanSheet.mockClear(); startFlow.mockClear()
})
afterEach(() => { act(() => root.unmount()); host.remove(); setNav(() => {}) })

describe('the Routines page', () => {
  it('T4.0: the large title and its line, the groups, then Freestyle', () => {
    mount()
    expect(host.querySelector('.g-spage-title').textContent).toBe('Routines')
    expect(host.querySelector('.g-spage-sub').textContent).toBe('3 routines · 1 in your Plan')
    expect(sections()).toEqual(['In your Plan', 'Not in your Plan', 'No routine'])
  })

  it('Freestyle starts a workout, or goes back to the one running', () => {
    mount()
    click(button('FreestyleStart a workout and pick exercises as you go'))
    expect(startFlow).toHaveBeenCalledWith([])
    act(() => root.unmount()); host.remove()
    mount({ active: { start: Date.now(), entries: [] } })
    click(button('FreestyleStart a workout and pick exercises as you go'))
    expect(nav).toHaveBeenCalledWith('/train/workout')
  })

  it('T4.1: with no routines, New routine and Pick a ready-made plan, and no Freestyle', () => {
    mount({ routines: [], week: {} })
    expect(host.querySelector('.g-sempty b').textContent).toBe('No routines yet')
    expect(sections()).toEqual([])
    click(button('Pick a ready-made plan'))
    expect(starterPlanSheet).toHaveBeenCalled()
    click(host.querySelector('.g-sempty-btn.solid'))
    const created = useStore.getState().S.routines.at(-1)
    expect(nav).toHaveBeenCalledWith('/train/routines/' + created.id + '?new=1')
  })

  it('T4.4: a plan import lands on its own group first, while the state is there', () => {
    route.state = { imported: { ids: ['b', 'c'], from: 'Upper Lower' } }
    mount()
    expect(sections()).toEqual(['Added from Upper Lower', 'In your Plan', 'No routine'])
    expect(host.querySelector('.g-rt-list .g-glist-body span').textContent).toBe('1 exercise · new')
  })
})
