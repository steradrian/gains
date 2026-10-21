// @vitest-environment happy-dom
// Plan on the stage (PR02 T3.0, T3.2, T3.3; the route /train/schedule). Rewritten from the old
// Schedule's tests (Plan.rotation, Plan.day-rows, Plan.routine-count): Loop / Fixed week is the one
// switch, the same keys as Settings (lib/rotation.js chooseRotation / chooseFixedWeek); the loop
// card has its editor behind Edit (add, take out with Undo, reorder by drag, keys and buttons),
// its round line and its buttons (Start the loop, Start the loop over, Use this rotation); a pass
// someone else wrote is read-only until adopted, an unreadable one offers recovery; the grid's
// days open the day; the weekly volume links to Training load.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { fmtDate, isoOf, todayISO } from '../../lib/format.js'
import { confirmSheet, dayOverrideSheet, menuSheet, planToolsSheet, starterPlanSheet, workoutDetailSheet } from '../../sheets.jsx'
import PlanScreen from './PlanScreen.jsx'

const nav = vi.fn()
// The banner's own source (the Coach status poll) is tested in train/coach/use-coach-banner.test.jsx;
// here it is a value, so no test reaches the network.
const { banner } = vi.hoisted(() => ({ banner: { current: null } }))
vi.mock('../train/coach/use-coach-banner.js', () => ({ useCoachBanner: () => banner.current }))
vi.mock('react-router-dom', () => ({ useNavigate: () => nav, useLocation: () => ({ pathname: '/train/schedule' }) }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../sheets.jsx', () => ({
  confirmSheet: vi.fn(), menuSheet: vi.fn(), dayOverrideSheet: vi.fn(), planToolsSheet: vi.fn(), starterPlanSheet: vi.fn(),
  workoutDetailSheet: vi.fn(), dayNoteSheet: vi.fn(), dayOptionsSheet: vi.fn(), startChooserSheet: vi.fn(), startFlow: vi.fn(),
  logPastWorkoutSheet: vi.fn(), importPlanFile: vi.fn(), planHasRoutines: () => true, exportPlanFile: vi.fn(), printWholePlan: vi.fn(),
  usePlanDayParam: vi.fn(),
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const routines = [
  { id: 'a', name: 'A', emoji: null, ex: [{ id: '0025' }] },
  { id: 'b', name: 'B', emoji: null, ex: [{ id: '0025' }] },
  { id: 'c', name: 'C', emoji: null, ex: [{ id: '0025' }] },
]
const live = (over = {}) => ({ ids: ['a', 'b'], since: Date.now() - 86400000, startsOn: todayISO(), label: 'My split', ...over })
const saved = { id: 'r1', sequence: ['a', 'b'], label: 'My split' }
const shift = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d) }

let host, root
beforeEach(() => {
  vi.clearAllMocks()
  banner.current = null
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mount = (over = {}) => {
  useStore.setState(s => ({
    S: { ...s.S, routines, week: { 1: ['c'] }, dayPlan: {}, dayNotes: {}, missedSeen: {}, workouts: [], active: null, queue: null, rotation: null, scheduleMode: null, weekStart: 1, ...over },
    user: null,
  }))
  act(() => root.render(<PlanScreen />))
}
const S = () => useStore.getState().S
const $ = sel => host.querySelector(sel)
const $$ = sel => [...host.querySelectorAll(sel)]
const click = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })) })
const byLabel = label => $$('button').find(b => b.getAttribute('aria-label') === label || b.textContent.trim() === label)
const modes = () => $$('.g-sseg [role="radio"]')
const pickMode = label => click(modes().find(b => b.textContent === label))
const selectedMode = () => modes().find(b => b.getAttribute('aria-checked') === 'true')?.textContent
const headings = () => $$('h2').map(h => h.textContent)
const chips = () => $$('.plan-loop .g-loop-item .sr-only').map(e => e.textContent)
const rows = () => $$('.plan-editor-list > [data-reorder-row]')
const rowNames = () => $$('.plan-erow .g-glist-body b').map(b => b.textContent)
const line = () => $('.plan-loop .plan-line')?.textContent
const also = () => $$('.plan-also .g-glist-row').map(r => r.querySelector('b').textContent + ': ' + r.querySelector('.g-glist-body span').textContent)
const sub = () => $('.g-spage-sub')?.textContent ?? null
const lastMenu = () => menuSheet.mock.calls.at(-1)[0]

describe('Plan — the page', () => {
  it('a pushed page: the large title, its line and one Plan menu that opens the plan tools', () => {
    mount({ week: { 1: ['a'], 3: ['b', 'c'] } })
    expect($('.g-spage-title').textContent).toBe('Plan')
    expect(sub()).toBe('A, B, C · 2 days a week')
    click(byLabel('Plan menu'))
    expect(planToolsSheet).toHaveBeenCalledTimes(1)
    expect($('.plan-routines')).toBeNull()
  })

  it('a loop names its routines and says no days a week: there is no stored number for it', () => {
    mount({ queue: live({ rotationId: 'r1' }), rotation: saved })
    expect(sub()).toBe('A, B')
  })
})

describe('Plan — Loop or Fixed week', () => {
  it('nothing saved: Fixed week with the week\'s card and its footer, no loop buttons', () => {
    mount()
    expect(selectedMode()).toBe('Fixed week')
    expect(headings()).toContain('Your week')
    expect(headings()).not.toContain('Your loop')
    expect($('.g-loop-note').textContent).toBe('The same routines on the same weekdays, every week.')
    expect(host.textContent).not.toContain('A missed day moves the loop forward')
    expect(rows()).toEqual([])
    expect(byLabel('Start the loop')).toBeUndefined()
  })

  it('Loop with nothing saved holds the choice and shows an empty loop', () => {
    mount()
    pickMode('Loop')
    expect(S().scheduleMode).toBe('rotation')
    expect(S().queue).toBe(null)
    expect(selectedMode()).toBe('Loop')
    expect(headings()).toContain('Your loop')
    expect($('.g-loop-empty').textContent).toBe('No rotation yet')
    expect($('.g-loop-note').textContent).toBe('A missed day moves the loop forward; nothing is lost.')
    expect(sub()).toBeNull()
  })

  it('the loop card\'s top wraps, so its action never runs off a 320 px screen', async () => {
    mount({ scheduleMode: 'rotation' })
    expect(byLabel('Add routine to the rotation')).toBeTruthy()
    const { readFileSync } = await import('node:fs')
    const css = readFileSync(process.cwd() + '/src/ds/ds.css', 'utf8')
    expect(css).toMatch(/^\.g-loop-top \{[^}]*flex-wrap: wrap/m)
  })

  it('back to Fixed week with nothing running needs no confirmation', () => {
    mount({ scheduleMode: 'rotation' })
    pickMode('Fixed week')
    expect(confirmSheet).not.toHaveBeenCalled()
    expect(S().scheduleMode).toBe('week')
  })

  it('Loop starts a pass from a saved loop', () => {
    mount({ rotation: saved })
    pickMode('Loop')
    expect(S().queue).toMatchObject({ ids: ['a', 'b'], rotationId: 'r1', startsOn: todayISO() })
    expect(S().scheduleMode).toBe('rotation')
  })

  it('leaving a running loop asks first, then keeps the loop and the weekdays', () => {
    mount({ queue: live({ rotationId: 'r1' }), rotation: saved, dayPlan: { [todayISO()]: 'a' } })
    expect(selectedMode()).toBe('Loop')
    pickMode('Fixed week')
    expect(S().queue).not.toBe(null)
    expect(confirmSheet).toHaveBeenCalledTimes(1)
    act(() => confirmSheet.mock.calls[0][0].onConfirm())
    expect(S().queue).toBe(null)
    expect(S().scheduleMode).toBe('week')
    expect(S().rotation.sequence).toEqual(['a', 'b'])
    expect(S().week).toEqual({ 1: ['c'] })
    expect(S().dayPlan).toEqual({})
  })
})

describe('Plan — the loop', () => {
  it('shows the live pass in order with its state, and keeps the weekdays that add a routine', () => {
    mount({ queue: live({ rotationId: 'r1' }), rotation: saved })
    expect(chips()).toEqual(['1. A, Up next', '2. B, Later'])
    expect($$('.g-loop-chip')[0].className).toContain('on')
    expect($('.g-loop-line').textContent).toBe('2 workouts, then repeat')
    expect(line()).toBe('0 of 2 done this round.')
    expect(headings()).toContain('Also on fixed days')
    expect(also()).toEqual(['Monday: C'])
  })

  it('a weekday shows only what the loop does not have, and a day with nothing else is left out', () => {
    mount({ queue: live({ rotationId: 'r1' }), rotation: saved, week: { 1: ['a', 'c'], 3: ['b'], 5: ['a'] } })
    expect(also()).toEqual(['Monday: C'])
    act(() => root.unmount()); root = createRoot(host)
    mount({ queue: live({ rotationId: 'r1' }), rotation: saved, week: { 3: ['b'], 5: ['a'] } })
    expect(headings()).not.toContain('Also on fixed days')
    expect(also()).toEqual([])
  })

  it('a row of Also on fixed days opens that weekday\'s next date', () => {
    mount({ queue: live({ rotationId: 'r1' }), rotation: saved })
    click($('.plan-also .g-glist-row'))
    const iso = dayOverrideSheet.mock.calls[0][0]
    expect(new Date(iso + 'T12:00:00').getDay()).toBe(1)
    expect(iso >= todayISO() && iso <= shift(6)).toBe(true)
    expect(nav).toHaveBeenCalledWith({ search: '?day=' + iso }, { replace: true })
  })

  it('a session done this round reads Done and moves Up next along', () => {
    mount({
      queue: live({ rotationId: 'r1' }), rotation: saved,
      workouts: [{ id: 'w1', d: todayISO(), start: Date.now() - 1000, routineIds: ['a'], routineId: 'a', name: 'A', entries: [] }],
    })
    expect(chips()).toEqual(['1. A, Done', '2. B, Up next'])
    expect($$('.g-loop-chip')[0].className).toContain('done')
    expect(line()).toBe('1 of 2 done this round.')
  })

  it('Edit opens the editor; Add offers only the routines not in the loop, and saves the pass', () => {
    mount({ queue: live({ rotationId: 'r1' }), rotation: saved })
    expect($('.plan-editor')).toBeNull()
    click(byLabel('Edit'))
    expect(byLabel('Done').getAttribute('aria-pressed')).toBe('true')
    expect(rowNames()).toEqual(['A', 'B'])
    click(byLabel('Add routine to the rotation'))
    expect(lastMenu().items.map(i => i.label)).toEqual(['C'])
    act(() => lastMenu().items[0].onClick())
    expect(S().queue.ids).toEqual(['a', 'b', 'c'])
    expect(S().rotation.sequence).toEqual(['a', 'b', 'c'])
    expect(rowNames()).toEqual(['A', 'B', 'C'])
  })

  it('the handle\'s arrow keys reorder without restarting the pass', () => {
    const since = Date.now() - 86400000
    mount({ queue: live({ since, rotationId: 'r1' }), rotation: saved })
    expect($('[data-reorder-handle]')).toBe(null)
    click(byLabel('Edit'))
    const handle = rows()[0].querySelector('[data-reorder-handle]')
    expect(handle.getAttribute('aria-label')).toBe('Move A')
    act(() => { handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    expect(S().queue.ids).toEqual(['b', 'a'])
    expect(S().queue.since).toBe(since)
  })

  it('the move buttons reorder too, and the ends cannot move past the edge', () => {
    mount({ queue: live({ ids: ['a', 'b', 'c'], rotationId: 'r1' }), rotation: { ...saved, sequence: ['a', 'b', 'c'] } })
    click(byLabel('Edit'))
    expect(byLabel('Move A up').disabled).toBe(true)
    expect(byLabel('Move C down').disabled).toBe(true)
    click(byLabel('Move C up'))
    expect(S().queue.ids).toEqual(['a', 'c', 'b'])
    click(byLabel('Move A down'))
    expect(S().queue.ids).toEqual(['c', 'a', 'b'])
  })

  it('a drag on the handle reorders the loop', () => {
    mount({ queue: live({ ids: ['a', 'b', 'c'], rotationId: 'r1' }), rotation: { ...saved, sequence: ['a', 'b', 'c'] } })
    click(byLabel('Edit'))
    rows().forEach((row, i) => { row.getBoundingClientRect = () => ({ top: i * 68, bottom: i * 68 + 60, height: 60, left: 0, right: 300, width: 300 }) })
    const h = rows()[2].querySelector('[data-reorder-handle]')
    const fire = (type, y) => act(() => { h.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, button: 0, clientY: y })) })
    fire('pointerdown', 166)
    fire('pointermove', 20)
    fire('pointerup', 20)
    expect(S().queue.ids).toEqual(['c', 'a', 'b'])
  })

  it('taking out the last routine keeps the loop, empty and ready for another routine', () => {
    mount({ queue: live({ ids: ['a'], rotationId: 'r1' }), rotation: { id: 'r1', sequence: ['a'], label: 'My split' } })
    click(byLabel('Edit'))
    expect(line()).toContain('Drag to reorder. Tap the minus to take one out.')
    const minus = rows()[0].querySelector('.plan-erow-minus')
    expect(minus.getAttribute('aria-label')).toBe('Remove A')
    click(minus)
    expect(S().queue).toBe(null)
    expect(S().rotation).toEqual({ id: 'r1', sequence: [], label: 'My split' })
    expect(S().scheduleMode).toBe('rotation')
    expect(S().week).toEqual({ 1: ['c'] })
    expect(useUI.getState().toastMsg).toBe('“A” is out of the loop.')
    expect(selectedMode()).toBe('Loop')
    expect($('.g-loop-empty').textContent).toBe('No rotation yet')
    expect($('.plan-editor')).toBeNull()
    // swapping the only routine: add another one back in, same rotation id
    click(byLabel('Add routine to the rotation'))
    act(() => lastMenu().items.find(i => i.label === 'B').onClick())
    expect(S().rotation).toMatchObject({ id: 'r1', sequence: ['b'] })
    expect(S().queue.ids).toEqual(['b'])
  })

  it('a loop built here saves no name of its own, so it follows the language on screen', () => {
    mount({ scheduleMode: 'rotation' })
    click(byLabel('Add routine to the rotation'))
    act(() => lastMenu().items.find(i => i.label === 'A').onClick())
    expect(S().rotation.sequence).toEqual(['a'])
    expect(S().rotation.label).toBe('')
    expect(S().queue.label).toBe('')
  })

  it('Start the loop over rewinds the current round, strictly from now', () => {
    mount({ queue: live({ since: Date.now() - 5 * 86400000, startsOn: '2026-09-01', rotationId: 'r1' }), rotation: saved })
    click(byLabel('Start the loop over'))
    expect(S().queue.startsOn).toBe(todayISO())
    expect(S().queue.ids).toEqual(['a', 'b'])
    expect(S().queue.strict).toBe(true)
  })

  it('a round waiting on its first day says when it starts', () => {
    const tomorrow = shift(1)
    mount({ queue: live({ startsOn: tomorrow, rotationId: 'r1' }), rotation: saved })
    expect(line()).toBe('Next round starts ' + fmtDate(tomorrow, true) + '.')
  })

  it('a saved loop with no round running offers Start the loop', () => {
    mount({ rotation: saved, scheduleMode: 'rotation' })
    expect(chips()).toEqual(['1. A', '2. B'])
    expect(byLabel('Start the loop over')).toBeUndefined()
    click(byLabel('Start the loop'))
    expect(S().queue.ids).toEqual(['a', 'b'])
    expect(S().queue.rotationId).toBe('r1')
  })
})

describe('Plan — someone else’s pass, and a broken one', () => {
  it('an externally written pass is locked: no switch, no edits, adoption behind a confirm', () => {
    mount({ queue: live(), scheduleMode: 'rotation' })   // no rotationId, no rotation
    expect(modes()).toEqual([])
    expect($('.plan-acts .g-tag').textContent).toBe('Externally managed')
    expect(byLabel('Edit')).toBeUndefined()
    expect(byLabel('Add routine to the rotation')).toBeUndefined()
    expect(chips()).toEqual(['1. A, Up next', '2. B, Later'])
    expect(headings()).toContain('Also on fixed days')
    click(byLabel('Use this rotation'))
    expect(S().rotation).toBe(null)            // not adopted yet: waiting on the confirm
    act(() => confirmSheet.mock.calls.at(-1)[0].onConfirm())
    expect(S().rotation.sequence).toEqual(['a', 'b'])
    expect(S().queue.rotationId).toBe(S().rotation.id)
    // Adopting drops the planner's name: refillAfter would otherwise repeat it on every pass.
    expect(S().rotation.label).toBe('')
    expect(S().queue.label).toBe('')
    expect(host.textContent).not.toContain('Externally managed')
    expect(selectedMode()).toBe('Loop')
  })

  it('adopting a coach queue over a different loop of your own says the loop gets replaced', () => {
    mount({ queue: live({ ids: ['b', 'c'] }), rotation: { id: 'r0', sequence: ['a', 'b'], label: 'Mine' }, scheduleMode: 'rotation' })
    click(byLabel('Use this rotation'))
    expect(confirmSheet.mock.calls.at(-1)[0].message).toMatch(/ Your own loop gets replaced\.$/)
    mount({ queue: live({ ids: ['a', 'b'] }), rotation: { id: 'r0', sequence: ['a', 'b'], label: 'Mine' }, scheduleMode: 'rotation' })
    click(byLabel('Use this rotation'))
    expect(confirmSheet.mock.calls.at(-1)[0].message).not.toContain('Your own loop')
  })

  it('a malformed queue offers recovery instead of a loop full of nothing', () => {
    mount({ queue: { ids: ['gone'], since: Date.now() } })
    expect($('[role=alert]').textContent).toContain('This rotation couldn’t be read')
    expect($('.g-sempty')).toBeNull()
    click(byLabel('Discard it'))
    expect(S().queue).toBe(null)
    expect($('[role=alert]')).toBeNull()
  })

  it('Discard it leaves a clear way back in: Loop starts the saved loop again', () => {
    mount({ queue: { ids: ['gone'], since: Date.now() }, rotation: saved, scheduleMode: 'rotation' })
    click(byLabel('Discard it'))
    expect(S().queue).toBe(null)
    expect(S().scheduleMode).toBe('week')
    expect(headings()).toContain('Your week')
    pickMode('Loop')
    expect(S().queue.ids).toEqual(['a', 'b'])
  })

  it('every routine in the loop deleted still leaves a way back in, not a locked editor', () => {
    mount({ routines: [], queue: { ids: ['a', 'b'], since: Date.now() }, rotation: saved, scheduleMode: 'rotation' })
    expect(host.textContent).toContain('This rotation couldn’t be read')
    click(byLabel('Discard it'))
    expect(S().scheduleMode).toBe('week')
    // nothing in the saved loop survives, so Loop only holds the choice: a fresh build
    pickMode('Loop')
    expect(S().queue).toBe(null)
    expect(S().scheduleMode).toBe('rotation')
  })
})

describe('Plan — nothing planned (T3.3)', () => {
  it('no routines: the empty state, its two ways in, and no muscle volume', () => {
    mount({ routines: [], week: {} })
    expect(sub()).toBe('Nothing planned this week')
    expect($('.g-sempty b').textContent).toBe('No fixed days yet')
    expect($('.plan-volume')).toBeNull()
    click($$('.g-sempty-btn').find(b => b.textContent === 'Add routines'))
    expect(nav).toHaveBeenCalledWith('/train/routines')
    click($$('.g-sempty-btn').find(b => b.textContent === 'Pick a ready-made plan'))
    expect(starterPlanSheet).toHaveBeenCalledTimes(1)
  })

  it('on a loop, as drawn; with routines to put in it, Add routines adds them to the loop', () => {
    mount({ week: {}, scheduleMode: 'rotation' })
    expect($('.g-sempty b').textContent).toBe('No rotation yet')
    expect($('.g-sempty').textContent).toContain('Add routines to your Plan and they repeat in a loop, one per training day.')
    click($$('.g-sempty-btn').find(b => b.textContent === 'Add routines'))
    expect(lastMenu().items.map(i => i.label)).toEqual(['A', 'B', 'C'])
    expect(nav).not.toHaveBeenCalled()
  })
})

describe('Plan — the two weeks', () => {
  const cells = () => $$('.g-pcell')
  const cellOn = iso => $(`.g-pcell[data-iso="${iso}"]`)
  const nextWeek = () => cells().slice(7)

  it('two weeks of seven from the week\'s first day, today ringed', () => {
    mount()
    expect(cells()).toHaveLength(14)
    expect($$('.g-pgrid-week').map(h => h.textContent)).toEqual(['This week', 'Next week'])
    expect(new Date(cells()[0].dataset.iso + 'T12:00:00').getDay()).toBe(1)
    expect($$('.g-pcell.today').map(c => c.dataset.iso)).toEqual([todayISO()])
    expect(cells().every(c => c.tagName === 'BUTTON')).toBe(true)   // the keyboard opens them too
    act(() => root.unmount()); root = createRoot(host)
    mount({ weekStart: 0 })
    expect(new Date(cells()[0].dataset.iso + 'T12:00:00').getDay()).toBe(0)
  })

  it('a planned day to come names its routine; a tap opens it on its own URL', () => {
    mount()
    const monday = nextWeek().find(c => new Date(c.dataset.iso + 'T12:00:00').getDay() === 1)
    expect(monday.getAttribute('aria-label')).toBe(fmtDate(monday.dataset.iso, true) + ', C')
    expect(monday.textContent).toContain('C')
    click(monday)
    expect(nav).toHaveBeenCalledWith({ search: '?day=' + monday.dataset.iso }, { replace: true })
    expect(dayOverrideSheet).toHaveBeenCalledWith(monday.dataset.iso)
  })

  it('an empty day is a rest day, and opens the same drawer', () => {
    mount()
    const tuesday = nextWeek().find(c => new Date(c.dataset.iso + 'T12:00:00').getDay() === 2)
    expect(tuesday.getAttribute('aria-label')).toBe(fmtDate(tuesday.dataset.iso, true) + ', Rest day')
    expect(tuesday.className).toContain('g-pcell-rest')
    click(tuesday)
    expect(dayOverrideSheet).toHaveBeenCalledWith(tuesday.dataset.iso)
  })

  it('a combined day counts its routines in its name; a single one does not', () => {
    mount({ week: { 1: ['a'], 2: ['a', 'b'] } })
    const on = d => nextWeek().find(c => new Date(c.dataset.iso + 'T12:00:00').getDay() === d).getAttribute('aria-label')
    expect(on(2)).toBe(fmtDate(nextWeek()[1].dataset.iso, true) + ', A + B, 2 routines')
    expect(on(1)).not.toContain('routine')
  })

  it('a past day logged opens its workout; a past day missed opens its options, with no URL', () => {
    const yesterday = shift(-1)
    const dow = iso => new Date(iso + 'T12:00:00').getDay()
    // A week that starts today would leave yesterday out of the grid: start it the day before.
    const weekStart = dow(todayISO()) === 1 ? 0 : 1
    const old = { id: 'w0', d: shift(-30), start: Date.now() - 30 * 86400000, routineIds: ['a'], name: 'A', entries: [] }
    mount({ weekStart, workouts: [old, { ...old, id: 'w1', d: yesterday, start: Date.now() - 86400000 }] })
    expect(cellOn(yesterday).className).toContain('g-pcell-done')
    expect(cellOn(yesterday).getAttribute('aria-label')).toBe(fmtDate(yesterday, true) + ', A, Done')
    click(cellOn(yesterday))
    expect(workoutDetailSheet).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }))
    expect(dayOverrideSheet).not.toHaveBeenCalled()

    mount({ weekStart, workouts: [old], week: { [dow(yesterday)]: ['b'] } })
    expect(cellOn(yesterday).className).toContain('g-pcell-missed')
    expect(cellOn(yesterday).getAttribute('aria-label')).toBe(fmtDate(yesterday, true) + ', B, Planned, not logged')
    click(cellOn(yesterday))
    expect(dayOverrideSheet).toHaveBeenCalledWith(yesterday)
    expect(nav).not.toHaveBeenCalled()
  })
})

describe('Plan — weekly muscle volume', () => {
  it('a row per muscle with its planned sets, and a way into Training load', () => {
    mount()
    expect(headings()).toContain('Weekly muscle volume')
    expect($$('.g-vbar').length).toBeGreaterThan(0)
    expect($('.g-vbars-note').textContent).toBe('Planned sets per week, from your plan. The line is a common target of 10 to 12.')
    click(byLabel('See in Training load'))
    expect(nav).toHaveBeenCalledWith('/progress/load?view=plan')
  })
})

describe('Plan — the Coach banner (T3.2)', () => {
  it('shows a pending proposal with Review and Dismiss, and none by default', () => {
    mount()
    expect($('.g-ibanner')).toBeNull()
    const onReview = vi.fn(), onDismiss = vi.fn()
    act(() => root.render(<PlanScreen coach={{ title: 'Coach suggests 2 changes', body: 'Nothing moves until you apply.', onReview, onDismiss }} />))
    expect($('.g-ibanner').textContent).toContain('Coach suggests 2 changes')
    click($$('.g-ibanner-btn').find(b => b.textContent === 'Review'))
    click($$('.g-ibanner-btn').find(b => b.textContent === 'Dismiss'))
    expect(onReview).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('draws the banner usePlan() gets from the Coach hook when a proposal is pending', () => {
    const onReview = vi.fn()
    banner.current = { title: 'Coach suggests 1 change', body: 'Nothing moves until you apply.', onReview, onDismiss: vi.fn() }
    mount()
    expect($('.g-ibanner').textContent).toContain('Coach suggests 1 change')
    click($$('.g-ibanner-btn').find(b => b.textContent === 'Review'))
    expect(onReview).toHaveBeenCalledTimes(1)
  })
})
