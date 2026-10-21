// @vitest-environment happy-dom
// The running workout's map, Add exercise, Options and Workout settings (map-drawers.jsx, drawers.js):
// W1.37, W1.23, W1.45 (the map), W1.18, W1.19 (Add exercise), W1.20, W1.21 (Options, Settings).
// The pointer drag itself is covered by ds/MapDrawer.test.jsx; here the keyboard handle drives reorder.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { workoutMapSheet, addExerciseSheet, workoutOptionsSheet } from './drawers.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const WARM = '3013'
const BENCH = '0025'
const FLY = '0188'
const PRESS = '0426'
const STRETCH = '1053'
const ROUTINE = { id: 'push', name: 'Push A', ex: [{ id: BENCH, sets: 3, reps: 8, weight: 80 }] }
const row = (extra = {}) => ({ w: 80, r: 8, done: false, ...extra })
const lift = (id, n, done = 0, extra = {}) => ({
  id, rid: 'push', target: { sets: n, reps: 8, weight: 80 }, sets: Array.from({ length: n }, (_, i) => row({ done: i < done })), ...extra,
})
const ENTRIES = () => [
  lift(WARM, 2, 2, { part: 'warmup' }),
  lift(BENCH, 3, 1),
  lift(FLY, 3),
  lift(PRESS, 3),
  lift(STRETCH, 2, 0, { part: 'cooldown' }),
]

function seed(entries = ENTRIES(), { cur = 1, active = {}, ...over } = {}) {
  const S = clone(DEF)
  Object.assign(S, { unit: 'kg', restSec: 120, effort: 'none', routines: [clone(ROUTINE)], workouts: [], ...over })
  S.active = { id: 'act', d: '2026-10-21', start: Date.now(), name: 'Push A', bw: null, cur, routineIds: ['push'], entries: clone(entries), ...active }
  useStore.setState({ S, user: null })
}
const A = () => useStore.getState().S.active
const ids = () => A().entries.map(e => e.id)

const mounted = []
// The drawer on screen: its newest sub-panel when it has one (openSheet inside an open drawer).
function top() {
  const drawer = useUI.getState().sheets.at(-1)
  const sheet = drawer?.panels?.at(-1) || drawer
  if (!sheet) return null
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text)
const tap = el => act(() => el.click())
const switchFor = (host, label) => [...host.querySelectorAll('.g-switchrow')].find(r => r.textContent.includes(label))?.querySelector('[role="switch"]')
const gripOf = (host, name) => host.querySelector(`.g-mr-grip[aria-label="Move ${name}"]`)
const press = (el, key) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })) })
const rowOf = (host, name) => [...host.querySelectorAll('.g-mr-main')].find(r => r.textContent.includes(name))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], timer: null, work: null, toastMsg: '', toastAction: null })
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) })
  useStore.setState({ S: clone(DEF) })
})

describe('the map (W1.37)', () => {
  it('lists every exercise by phase with its state, the title and the foot', () => {
    seed()
    workoutMapSheet()
    const host = top()
    const text = host.textContent
    expect(text).toContain('Push A · 5 exercises')
    expect(text).toContain('Drag to reorder within a phase')
    expect(text).toContain('Warm-up · done')
    expect(text).toContain('Workout · 0 of 3 done')
    expect(text).toContain('Cool-down · 0 of 1 done')
    expect(text).toContain('Set 2 of 3')
    expect(host.querySelectorAll('.g-mr')).toHaveLength(5)
    expect(host.querySelectorAll('.g-mr-cur')).toHaveLength(1)
    expect(button(host, 'Add exercise')).toBeTruthy()
    expect(button(host, 'Make superset')).toBeTruthy()
    expect(button(host, 'Workout options')).toBeTruthy()
  })

  it('goes to the exercise a row names and closes', () => {
    seed()
    workoutMapSheet()
    const host = top()
    tap(rowOf(host, 'Middle Fly'))
    expect(A().cur).toBe(2)
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('has no map when there is no workout', () => {
    useStore.setState({ S: clone(DEF) })
    workoutMapSheet()
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('scrolls a long workout inside the drawer (W1.45)', () => {
    const many = [lift(WARM, 2, 2, { part: 'warmup' }), ...Array.from({ length: 18 }, (_, i) => lift(i % 2 ? FLY : PRESS, 3)), lift(STRETCH, 2, 0, { part: 'cooldown' })]
    seed(many, { cur: 3 })
    workoutMapSheet()
    const host = top()
    expect(host.textContent).toContain('20 exercises')
    expect(host.querySelectorAll('.g-mr')).toHaveLength(20)
  })
})

describe('reordering (W1.23)', () => {
  it('moves a row down with the keyboard handle, inside its phase', () => {
    seed()
    workoutMapSheet()
    const host = top()
    const grip = host.querySelectorAll('.g-mr-grip')[1]
    press(grip, 'ArrowDown')
    expect(ids()).toEqual([WARM, FLY, BENCH, PRESS, STRETCH])
    expect(A().cur).toBe(2)
  })

  it('never carries a row into another phase', () => {
    seed()
    workoutMapSheet()
    const host = top()
    press(host.querySelectorAll('.g-mr-grip')[3], 'ArrowDown')
    press(host.querySelectorAll('.g-mr-grip')[1], 'ArrowUp')
    expect(ids()).toEqual([WARM, BENCH, FLY, PRESS, STRETCH])
  })
})

describe('Make superset and Unpair', () => {
  it('pairs the current exercise with the next, then reads Unpair', () => {
    seed()
    workoutMapSheet()
    let host = top()
    tap(button(host, 'Make superset'))
    expect(A().entries[1].sg).toBeTruthy()
    expect(A().entries[1].sg).toBe(A().entries[2].sg)
    expect(host.textContent).toContain('Unpair')
    expect(host.textContent).toContain('Superset settings')
    tap(button(host, 'Unpair'))
    expect(A().entries[1].sg).toBeUndefined()
    expect(A().entries[2].sg).toBeUndefined()
  })

  it('offers no pairing for the last exercise of a phase', () => {
    seed(ENTRIES(), { cur: 3 })
    workoutMapSheet()
    expect(button(top(), 'Make superset')).toBeUndefined()
  })

  it('names the superset and its round rest as a step inside the same drawer', () => {
    seed()
    workoutMapSheet()
    const host = top()
    tap(button(host, 'Make superset'))
    tap(button(host, 'Superset settings'))
    expect(host.textContent).toContain('Rest after each round')
    const input = host.querySelector('.g-ws-input')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Chest finisher')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    tap(button(host, 'Save'))
    expect(A().entries[1].target.sgName).toBe('Chest finisher')
    expect(A().entries[2].target.sgName).toBe('Chest finisher')
    expect(useUI.getState().sheets).toHaveLength(1)
  })
})

describe('Skip', () => {
  it('skips the cool-down for this session', () => {
    seed()
    workoutMapSheet()
    const host = top()
    tap(button(host, 'Skip cool-down'))
    expect(A().skipped).toEqual({ cooldown: true })
    expect(host.textContent).not.toContain('Skip cool-down')
  })

  it('offers Skip warm-up only while the warm-up is open', () => {
    seed()
    workoutMapSheet()
    expect(top().textContent).not.toContain('Skip warm-up')
    act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) })
    useUI.setState({ sheets: [] })
    const open = ENTRIES()
    open[0].sets[1].done = false
    seed(open, { cur: 0 })
    workoutMapSheet()
    const host = top()
    tap(button(host, 'Skip warm-up'))
    expect(A().skipped).toEqual({ warmup: true })
  })
})

describe('Add exercise (W1.18, W1.19)', () => {
  const addFirst = () => {
    const host = top()
    tap(host.querySelector('.g-pk-add'))
    return host
  }

  it('is the picker for this workout, with Add routine', () => {
    seed()
    addExerciseSheet()
    const host = top()
    expect(host.textContent).toContain('Add exercise')
    expect(host.textContent).toContain('This workout')
    expect(host.textContent).toContain('Add routine')
    expect(host.textContent).toContain('Create your own exercise')
  })

  it('puts the exercise after the current one, counts every exercise in the toast and undoes it', () => {
    seed()
    addExerciseSheet()
    addFirst()
    expect(A().entries).toHaveLength(6)
    expect(A().cur).toBe(2)
    expect(useUI.getState().toastMsg).toMatch(/^Added .+ after .+ · 3 of 6$/)
    expect(useUI.getState().toastAction.label).toBe('Undo')
    act(() => useUI.getState().toastAction.run())
    expect(ids()).toEqual([WARM, BENCH, FLY, PRESS, STRETCH])
    expect(A().cur).toBe(1)
  })

  it('goes into the part whose section opened it', () => {
    seed()
    addExerciseSheet(null, 'cooldown')
    addFirst()
    expect(A().entries).toHaveLength(6)
    expect(A().entries[5].part).toBe('cooldown')
    expect(A().entries[4].id).toBe(STRETCH)
  })

  it('opens from the map’s Add exercise as a panel of the map', () => {
    seed()
    workoutMapSheet()
    const host = top()
    tap(button(host, 'Add exercise'))
    const next = useUI.getState().sheets
    expect(next).toHaveLength(1)
    expect(next[0].panels).toHaveLength(1)
    expect(top().textContent).toContain('This workout')
  })
})

describe('Workout options (W1.20)', () => {
  it('lists the rows of the board', () => {
    seed()
    workoutOptionsSheet()
    const text = top().textContent
    ;['Reorder exercises', 'Rename workout', 'Session note', 'Add routine', 'Workout settings', 'Don’t count for progression', 'Discard workout']
      .forEach(label => expect(text).toContain(label))
    expect(text).not.toContain('Layout')
    expect(text).not.toContain('Mark all sets done')
  })

  it('offers Mark all sets done on a backfill only, and ticks every set', () => {
    seed(ENTRIES(), { active: { backfill: { durationMin: 60 } } })
    workoutOptionsSheet()
    const host = top()
    tap([...host.querySelectorAll('.g-drow')].find(r => r.textContent.includes('Mark all sets done')))
    expect(A().entries.every(e => e.sets.every(s => s.done))).toBe(true)
  })

  it('hides Add routine and Discard while editing a logged workout', () => {
    seed(ENTRIES(), { active: { editingWorkoutId: 'w-1' } })
    workoutOptionsSheet()
    const text = top().textContent
    expect(text).not.toContain('Add routine')
    expect(text).not.toContain('Discard workout')
  })

  it('keeps a session out of progression with the switch', () => {
    seed()
    workoutOptionsSheet()
    tap(switchFor(top(), 'Don’t count for progression'))
    expect(A().noProg).toBe(true)
  })

  it('Reorder exercises opens the map as a panel of Options, in the same drawer', () => {
    seed()
    workoutOptionsSheet()
    const host = top()
    tap([...host.querySelectorAll('.g-drow')].find(r => r.textContent.includes('Reorder exercises')))
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().sheets[0].panels).toHaveLength(1)
    expect(top().textContent).toContain('Drag to reorder within a phase')
  })

  it('Rename workout and Session note are panels of Options too', () => {
    seed()
    workoutOptionsSheet()
    for (const title of ['Rename workout', 'Session note']) {
      const options = useUI.getState().sheets[0]
      tap([...top().querySelectorAll('.g-drow')].find(r => r.textContent.includes(title)))
      expect(useUI.getState().sheets, title).toHaveLength(1)
      expect(useUI.getState().sheets[0].panels, title).toHaveLength(1)
      act(() => useUI.getState().closeSheet(useUI.getState().sheets[0].panels[0].id))
      expect(useUI.getState().sheets[0].id).toBe(options.id)
    }
  })

  it('Discard workout opens the confirmation as a panel of Options', () => {
    seed()
    workoutOptionsSheet()
    tap([...top().querySelectorAll('.g-drow')].find(r => r.textContent.includes('Discard workout')))
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().sheets[0].panels).toHaveLength(1)
  })

  it('is reached from the map’s Workout options', () => {
    seed()
    workoutMapSheet()
    tap(button(top(), 'Workout options'))
    expect(top().textContent).toContain('Reorder exercises')
  })
})

describe('Workout settings (W1.21), a step inside Options', () => {
  const openSettings = () => {
    workoutOptionsSheet()
    const host = top()
    tap([...host.querySelectorAll('.g-drow')].find(r => r.textContent.includes('Workout settings')))
    return host
  }

  it('slides in with a way back to Options, in the same drawer', () => {
    seed()
    const host = openSettings()
    expect(host.textContent).toContain('Next exercise on its own')
    expect(host.textContent).toContain('Warm-ups and cool-downs come from the routine. Skip either one in the map.')
    expect(useUI.getState().sheets).toHaveLength(1)
    tap(button(host, 'Options'))
    expect(host.textContent).toContain('Reorder exercises')
  })

  it('writes the same fields as Settings', () => {
    seed(ENTRIES(), { autoNext: true, showPlates: true, sound: false })
    const host = openSettings()
    tap(switchFor(host, 'Next exercise on its own'))
    tap(switchFor(host, 'Plate loading'))
    tap(switchFor(host, 'Sound'))
    const s = useStore.getState().S
    expect(s.autoNext).toBe(false)
    expect(s.showPlates).toBe(false)
    expect(s.sound).toBe(true)
  })

  it('turns Effort on as RIR, off as none, and back on as the last choice', () => {
    seed()
    const host = openSettings()
    tap(switchFor(host, 'Effort per set'))
    expect(useStore.getState().S.effort).toBe('rir')
    act(() => useStore.getState().update(s => { s.effort = 'rpe' }))
    tap(switchFor(host, 'Effort per set'))
    expect(useStore.getState().S.effort).toBe('none')
    tap(switchFor(host, 'Effort per set'))
    expect(useStore.getState().S.effort).toBe('rpe')
  })

  it('sets the rest on the wheel as a step, 0:00 being off', () => {
    seed(ENTRIES(), { restSec: 90 })
    const host = openSettings()
    tap([...host.querySelectorAll('.g-drow')].find(r => r.textContent.includes('Rest timer')))
    expect(host.querySelector('.dw-col').getAttribute('aria-valuetext')).toBe('1 minute 30 seconds')
    tap(button(host, 'Done'))
    expect(useStore.getState().S.restSec).toBe(90)
    expect(host.textContent).toContain('Plate loading')
  })
})
