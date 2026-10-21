// @vitest-environment happy-dom
// The exercise drawer (T6.1): the head says what the exercise is and its best set, How to carries
// the description, the muscles and the steps, Add to my plan and the catalogue fix link, and Your
// setup holds what the old sheet had below them (plate loading, weight means).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXIDX, registerCustom } from './lib/exercises.js'
import { fmtDate } from './lib/format.js'
import { instrFor } from './lib/i18n.js'
import { _setLangState } from './lib/i18n-core.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { detailTags, exerciseDetailSheet } from './sheets.jsx'

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
const row = (host, title) => [...host.querySelectorAll('.g-drow')].find(r => r.querySelector('b')?.textContent === title)

const BENCH = EXIDX['0025']   // barbell bench press
const CARDIO = Object.values(EXIDX).find(e => e.bp === 'cardio' && !e.custom)
const T0 = Date.UTC(2026, 9, 12, 9)
const session = sets => ({ id: 'w1', d: '2026-10-12', start: T0, end: T0 + 3600000, name: 'Push', entries: [{ id: BENCH.id, target: { mode: 'reps', bodyweight: false }, sets }] })

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: { ...structuredClone(DEF), unit: 'kg' }, user: null })
  registerCustom([])
  _setLangState('en', null, null, null)
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  registerCustom([])
  vi.restoreAllMocks()
})

describe('the exercise drawer head', () => {
  it('names the exercise, tags it as detailTags does, and gives the best set with its day', () => {
    useStore.setState(s => ({ S: { ...s.S, workouts: [session([{ w: 80, r: 8, done: true }, { w: 82.5, r: 6, done: true }])] } }))
    exerciseDetailSheet(BENCH)
    const host = renderTop()
    expect(host.querySelector('.g-bs-head h2').textContent.toLowerCase()).toBe(BENCH.n.toLowerCase())
    expect([...host.querySelectorAll('.g-xd-tags .g-tag')].map(t => t.textContent)).toEqual(detailTags(BENCH).map(t => t.label))
    expect(host.querySelector('.g-xd-tags .g-tag').className).toContain('g-tag-accent')
    expect(host.querySelector('.g-xd-best').textContent).toBe(`Best 82.5 kg × 6 · ${fmtDate('2026-10-12', true)}`)
  })

  it('has no best line before the exercise is logged', () => {
    exerciseDetailSheet(BENCH)
    expect(renderTop().querySelector('.g-xd-best')).toBeNull()
  })
})

describe('How to', () => {
  it('draws the muscles beside Primary and Additional, and numbers the steps', () => {
    exerciseDetailSheet(BENCH)
    const host = renderTop()
    expect(host.querySelector('.g-xd-mlines').textContent).toContain('Primary · ')
    expect(host.querySelectorAll('.g-xd-steps li')).toHaveLength(instrFor(BENCH).length)
    expect(host.querySelector('.g-xd-steps li span').textContent).toBe('1')
  })

  it('Add to my plan opens the routine list over the drawer', () => {
    exerciseDetailSheet(BENCH)
    act(() => row(renderTop(), 'Add to my plan').click())
    expect(useUI.getState().sheets).toHaveLength(2)
    expect(renderTop().textContent).toContain('Pick a routine. Sets, reps and weight come next.')
  })

  it('a built-in exercise links to its catalogue issue; a custom one has no such row', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    exerciseDetailSheet(BENCH)
    act(() => row(renderTop(), 'Suggest a fix for this exercise').click())
    expect(open).toHaveBeenCalledWith(expect.stringContaining('https://github.com/steradrian/gains/issues/new?template=exercise.yml&exercise=0025'), '_blank', 'noopener,noreferrer')
    const own = { id: 'cdrw1', n: 'My row', bp: 'back', eq: 'barbell', custom: true }
    useStore.setState(s => ({ S: { ...s.S, customEx: [own] } }))
    registerCustom([own])
    useUI.setState({ sheets: [] })
    exerciseDetailSheet(own)
    expect(row(renderTop(), 'Suggest a fix for this exercise')).toBeUndefined()
  })
})

describe('Your setup', () => {
  it('Plate loading says how the bar is set and opens its own drawer', () => {
    exerciseDetailSheet(BENCH)
    const host = renderTop()
    const plates = row(host, 'Plate loading')
    expect(plates.querySelector('.g-drow-val').textContent).toMatch(/^(Bar .+|No bar)$/)
    act(() => plates.click())
    expect(useUI.getState().sheets).toHaveLength(2)
    expect(renderTop().querySelector('h3').textContent).toBe('Plate loading')
  })

  it('is not there for cardio, which has neither plates nor bells', () => {
    exerciseDetailSheet(CARDIO)
    expect(renderTop().querySelector('.g-xd-setup')).toBeNull()
  })

  it('no longer carries the 1RM calculator, which moves to the Progress page', () => {
    exerciseDetailSheet(BENCH)
    expect(renderTop().textContent).not.toContain('Estimated 1RM')
  })
})
