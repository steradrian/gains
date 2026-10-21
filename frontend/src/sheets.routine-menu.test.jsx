// @vitest-environment happy-dom
// T5.8, a routine's menu (the editor's ⋯), and its drawers: Plan days, Share routine and Routine
// settings. What each row says and does; Delete comes back with Undo.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { setNav } from './lib/nav.js'
import { routineMenuSheet } from './sheets.jsx'

const plan = vi.hoisted(() => ({ printed: [] }))
vi.mock('./lib/plan-share.js', async importOriginal => ({
  ...(await importOriginal()),
  printPlan: (S, owner, opts) => { plan.printed.push(opts) },
}))
vi.mock('./lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('./lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))

const BENCH = '0025'
const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const routine = (id, name, n = 1) => ({ id, name, emoji: 'dumbbell', ex: Array.from({ length: n }, () => ({ id: BENCH, sets: 3, reps: 8, weight: 50, mode: 'reps' })) })
const mounted = []
let navigated, how

function install(extra = {}) {
  const st = clone(DEF)
  Object.assign(st, {
    weekStart: 0,
    routines: [routine('push', 'Push A'), routine('pull', 'Pull A'), routine('empty', 'Empty', 0)],
    week: { 0: ['push'], 1: ['pull', 'push'], 4: ['push'] }, dayPlan: {}, active: null, workouts: [], weighIn: false, bodyweight: [],
  }, extra)
  useStore.setState({ S: st, user: null })
}
function mountTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const title = host => host.querySelector('.g-bs-head h2').textContent
const items = host => [...host.querySelectorAll('.g-menuitem-body')].map(b => [b.querySelector('b').textContent, b.querySelector('span')?.textContent ?? null])
const tap = (host, text) => {
  const target = [...host.querySelectorAll('button')].find(b => b.querySelector('b')?.textContent === text || b.textContent.trim() === text)
  expect(target, text).toBeTruthy()
  act(() => { target.click() })
}
const openMenu = (id = 'push', opts) => { routineMenuSheet(id, opts); return mountTop() }
const undo = () => act(() => useUI.getState().runToastAction())

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  navigated = null; how = undefined
  plan.printed = []
  setNav((to, opts) => { navigated = to; how = opts })
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  document.body.innerHTML = ''
  install()
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('T5.8 the routine menu', () => {
  it('is a DS drawer titled with the routine, with every row the board draws plus Routine settings', () => {
    const host = openMenu()
    expect(useUI.getState().sheets.at(-1).variant).toBe('ds')
    expect(title(host)).toBe('Push A')
    expect(items(host)).toEqual([
      ['Start Push A', null],
      ['Plan days', 'Sun, Mon, Thu'],
      ['Duplicate', 'Makes “Push A (Copy)”'],
      ['Share routine', 'As a plan file, or on paper'],
      ['Routine settings', 'Icon, progression and deload'],
      ['Delete routine', 'Comes back with Undo for 8 s'],
    ])
    expect(host.querySelector('.g-menuitem-danger .g-menuitem-body b').textContent).toBe('Delete routine')
  })

  it('Plan days says when the routine is on no weekday', () => {
    expect(items(openMenu('empty'))[1]).toEqual(['Plan days', 'Not in your Plan'])
  })

  it('Start starts it; an empty routine opens its editor; a running workout is gone back to', () => {
    tap(openMenu(), 'Start Push A')
    expect(S().active).toBeTruthy()
    expect(S().active.entries.length).toBe(1)

    install()
    tap(openMenu('empty'), 'Start Empty')
    expect(S().active).toBeFalsy()
    expect(navigated).toBe('/train/routines/empty')

    install({ active: { start: Date.now(), entries: [] } })
    tap(openMenu(), 'Start Push A')
    expect(navigated).toBe('/train/workout')
  })

  it('Duplicate makes the copy the line names, right below, and opens it', () => {
    tap(openMenu(), 'Duplicate')
    const copy = S().routines[1]
    expect(copy.name).toBe('Push A (Copy)')
    expect(navigated).toBe('/train/routines/' + copy.id)
    expect(useUI.getState().toastMsg).toBe('Copied as “Push A (Copy)”.')
  })

  it('Delete routine closes the menu, deletes after its entry is gone and leaves the leaving to the editor; Undo puts it back', () => {
    const before = clone(S())
    // The menu writes no address itself: the editor, on seeing its routine gone, steps back off its
    // page (use-routine-editor; RoutineEditor.delete-history.test.jsx has the real history). Deleted
    // while the menu's entry was still open, that step collided with the close (root cause A,
    // docs/audits/gains-train-review.md #2).
    tap(openMenu(), 'Delete routine')
    expect(navigated).toBeNull()
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(S().routines.map(r => r.id)).toEqual(['pull', 'empty'])
    expect(S().week).toEqual({ 1: ['pull'] })
    expect(useUI.getState().toastMsg).toBe('Deleted Push A. Sun and Thu are now rest days')
    undo()
    expect(S().routines).toEqual(before.routines)
    expect(S().week).toEqual(before.week)
  })
})

describe('T5.8 Plan days', () => {
  it('seven weekdays in the week’s order, ticked where the routine is; Save puts it on exactly those, with Undo', () => {
    tap(openMenu(), 'Plan days')
    const host = mountTop()
    expect(title(host)).toBe('Plan days')
    const boxes = [...host.querySelectorAll('[role="checkbox"]')]
    expect(boxes.map(b => b.querySelector('b').textContent)).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
    expect(boxes.map(b => b.getAttribute('aria-checked'))).toEqual(['true', 'true', 'false', 'false', 'true', 'false', 'false'])
    // Monday is combined with Pull A, and says so
    expect(boxes[1].textContent).toContain('Also Pull A')
    act(() => { boxes[0].click() })
    act(() => { boxes[5].click() })
    expect(S().week[0]).toEqual(['push'])          // nothing is written before Save
    tap(host, 'Save')
    expect(S().week).toEqual({ 1: ['pull', 'push'], 4: ['push'], 5: ['push'] })
    // The list is the locale's own ("Mon, Thu, and Fri" in en-US, without the last comma in en-GB).
    expect(useUI.getState().toastMsg).toMatch(/^Push A is on Mon, Thu,? and Fri$/)
    undo()
    expect(S().week).toEqual({ 0: ['push'], 1: ['pull', 'push'], 4: ['push'] })
  })

  it('unticking every day takes it off the week and keeps the other routine on a combined day', () => {
    tap(openMenu(), 'Plan days')
    const host = mountTop()
    for (const box of host.querySelectorAll('[aria-checked="true"]')) act(() => { box.click() })
    tap(host, 'Save')
    expect(S().week).toEqual({ 1: ['pull'] })
  })
})

describe('T5.8 Share routine', () => {
  it('offers the plan file and the printout; the file holds only this routine', async () => {
    const saved = []
    const create = vi.fn(blob => { saved.push(blob); return 'blob:x' })
    const revoke = vi.fn()
    const own = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }
    URL.createObjectURL = create; URL.revokeObjectURL = revoke
    try {
      tap(openMenu(), 'Share routine')
      const host = mountTop()
      expect(title(host)).toBe('Share routine')
      expect(items(host).map(i => i[0])).toEqual(['As a plan file', 'Print / Save as PDF'])
      await act(async () => { tap(host, 'As a plan file') })
      expect(saved).toHaveLength(1)
      const bundle = JSON.parse(await saved[0].text())
      expect(bundle.routines.map(r => r.name)).toEqual(['Push A'])
      expect(bundle.name).toBe('Push A')
      expect(useUI.getState().toastMsg).toBe('Plan file saved. Send it to a friend!')
    } finally {
      URL.createObjectURL = own.create; URL.revokeObjectURL = own.revoke
    }
    tap(openMenu(), 'Share routine')
    tap(mountTop(), 'Print / Save as PDF')
    expect(plan.printed).toEqual([{ routineId: 'push' }])
  })

  it('an empty routine has nothing to share', () => {
    tap(openMenu('empty'), 'Share routine')
    const host = mountTop()
    expect(host.textContent).toContain('Add an exercise first. An empty routine has nothing to share.')
    expect([...host.querySelectorAll('.g-menuitem')].every(b => b.disabled)).toBe(true)
  })
})

describe('T5.8 Routine settings', () => {
  it('holds the icon, the Deload switch and the progression, each written at once', () => {
    tap(openMenu(), 'Routine settings')
    const host = mountTop()
    expect(title(host)).toBe('Routine settings')
    expect(host.textContent).toContain('Icon')
    const sw = host.querySelector('[role="switch"]')
    expect(sw.getAttribute('aria-label')).toBe('Deload routine')
    act(() => { sw.click() })
    expect(S().routines[0].excludeFromProgression).toBe(true)
    act(() => { sw.click() })
    expect('excludeFromProgression' in S().routines[0]).toBe(false)
    const radios = [...host.querySelectorAll('[role="radio"]')]
    expect(radios.length).toBeGreaterThan(1)
    expect(radios.filter(r => r.getAttribute('aria-checked') === 'true')).toHaveLength(1)
    const other = radios.find(r => r.getAttribute('aria-checked') === 'false')
    act(() => { other.click() })
    expect(S().routines[0].prog).toBeTruthy()
    expect(S().routines[0].prog).not.toBe('linear')
  })
})
