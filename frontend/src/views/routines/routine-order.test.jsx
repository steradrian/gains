// @vitest-environment happy-dom
// Issue #142: routines were stuck in the order they were created. `S.routines` is the single
// order every screen reads — Plan, the Start screen, the day-assignment sheets — so moving one
// here moves it everywhere. On the Routines page (T4.0, owner question 6) the groups keep that
// order, and the order changes behind Reorder: one flat list with a handle to drag (or to move
// with the arrow keys) and move up / move down buttons.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { setNav } from '../../lib/nav.js'
import RoutinesScreen from './RoutinesScreen.jsx'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav, useLocation: () => ({ pathname: '/train/routines', state: null }) }))
vi.mock('../../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), startFlow: vi.fn(), dayNoteSheet: vi.fn(), dayOptionsSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  importPlanFile: vi.fn(), logPastWorkoutSheet: vi.fn(), startChooserSheet: vi.fn(),
}))

const routine = (id, name) => ({ id, name, emoji: null, ex: [{ id: '0025' }] })
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  nav.mockClear(); setNav(nav)
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  useStore.setState(s => ({ S: { ...s.S, routines: [routine('a', 'Push A'), routine('b', 'Pull A'), routine('c', 'Legs A')], week: { 1: ['b'] }, dayPlan: {}, workouts: [], queue: null, scheduleMode: 'week' }, user: null }))
})
afterEach(() => { act(() => root.unmount()); host.remove(); setNav(() => {}) })

const mount = () => act(() => root.render(<RoutinesScreen />))
const listRows = () => [...host.querySelectorAll('.g-rt-row')].filter(e => e.querySelector('b').textContent !== 'Freestyle')
const orderRows = () => [...host.querySelectorAll('.g-rt-orow')]
const names = () => listRows().map(e => e.querySelector('b').textContent)
const orderNames = () => orderRows().map(e => e.querySelector('b').textContent)
const stored = () => useStore.getState().S.routines.map(r => r.name)
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const click = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
const handles = () => [...host.querySelectorAll('[data-reorder-handle]')]
const reorder = () => click(button('Reorder'))
// happy-dom lays nothing out: give the rows 60px each, 68px apart (an 8px gap).
const layOut = () => orderRows().forEach((row, i) => {
  row.getBoundingClientRect = () => ({ top: i * 68, bottom: i * 68 + 60, height: 60, left: 0, right: 300, width: 300 })
})
const pointer = (el, type, y) => act(() => { el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, clientY: y })) })

describe('routine order', () => {
  it('groups keep the stored order, with no move buttons outside Reorder, and say the days a routine is on', () => {
    mount()
    // Pull A is on a weekday, so it is in the Plan; the other two follow in their stored order.
    expect(names()).toEqual(['Pull A', 'Push A', 'Legs A'])
    expect(handles()).toEqual([])
    expect(host.querySelector('.g-rt-btn')).toBe(null)
    expect(listRows()[0].querySelector('.g-glist-body span').textContent).toBe('1 exercise · Mon')
  })

  it('Reorder shows one flat list in the stored order, a handle and move buttons per row; tapping a row opens nothing', () => {
    mount()
    reorder()
    expect(orderNames()).toEqual(['Push A', 'Pull A', 'Legs A'])
    expect(handles().length).toBe(3)
    // each named for its routine, so a screen reader can tell three of them apart
    expect(handles().map(b => b.getAttribute('aria-label'))).toEqual(['Move Push A', 'Move Pull A', 'Move Legs A'])
    expect([...host.querySelectorAll('.g-rt-btn:not(.g-rt-handle)')].map(b => b.getAttribute('aria-label'))).toEqual([
      'Move Push A up', 'Move Push A down', 'Move Pull A up', 'Move Pull A down', 'Move Legs A up', 'Move Legs A down',
    ])
    click(orderRows()[0])
    expect(nav).not.toHaveBeenCalled()
    click(button('Done'))
    expect(handles()).toEqual([])
    expect(names()).toEqual(['Pull A', 'Push A', 'Legs A'])
  })

  it('moves a routine with the arrow keys on its handle, and the stored order follows', () => {
    mount()
    reorder()
    act(() => { handles()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    expect(stored()).toEqual(['Pull A', 'Push A', 'Legs A'])
    expect(orderNames()).toEqual(['Pull A', 'Push A', 'Legs A'])
    // the ends cannot go further
    act(() => { handles()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })) })
    act(() => { handles()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    expect(stored()).toEqual(['Pull A', 'Push A', 'Legs A'])
  })

  it('move up and move down move it one place, and are off at the ends', () => {
    mount()
    reorder()
    const up = name => host.querySelector(`button[aria-label="Move ${name} up"]`)
    const down = name => host.querySelector(`button[aria-label="Move ${name} down"]`)
    expect(up('Push A').disabled).toBe(true)
    expect(down('Legs A').disabled).toBe(true)
    click(down('Push A'))
    expect(stored()).toEqual(['Pull A', 'Push A', 'Legs A'])
    click(up('Legs A'))
    expect(stored()).toEqual(['Pull A', 'Legs A', 'Push A'])
  })

  it('drags a routine by its handle to a new place', () => {
    mount()
    reorder()
    layOut()
    const h = handles()[0]
    pointer(h, 'pointerdown', 30)
    pointer(h, 'pointermove', 100)
    // while held, the row follows and the one it passed slides up into the gap
    expect(orderRows()[0].style.transform).toBe('translateY(70px)')
    expect(orderRows()[1].style.transform).toBe('translateY(-68px)')
    pointer(h, 'pointermove', 170)
    pointer(h, 'pointerup', 170)
    expect(stored()).toEqual(['Pull A', 'Legs A', 'Push A'])
    expect(orderRows()[0].style.transform).toBe('')
  })

  it('a drag that ends where it started changes nothing, and a cancelled one neither', () => {
    mount()
    reorder()
    layOut()
    const h = handles()[1]
    pointer(h, 'pointerdown', 98)
    pointer(h, 'pointermove', 110)
    pointer(h, 'pointerup', 110)
    expect(stored()).toEqual(['Push A', 'Pull A', 'Legs A'])
    pointer(h, 'pointerdown', 98)
    pointer(h, 'pointermove', 200)
    pointer(h, 'pointercancel', 200)
    expect(stored()).toEqual(['Push A', 'Pull A', 'Legs A'])
  })

  it('offers no Reorder when there is nothing to reorder', () => {
    useStore.setState(s => ({ S: { ...s.S, routines: [routine('a', 'Only one')] } }))
    mount()
    expect(button('Reorder')).toBeUndefined()
    expect(names()).toEqual(['Only one'])
  })

  it('New routine is in the nav bar and opens the editor on the new routine, in its new state', () => {
    mount()
    const add = host.querySelector('.g-snav button[aria-label="New routine"]')
    expect(add.compareDocumentPosition(listRows()[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    click(add)
    const created = useStore.getState().S.routines.at(-1)
    expect(created.name).toBe('New routine')
    expect(nav).toHaveBeenCalledWith('/train/routines/' + created.id + '?new=1')
  })
})
