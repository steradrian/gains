// @vitest-environment happy-dom
// T3.7 Import a plan and its landing, T4.4. Takes over sheets.plan-import-toast.test.jsx (the
// toast counts what was added, singular and plural) and the old import sheet's summary, warning
// and schedule switch. New: the plan's name, the page's error state, the landing state routines M1
// reads, the Undo, and no schedule switch for a file without weekdays (a one-routine file).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { setNav } from '../../lib/nav.js'
import { parsePlan } from '../../lib/plan-share.js'
import { EXDB } from '../../lib/exercises.js'
import { importPlanFile } from '../../sheets.jsx'
import PlanImportPage from './PlanImportPage.jsx'

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const lifts = EXDB.filter(e => e.bp !== 'cardio' && e.img).slice(0, 2).map(e => e.id)
const routine = (id, name, n = 1) => ({ id, name, emoji: null, ex: lifts.slice(0, n).map(x => ({ id: x, sets: 3, reps: 8, weight: 40 })) })
const fileOf = (routines, over = {}) => ({ opengym_plan: 1, unit: 'kg', name: '', week: {}, routines, customEx: [], ...over })
const bundleOf = (routines, over) => parsePlan(fileOf(routines, over), 'kg')
const mounted = []
let go

function show(state) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(
    <MemoryRouter initialEntries={[{ pathname: '/train/schedule/import', state }]}>
      <Routes>
        <Route path="/train/schedule/import" element={<PlanImportPage />} />
        <Route path="/train/schedule" element={<p className="plan-page">Plan</p>} />
      </Routes>
    </MemoryRouter>,
  ))
  return host
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  document.body.innerHTML = ''
  const st = clone(DEF)
  Object.assign(st, { routines: [routine('mine', 'Mine')], week: { 2: ['mine'] }, dayPlan: {}, customEx: [], workouts: [], active: null })
  useStore.setState({ S: st, user: null })
  go = vi.fn()
  setNav(go)
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(r => r.unmount()) })
  setNav(() => {})
})

describe('the import page', () => {
  it('opened cold, with no file, goes to the Plan page', () => {
    expect(show(undefined).querySelector('.plan-page')).toBeTruthy()
  })

  it('names the plan, then what is in it: routines, exercises, and the days a week from the file', () => {
    const bundle = bundleOf([routine('a', 'Upper A', 2), routine('b', 'Lower A')], { name: 'Upper Lower', week: { 1: ['a'], 4: ['b'] } })
    const host = show({ bundle })
    expect(host.querySelector('.g-spage-title').textContent).toBe('Import a plan')
    const head = host.querySelector('.g-glist .g-glist-body')
    expect(head.querySelector('b').textContent).toBe('Upper Lower')
    expect(head.querySelector('span').textContent).toBe('2 routines · 3 exercises · 2 days a week')
    const rows = [...host.querySelectorAll('.g-tr3-imp .g-glist')[1].querySelectorAll('.g-glist-row')]
    expect(rows.map(r => r.querySelector('b').textContent)).toEqual(['Upper A', 'Lower A'])
    expect(rows.map(r => r.querySelector('.g-glist-body span').textContent)).toEqual(['2 exercises', '1 exercise'])
    expect(rows[0].querySelector('.g-tr3-thumb img')).toBeTruthy()
    expect(host.textContent).toContain('Use this weekly schedule')
  })

  it('a file without weekdays has no schedule switch and no "days a week"; without a name the counts lead', () => {
    const host = show({ bundle: bundleOf([routine('a', 'Push')]) })
    expect(host.querySelector('[role=switch]')).toBeNull()
    expect(host.textContent).not.toContain('Use this weekly schedule')
    expect(host.querySelector('.g-glist .g-glist-body b').textContent).toBe('1 routine · 1 exercise')
  })

  it('warns about exercises the file named that are not in the library', () => {
    const bundle = parsePlan(fileOf([{ id: 'a', name: 'A', ex: [{ id: lifts[0], sets: 3 }, { id: 'no-such-lift', sets: 3 }] }]), 'kg')
    expect(show({ bundle }).querySelector('.g-ibanner').textContent).toContain('1 exercise in the file isn’t in your library and was left out.')
  })

  it('a file it could not read: says so, changes nothing, and offers another file', () => {
    const before = S()
    const host = show({ error: '' })
    expect(host.textContent).toContain('Couldn’t read that file.')
    expect(host.textContent).toContain('Nothing in your plan changed.')
    expect(button(host, 'Choose another file')).toBeTruthy()
    expect(host.querySelector('input[type=file]').getAttribute('accept')).toBe('application/json,.json,.gains')
    expect(S()).toBe(before)
    // parsePlan's own refusal is written for people, and is shown
    expect(show({ error: 'this isn’t a Gains plan file' }).textContent).toContain('Import failed: this isn’t a Gains plan file')
  })
})

describe('Import this plan', () => {
  it('says "1 routine" for a single routine, without a name', () => {
    const host = show({ bundle: bundleOf([routine('a', 'Push')]) })
    act(() => { button(host, 'Import this plan').click() })
    expect(S().routines).toHaveLength(2)
    expect(useUI.getState().toastMsg).toBe('Added 1 routine to your plan')
  })

  it('names the plan and keeps the plural, lands on Routines with what it added, and marks where they came from', () => {
    const host = show({ bundle: bundleOf([routine('a', 'Push'), routine('b', 'Pull')], { name: 'Upper Lower' }) })
    act(() => { button(host, 'Import this plan').click() })
    const added = S().routines.slice(1)
    expect(added.map(r => r.importedFrom)).toEqual(['Upper Lower', 'Upper Lower'])
    expect(useUI.getState().toastMsg).toBe('Added 2 routines from Upper Lower')
    expect(go).toHaveBeenCalledWith('/train/routines', { replace: true, state: { imported: { ids: added.map(r => r.id), from: 'Upper Lower' } } })
    expect(S().week).toEqual({ 2: ['mine'] })   // the switch was off
  })

  it('Undo takes away what it added and puts the week back', () => {
    const host = show({ bundle: bundleOf([routine('a', 'Push')], { name: 'PPL', week: { 1: ['a'] } }) })
    act(() => { host.querySelector('[role=switch]').click() })
    expect(host.textContent).not.toContain('Nothing you already have is touched.')
    act(() => { button(host, 'Import this plan').click() })
    expect(S().week).toEqual({ 1: [S().routines[1].id] })
    act(() => { useUI.getState().runToastAction() })
    expect(S().routines.map(r => r.id)).toEqual(['mine'])
    expect(S().week).toEqual({ 2: ['mine'] })
  })
})

describe('importPlanFile', () => {
  const pick = (text, name = 'plan.gains') => new File([text], name, { type: 'application/json' })

  it('opens the page with the parsed plan, after closing the drawer it came from', async () => {
    const onRead = vi.fn()
    importPlanFile(pick(JSON.stringify(fileOf([routine('a', 'Push')], { name: 'Mine' }))), onRead)
    await vi.waitFor(() => expect(go).toHaveBeenCalled())
    expect(onRead).toHaveBeenCalled()
    const [path, opts] = go.mock.calls[0]
    expect(path).toBe('/train/schedule/import')
    expect(opts.state.bundle).toMatchObject({ name: 'Mine', routineCount: 1 })
  })

  it('opens it in its error state for a file that is not a plan, with parsePlan’s reason', async () => {
    importPlanFile(pick('{"hello":1}'))
    await vi.waitFor(() => expect(go).toHaveBeenCalled())
    expect(go.mock.calls[0][1].state).toEqual({ error: 'this isn’t a Gains plan file' })
    expect(useUI.getState().toastMsg).toBe('')
  })
})
