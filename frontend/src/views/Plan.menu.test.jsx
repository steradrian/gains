// @vitest-environment happy-dom
// The Routines page (views/Plan.jsx) and its header menu: what stays of the old Plan.rotation and
// Plan.day-rows tests once the Plan page moved to views/plan/PlanScreen.jsx. One menu holds share,
// print, import and the starter plans, greys out what an empty plan cannot share, and has no Coach
// (a row on Train); with no routines, the page offers the starter plan.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Plan from './Plan.jsx'
import { menuSheet, starterPlanSheet } from '../sheets.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, coach: false }
  state.snapshot = () => ({
    S: state.S,
    user: null,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => (selector ? selector(mocks.snapshot()) : mocks.snapshot())
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), syncReminder: vi.fn() }))
vi.mock('../lib/coach.js', () => ({ coachAvailable: () => mocks.coach }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), menuSheet: vi.fn(), confirmSheet: vi.fn(),
  planHasRoutines: s => (s.routines || []).some(r => r.ex.length), exportPlanFile: vi.fn(), printWholePlan: vi.fn(), importPlanFile: vi.fn(),
}))

let host, root
beforeEach(() => {
  vi.clearAllMocks()
  mocks.coach = false
  mocks.S = {
    unit: 'kg', workouts: [], exWeights: {}, week: { 1: ['r1'] }, dayPlan: {},
    routines: [{ id: 'r1', name: 'Push', emoji: null, ex: [] }, { id: 'r2', name: 'Pull', emoji: null, ex: [] }],
  }
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mount = () => act(() => root.render(<Plan view="routines" />))
const openMenu = () => {
  act(() => host.querySelector('button[aria-label="Plan options"]').click())
  return menuSheet.mock.calls.at(-1)[0]
}
const click = el => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))

describe('Routines — the page and its menu', () => {
  it('is the routines list only: no Loop / Fixed week, no plan of days', () => {
    mount()
    expect(host.querySelector('h1').textContent).toBe('Routines')
    expect(host.querySelector('.plan-routines')).toBeTruthy()
    expect(host.querySelector('.g-sseg')).toBeNull()
    expect(host.querySelector('.g-pgrid')).toBeNull()
  })

  it('one menu holds share, print, import and the starter plans', () => {
    mocks.S.routines[0].ex = [{ id: '0025' }]
    mount()
    expect(openMenu().items.filter(Boolean).map(i => i.label)).toEqual(['Export plan file', 'Print / Save as PDF', 'Import a plan file', 'Load starter plan'])
  })

  it('has no Coach button in the header nor a menu entry, even when the Coach is available', () => {
    mocks.coach = true
    mount()
    expect([...host.querySelectorAll('.hdr button')].find(b => b.textContent === 'Coach')).toBeUndefined()
    expect(openMenu().items.filter(Boolean).map(i => i.label)).not.toContain('Coach')
  })

  it('greys out share and print while there is nothing to share, and says why', () => {
    mount()
    const menu = openMenu()
    const item = label => menu.items.find(i => i && i.label === label)
    expect(item('Export plan file').disabled).toBe(true)
    expect(item('Print / Save as PDF').disabled).toBe(true)
    expect(item('Import a plan file').disabled).toBeFalsy()
    expect(menu.subtitle).toContain('Add an exercise to a routine first')
  })

  it('with no routines, the list shows the routine illustration, and its action opens the starter plan', () => {
    mocks.S = { ...mocks.S, routines: [], week: {} }
    mount()
    expect(host.querySelector('.empty .empty-t').textContent).toBe('No routines yet')
    expect(host.querySelector('.empty .empty-art svg.lineart')).not.toBeNull()
    click([...host.querySelectorAll('.empty-acts button')].find(b => b.textContent === 'Load starter plan'))
    expect(starterPlanSheet).toHaveBeenCalledTimes(1)
  })
})
