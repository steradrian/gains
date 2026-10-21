// @vitest-environment happy-dom
// Today's Up next in each training state (board T10Today, PR01 variants): planned (play), done
// (trophy), rest (Recover, the next session), running (Resume), an open edit, no plan; and the
// training profile's ring and week. Then Training's hero and its action row's first slot, on the
// day every tab shares (ux-redesign-tabs §1.1): planned (Start), done (Workout), rest (Workout),
// running (Resume), an open edit (Edit), a past day (Log workout); and the hero's ⋯ with "Choose a
// different workout" — the way to the Start screen when a plan already owns today, since Start goes
// straight into it — and "Change this day". Last, the plan welcome.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { useDiarySelection, useDiaryTarget } from '../lib/nutrition/selection.js'
import { fmtDate, isoOf, todayISO } from '../lib/format.js'
import { dayOverrideSheet, logPastWorkoutSheet, menuSheet, startFlow, workoutDetailSheet } from '../sheets.jsx'
import PlanWelcome from '../components/PlanWelcome.jsx'
import TrainingHero from '../components/TrainingHero.jsx'
import TrainingSlot from '../components/TrainingSlot.jsx'
import Home from './Home.jsx'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav, useLocation: () => ({ pathname: '/home' }) }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(), menuSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(),
  workoutDetailSheet: vi.fn(), logPastWorkoutSheet: vi.fn(),
}))

const routines = [{ id: 'r1', name: 'Push', emoji: null, ex: [{ id: '0025' }, { id: '0047' }] }]
const TODAY = todayISO()
const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return isoOf(d) })()
const EVERY_DAY = { 0: ['r1'], 1: ['r1'], 2: ['r1'], 3: ['r1'], 4: ['r1'], 5: ['r1'], 6: ['r1'] }

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  useDiarySelection.getState().reset()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

// The weigh-in is off, so Start's own weigh-in sheet (and its way to the Start screen) never opens.
const setS = (over = {}) => useStore.setState(s => ({
  S: { ...s.S, routines, dayPlan: {}, workouts: [], active: null, weighIn: false, queue: null, scheduleMode: null, week: EVERY_DAY, ...over },
  user: null,
}))
function TrainingDay() {
  const { date } = useDiaryTarget(null)
  return <><TrainingHero date={date} /><TrainingSlot date={date} /></>
}
const mount = () => act(() => root.render(<TrainingDay />))
const mountToday = () => act(() => root.render(<Home />))
const upNext = () => [...host.querySelectorAll('.g-grow-body > *')].map(e => e.textContent)
const row = () => host.querySelector('.g-grow')
const hero = () => ({
  eyebrow: host.querySelector('.hero-e')?.textContent ?? null,
  title: host.querySelector('.hero-t').textContent,
  caption: host.querySelector('.hero-c')?.textContent ?? null,
})
const first = () => host.querySelector('.act-b')
const tap = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
// The ⋯ menu's items, as menuSheet was handed them.
const menu = () => {
  tap(host.querySelector('.hero-more'))
  return menuSheet.mock.calls.at(-1)[0].items.filter(Boolean)
}

describe('Today — Up next', () => {
  it('a planned day: training today, the routine and its exercises; the play starts it', () => {
    setS(); mountToday()
    expect(upNext()).toEqual(['Training today', 'Push', '2 exercises'])
    expect(row().querySelector('.g-trail-solid')).toBeTruthy()
    tap(row())
    expect(startFlow).toHaveBeenCalledWith(['r1'])
  })

  it('a day changed in the plan says so', () => {
    setS({ week: {}, dayPlan: { [TODAY]: 'r1' } }); mountToday()
    expect(upNext()[2]).toBe('2 exercises · rescheduled')
  })

  it('a rest day: recover, and the next session; it opens the plan', () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    setS({ week: { [tomorrow.getDay()]: ['r1'] } }); mountToday()
    expect(upNext()[0]).toBe('Rest day')
    expect(upNext()[1]).toBe('Recover')
    expect(upNext()[2]).toMatch(/^Next: Push, \w+$/)
    tap(row())
    expect(nav).toHaveBeenCalledWith('/train/schedule')
    expect(startFlow).not.toHaveBeenCalled()
  })

  it('a rest day before a session tomorrow says tomorrow (T1.13)', () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    setS({ week: { [tomorrow.getDay()]: ['r1'] } }); mountToday()
    expect(upNext()[2]).toBe('Next: Push, tomorrow')
  })

  it('done: the session with its time, sets and new bests, opening it (T1.12)', () => {
    const start = Date.now() - 60 * 60000
    const sets = [{ done: true }, { done: true }, { done: false }]
    const w = { id: 'w1', d: TODAY, start, end: start + 52 * 60000, routineIds: ['r1'], routineId: 'r1', name: 'Push', prs: ['a', 'b'], entries: [{ sets }] }
    setS({ workouts: [w] }); mountToday()
    expect(upNext()).toEqual(['Done today', 'Push', '52 min · 2 sets · 2 new bests'])
    tap(row())
    expect(workoutDetailSheet).toHaveBeenCalledWith(w)
  })

  it('running: its clock and the exercises done; Resume goes back to it (T1.11)', () => {
    const entries = [{ sets: [{ done: true }] }, { sets: [{ done: true }, { done: false }] }]
    setS({ active: { id: 'a', name: 'Push', start: Date.now() - 65_000, cur: 0, entries } }); mountToday()
    const [eyebrow, ...rest] = upNext()
    expect(eyebrow).toMatch(/^Workout running · 1:0\d$/)
    expect(rest).toEqual(['Push', '1 of 2 exercises done'])
    expect(row().querySelector('.g-trail-pill').textContent).toBe('Resume')
    tap(row())
    expect(nav).toHaveBeenCalledWith('/train/workout')
  })

  it('a session not on the clock (a backfill) has no time in the eyebrow', () => {
    setS({ active: { id: 'a', name: 'Push', cur: 0, entries: [] } }); mountToday()
    expect(upNext()).toEqual(['Workout running', 'Push'])
  })

  it('an open editor on a saved workout reads as an edit and goes back to it', () => {
    setS({ active: { id: 'w', name: 'Push', start: 1000, cur: 0, entries: [], editingWorkoutId: 'w' } }); mountToday()
    expect(upNext()).toEqual(['Editing a saved workout', 'Push'])
    tap(row())
    expect(nav).toHaveBeenCalledWith('/train/workout')
  })

  it('no plan yet, once something was logged: the way to one in Training', () => {
    setS({ routines: [], week: {}, bodyweight: [{ d: yesterday, w: 80 }] }); mountToday()
    expect(upNext()).toEqual(['No plan yet', 'Choose a plan any time in Train'])
    tap(row())
    expect(nav).toHaveBeenCalledWith('/train')
  })

  it('back after 7+ days without a log: a welcome back, once per return (T1.10)', () => {
    localStorage.removeItem('gains.awaySeen')
    const d = new Date(); d.setDate(d.getDate() - 8)
    setS({ workouts: [{ id: 'w', d: isoOf(d), name: 'Push', entries: [] }], bodyweight: [] }); mountToday()
    const card = () => host.querySelector('.g-away')
    expect(card().textContent).toBe('Welcome back8 days since your last log. Your Plan kept going, so start from today. Nothing to catch up on.Weigh inNot now')
    tap([...card().querySelectorAll('.g-away-btn')][1])
    expect(card()).toBeNull()
    act(() => root.unmount())
    root = createRoot(host)
    mountToday()
    expect(card()).toBeNull()
  })

  it('an unanswered welcome back comes back after a remount, until Weigh in or Not now (T1.10)', () => {
    localStorage.removeItem('gains.awaySeen')
    const d = new Date(); d.setDate(d.getDate() - 8)
    setS({ workouts: [{ id: 'w', d: isoOf(d), name: 'Push', entries: [] }], bodyweight: [] }); mountToday()
    expect(host.querySelector('.g-away')).toBeTruthy()
    act(() => root.unmount())
    root = createRoot(host)
    mountToday()
    expect(host.querySelector('.g-away')).toBeTruthy()
  })

  it('no welcome back within a week of the last log', () => {
    localStorage.removeItem('gains.awaySeen')
    const d = new Date(); d.setDate(d.getDate() - 6)
    setS({ workouts: [{ id: 'w', d: isoOf(d), name: 'Push', entries: [] }], bodyweight: [] }); mountToday()
    expect(host.querySelector('.g-away')).toBeNull()
  })

  it('a first day, nothing logged and no plan: First steps instead of Up next (T1.9)', () => {
    setS({ routines: [], week: {}, bodyweight: [] }); mountToday()
    expect(host.querySelector('.g-grow')).toBeNull()
    expect(host.textContent).toContain('First steps0 of 2')
    const steps = [...host.querySelectorAll('.g-fstep')]
    expect(steps.map(s => s.querySelector('b').textContent)).toEqual(['Plan your training week', 'Weigh in'])
    tap(steps[0].querySelector('.g-fstep-row'))
    expect(nav).toHaveBeenCalledWith('/train/schedule')
  })

  it('the training profile: the week\'s workouts as one ring, today\'s session on its pill, each day marked', () => {
    const now = Date.now()
    setS({ workouts: [{ id: 'w', d: TODAY, start: now - 3600000, end: now, routineIds: ['r1'], routineId: 'r1', name: 'Push', entries: [] }] }); mountToday()
    expect(host.querySelector('.g-rc-slide').getAttribute('aria-label')).toBe('Workouts: This week 1 of 7 workouts. Open details')
    expect([...host.querySelectorAll('.g-ssec')].map(s => s.textContent)).toContain('This week1 of 7 done')
    const cells = [...host.querySelectorAll('.g-wk-cell')]
    expect(cells).toHaveLength(7)
    const todayCell = cells.find(c => c.querySelector('.g-wk-done') && c.getAttribute('aria-label').endsWith('Done'))
    expect(todayCell).toBeTruthy()
  })

  it('the pill names the session planned today', () => {
    setS(); mountToday()
    expect(host.querySelector('.g-rc-pill').textContent).toBe('Push today')
  })
})

describe('Training — the hero and the first action', () => {
  it('a planned day: the routine and its exercises; Start starts it', () => {
    setS(); mount()
    expect(hero()).toEqual({ eyebrow: null, title: 'Push', caption: '2 exercises' })
    expect(first().textContent).toBe('Start')
    tap(first())
    expect(startFlow).toHaveBeenCalledWith(['r1'])
  })

  it('a day changed in the plan says so', () => {
    setS({ week: {}, dayPlan: { [TODAY]: 'r1' } }); mount()
    expect(hero().caption).toBe('2 exercises · rescheduled')
  })

  it('the ⋯ offers a different workout without starting anything, and changing the day', () => {
    setS(); mount()
    const items = menu()
    expect(items.map(i => i.label)).toEqual(['Choose a different workout', 'Change this day'])
    items[0].onClick()
    expect(nav).toHaveBeenCalledWith('/train/workout')
    expect(startFlow).not.toHaveBeenCalled()
    items[1].onClick()
    expect(dayOverrideSheet).toHaveBeenCalledWith(TODAY)
  })

  it('a rest day: when the next session is, and Workout opens the Start screen', () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    setS({ week: { [tomorrow.getDay()]: ['r1'] } }); mount()
    expect(hero().title).toBe('Rest day')
    expect(hero().caption).toMatch(/^Next session: \w+, Push$/)
    expect(first().textContent).toBe('Workout')
    tap(first())
    expect(nav).toHaveBeenCalledWith('/train/workout')
    expect(startFlow).not.toHaveBeenCalled()
  })

  it('a rest day names every routine of the next session', () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const pull = { id: 'r2', name: 'Pull', emoji: null, ex: [{ id: '0025' }] }
    setS({ routines: [...routines, pull], week: { [tomorrow.getDay()]: ['r1', 'r2'] } }); mount()
    expect(hero().caption).toMatch(/^Next session: \w+, Push \+ Pull$/)
  })

  it('the ⋯ comes after the heading in reading order', () => {
    setS(); mount()
    const title = host.querySelector('.hero-t'), more = host.querySelector('.hero-more')
    expect(title.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('done: the session with its time and PRs, the way to it, and Workout for another', () => {
    const start = Date.now() - 60 * 60000
    const w = { id: 'w1', d: TODAY, start, end: start + 52 * 60000, routineIds: ['r1'], routineId: 'r1', name: 'Push', prs: ['a', 'b'], entries: [] }
    setS({ workouts: [w] }); mount()
    expect(hero()).toEqual({ eyebrow: 'Done', title: 'Push', caption: '52 min · 2 PRs' })
    tap(host.querySelector('.hero-l'))
    expect(workoutDetailSheet).toHaveBeenCalledWith(w)
    expect(first().textContent).toBe('Workout')
  })

  it('running: the session and its clock; Resume goes back to it, and the ⋯ has no different workout', () => {
    setS({ active: { id: 'a', name: 'Push', start: Date.now(), cur: 0, entries: [] } }); mount()
    expect(hero().eyebrow).toBe('In progress')
    expect(hero().title).toBe('Push')
    expect(hero().caption).toMatch(/^\d+:\d{2}$/)
    expect(first().textContent).toBe('Resume')
    tap(first())
    expect(nav).toHaveBeenCalledWith('/train/workout')
    expect(menu().map(i => i.label)).toEqual(['Change this day'])
  })

  it('reads an open editor on a saved workout as an edit, not as a session in progress', () => {
    setS({ active: { id: 'w', name: 'Push', start: 1000, cur: 0, entries: [], editingWorkoutId: 'w' } }); mount()
    expect(hero()).toEqual({ eyebrow: null, title: 'Push', caption: 'Editing a saved workout' })
    expect(first().textContent).toBe('Edit')
    tap(first())
    expect(nav).toHaveBeenCalledWith('/train/workout')
  })

  it('a past day planned and not logged: Log workout opens it with that day\'s plan', () => {
    setS(); act(() => useDiarySelection.getState().setDate(yesterday)); mount()
    expect(hero()).toEqual({ eyebrow: fmtDate(yesterday, true), title: 'Push', caption: 'Planned, not logged' })
    expect(first().textContent).toBe('Log workout')
    tap(first())
    expect(logPastWorkoutSheet).toHaveBeenCalledWith({ iso: yesterday, routineIds: ['r1'] })
    menu()[0].onClick()
    expect(dayOverrideSheet).toHaveBeenCalledWith(yesterday)
  })

  it('a past day with workouts: each opens, and Log workout adds another to that day', () => {
    const at = h => new Date(yesterday + `T${h}:00:00`).getTime()
    const a = { id: 'a', d: yesterday, start: at(8), end: at(9), routineIds: ['r1'], name: 'Push', entries: [] }
    const b = { id: 'b', d: yesterday, start: at(18), end: at(19), routineIds: [], name: 'Freestyle', entries: [] }
    setS({ workouts: [a, b] }); act(() => useDiarySelection.getState().setDate(yesterday)); mount()
    expect(hero().title).toBe('2 workouts')
    tap(host.querySelector('.hero-l'))
    const items = menuSheet.mock.calls.at(-1)[0].items
    expect(items.map(i => i.label)).toEqual(['Push', 'Freestyle'])
    items[1].onClick()
    expect(workoutDetailSheet).toHaveBeenCalledWith(b)
    tap(first())
    expect(logPastWorkoutSheet).toHaveBeenCalledWith({ iso: yesterday })
  })

  it('a workout with no name still has a label in the See workouts menu', () => {
    const at = h => new Date(yesterday + `T${h}:00:00`).getTime()
    const a = { id: 'a', d: yesterday, start: at(8), end: at(9), routineIds: [], name: '', entries: [] }
    const b = { id: 'b', d: yesterday, start: at(18), end: at(19), routineIds: [], name: 'Push', entries: [] }
    setS({ workouts: [a, b] }); act(() => useDiarySelection.getState().setDate(yesterday)); mount()
    tap(host.querySelector('.hero-l'))
    expect(menuSheet.mock.calls.at(-1)[0].items.map(i => i.label)).toEqual(['Workout', 'Push'])
  })

  it('a session in progress keeps the first slot on a past day too', () => {
    setS({ active: { id: 'a', name: 'Push', start: Date.now(), cur: 0, entries: [] } })
    act(() => useDiarySelection.getState().setDate(yesterday)); mount()
    expect(first().textContent).toBe('Resume')
  })
})

describe('Plan welcome', () => {
  it('with no routines, welcomes with a starter plan or your own', () => {
    setS({ routines: [], week: {} }); act(() => root.render(<PlanWelcome />))
    expect(host.textContent).toContain('Welcome!')
    const empty = host.querySelector('.empty[data-surface=page]')
    expect(empty.querySelector('.lineart[data-scene=routine]')).not.toBeNull()
    expect(empty.closest('.card')).toBeNull()
    const pill = label => [...host.querySelectorAll('.empty-acts button')].find(b => b.textContent === label)
    expect(pill('Load starter plan')).toBeTruthy()
    tap(pill('Build my own plan'))
    expect(nav).toHaveBeenCalledWith('/train/routines')
  })

  it('Today has no body-weight card, whatever the old preference said', () => {
    setS({ routines: [], week: {} }); mountToday()
    expect([...host.querySelectorAll('h2')].some(el => el.textContent === 'Body weight')).toBe(false)
  })
})
