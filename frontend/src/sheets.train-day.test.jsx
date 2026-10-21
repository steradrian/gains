// @vitest-environment happy-dom
// Train's two drawers (PR02 T2.1 Start a workout, T2.2 Day options): what each row shows and does.
// Starting goes through startFlow, so the weigh-in still asks first; a running workout skips the
// chooser; with no routines the chooser offers ways to get a plan; Rest / skip this day moves the
// session to the next free day and Undo puts the plan back.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { setNav } from './lib/nav.js'
import { fmtDate } from './lib/format.js'
import { dayOptionsSheet, startChooserSheet } from './sheets/train-day.jsx'

const BENCH = '0025'
// Sun 18 Oct 2026. Push on Sundays, Pull on Wednesdays (logged on the 14th), Legs on Fridays (missed on the 16th).
const TODAY = '2026-10-18', WED = '2026-10-14', MON = '2026-10-19', TUE = '2026-10-20', SAT = '2026-10-17'
const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const routine = (id, name) => ({ id, name, emoji: 'dumbbell', ex: [{ id: BENCH, sets: 2, reps: 10, weight: 50, mode: 'reps' }] })
const pulled = {
  id: 'w1', d: WED, start: new Date(WED + 'T10:00:00').getTime(), end: new Date(WED + 'T11:00:00').getTime(),
  name: 'Pull A', routineIds: ['pull'], prs: [],
  entries: [{ id: BENCH, rid: 'pull', target: { mode: 'reps', reps: 8, weight: 40 }, sets: [{ w: 45, r: 8, done: true }] }],
}
const mounted = []
let navigated

function install(extra = {}) {
  const st = clone(DEF)
  Object.assign(st, {
    routines: [routine('push', 'Push A'), routine('pull', 'Pull A'), routine('legs', 'Legs')],
    week: { 0: ['push'], 3: ['pull'], 5: ['legs'] }, dayPlan: {}, dayNotes: {}, missedSeen: {},
    active: null, workouts: [pulled], weighIn: false, bodyweight: [],
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
const rows = host => [...host.querySelectorAll('.g-tr-b')].map(b => [b.querySelector('b').textContent, b.querySelector('span:not(.g-tag)')?.textContent ?? null])
const items = host => [...host.querySelectorAll('.g-menuitem-body')].map(b => [b.querySelector('b').textContent, b.querySelector('span')?.textContent ?? null])
const tap = (host, text) => {
  const target = [...host.querySelectorAll('button')].find(b => b.querySelector('b')?.textContent.startsWith(text) || b.textContent.trim() === text)
  expect(target, text).toBeTruthy()
  act(() => { target.click() })
}
const topSheet = () => useUI.getState().sheets.at(-1)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(TODAY + 'T12:00:00'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  navigated = null
  setNav(to => { navigated = to })
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  document.body.innerHTML = ''
  install()
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  vi.useRealTimers()
})

describe('T2.1 Start a workout', () => {
  it('opens on the DS drawer: today planned first, the others, the missed routine last, then Freestyle and the latest workout', () => {
    startChooserSheet()
    expect(topSheet().variant).toBe('ds')
    const host = mountTop()
    expect(title(host)).toBe('Start a workout')
    expect(host.querySelector('.g-bs-chip').textContent).toBe('Today')
    expect(rows(host).map(r => r[0])).toEqual(['Push APlanned today', 'Pull A', 'LegsMissed Fri', 'Freestyle', 'Repeat a past workout'])
    expect(rows(host)[3][1]).toBe('Pick exercises as you go')
    expect(rows(host)[4][1]).toBe(fmtDate(WED, true) + ' · Pull A')
    expect(host.querySelector('.g-tag-warning').textContent).toBe('Missed Fri')
    expect(host.textContent).toContain('Browse ready-made plans')
  })

  it('a routine starts through startFlow: today\'s plan, any other routine, Freestyle', () => {
    startChooserSheet()
    tap(mountTop(), 'Push A')
    expect(S().active.routineIds).toEqual(['push'])
    expect(navigated).toBe('/train/workout')
    expect(useUI.getState().sheets).toHaveLength(0)

    install()
    startChooserSheet()
    tap(mountTop(), 'Legs')
    expect(S().active.routineIds).toEqual(['legs'])

    install()
    startChooserSheet()
    tap(mountTop(), 'Freestyle')
    expect(S().active.routineIds).toEqual([])
    expect(S().active.name).toBe('Freestyle')
  })

  it('still asks the weigh-in first when it is on, and starts once it is answered', () => {
    install({ weighIn: true })
    startChooserSheet()
    const chooser = topSheet().id
    tap(mountTop(), 'Pull A')
    expect(S().active).toBeNull()
    expect(topSheet().id).not.toBe(chooser)
    expect(topSheet().variant).toBe('ds')
    expect(mountTop().textContent).toContain('Quick check-in')
  })

  it('Repeat a past workout starts the latest workout again, as a new session', () => {
    startChooserSheet()
    tap(mountTop(), 'Repeat a past workout')
    expect(S().active.name).toBe('Pull A')
    expect(S().active.entries.map(e => e.id)).toEqual([BENCH])
    expect(S().workouts).toHaveLength(1)
  })

  it('Browse ready-made plans opens the plans sheet', () => {
    startChooserSheet()
    const chooser = topSheet().id
    tap(mountTop(), 'Browse ready-made plans')
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(topSheet().id).not.toBe(chooser)
  })

  it('with a workout running there is nothing to choose: it goes back to it', () => {
    install({ active: { id: 'a', d: TODAY, start: Date.now(), routineIds: ['push'], entries: [] } })
    startChooserSheet()
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(navigated).toBe('/train/workout')
  })

  it('with no routines it offers T2.9\'s ways to a plan, then Freestyle, and no plans link at the foot', () => {
    install({ routines: [], week: {}, workouts: [] })
    startChooserSheet()
    const host = mountTop()
    expect(rows(host).map(r => r[0])).toEqual(['Pick a ready-made plan', 'Create a routine', 'Import a plan file', 'Freestyle'])
    expect(host.textContent).not.toContain('Browse ready-made plans')
    expect(host.querySelector('input[type="file"]')).toBeTruthy()
    tap(host, 'Create a routine')
    expect(S().routines).toHaveLength(1)
    expect(navigated).toBe('/train/routines/' + S().routines[0].id)
  })

  it('Pick a ready-made plan opens the plans sheet', () => {
    install({ routines: [], week: {}, workouts: [] })
    startChooserSheet()
    const chooser = topSheet().id
    tap(mountTop(), 'Pick a ready-made plan')
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(topSheet().id).not.toBe(chooser)
  })
})

describe('T2.2 Day options', () => {
  it('today: the day and its workout in the title, and the four rows', () => {
    dayOptionsSheet(TODAY)
    expect(topSheet().variant).toBe('ds')
    const host = mountTop()
    expect(title(host)).toBe(fmtDate(TODAY, true) + ' · Push A')
    expect(items(host)).toEqual([
      ['Change this day', 'Pick another routine for ' + fmtDate(TODAY, true)],
      ['Choose a different workout', 'Just for today'],
      ['Rest / skip this day', 'Push A moves to your next free day'],
      ['Add a note for this day', null],
    ])
  })

  it('Change this day opens the day sheet', () => {
    dayOptionsSheet(TODAY)
    tap(mountTop(), 'Change this day')
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(mountTop().textContent).toContain('Weekly plan:')
  })

  it('Choose a different workout opens Start a workout', () => {
    dayOptionsSheet(TODAY)
    tap(mountTop(), 'Choose a different workout')
    expect(title(mountTop())).toBe('Start a workout')
  })

  it('Rest / skip this day rests the day, moves the workout to the next free day, and Undo puts both back', () => {
    install({ dayPlan: { [TODAY]: 'pull' } })
    dayOptionsSheet(TODAY)
    tap(mountTop(), 'Rest / skip this day')
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(S().dayPlan).toEqual({ [TODAY]: 'rest', [MON]: 'pull' })
    expect(useUI.getState().toastMsg).toBe('Pull A moved to ' + fmtDate(MON, true))
    expect(useUI.getState().toastAction.label).toBe('Undo')
    act(() => { useUI.getState().runToastAction() })
    expect(S().dayPlan).toEqual({ [TODAY]: 'pull' })
  })

  it('Rest with no free day ahead only rests the day, says so, and Undo clears it', () => {
    install({ week: { 0: ['push'], 1: ['legs'], 2: ['legs'], 3: ['pull'], 4: ['legs'], 5: ['legs'], 6: ['legs'] } })
    dayOptionsSheet(TODAY)
    const host = mountTop()
    expect(items(host)[2]).toEqual(['Rest / skip this day', 'No workout this day'])
    tap(host, 'Rest / skip this day')
    expect(S().dayPlan).toEqual({ [TODAY]: 'rest' })
    expect(useUI.getState().toastMsg).toBe(fmtDate(TODAY) + ' set to rest')
    act(() => { useUI.getState().runToastAction() })
    expect(S().dayPlan).toEqual({})
  })

  it('with a workout running: no different workout and no rest for today', () => {
    install({ active: { id: 'a', d: TODAY, start: Date.now(), routineIds: ['push'], entries: [] } })
    dayOptionsSheet(TODAY)
    expect(items(mountTop()).map(i => i[0])).toEqual(['Change this day', 'Add a note for this day'])
  })

  it('shows the day\'s note under its row, and the row opens the note', () => {
    install({ dayNotes: { [TODAY]: { tag: 'injured', text: 'Shoulder felt tight', _ts: 1 } } })
    dayOptionsSheet(TODAY)
    const host = mountTop()
    expect(items(host)[3]).toEqual(['Add a note for this day', 'Shoulder felt tight'])
    tap(host, 'Add a note for this day')
    expect(mountTop().querySelector('textarea').value).toBe('Shoulder felt tight')
  })

  it('a later day: only change and rest; a free one has nothing to rest and the title is the date', () => {
    dayOptionsSheet('2026-10-25')
    expect(items(mountTop()).map(i => i[0])).toEqual(['Change this day', 'Rest / skip this day'])
    dayOptionsSheet(TUE)
    const host = mountTop()
    expect(title(host)).toBe(fmtDate(TUE, true))
    expect(items(host).map(i => i[0])).toEqual(['Change this day'])
  })

  it('a past day: change it or note it, never rest it', () => {
    dayOptionsSheet(SAT)
    expect(items(mountTop()).map(i => i[0])).toEqual(['Change this day', 'Add a note for this day'])
    dayOptionsSheet(WED)
    expect(items(mountTop()).map(i => i[0])).toEqual(['Change this day'])
  })
})
