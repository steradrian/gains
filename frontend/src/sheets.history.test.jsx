// @vitest-environment happy-dom
// The history sheet (issue #43) is the one place the workout screen answers "what did I do
// on this last time, and the time before" — worth pinning that it reads the log newest
// first, labels sets the way the rest of the app does, and does not pretend an exercise
// with no sessions has a curve.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exerciseHistorySheet, exerciseDetailSheet } from './sheets.jsx'
import { EXIDX } from './lib/exercises.js'
import { exerciseNameFor } from './lib/i18n.js'

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

const EX = Object.keys(EXIDX).find(id => (EXIDX[id].bp || '') !== 'cardio' && !EXIDX[id].custom)
const DAY = 86400000
const T0 = Date.UTC(2026, 2, 2, 9)
const iso = i => new Date(T0 + i * DAY).toISOString().slice(0, 10)
const session = (i, rows) => ({
  id: 'w' + i, d: iso(i), start: T0 + i * DAY, end: T0 + i * DAY + 3600000, name: 'Push', vol: 0,
  entries: [{ id: EX, target: { mode: 'reps', bodyweight: false }, sets: rows }],
})

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', workouts: [], active: null } }))
  document.body.innerHTML = ''
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('exercise history sheet', () => {
  it('shows an empty state instead of a chart when nothing was logged', () => {
    exerciseHistorySheet(EX)
    const host = renderTop()
    expect(host.querySelector('.g-ps-empty').textContent).toBe('No sessions logged yet')
    expect(host.querySelector('.g-lc')).toBeNull()
  })

  it('is a full drawer titled with the exercise', () => {
    exerciseHistorySheet(EX)
    const host = renderTop()
    expect(host.querySelector('.g-bs-full')).toBeTruthy()
    expect(host.querySelector('.g-bs-head h2').textContent).toBe(exerciseNameFor(EXIDX[EX]))
  })

  it('lists sessions newest first with labelled sets, volume and one new-best marker', () => {
    useStore.setState(s => ({ S: { ...s.S, workouts: [
      session(0, [{ w: 40, r: 8, done: true, phase: 'warmup' }, { w: 60, r: 5, done: true }, { w: 60, r: 5, done: true }]),
      session(2, [{ w: 70, r: 5, done: true }]),
      session(4, [{ w: 70, r: 3, done: true }, { w: 90, r: 1, done: false }]),
    ] } }))
    exerciseHistorySheet(EX)
    const host = renderTop()
    const rows = [...host.querySelectorAll('.g-ps-card')]
    expect(rows).toHaveLength(3)
    const sets = row => [...row.querySelectorAll('.g-ps-sets b')].map(b => b.textContent)
    // newest first, oldest last; the warm-up and the unfinished set never show up
    expect(sets(rows[0])).toEqual(['70×3'])
    expect(sets(rows[2])).toEqual(['60×5', '60×5'])
    expect(rows[2].textContent).toContain('Volume 600 kg')
    // the record was set in the middle session and only that one carries the mark
    expect(rows.map(r => !!r.querySelector('.g-ps-pr'))).toEqual([false, true, false])
    // the top-set curve is the kit's line, with a readout per point
    expect(host.querySelector('.g-lc svg')).toBeTruthy()
    expect([...host.querySelectorAll('.g-lc .g-sr li')].map(li => li.textContent).at(-1)).toContain('70 kg')
  })

  // A cardio history charts the session's top speed, stored in km/h, in the profile's speed unit.
  it.each([['kmh', ['10 km/h', '12 km/h']], ['mph', ['6.2 mph', '7.5 mph']]])('charts a cardio exercise\'s top speed in %s', (speedUnit, readouts) => {
    const cardio = Object.keys(EXIDX).find(id => (EXIDX[id].bp || '') === 'cardio' && !EXIDX[id].custom)
    const run = (i, speed) => ({
      id: 'c' + i, d: iso(i), start: T0 + i * DAY, end: T0 + i * DAY + 3600000, name: 'Run', vol: 0,
      entries: [{ id: cardio, target: { mode: 'cardio' }, sets: [{ min: 30, speed, done: true }] }],
    })
    useStore.setState(s => ({ S: { ...s.S, speedUnit, workouts: [run(0, 10), run(2, 12)] } }))
    exerciseHistorySheet(cardio)
    const host = renderTop()
    expect(host.querySelector('.g-lc').getAttribute('aria-label')).toMatch(/Top speed$/)
    const points = [...host.querySelectorAll('.g-lc .g-sr li')].map(li => li.textContent)
    readouts.forEach((r, i) => expect(points[i]).toContain(r))
  })

  // Inside a running workout the exercise drawer's Progress and History tabs open this sheet over it,
  // so nobody leaves the workout (owner question 2); elsewhere they open the progress page.
  it.each(['Progress', 'History'])('is what the exercise drawer\'s %s opens inside the workout, once there is history', tabName => {
    const hash = location.hash
    location.hash = '#/train/workout'
    try {
      exerciseDetailSheet(EXIDX[EX])
      const before = renderTop()
      const tab = host => [...host.querySelectorAll('[role="tab"]')].find(b => b.textContent === tabName)
      act(() => { tab(before).click() })
      expect(useUI.getState().sheets).toHaveLength(1)
      expect(before.querySelector('[role="tabpanel"]').textContent).toBe('No sessions logged yet')

      useStore.setState(s => ({ S: { ...s.S, workouts: [session(0, [{ w: 60, r: 5, done: true }])] } }))
      useUI.setState({ sheets: [] })
      exerciseDetailSheet(EXIDX[EX])
      const host = renderTop()
      act(() => { tab(host).click() })
      expect(useUI.getState().sheets).toHaveLength(2)
      const top = renderTop()
      expect(top.querySelectorAll('.g-ps-card')).toHaveLength(1)
    } finally { location.hash = hash }
  })
})
