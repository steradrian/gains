// @vitest-environment happy-dom
// Ready (board W1.1 Wk1Planned) on the workout route: the close, the phase bar, the title and sub,
// each part's heading and rows; Start workout asks the weigh-in, then makes the warm-up offer or
// begins; with no `start` it shows today's plan, else goes to Training with the chooser; a `start`
// that names no routine goes to Training; nothing shows while a finish or discard is leaving.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { setNav } from '../../lib/nav.js'
import { back } from '../../lib/use-tab-nav.js'
import { startChooserSheet } from '../../sheets.jsx'
import { warmupOfferSheet } from './finish-drawers.js'
import ReadyScreen from './ReadyScreen.jsx'

const h = vi.hoisted(() => ({ leaving: false }))
vi.mock('./finish-drawers.js', () => ({
  isLeaving: () => h.leaving, markLeaving: vi.fn(), holdReopen: vi.fn(), takeReopen: vi.fn(() => null),
  warmupOfferSheet: vi.fn(), cooldownOfferSheet: vi.fn(), finishSheet: vi.fn(), discardSheet: vi.fn(), staleWorkoutSheet: vi.fn(),
}))
vi.mock('../../sheets.jsx', async importOriginal => ({ ...(await importOriginal()), startChooserSheet: vi.fn() }))
vi.mock('../../lib/use-tab-nav.js', async importOriginal => ({ ...(await importOriginal()), back: vi.fn() }))

// Sun 18 Oct 2026: Push A on Sundays.
const TODAY = '2026-10-18'
const BENCH = '0025', FLY = '0227', LATERAL = '0334', SITUP = '0001', SQUAT = '0043'
const pushA = {
  id: 'push', name: 'Push A', ex: [
    { id: SITUP, sets: 2, reps: 15, part: 'warmup' },
    { id: BENCH, sets: 3, reps: 8, weight: 80 },
    { id: FLY, sets: 3, reps: 12, weight: 17.5 },
    { id: LATERAL, sets: 3, reps: 15, weight: 8 },
    { id: SQUAT, mode: 'time', sets: 2, sec: 30, side: true, part: 'cooldown' },
  ],
}
const legs = { id: 'legs', name: 'Legs', ex: [{ id: SQUAT, sets: 5, reps: 5, weight: 100 }] }
const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const done = (id, d, mins) => ({ id, d, start: Date.parse(d + 'T10:00:00'), end: Date.parse(d + 'T10:00:00') + mins * 60000, routineIds: ['push'], name: 'Push A', entries: [] })

function install(extra = {}) {
  useStore.setState({ S: { ...clone(DEF), routines: [clone(pushA), clone(legs)], week: { 0: ['push'] }, dayPlan: {}, workouts: [], active: null, weighIn: false, bodyweight: [], ...extra }, user: null })
}

let host, root, navs
const mount = (path = '/train/workout?start=push') => {
  act(() => root.render(<MemoryRouter initialEntries={[path]}><ReadyScreen /></MemoryRouter>))
}
const $ = sel => host.querySelector(sel)
const $$ = sel => [...host.querySelectorAll(sel)]
const tap = el => act(() => { el.click() })
const heads = () => $$('.g-ready-gh').map(e => e.textContent)
const rowsOf = i => $$('.g-ready-group')[i].querySelectorAll('.g-xrow')
const startBtn = () => $$('button').find(b => b.textContent === 'Start workout')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(TODAY + 'T12:00:00'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  h.leaving = false
  navs = []
  setNav((to, opts) => { navs.push([to, opts]) })
  useUI.setState({ sheets: [] })
  install()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
})

describe('Ready', () => {
  it('shows the close, the session name, the phase bar, the title, the sub and Start workout', () => {
    mount()
    const close = $('button[aria-label="Close"]')
    expect(close).not.toBeNull()
    expect($('.g-wtop-title').textContent).toBe('Push A')
    expect($('h1').textContent).toBe('Push A')
    expect($('.g-ready-sub').textContent.split(' · ')[0]).toBe('5 exercises')
    const bar = $('.g-pp')
    expect(bar.getAttribute('aria-label')).toBe('All exercises')
    expect([...bar.querySelectorAll('.g-pp-pill')].map(p => [p.title, p.textContent])).toEqual([['Warm-up', '1'], ['Workout', '3'], ['Cool-down', '1']])
    expect(startBtn()).toBeTruthy()
    tap(close)
    expect(back).toHaveBeenCalledTimes(1)
    expect(navs).toEqual([])
  })

  it('lists every part with its count, each exercise with its line, not tappable', () => {
    mount()
    expect(heads()).toEqual(['Warm-up· 1', 'Workout· 3', 'Cool-down· 1'])
    expect(rowsOf(1)).toHaveLength(3)
    expect(rowsOf(1)[0].querySelector('.g-xrow-b > span').textContent).toBe('Barbell · 3 × 8')
    expect(rowsOf(1)[0].tagName).toBe('DIV')
    expect(rowsOf(1)[0].classList.contains('g-xrow-line')).toBe(false)
    expect(rowsOf(1)[1].classList.contains('g-xrow-line')).toBe(true)
    expect($$('.g-ready-group .g-glist.g-glass')).toHaveLength(3)
  })

  it('All exercises moves focus to the list, and opens nothing', () => {
    mount()
    tap($('.g-pp'))
    expect(document.activeElement).toBe($('.g-ready-list'))
    expect(navs).toEqual([])
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('the sub has the usual minutes after finished sessions of the routine, and none without', () => {
    mount()
    expect($('.g-ready-sub').textContent).not.toContain('about')
    act(() => root.unmount()); root = createRoot(host)
    install({ workouts: [done('a', '2026-10-05', 60), done('b', '2026-10-08', 55), done('c', '2026-10-12', 40)] })
    mount()
    expect($('.g-ready-sub').textContent.split(' · ').slice(0, 2)).toEqual(['5 exercises', 'about 55 min'])
  })
})

describe('Ready → Start workout', () => {
  it('weigh-in on and none today: asks it first, nothing starts and no offer yet', () => {
    install({ weighIn: true })
    mount()
    tap(startBtn())
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().sheets[0].locked).toBe(true)
    expect(warmupOfferSheet).not.toHaveBeenCalled()
    expect(S().active).toBeNull()
  })

  it('with warm-ups: the warm-up offer, carrying today\'s weigh-in', () => {
    install({ weighIn: true, bodyweight: [{ d: TODAY, w: 81.4, t: 1 }] })
    mount()
    tap(startBtn())
    expect(warmupOfferSheet).toHaveBeenCalledWith(['push'], 81.4)
    expect(S().active).toBeNull()
  })

  it('without warm-ups: the session begins at once', () => {
    mount('/train/workout?start=legs')
    tap(startBtn())
    expect(warmupOfferSheet).not.toHaveBeenCalled()
    expect(S().active.routineIds).toEqual(['legs'])
    expect(navs.at(-1)[0]).toBe('/train/workout')
  })
})

describe('Ready — the way in without a session to show', () => {
  it('no start: today\'s planned routine', () => {
    mount('/train/workout')
    expect($('h1').textContent).toBe('Push A')
    expect(navs).toEqual([])
    expect(startChooserSheet).not.toHaveBeenCalled()
  })

  it('no start and nothing planned today: Training, with the start chooser, once', () => {
    install({ week: {} })
    mount('/train/workout')
    expect(host.innerHTML).toBe('')
    expect(navs).toEqual([['/train', { replace: true }]])
    expect(startChooserSheet).toHaveBeenCalledTimes(1)
    act(() => useStore.getState().update(s => { s.dayPlan = {} }))
    expect(navs).toHaveLength(1)
    expect(startChooserSheet).toHaveBeenCalledTimes(1)
  })

  it('today\'s plan with no exercises counts as nothing planned', () => {
    install({ routines: [{ id: 'empty', name: 'Arms', ex: [] }], week: { 0: ['empty'] } })
    mount('/train/workout')
    expect(navs).toEqual([['/train', { replace: true }]])
    expect(startChooserSheet).toHaveBeenCalledTimes(1)
  })

  it('a start that names no routine with exercises: Training, without the chooser', () => {
    mount('/train/workout?start=gone')
    expect(host.innerHTML).toBe('')
    expect(navs).toEqual([['/train', { replace: true }]])
    expect(startChooserSheet).not.toHaveBeenCalled()
  })

  it('while a finish or discard is leaving: nothing rendered, nowhere navigated', () => {
    h.leaving = true
    mount('/train/workout')
    expect(host.innerHTML).toBe('')
    act(() => root.unmount()); root = createRoot(host)
    mount('/train/workout?start=gone')
    expect(host.innerHTML).toBe('')
    expect(navs).toEqual([])
    expect(startChooserSheet).not.toHaveBeenCalled()
  })
})
