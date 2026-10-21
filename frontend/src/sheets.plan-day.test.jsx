// @vitest-environment happy-dom
// T3.1 Plan day (sheets/plan-day.jsx), opened as dayOverrideSheet(iso) from everywhere.
// Moved here from sheets.dayoverride.test.jsx (the coach week: the header names the plan the day
// would have without its override; the week's remaining sessions come first, picking one pins it,
// one pinned elsewhere shows that day) and sheets.day-assign.test.jsx (the weekday multi-pick, now
// the "Every {weekday}" scope). New: pick then Save, the scope, Rest moving the session with Undo,
// the past form, and the drawer's own URL (usePlanDayParam).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { dayOverrideSheet, usePlanDayParam } from './sheets.jsx'
import { todayISO, isoOf, fmtDate } from './lib/format.js'

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const mounted = []

function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(el))
  return host
}
function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  return mount(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
}
const header = host => host.querySelector('.g-tr3-plan').textContent
const headings = host => [...host.querySelectorAll('.g-tr3-sec')].map(e => e.textContent)
const titles = host => [...host.querySelectorAll('.g-radio-body > b')].map(e => e.textContent)
const rowOf = (host, name) => [...host.querySelectorAll('.g-radio')].find(el => el.querySelector('.g-radio-body > b')?.textContent === name)
const subOf = (host, name) => rowOf(host, name).querySelector('.g-radio-body > span')?.textContent
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const click = el => act(() => { el.click() })
const save = host => click(button(host, 'Save'))
const every = host => click([...host.querySelectorAll('.g-seg button')].find(b => b.textContent.startsWith('Every')))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(r => r.unmount()) }) })

/* ---------------------------------- the coach week (real time) ---------------------------------- */
describe('in a coach week', () => {
  const routines = [
    { id: 'd1', name: 'US W1 D1', emoji: null, ex: [{ id: '0025' }] },
    { id: 'd2', name: 'US W1 D2', emoji: null, ex: [{ id: '0025' }] },
    { id: 'own', name: 'Core', emoji: null, ex: [{ id: '0025' }] },
  ]
  const SINCE = Date.now() - 2 * 86400000
  const daysFromToday = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d) }
  const queue = { ids: ['d1', 'd2'], since: SINCE, startsOn: daysFromToday(-1), label: 'US W1' }
  // A finished workout on `id`, started after the apply: the done rule counts it for this week.
  const logged = id => {
    const start = SINCE + 3600000
    return { id: 'w-' + id, d: isoOf(new Date(start)), start, end: start + 3600000, routineIds: [id], routineId: id, name: routines.find(r => r.id === id).name, entries: [] }
  }
  const setS = (over = {}) => useStore.setState(s => ({ S: { ...s.S, routines, week: {}, dayPlan: {}, workouts: [], active: null, queue, ...over }, user: null }))

  it('the header names the queue session for today, with the weekday’s own routine after it', () => {
    setS()
    dayOverrideSheet(todayISO())
    expect(header(renderTop())).toMatch(/^Weekly plan: US W1 D1/)
    setS({ week: { [new Date().getDay()]: ['own'] } })
    dayOverrideSheet(todayISO())
    expect(header(renderTop())).toMatch(/^Weekly plan: US W1 D1 \+ Core/)
  })

  it('a rest override for today still shows the plan it replaced, marked as changed', () => {
    setS({ dayPlan: { [todayISO()]: 'rest' } })
    dayOverrideSheet(todayISO())
    const h = header(renderTop())
    expect(h).toMatch(/^Weekly plan: US W1 D1/)
    expect(h).toContain('changed for this day')
  })

  it('another day has no queue session: the weekday alone, or Rest', () => {
    const tomorrow = daysFromToday(1)
    setS({ week: { [new Date(tomorrow + 'T12:00:00').getDay()]: ['own'] } })
    dayOverrideSheet(tomorrow)
    expect(header(renderTop())).toMatch(/^Weekly plan: Core/)
    setS()
    dayOverrideSheet(tomorrow)
    expect(header(renderTop())).toMatch(/^Weekly plan: Rest/)
  })

  it('a fulfilled pin, the session pinned here already done, reads as no change; Back to weekly plan stays', () => {
    setS({ dayPlan: { [todayISO()]: 'd1' }, workouts: [logged('d1')] })
    dayOverrideSheet(todayISO())
    const host = renderTop()
    expect(header(host)).toMatch(/^Weekly plan: US W1 D2/)
    expect(header(host)).not.toContain('changed for this day')
    expect(rowOf(host, 'Back to weekly plan')).toBeTruthy()
  })

  it('the pinned day’s own drawer shows what the session works, not its own date again', () => {
    const friday = daysFromToday(2)
    setS({ dayPlan: { [friday]: 'd2' } })
    dayOverrideSheet(friday)
    const host = renderTop()
    expect(subOf(host, 'US W1 D2')).toBe(subOf(host, 'Core'))
    expect(subOf(host, 'US W1 D2')).not.toBe(fmtDate(friday, true))
    // …while from today's drawer the same session wears Friday.
    dayOverrideSheet(todayISO())
    expect(subOf(renderTop(), 'US W1 D2')).toBe(fmtDate(friday, true))
    // A session pinned to today wears today from another day's drawer.
    setS({ dayPlan: { [todayISO()]: 'd2' } })
    dayOverrideSheet(friday)
    expect(subOf(renderTop(), 'US W1 D2')).toBe(fmtDate(todayISO(), true))
  })

  it('lists the remaining sessions first under Coach week, a done session down with your routines', () => {
    setS({ workouts: [logged('d1')] })
    dayOverrideSheet(todayISO())
    const host = renderTop()
    expect(headings(host)).toEqual(['Coach week', 'Routines'])
    expect(titles(host)).toEqual(['US W1 D2', 'US W1 D1', 'Core', 'Rest / skip this day'])
  })

  it('your own loop is headed Your loop, not Coach week', () => {
    setS({ queue: { ...queue, rotationId: 'r1' }, rotation: { id: 'r1', sequence: ['d1', 'd2'], label: 'Rotation' } })
    try {
      dayOverrideSheet(todayISO())
      expect(headings(renderTop())[0]).toBe('Your loop')
    } finally { useStore.setState(s => ({ S: { ...s.S, rotation: null } })) }
  })

  it('picking a coach row and saving pins that session to the day', () => {
    const friday = daysFromToday(2)
    setS()
    dayOverrideSheet(friday)
    const host = renderTop()
    click(rowOf(host, 'US W1 D2'))
    expect(S().dayPlan[friday]).toBeUndefined()   // nothing is written before Save
    expect(rowOf(host, 'US W1 D2').getAttribute('aria-checked')).toBe('true')
    save(host)
    expect(S().dayPlan[friday]).toBe('d2')
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(useUI.getState().toastMsg).toBe(`US W1 D2 planned for ${fmtDate(friday)}`)
  })

  it('a session pinned to another day shows that day instead of what it works', () => {
    const friday = daysFromToday(2)
    setS({ dayPlan: { [friday]: 'd2' } })
    dayOverrideSheet(todayISO())
    const host = renderTop()
    expect(subOf(host, 'US W1 D2')).toBe(fmtDate(friday, true))
    expect(subOf(host, 'US W1 D1')).not.toBe(fmtDate(friday, true))
  })

  it('without a queue there is no heading and one plain list', () => {
    setS({ queue: null })
    dayOverrideSheet(todayISO())
    const host = renderTop()
    expect(headings(host)).toEqual([])
    expect(titles(host)).toEqual(['US W1 D1', 'US W1 D2', 'Core', 'Rest / skip this day'])
  })
})

/* ------------------------------- a fixed week (Wednesday 16 Sep 2026) ------------------------------- */
describe('a fixed week', () => {
  const MON = '2026-09-21', WED = '2026-09-23', THU = '2026-09-24'
  function install(extra = {}) {
    const st = clone(DEF)
    Object.assign(st, {
      routines: [
        { id: 'push', name: 'Push', emoji: null, ex: [{ id: '0025' }] },
        { id: 'core', name: 'Core', emoji: null, ex: [] },
      ],
      week: { 1: ['push'], 3: ['push'] }, dayPlan: {}, dayNotes: {}, active: null, workouts: [], queue: null, weighIn: false,
    }, extra)
    useStore.setState({ S: st, user: null })
  }
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-16T12:00:00'))
    install()
  })
  afterEach(() => { vi.useRealTimers() })

  it('is titled with the date and offers Only that date or Every weekday, for today and later only', () => {
    dayOverrideSheet(WED)
    const host = renderTop()
    expect(host.querySelector('h2').textContent).toBe(fmtDate(WED, true))
    expect([...host.querySelectorAll('.g-seg button')].map(b => b.textContent)).toEqual([`Only ${fmtDate(WED, true)}`, 'Every Wednesday'])
    expect(host.textContent).toContain('Pick one routine.')
    expect(button(host, 'Save')).toBeTruthy()
    // a day gone by has no scope and no Save
    dayOverrideSheet('2026-09-15')
    const past = renderTop()
    expect(past.querySelector('.g-seg')).toBeNull()
    expect(button(past, 'Save')).toBeUndefined()
  })

  it('Only: Save with nothing changed writes nothing', () => {
    dayOverrideSheet(WED)
    const host = renderTop()
    expect(rowOf(host, 'Push').getAttribute('aria-checked')).toBe('true')
    save(host)
    expect(S().dayPlan).toEqual({})
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('Only: Rest moves the session to the next free day, says so, and Undo puts both days back', () => {
    dayOverrideSheet(WED)
    const host = renderTop()
    expect(subOf(host, 'Rest / skip this day')).toBe('Push moves to your next free day')
    click(rowOf(host, 'Rest / skip this day'))
    save(host)
    expect(S().dayPlan).toEqual({ [WED]: 'rest', [THU]: 'push' })
    expect(useUI.getState().toastMsg).toBe(`Push moved to ${fmtDate(THU, true)}`)
    act(() => { useUI.getState().runToastAction() })
    expect(S().dayPlan).toEqual({})
  })

  it('Only: a day with nothing planned starts on Rest, and a pick plans it', () => {
    dayOverrideSheet(THU)
    const host = renderTop()
    expect(rowOf(host, 'Rest / skip this day').getAttribute('aria-checked')).toBe('true')
    expect(subOf(host, 'Rest / skip this day')).toBe('No workout this day')
    click(rowOf(host, 'Core'))
    save(host)
    expect(S().dayPlan[THU]).toBe('core')
  })

  it('Only: Back to weekly plan clears the override', () => {
    install({ dayPlan: { [WED]: 'core' } })
    dayOverrideSheet(WED)
    const host = renderTop()
    expect(header(host)).toContain('changed for this day')
    click(rowOf(host, 'Back to weekly plan'))
    save(host)
    expect(S().dayPlan).toEqual({})
    expect(useUI.getState().toastMsg).toBe('Back to weekly plan')
  })

  it('Every: ticks what is on the weekday and adds a second routine for a combined day, on Save', () => {
    dayOverrideSheet(MON)
    const host = renderTop()
    every(host)
    const box = name => [...host.querySelectorAll('[role=checkbox]')].find(b => b.querySelector('b').textContent === name)
    expect(box('Push').getAttribute('aria-checked')).toBe('true')
    expect(box('Core').getAttribute('aria-checked')).toBe('false')
    expect(host.textContent).toContain('Pick one routine, or more to train them together.')
    expect(host.textContent).toContain('Every Monday changes future Mondays only; past days keep what was logged.')
    click(box('Core'))
    expect(S().week[1]).toEqual(['push'])   // not before Save
    save(host)
    expect(S().week[1]).toEqual(['push', 'core'])
    expect(useUI.getState().toastMsg).toMatch(/^Mondays: /)
  })

  it('Every: takes a routine off, and the weekday goes once nothing is left', () => {
    dayOverrideSheet(MON)
    const host = renderTop()
    every(host)
    const rest = () => [...host.querySelectorAll('[role=checkbox]')].find(b => b.querySelector('b').textContent === 'Rest / skip this day')
    click([...host.querySelectorAll('[role=checkbox]')].find(b => b.querySelector('b').textContent === 'Push'))
    expect(rest().getAttribute('aria-checked')).toBe('true')
    expect(rest().textContent).toContain('Nothing planned on Mondays')
    save(host)
    expect(S().week).not.toHaveProperty('1')
    expect(useUI.getState().toastMsg).toBe('Mondays: Rest')
  })

  it('Every: Rest clears a combined weekday', () => {
    install({ week: { 1: ['push', 'core'] } })
    dayOverrideSheet(MON)
    const host = renderTop()
    every(host)
    click([...host.querySelectorAll('[role=checkbox]')].find(b => b.querySelector('b').textContent === 'Rest / skip this day'))
    save(host)
    expect(S().week).not.toHaveProperty('1')
  })

  it('Every: an empty weekday takes routines in the order tapped', () => {
    dayOverrideSheet(THU)
    const host = renderTop()
    every(host)
    const tap = name => click([...host.querySelectorAll('[role=checkbox]')].find(b => b.querySelector('b').textContent === name))
    tap('Core')
    tap('Push')
    save(host)
    expect(S().week[4]).toEqual(['core', 'push'])
  })

  it('a day gone by offers Back to weekly plan and the note, and no Rest', () => {
    install({ dayPlan: { '2026-09-14': 'core' } })
    dayOverrideSheet('2026-09-14')
    const host = renderTop()
    expect(host.textContent).not.toContain('Rest / skip this day')
    expect(host.textContent).toContain('Add a note for this day')
    click([...host.querySelectorAll('.g-menuitem')].find(b => b.textContent.startsWith('Back to weekly plan')))
    expect(S().dayPlan).toEqual({})
    expect(useUI.getState().toastMsg).toBe('Back to weekly plan')
  })

  it('the note row is not offered on a day still to come', () => {
    dayOverrideSheet(WED)
    expect(renderTop().textContent).not.toContain('Add a note for this day')
    dayOverrideSheet('2026-09-16')
    expect(renderTop().textContent).toContain('Add a note for this day')
  })
})

/* ---------------------------------------- its own URL ---------------------------------------- */
describe('usePlanDayParam', () => {
  function Probe() {
    usePlanDayParam()
    return <p className="where">{useLocation().search}</p>
  }
  const page = path => mount(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="*" element={<Probe />} /></Routes>
    </MemoryRouter>,
  )
  beforeEach(() => {
    useStore.setState(s => ({ S: { ...s.S, routines: [{ id: 'push', name: 'Push', emoji: null, ex: [{ id: '0025' }] }], week: {}, dayPlan: {}, workouts: [], active: null, queue: null }, user: null }))
  })

  it('opens the drawer on a load with ?day=, and takes ?day= away once it closes, keeping the rest', () => {
    const day = isoOf(new Date(Date.now() + 2 * 86400000))
    const host = page('/train/schedule?tab=x&day=' + day)
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(host.querySelector('.where').textContent).toBe('?tab=x&day=' + day)
    const drawer = renderTop()
    expect(drawer.querySelector('h2').textContent).toBe(fmtDate(day, true))
    save(drawer)
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(host.querySelector('.where').textContent).toBe('?tab=x')
  })

  it('leaves a page without ?day= alone, and a malformed day opens nothing', () => {
    page('/train/schedule?tab=x')
    expect(useUI.getState().sheets).toHaveLength(0)
    const host = page('/train/schedule?day=soon')
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(host.querySelector('.where').textContent).toBe('')
  })
})
