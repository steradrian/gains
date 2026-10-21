// @vitest-environment happy-dom
// More cases for the exercise drawers (guard-M2a), ported from views/Workout.test.jsx and
// Workout.plates.test.jsx: the muscle tag on How to, and Plate loading when the plates fall short.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { registerCustom } from '../../lib/exercises.js'
import { _setLangState } from '../../lib/i18n-core.js'
import de from '../../locales/de.js'
import { howToSheet, platesSheet } from './drawers.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const SQUAT = '0043' // barbell full squat
const COCOONS = '0260' // body weight, done with +25
const BURPEE = '1160' // cardio, target "cardiovascular system"

function seed(entries, over = {}) {
  const S = clone(DEF)
  Object.assign(S, { unit: 'kg', restSec: 90, effort: 'none', routines: [], workouts: [], ...over })
  S.active = { id: 'act', d: '2026-10-21', start: Date.now(), name: 'Test', bw: null, cur: 0, entries: clone(entries) }
  useStore.setState({ S, user: null })
}
const one = (id, w, extra = {}) => ({ id, target: { mode: 'reps', sets: 1, reps: 6, weight: w }, sets: [{ w, r: 6, done: false }], ...extra })

const mounted = []
function top() {
  const sheet = useUI.getState().sheets.at(-1)
  if (!sheet) return null
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], timer: null, work: null, toastMsg: null, toastAction: null })
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) })
  useStore.setState({ S: clone(DEF) })
  registerCustom([])
  _setLangState('en', null, null, null)
})

// old Workout.test.jsx:3020, :3033 (QA C9): the tag reads the muscle's display name
describe('How to: the muscle tag', () => {
  it('names a custom exercise\'s target muscle by its display name', () => {
    registerCustom([{ id: 'cqa1', n: 'QA Custom Thrust', bp: 'upper legs', eq: 'barbell', custom: true, tg: 'gluteal', sm: [], primaries: ['gluteal'], secondaries: [], muscleGroups: ['gluteal'] }])
    seed([one('cqa1', 60)])
    howToSheet(0)
    const text = top().textContent
    expect(text).toContain('Glutes')
    expect(text).not.toContain('gluteal')
  })

  it('keeps the cardio target translated (burpee, de)', () => {
    _setLangState('de', de, null, null)
    seed([one(BURPEE, 0)])
    howToSheet(0)
    const text = top().textContent
    expect(text).toContain('Herz-Kreislauf')
    expect(text).not.toContain('Cardiovascular system')
  })
})

// old Workout.plates.test.jsx:111, :148: what the inventory cannot make says how much is short
describe('Plate loading: plates that fall short', () => {
  it('a bar loaded per side says how much is missing', () => {
    seed([one(SQUAT, 70)], { unit: 'lb', plates: { lb: { 45: 1, 10: 1 } } })
    platesSheet(0)
    expect(top().textContent).toMatch(/Your plates come .*lb short of this\./)
  })

  it('a single stack says how much is missing', () => {
    seed([one(COCOONS, 30)], { unit: 'lb', plates: { lb: { 25: 1 } } })
    platesSheet(0)
    expect(top().textContent).toContain('Your plates come 5 lb short of this.')
  })

  it('says nothing when the plates make the weight', () => {
    seed([one(SQUAT, 145)], { unit: 'lb', plates: { lb: { 45: 1, 35: 1, 25: 1, 15: 1, 10: 1, 5: 1, 2.5: 1 } } })
    platesSheet(0)
    expect(top().textContent).not.toContain('short of this')
  })
})
