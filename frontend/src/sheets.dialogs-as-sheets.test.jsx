// @vitest-environment happy-dom
/* The six dialogs that used to be centred boxes are bottom sheets (docs/reviews/design-dialogs-to-
 * sheets.md): confirmSheet and the add-device-data question, the same-day choice, workout
 * complete, the save prompt and the finish summary in sheets/workout-flow.jsx, and the sheet that
 * lists what a sign-out would leave unsent. Each runs in the real Modals on the real store, so the
 * backdrop, Escape and a drag are what a person would use. */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals, { scrollRestorePending } from './components/Modals.jsx'
import { leaveServer } from './components/ServerSync.jsx'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { askAddDeviceData, confirmSheet, exitWorkoutEdit, finishWorkout, logPastWorkoutSheet, workoutCompleteSheet } from './sheets.jsx'
import { back } from './lib/use-tab-nav.js'
import { editCompletedSession } from './lib/session-edit.js'
import { EXDB } from './lib/exercises-data.js'

vi.mock('./lib/use-tab-nav.js', async importOriginal => ({ ...(await importOriginal()), back: vi.fn() }))
vi.mock('./lib/media-sync.js', () => ({ syncMedia: vi.fn(async () => {}) }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, host
const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const all = s => [...document.querySelectorAll(s)]
const top = () => all('.sheet').at(-1)
const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) }) }
const click = el => act(async () => { el.click() })
const backdrop = () => click(all('.mback').at(-1))
const escape = () => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
const btn = (text, within = top()) => [...within.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const labels = (within = top()) => [...within.querySelectorAll('button')].map(b => b.textContent.trim())
const variant = b => ['primary', 'danger', 'plain', 'ghost', 'dim'].filter(c => b.classList.contains(c))
const sheets = () => useUI.getState().sheets
const describedBy = el => document.getElementById(el.getAttribute('aria-describedby'))?.textContent
// A pull down the sheet with the mouse, as a trackpad does: the same gesture as a finger's.
const drag = async (el, dy) => {
  await act(async () => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 10, clientY: 10 })) })
  await act(async () => { el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 10 + dy })) })
  await act(async () => { window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })) })
}

beforeEach(async () => {
  localStorage.clear()
  document.body.innerHTML = '<div id="app"><button id="opener">Open</button></div><div id="root"></div>'
  host = document.getElementById('root')
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
  vi.mocked(back).mockClear()
  root = createRoot(host)
  await act(async () => { root.render(<Modals />) })
})
afterEach(async () => {
  await act(async () => { useUI.getState().closeAll(); root.unmount() })
  await settle()
  while (scrollRestorePending()) await act(async () => { await new Promise(r => setTimeout(r, 25)) })
  await settle()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('confirmSheet', () => {
  const ask = opts => act(() => { confirmSheet({ title: 'Delete it?', message: 'This cannot be undone.', ...opts }) })

  it('is a left-aligned bottom sheet with a grab bar, not a centred box', () => {
    ask({ onConfirm: vi.fn() })
    expect(top()).toBeTruthy()
    expect(top().querySelector('.grab')).toBeTruthy()
    expect(document.querySelector('.center')).toBeNull()
    expect(top().querySelector('h3').textContent).toBe('Delete it?')
    expect(top().textContent).toContain('This cannot be undone.')
    expect(top().querySelector('.ta-center')).toBeNull()
  })

  it('puts the safe main action first as primary and Cancel last as ghost and dim', () => {
    ask({ onConfirm: vi.fn(), confirmText: 'Save' })
    expect(labels()).toEqual(['Save', 'Cancel'])
    expect(variant(btn('Save'))).toEqual(['primary'])
    expect(variant(btn('Cancel'))).toEqual(['ghost', 'dim'])
  })

  it('draws a destructive confirm as danger, never a filled primary', () => {
    ask({ onConfirm: vi.fn(), confirmText: 'Delete', danger: true })
    expect(variant(btn('Delete'))).toEqual(['danger'])
  })

  it('runs onConfirm from the confirm button and onCancel from Cancel, closing each time', async () => {
    const onConfirm = vi.fn(), onCancel = vi.fn()
    ask({ onConfirm, onCancel, confirmText: 'Delete' })
    await click(btn('Delete'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(sheets()).toHaveLength(0)
    ask({ onConfirm, onCancel })
    await click(btn('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(sheets()).toHaveLength(0)
  })

  it('reads its question out: the dialog is described by the message line', () => {
    ask({ onConfirm: vi.fn() })
    expect(describedBy(top())).toBe('This cannot be undone.')
    expect(top().getAttribute('aria-modal')).toBe('true')
    expect(top().getAttribute('aria-labelledby')).toBeTruthy()
  })

  it('has no description when it asks no question', () => {
    ask({ onConfirm: vi.fn(), message: undefined })
    expect(top().hasAttribute('aria-describedby')).toBe(false)
  })

  it('is a plain dialog, and an alertdialog when it is destructive or locked', () => {
    ask({ onConfirm: vi.fn() })
    expect(top().getAttribute('role')).toBe('dialog')
    act(() => useUI.getState().closeAll())
    ask({ onConfirm: vi.fn(), danger: true })
    expect(top().getAttribute('role')).toBe('alertdialog')
    act(() => useUI.getState().closeAll())
    ask({ onConfirm: vi.fn(), locked: true })
    expect(top().getAttribute('role')).toBe('alertdialog')
  })

  it('treats the backdrop and Escape as Cancel', async () => {
    const onConfirm = vi.fn(), onCancel = vi.fn()
    ask({ onConfirm, onCancel })
    await backdrop()
    ask({ onConfirm, onCancel })
    await escape()
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(sheets()).toHaveLength(0)
  })
})

describe('askAddDeviceData', () => {
  const extras = { workouts: 2, bodyweight: 1 }

  it('is locked: no grab bar, and neither the backdrop nor Escape answers it', async () => {
    void askAddDeviceData(extras)
    await settle()
    expect(top().querySelector('.grab')).toBeNull()
    await backdrop()
    await escape()
    await drag(top(), 150)
    expect(sheets()).toHaveLength(1)
  })

  it('offers Add them as primary and Keep profile as is as a peer plain button, not a dimmed way out', async () => {
    void askAddDeviceData(extras)
    await settle()
    expect(labels()).toEqual(['Add them', 'Keep profile as is'])
    expect(variant(btn('Add them'))).toEqual(['primary'])
    expect(variant(btn('Keep profile as is'))).toEqual(['plain'])
  })

  it('resolves true on Add them and false on Keep profile as is', async () => {
    const yes = askAddDeviceData(extras)
    await settle()
    await click(btn('Add them'))
    await expect(yes).resolves.toBe(true)
    const no = askAddDeviceData(extras)
    await settle()
    await click(btn('Keep profile as is'))
    await expect(no).resolves.toBe(false)
  })
})

describe('the same-day choice', () => {
  const day = { iso: '2026-09-11' }
  const open = async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-16T12:00:00'))
    useStore.setState({ S: { ...clone(DEF), active: null, routines: [], workouts: [{ id: 'w1', d: day.iso, start: 1, end: 2, name: 'Push', entries: [], prs: [] }] }, user: null })
    act(() => logPastWorkoutSheet(day))
    await settle()
    await click(btn('Continue'))
  }

  it('is a sheet over the log sheet, titled by the day, with the reversible choice first', async () => {
    await open()
    expect(sheets()).toHaveLength(2)
    expect(document.querySelector('.center')).toBeNull()
    expect(top().querySelector('h3').textContent).toBe('Fri 11 Sept')
    expect(top().textContent).toContain('There is already a workout on that day.')
    expect(labels()).toEqual(['Add as second workout', 'Replace', 'Cancel'])
    expect(variant(btn('Add as second workout'))).toEqual(['primary'])
    expect(variant(btn('Replace'))).toEqual(['danger'])
    expect(variant(btn('Cancel'))).toEqual(['ghost', 'dim'])
  })

  it('is an alertdialog that reads the day it warns about', async () => {
    await open()
    expect(top().getAttribute('role')).toBe('alertdialog')
    expect(describedBy(top())).toBe('There is already a workout on that day.')
  })

  it('adds a second workout, or replaces the one that is there', async () => {
    await open()
    await click(btn('Add as second workout'))
    expect(S().active.backfill.replaceId).toBeNull()
    expect(sheets()).toHaveLength(0)
    useStore.setState(s => ({ S: { ...s.S, active: null } }))
    useUI.setState({ sheets: [] })
    await open()
    await click(btn('Replace'))
    expect(S().active.backfill.replaceId).toBe('w1')
  })

  it('treats Cancel, the backdrop and Escape alike: the choice goes, the log sheet stays', async () => {
    await open()
    await click(btn('Cancel'))
    expect(sheets()).toHaveLength(1)
    await click(btn('Continue'))
    await backdrop()
    expect(sheets()).toHaveLength(1)
    await click(btn('Continue'))
    await escape()
    expect(sheets()).toHaveLength(1)
    expect(S().active).toBeNull()
  })
})

describe('workout complete', () => {
  const KEEP_GOING = 'Keep going: tap “+ Add exercise” below'

  it('is a bottom sheet with its centred hero, Finish workout as primary and Continue workout as plain', () => {
    act(() => workoutCompleteSheet())
    expect(document.querySelector('.center')).toBeNull()
    expect(top().querySelector('.sheet-hero')).toBeTruthy()
    expect(top().querySelector('h3').classList.contains('ta-center')).toBe(true)
    expect(labels()).toEqual(['Finish workout', 'Continue workout'])
    expect(variant(btn('Finish workout'))).toEqual(['primary'])
    expect(variant(btn('Continue workout'))).toEqual(['plain'])
  })

  it('Continue workout closes it and says Keep going', async () => {
    act(() => workoutCompleteSheet())
    await click(btn('Continue workout'))
    expect(sheets()).toHaveLength(0)
    expect(useUI.getState().toastMsg).toBe(KEEP_GOING)
  })

  it('the backdrop and Escape say Keep going too: they are Continue', async () => {
    act(() => workoutCompleteSheet())
    await backdrop()
    expect(sheets()).toHaveLength(0)
    expect(useUI.getState().toastMsg).toBe(KEEP_GOING)
    useUI.setState({ toastMsg: '' })
    act(() => workoutCompleteSheet())
    await escape()
    expect(useUI.getState().toastMsg).toBe(KEEP_GOING)
  })

  it('Finish workout closes it without the Keep going toast', async () => {
    act(() => workoutCompleteSheet())
    await click(btn('Finish workout'))
    expect(sheets()).toHaveLength(0)
    expect(useUI.getState().toastMsg).not.toBe(KEEP_GOING)
  })
})

describe('Save workout changes?', () => {
  const A = EXDB.find(e => e.bp !== 'cardio').id
  const record = () => ({
    id: 'w-old', d: '2026-09-10', start: 1, end: 2, name: 'Push', prs: [],
    entries: [{ id: A, target: { mode: 'reps', reps: 8 }, sets: [{ w: 45, r: 8, done: true }] }],
  })
  let onExit
  beforeEach(() => {
    onExit = vi.fn()
    useStore.setState(s => ({ S: { ...s.S, workouts: [record()], routines: [], active: null } }))
    useStore.getState().update(st => { editCompletedSession(st, 'w-old'); st.active.entries[0].sets[0].w = 50 })
    act(() => exitWorkoutEdit(onExit))
  })

  it('is a sheet: Save changes primary, Don\'t save danger (it throws the edits away), Keep editing last as ghost and dim', () => {
    expect(document.querySelector('.center')).toBeNull()
    expect(top().querySelector('h3').textContent).toBe('Save workout changes?')
    expect(top().textContent).toContain('Save your edits to this workout, or keep the original record.')
    expect(labels()).toEqual(['Save changes', 'Don\'t save', 'Keep editing'])
    expect(variant(btn('Save changes'))).toEqual(['primary'])
    expect(variant(btn('Don\'t save'))).toEqual(['danger'])
    expect(variant(btn('Keep editing'))).toEqual(['ghost', 'dim'])
  })

  it('is an alertdialog described by what it offers', () => {
    expect(top().getAttribute('role')).toBe('alertdialog')
    expect(describedBy(top())).toBe('Save your edits to this workout, or keep the original record.')
  })

  it('Save changes saves the edit and leaves', async () => {
    await click(btn('Save changes'))
    expect(S().workouts[0].entries[0].sets[0].w).toBe(50)
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('Don\'t save drops the edit and leaves', async () => {
    await click(btn('Don\'t save'))
    expect(S().workouts[0].entries[0].sets[0].w).toBe(45)
    expect(S().active).toBeNull()
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('Keep editing, the backdrop and Escape all stay in the editor with the edits intact', async () => {
    await click(btn('Keep editing'))
    expect(sheets()).toHaveLength(0)
    act(() => exitWorkoutEdit(onExit))
    await backdrop()
    expect(sheets()).toHaveLength(0)
    act(() => exitWorkoutEdit(onExit))
    await escape()
    expect(sheets()).toHaveLength(0)
    expect(onExit).not.toHaveBeenCalled()
    expect(S().active.entries[0].sets[0].w).toBe(50)
  })
})

describe('the finish summary', () => {
  beforeEach(() => {
    const st = clone(DEF)
    st.active = {
      id: 'fin', d: '2026-09-28', start: Date.now() - 20 * 60000, routineId: null, name: 'Core', bw: null, cur: 0,
      entries: [{ id: EXDB[0].id, target: { mode: 'reps', sets: 1, reps: 5, weight: 40 }, sets: [{ w: 40, r: 5, done: true }] }],
    }
    useStore.setState({ S: st, user: null })
    act(() => finishWorkout())
  })

  it('is an unlocked bottom sheet, not a centred box, with the four tiles in the sheet\'s own width', () => {
    expect(sheets()).toHaveLength(1)
    expect(sheets()[0].locked).toBe(false)
    expect(top().querySelector('.grab')).toBeTruthy()
    expect(document.querySelector('.center')).toBeNull()
    expect(top().querySelector('h3').textContent).toBe('Workout complete!')
    expect(top().querySelectorAll('.tiles > .tile')).toHaveLength(4)
  })

  it('keeps Nice! in a sticky footer that is the last thing in the sheet', () => {
    const foot = top().querySelector(':scope > .sheet-foot')
    expect(foot).toBeTruthy()
    expect(top().lastElementChild).toBe(foot)
    expect(labels(foot)).toEqual(['Nice!'])
    expect(variant(btn('Nice!'))).toEqual(['primary'])
  })

  it('Nice! goes back once', async () => {
    await click(btn('Nice!'))
    expect(sheets()).toHaveLength(0)
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('the backdrop goes back exactly as Nice! does: the workout is saved, there is nothing to protect', async () => {
    await backdrop()
    expect(sheets()).toHaveLength(0)
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('Escape goes back too', async () => {
    await escape()
    expect(sheets()).toHaveLength(0)
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('has saved the workout by the time it is up, so letting go of the sheet loses nothing', () => {
    expect(S().workouts).toHaveLength(1)
    expect(S().workouts[0].name).toBe('Core')
    expect(S().active).toBeNull()
  })

  it('a long pull down dismisses it and goes back once; a short one springs back', async () => {
    await drag(top(), 20)
    expect(sheets()).toHaveLength(1)
    expect(back).not.toHaveBeenCalled()
    await drag(top(), 150)
    expect(sheets()).toHaveLength(0)
    expect(back).toHaveBeenCalledTimes(1)
    expect(S().workouts).toHaveLength(1)
  })
})

describe('a sheet\'s lock', () => {
  it('writes nothing to the store when it is already the value asked for, and one write when it changes', () => {
    let handle
    act(() => { handle = useUI.getState().openSheet(() => <h3>Hi</h3>) })
    const before = sheets()
    act(() => handle.lock(false))
    expect(sheets()).toBe(before)
    act(() => handle.lock(true))
    expect(sheets()).not.toBe(before)
    expect(sheets()[0].locked).toBe(true)
    const locked = sheets()
    act(() => handle.lock(true))
    expect(sheets()).toBe(locked)
  })

  it('leaves the store alone for a sheet that has gone', () => {
    let handle
    act(() => { handle = useUI.getState().openSheet(() => <h3>Hi</h3>) })
    act(() => handle.close())
    const after = sheets()
    act(() => handle.lock(true))
    expect(sheets()).toBe(after)
  })
})

describe('the unsent-changes sheet', () => {
  let done, signOut, syncNow, release
  beforeEach(() => {
    done = vi.fn()
    signOut = vi.fn(async () => ({ owed: true, count: 2 }))
    release = null
    syncNow = vi.fn(() => new Promise(resolve => { release = () => resolve(null) }))
    useStore.setState({ signOut, syncNow, sync: { status: 'offline', lastError: { status: 0, code: 'network' } } })
  })
  const open = async () => {
    await act(async () => { await leaveServer('signout', { exportBackup: vi.fn(), done }) })
    await settle()
  }

  it('is a bottom sheet with the way on first, the backup, Sign out anyway as danger and Cancel last', async () => {
    await open()
    expect(document.querySelector('.center')).toBeNull()
    expect(top().querySelector('.grab')).toBeTruthy()
    expect(top().querySelector('.ta-center')).toBeNull()
    expect(top().querySelector('h3').textContent).toBe('Not everything is on your server yet')
    expect(labels()).toEqual(['Try again', 'Export backup (JSON)', 'Sign out anyway', 'Cancel'])
    expect(variant(btn('Try again'))).toEqual(['primary'])
    expect(variant(btn('Export backup (JSON)'))).toEqual(['plain'])
    expect(variant(btn('Sign out anyway'))).toEqual(['danger'])
    expect(variant(btn('Cancel'))).toEqual(['ghost', 'dim'])
  })

  it('while idle the backdrop and Escape are Cancel: nothing is signed out', async () => {
    await open()
    await backdrop()
    expect(sheets()).toHaveLength(0)
    expect(done).not.toHaveBeenCalled()
    await open()
    await escape()
    expect(sheets()).toHaveLength(0)
    expect(done).not.toHaveBeenCalled()
  })

  it('is locked only while a request is out: no grab bar, no backdrop, no Escape, then free again', async () => {
    await open()
    await click(btn('Try again'))
    expect(sheets()[0].locked).toBe(true)
    expect(top().querySelector('.grab')).toBeNull()
    await backdrop()
    await escape()
    expect(sheets()).toHaveLength(1)
    await drag(top(), 150)
    expect(sheets()).toHaveLength(1)
    await act(async () => { release() })
    await settle()
    expect(sheets()[0].locked).toBe(false)
    expect(top().querySelector('.grab')).toBeTruthy()
    await backdrop()
    expect(sheets()).toHaveLength(0)
  })

  it('keeps its buttons, and the focus on the one that was pressed, while a request is out', async () => {
    await open()
    const retry = btn('Try again')
    retry.focus()
    await click(retry)
    expect(btn('Syncing…')).toBe(retry)
    expect(document.activeElement).toBe(retry)
    for (const b of top().querySelectorAll('button')) {
      expect(b.disabled, b.textContent).toBe(false)
      expect(b.getAttribute('aria-disabled'), b.textContent).toBe('true')
    }
    // A press on any of them does nothing meanwhile.
    await click(btn('Sign out anyway'))
    await click(btn('Syncing…'))
    await click(btn('Cancel'))
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(syncNow).toHaveBeenCalledTimes(1)
    expect(sheets()).toHaveLength(1)
    await act(async () => { release() })
    await settle()
    expect(btn('Try again').hasAttribute('aria-disabled')).toBe(false)
  })

  it('says it is busy and that it is syncing, for a screen reader', async () => {
    await open()
    const status = () => top().querySelector('[role="status"]')
    const busy = () => top().querySelector('[aria-busy]')
    expect(status().textContent).toBe('')
    expect(busy()).toBeNull()
    await click(btn('Try again'))
    expect(status().textContent).toBe('Syncing…')
    expect(busy().getAttribute('aria-busy')).toBe('true')
    await act(async () => { release() })
    await settle()
    expect(status().textContent).toBe('')
    expect(busy()).toBeNull()
  })

  it('is unlocked again when the sync itself rejects, not left locked for good', async () => {
    useStore.setState({ syncNow: vi.fn(async () => { throw new Error('offline') }) })
    await open()
    await click(btn('Try again'))
    await settle()
    expect(sheets()[0].locked).toBe(false)
    expect(btn('Try again').hasAttribute('aria-disabled')).toBe(false)
    expect(top().querySelector('[aria-busy]')).toBeNull()
    await backdrop()
    expect(sheets()).toHaveLength(0)
  })
})
