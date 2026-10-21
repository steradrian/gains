// @vitest-environment happy-dom
// Train on the stage (PR-02, boards Tr2Train to Tr2Future): the header, the day rail with its own
// selection, the missed-day banner with Move and Skip and their Undo, the rings, the four actions,
// the selected day's card in each state, Routines (the first three, ▶ to start, See all,
// Freestyle) and Your training; with training not set up, the invitation. Every tap runs the flow
// the rest of the app runs.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { dateLocale } from '../lib/i18n.js'
import { fmtDate, isoOf, todayISO } from '../lib/format.js'
import { dayOptionsSheet, dayOverrideSheet, logPastWorkoutSheet, menuSheet, starterPlanSheet, startChooserSheet, startFlow, workoutDetailSheet } from '../sheets.jsx'
import { addRoutine } from './Plan.jsx'
import TrainHub from './TrainHub.jsx'

const nav = vi.fn()
const coach = vi.hoisted(() => ({ on: false }))
vi.mock('react-router-dom', () => ({ useNavigate: () => nav, useLocation: () => ({ pathname: '/train' }) }))
vi.mock('../lib/coach.js', () => ({ coachAvailable: () => coach.on }))
vi.mock('./Plan.jsx', () => ({ addRoutine: vi.fn() }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), dayOverrideSheet: vi.fn(), dayOptionsSheet: vi.fn(), startChooserSheet: vi.fn(), dayNoteSheet: vi.fn(), menuSheet: vi.fn(), startFlow: vi.fn(),
  workoutDetailSheet: vi.fn(), logPastWorkoutSheet: vi.fn(), importPlanFile: vi.fn(),
}))

const r = (id, name, n = 2) => ({ id, name, emoji: null, ex: Array.from({ length: n }, () => ({ id: '0025' })) })
const routines = [r('r1', 'Push'), r('r2', 'Pull'), r('r3', 'Legs'), r('r4', 'Arms')]
const TODAY = todayISO()
const shift = n => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d) }
const dow = iso => new Date(iso + 'T12:00:00').getDay()
const wd = dow(TODAY)
const yesterday = shift(-1)
const tomorrow = shift(1)

let host, root, toast
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  coach.on = false
  toast = vi.fn()
  useUI.setState({ toast })
  useDiarySelection.getState().reset()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const setS = (over = {}) => useStore.setState(s => ({
  S: { ...s.S, routines, dayPlan: {}, missedSeen: {}, dayNotes: {}, workouts: [], active: null, queue: null, rotation: null, scheduleMode: null, checkIn: false, week: { [wd]: ['r1'] }, ...over },
  user: null,
}))
const mount = () => act(() => root.render(<TrainHub />))
const tap = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
const $ = sel => host.querySelector(sel)
const $$ = sel => [...host.querySelectorAll(sel)]
const longDay = iso => new Date(iso + 'T12:00:00').toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
// A day's cell by its name: "Monday, 19 October, Planned", or the bare date before the first workout.
const cell = iso => $$('.g-rd').find(b => {
  const label = b.getAttribute('aria-label')
  return label === longDay(iso) || label.startsWith(longDay(iso) + ',')
})
const card = () => ({
  eyebrow: $('.g-tcard-tags').textContent,
  title: $('.g-tcard-head b').textContent,
  meta: $('.g-tcard-head span')?.textContent ?? null,
  buttons: $$('.g-tcard-btn').map(b => b.textContent),
})
const cardButton = label => $$('.g-tcard-btn').find(b => b.textContent === label)
const action = label => $$('.g-gact').find(b => b.textContent === label)
const section = title => $$('.g-ssec').find(s => s.querySelector('h2').textContent === title)
const tiles = () => $$('.g-rtile')
const row = title => $$('.g-glist-row').find(x => x.querySelector('b').textContent === title)
const at = (iso, h, extra = {}) => {
  const start = new Date(iso + `T${String(h).padStart(2, '0')}:00:00`).getTime()
  return { id: 'w' + iso + h, d: iso, start, end: start + 3600000, routineIds: ['r1'], routineId: 'r1', name: 'Push', entries: [{ id: '0025', sets: [{ w: 50, r: 5, done: true }] }], ...extra }
}

describe('Train — the screen', () => {
  it('top to bottom: header, rail, rings, the four actions, the card, Routines, Your training; no DayNav', () => {
    setS(); mount()
    expect($('.g-root.g-screen .train')).toBeTruthy()
    expect($('.g-shdr')).toBeTruthy()
    expect($('.g-shdr-pin .g-spill input').getAttribute('placeholder')).toBe('Search training')
    expect($$('h1').map(h => h.textContent)).toEqual(['Training'])
    expect($$('.g-rail-page')[0].querySelectorAll('.g-rd')).toHaveLength(7)
    expect($('.g-rcb')).toBeTruthy()
    expect($$('.g-gact').map(b => b.textContent)).toEqual(['Start', 'Plan', 'Routines', 'Exercises'])
    expect($('.g-tcard')).toBeTruthy()
    expect($$('.g-ssec h2').map(h => h.textContent)).toEqual(['Routines', 'Your training'])
    expect($('.month-bar, .wk-d, .hero')).toBeNull()
    expect($('h1.sr-only').textContent).toBe('Training')
  })

  it('the header: the avatar opens Me, the bell notifications', () => {
    setS(); mount()
    tap($('.g-shdr .g-sbtn:not(.g-bell)'))
    expect(nav).toHaveBeenCalledWith('/me')
    tap($('.g-bell'))
    expect(nav).toHaveBeenCalledWith('/me/notifications')
  })

  it('the rail marks today and a planned day, and Plan opens the schedule', () => {
    setS({ week: { [wd]: ['r1'], [dow(tomorrow)]: ['r2'] } }); mount()
    expect(cell(TODAY).classList.contains('now')).toBe(true)
    expect(cell(TODAY).getAttribute('aria-pressed')).toBe('true')
    expect(cell(tomorrow).querySelector('.g-rd-planned')).toBeTruthy()
    expect(cell(tomorrow).textContent).toContain('Pull')
    tap($('.g-rail-act'))
    expect(nav).toHaveBeenCalledWith('/train/schedule')
  })

  it('the rings open Training load, the streak the Plan', () => {
    setS(); mount()
    const [workouts, , streak] = $$('.g-rc-slide')
    tap(workouts)
    expect(nav).toHaveBeenLastCalledWith('/progress/load')
    tap(streak)
    expect(nav).toHaveBeenLastCalledWith('/train/schedule')
  })
})

describe('Train — the card and Start', () => {
  it('planned: the routine and its size; Start Push starts it, and so does the Start action', () => {
    setS(); mount()
    expect(card()).toMatchObject({ eyebrow: 'Today · planned', title: 'Push', buttons: ['Start Push'] })
    expect(card().meta).toContain('2 exercises')
    tap(cardButton('Start Push'))
    expect(startFlow).toHaveBeenCalledWith(['r1'])
    tap(action('Start'))
    expect(startFlow).toHaveBeenCalledTimes(2)
  })

  it('the ⋯ opens the day\'s options for today, and starts nothing', () => {
    setS(); mount()
    tap($('.g-tcard-menu'))
    expect(dayOptionsSheet).toHaveBeenCalledWith(TODAY)
    expect(dayOverrideSheet).not.toHaveBeenCalled()
    expect(startFlow).not.toHaveBeenCalled()
  })

  it('the ⋯ comes after the heading in reading order', () => {
    setS(); mount()
    expect($('.g-tcard-head b').compareDocumentPosition($('.g-tcard-menu')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('done: the session; See workout opens it, and Start opens the Start a workout drawer for another', () => {
    const w = at(TODAY, 0, { prs: ['0025'] })
    setS({ workouts: [w] }); mount()
    expect(card()).toMatchObject({ eyebrow: 'Workout done', title: 'Push', buttons: ['See workout'] })
    expect(card().meta).toMatch(/^1h 0m · 1 set · 250 kg · 1 new best$/)
    tap(cardButton('See workout'))
    expect(workoutDetailSheet).toHaveBeenCalledWith(w)
    tap(action('Start'))
    expect(startChooserSheet).toHaveBeenCalledTimes(1)
    expect(nav).not.toHaveBeenCalled()
  })

  it('rest: Recover; Train anyway and Start open the Start a workout drawer', () => {
    setS({ week: {} }); mount()
    expect(card()).toMatchObject({ eyebrow: 'Rest day', title: 'Recover' })
    tap(cardButton('Train anyway'))
    tap(action('Start'))
    expect(startChooserSheet).toHaveBeenCalledTimes(2)
    expect(nav).not.toHaveBeenCalled()
    expect(startFlow).not.toHaveBeenCalled()
  })

  it('rest: the next session names every routine, and See that day selects it', () => {
    setS({ week: { [dow(tomorrow)]: ['r1', 'r2'] } }); mount()
    expect(card().meta).toBe('Next: Push + Pull, ' + fmtDate(tomorrow, true))
    const see = $$('.g-tcard-btn').find(b => b.textContent.startsWith('See '))
    tap(see)
    expect(cell(tomorrow).getAttribute('aria-pressed')).toBe('true')
    expect(card().title).toBe('Push + Pull')
  })

  it('running: the session with its clock and progress; Resume goes back to it', () => {
    setS({ active: { id: 'a', name: 'Push', start: Date.now(), cur: 0, entries: [{ id: '0025', sets: [{ w: 50, r: 5, done: true }] }, { id: '0025', sets: [{ w: 50, r: 5, done: false }] }] } }); mount()
    expect(card().eyebrow).toMatch(/^In progress · \d+:\d{2}$/)
    expect(card().meta).toMatch(/^1 of 2 exercises/)
    expect($('.g-tcard-bar')).toBeTruthy()
    tap(cardButton('Resume'))
    expect(nav).toHaveBeenCalledWith('/train/workout')
    tap(action('Start'))
    expect(nav).toHaveBeenCalledTimes(2)
    expect(startFlow).not.toHaveBeenCalled()
  })

  it('an open editor on a saved workout reads as an edit, with Resume', () => {
    setS({ active: { id: 'w', name: 'Push', start: 1000, cur: 0, entries: [], editingWorkoutId: 'w' } }); mount()
    expect(card()).toMatchObject({ eyebrow: 'Editing a saved workout', title: 'Push', buttons: ['Resume'] })
  })

  it('a coach week\'s session is today\'s: Start starts it', () => {
    setS({ week: {}, queue: { ids: ['r2'], since: Date.now() - 86400000, startsOn: TODAY, label: 'US W1' } }); mount()
    expect(card().title).toBe('Pull')
    tap(action('Start'))
    expect(startFlow).toHaveBeenCalledWith(['r2'])
  })
})

describe('Train — other days in the rail', () => {
  it('a past planned day: what was planned, and Log this workout with its plan; the shared date stays', () => {
    setS({ week: { [dow(yesterday)]: ['r1'] } }); mount()
    tap(cell(yesterday))
    expect(card()).toEqual({ eyebrow: fmtDate(yesterday, true), title: 'Push', meta: 'Planned, not logged', buttons: ['Log this workout'] })
    tap(cardButton('Log this workout'))
    expect(logPastWorkoutSheet).toHaveBeenCalledWith({ iso: yesterday, routineIds: ['r1'] })
    expect(useDiarySelection.getState().day()).toBe(TODAY)
  })

  it('a past rest day: Log workout for that day', () => {
    setS({ week: {} }); mount()
    tap(cell(yesterday))
    expect(card().title).toBe('Rest day')
    tap(cardButton('Log workout'))
    expect(logPastWorkoutSheet).toHaveBeenCalledWith({ iso: yesterday })
  })

  it('a past logged day opens its workout; with two, a list where an unnamed one still has a label', () => {
    const a = at(yesterday, 8, { name: '' })
    const b = at(yesterday, 18, { name: 'Pull' })
    setS({ workouts: [a], week: {} }); mount()
    tap(cell(yesterday))
    tap(cardButton('See workout'))
    expect(workoutDetailSheet).toHaveBeenCalledWith(a)
    act(() => root.unmount()); root = createRoot(host)
    setS({ workouts: [a, b], week: {} }); mount()
    tap(cell(yesterday))
    tap(cardButton('See workouts'))
    expect(menuSheet.mock.calls.at(-1)[0].items.map(i => i.label)).toEqual(['Workout', 'Pull'])
  })

  it('a planned day to come is read-only: Change this day and See routine, no Start; the shared date stays', () => {
    setS({ week: { [wd]: ['r1'], [dow(tomorrow)]: ['r2'] } }); mount()
    tap(cell(tomorrow))
    expect(card()).toMatchObject({ eyebrow: fmtDate(tomorrow, true) + ' · planned', title: 'Pull', buttons: ['Change this day', 'See routine'] })
    tap(cardButton('Change this day'))
    expect(dayOverrideSheet).toHaveBeenCalledWith(tomorrow)
    tap(cardButton('See routine'))
    expect(nav).toHaveBeenCalledWith('/train/routines/r2')
    expect(useDiarySelection.getState().day()).toBe(TODAY)
    tap(cell(TODAY))
    expect(card().title).toBe('Push')
  })

  it('a later week: the rail pages with ›, and a day there lists its exercises with Edit routine', () => {
    setS({ week: { [wd]: ['r1'] } }); mount()
    tap($$('.g-rail-btn').at(-1))
    expect($('.g-rail-title').textContent).toBe('Next week')
    tap(cell(shift(7)))
    expect(card().eyebrow).toBe(fmtDate(shift(7), true) + 'Planned')
    expect($$('.g-tcard-rows .g-xrow')).toHaveLength(2)
    expect(card().buttons).toEqual(['Change this day', 'Edit routine'])
  })
})

describe('Train — the missed day (T2.8, T2.12, T2.13)', () => {
  // Pull was planned yesterday and not logged; a workout three days ago starts the record.
  const missed = () => setS({ week: { [wd]: ['r1'], [dow(yesterday)]: ['r2'] }, workouts: [at(shift(-3), 9)] })
  const banner = () => $('.train-banner .g-ibanner')
  const bannerButton = label => [...banner().querySelectorAll('.g-ibanner-btn')].find(b => b.textContent === label)

  it('the banner names the day above the rings; Move to today plans it today, with Undo in the toast', () => {
    missed(); mount()
    expect(banner().textContent).toContain('You missed Pull on ' + fmtDate(yesterday, true))
    expect(banner().compareDocumentPosition($('.g-rcb')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    tap(bannerButton('Move to today'))
    expect(useStore.getState().S.dayPlan[TODAY]).toBe('r2')
    expect(toast).toHaveBeenCalledTimes(1)
    const [text, opts] = toast.mock.calls[0]
    expect(text).toMatch(/^Moved Pull to today/)
    expect(opts.action).toBe('Undo')
    expect(banner()).toBeNull()
    expect(card().title).toBe('Pull')
    act(() => opts.onAction())
    expect(useStore.getState().S.dayPlan[TODAY]).toBeUndefined()
    expect(card().title).toBe('Push')
  })

  it('Skip it marks the day seen without moving anything, with Undo in the toast', () => {
    missed(); mount()
    tap(bannerButton('Skip it'))
    expect(useStore.getState().S.missedSeen[yesterday]).toMatchObject({ seen: true })
    expect(useStore.getState().S.dayPlan).toEqual({})
    const [text, opts] = toast.mock.calls[0]
    expect(text).toBe(`Skipped Pull on ${fmtDate(yesterday, true)}. Push stays today`)
    expect(banner()).toBeNull()
    act(() => opts.onAction())
    expect(banner()).toBeTruthy()
  })
})

describe('Train — Routines', () => {
  it('the first three, each opening its editor and starting from ▶; then Freestyle; See all opens Routines', () => {
    setS(); mount()
    expect(tiles().map(x => x.querySelector('b').textContent)).toEqual(['Push', 'Pull', 'Legs', 'Freestyle'])
    tap(tiles()[1].querySelector('.g-rtile-open'))
    expect(nav).toHaveBeenCalledWith('/train/routines/r2')
    const play = tiles()[1].querySelector('.g-rtile-play')
    expect(play.getAttribute('aria-label')).toBe('Start Pull')
    tap(play)
    expect(startFlow).toHaveBeenCalledWith(['r2'])
    tap(tiles()[3].querySelector('.g-rtile-open'))
    expect(startFlow).toHaveBeenLastCalledWith([])
    tap(section('Routines').querySelector('.g-ssec-act'))
    expect(nav).toHaveBeenCalledWith('/train/routines')
  })

  it('the Plan\'s routines come first, a rotation\'s or a coach week\'s too', () => {
    setS({ week: { [wd]: ['r3'] } }); mount()
    expect(tiles()[0].querySelector('b').textContent).toBe('Legs')
    act(() => root.unmount()); root = createRoot(host)
    setS({ week: {}, scheduleMode: 'rotation', rotation: { id: 'rot', sequence: ['r2'] } }); mount()
    expect(tiles()[0].querySelector('b').textContent).toBe('Pull')
    act(() => root.unmount()); root = createRoot(host)
    setS({ week: {}, queue: { ids: ['r4'], since: Date.now() - 86400000, startsOn: TODAY, label: 'US W1' } }); mount()
    expect(tiles()[0].querySelector('b').textContent).toBe('Arms')
  })

  it('▶ on a routine with no exercises opens it to add some instead of starting an empty session', () => {
    setS({ routines: [r('e1', 'Empty', 0), ...routines], week: { [wd]: ['e1'] } }); mount()
    const play = tiles()[0].querySelector('.g-rtile-play')
    expect(play.getAttribute('aria-label')).toBe('Add exercise, Empty')
    tap(play)
    expect(startFlow).not.toHaveBeenCalled()
    expect(nav).toHaveBeenCalledWith('/train/routines/e1')
  })

  it('with a session in progress, ▶ goes back to it instead of starting another', () => {
    setS({ active: { id: 'a', name: 'Push', start: Date.now(), cur: 0, entries: [] } }); mount()
    tap(tiles()[0].querySelector('.g-rtile-play'))
    expect(startFlow).not.toHaveBeenCalled()
    expect(nav).toHaveBeenCalledWith('/train/workout')
  })
})

describe('Train — Your training', () => {
  it('Muscles this week opens Training load, and says what is not trained yet', () => {
    setS(); mount()
    const muscles = $('.g-mcard')
    expect(muscles.textContent).toContain('Muscles this week')
    expect(muscles.textContent).toContain('Nothing trained yet this week')
    tap(muscles)
    expect(nav).toHaveBeenCalledWith('/progress/load')
  })

  it('History, Training load, Ready-made plans and Gym setup; Check in with Coach off and check-in on', () => {
    setS({ checkIn: true }); mount()
    expect($$('.g-glist-row b').map(b => b.textContent)).toEqual(['History', 'Training load', 'Ready-made plans', 'Gym setup', 'Check in'])
    tap(row('History'))
    expect(nav).toHaveBeenCalledWith('/train/history')
    tap(row('Training load'))
    expect(nav).toHaveBeenCalledWith('/progress/load')
    tap(row('Ready-made plans'))
    expect(starterPlanSheet).toHaveBeenCalled()
    tap(row('Gym setup'))
    expect(nav).toHaveBeenCalledWith('/me/equipment')
    tap(row('Check in'))
    expect(nav).toHaveBeenCalledWith('/train/checkin')
  })

  it('Coach on: its row, and no Check in', () => {
    coach.on = true
    setS({ checkIn: true }); mount()
    tap(row('Coach'))
    expect(nav).toHaveBeenCalledWith('/train/coach')
    expect(row('Check in')).toBeUndefined()
  })

  it('the Exercises and Routines actions open their pages', () => {
    setS(); mount()
    tap(action('Exercises'))
    expect(nav).toHaveBeenCalledWith('/train/exercises')
    tap(action('Routines'))
    expect(nav).toHaveBeenCalledWith('/train/routines')
  })
})

describe('Train — not set up (T2.9)', () => {
  it('no routines, plan or workouts: the invitation instead of the rail, with its three ways in', () => {
    setS({ routines: [], week: {} }); mount()
    expect($('.g-rail, .g-rcb, .g-tcard')).toBeNull()
    expect($('.g-sempty b').textContent).toBe('Add training')
    const button = label => $$('.g-sempty-btn').find(b => b.textContent === label)
    tap(button('Pick a ready-made plan'))
    expect(starterPlanSheet).toHaveBeenCalled()
    tap(button('Create a routine'))
    expect(addRoutine).toHaveBeenCalled()
    const input = $('input[type="file"]')
    const click = vi.spyOn(input, 'click')
    tap(button('Import a plan file'))
    expect(click).toHaveBeenCalled()
  })

  it('with workouts but no routines, Train is on: Freestyle is still there', () => {
    setS({ routines: [], week: {}, workouts: [at(shift(-2), 9)] }); mount()
    expect(tiles().map(x => x.querySelector('b').textContent)).toEqual(['Freestyle'])
  })
})
