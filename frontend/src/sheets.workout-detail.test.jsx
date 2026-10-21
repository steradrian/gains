// @vitest-environment happy-dom
// A past workout's drawer (board T8.1). Discord (rubik_97): drop-set weights were counted in the
// volume but never listed, and supersets were not shown at all. Discord 'Improvement ideas': an
// exercise opens its own history from here, and the workout can be copied as text. T8.4: Delete
// goes at once, with an 8 s Undo that puts the record back and holds its photos meanwhile.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { createMediaStore, memoryBackend, _setMediaStore } from './lib/media-store.js'
import { deleteWorkoutWithUndo, openDay, workoutDetailSheet } from './sheets.jsx'
import { EXDB } from './lib/exercises-data.js'
import { fmtDate, todayISO } from './lib/format.js'
import { setNav } from './lib/nav.js'

const realToast = useUI.getState().toast
const lifts = EXDB.filter(e => e.bp !== 'cardio' && e.eq === 'barbell').slice(0, 3).map(e => e.id)
const clone = v => JSON.parse(JSON.stringify(v))
const mounted = []

function mountTopSheet() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
// A DetailRow by its title; MenuList items by their label.
const row = (host, title) => [...host.querySelectorAll('.g-drow')].find(r => r.querySelector('b')?.textContent === title)
const item = (host, label) => [...host.querySelectorAll('button')].find(b => b.textContent.startsWith(label))
const S = () => useStore.getState().S

const workout = (entries, extra = {}) => ({
  id: 'w1', d: '2026-09-15', start: Date.UTC(2026, 8, 15, 17), end: Date.UTC(2026, 8, 15, 18), name: 'Push',
  vol: 0, prs: [], routineIds: [], entries, ...extra,
})
const done = (w, r, more = {}) => ({ w, r, done: true, ...more })
const hex = n => n.toString(16).padStart(2, '0').repeat(32)

let toast, media
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  toast = vi.fn()
  useUI.setState({ sheets: [], toast })
  const S0 = clone(DEF)
  Object.assign(S0, { unit: 'kg', routines: [], workouts: [], active: null })
  useStore.setState({ S: S0, user: null })
  media = createMediaStore({ ...memoryBackend(), persistent: true, name: 'test' }, { objectURL: { createObjectURL: () => 'blob:t/1', revokeObjectURL() {} } })
  _setMediaStore(media)
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  _setMediaStore(null)
  vi.unstubAllGlobals()
})

describe('workout drawer', () => {
  it('lists a drop-set\'s drops and a rest-pause set\'s bursts', () => {
    workoutDetailSheet(workout([
      { id: lifts[0], target: { mode: 'reps' }, sets: [done(100, 8, { type: 'dropset', drops: [{ w: 80, r: 6 }, { w: 60, r: 5 }] })] },
      { id: lifts[1], target: { mode: 'reps' }, sets: [done(60, 16, { type: 'restpause', clusters: [{ r: 4, restSec: 15 }, { r: 2, restSec: 15 }] })] },
    ]))
    const rows = [...mountTopSheet().querySelectorAll('.g-wd-ex .g-xrow-b > span')].map(el => el.textContent)
    expect(rows).toEqual(['100×8 ↘ 80×6 ↘ 60×5', '60×10+4+2'])
  })

  it('heads with the name and the date, then Time, Sets and Volume (tonnes past 10 000 kg)', () => {
    workoutDetailSheet(workout([{ id: lifts[0], target: { mode: 'reps' }, sets: [done(100, 5), done(100, 5)] }], { vol: 12400 }))
    const host = mountTopSheet()
    expect(host.querySelector('.g-bs-head h2').textContent).toBe('Push')
    expect(host.querySelector('.g-bs-chip').textContent).toContain('15 Sep')
    expect([...host.querySelectorAll('.g-stat')].map(s => s.textContent)).toEqual(['Time1h 0m', 'Sets2', 'Volume12.4 t'])
  })

  it('counts work sets once everywhere: the Sets tile and the routine headers skip warm-ups and agree on a per-side set', () => {
    workoutDetailSheet(workout([
      { id: lifts[0], rid: 'a', target: { mode: 'reps' }, sets: [done(40, 8, { phase: 'warmup' }), done(100, 5)] },
      { id: lifts[1], rid: 'b', target: { mode: 'reps', side: true }, sets: [
        { w: 10, r: 16, done: true, sides: { L: { w: 10, r: 8, done: true }, R: { w: 10, r: 8, done: true } } },
      ] },
    ], { routineIds: ['a', 'b'] }))
    const host = mountTopSheet()
    expect([...host.querySelectorAll('.g-stat')].map(s => s.textContent)[1]).toBe('Sets3')
    const heads = [...host.querySelectorAll('.g-wd-group-head > span')].map(s => s.textContent.split(' · ')[0])
    expect(heads).toEqual(['1 set', '2 sets'])
  })

  it('leaves Time out when the session has no clock, as an import has none', () => {
    workoutDetailSheet(workout([], { start: undefined, end: undefined }))
    expect([...mountTopSheet().querySelectorAll('.g-stat > span')].map(s => s.textContent)).toEqual(['Sets', 'Volume'])
  })

  it('says which muscles did most of the work, and shows no map for a session with no load', () => {
    workoutDetailSheet(workout([{ id: '0025', target: { mode: 'reps' }, sets: [done(60, 8)] }]))
    const host = mountTopSheet()
    expect(host.querySelector('.g-wd-map').textContent).toMatch(/^Muscle mapChest.*did most of the work\.$/)
    useUI.setState({ sheets: [] })
    workoutDetailSheet(workout([]))
    expect(mountTopSheet().querySelector('.g-wd-map')).toBeNull()
  })

  it('marks an exercise that set a new best', () => {
    workoutDetailSheet(workout([
      { id: lifts[0], target: { mode: 'reps' }, sets: [done(60, 5)] },
      { id: lifts[1], target: { mode: 'reps' }, sets: [done(60, 5)] },
    ], { prs: [lifts[1]] }))
    const tags = [...mountTopSheet().querySelectorAll('.g-wd-ex')].map(el => el.querySelector('.g-tag')?.textContent ?? null)
    expect(tags).toEqual([null, 'New best'])
  })

  it('keeps a superset together under one label, in a flat and in a combined workout', () => {
    const entries = [
      { id: lifts[0], sg: 'sg1', target: { mode: 'reps' }, sets: [done(40, 10)] },
      { id: lifts[1], sg: 'sg1', target: { mode: 'reps' }, sets: [done(20, 12)] },
      { id: lifts[2], target: { mode: 'reps' }, sets: [done(60, 5)] },
    ]
    workoutDetailSheet(workout(entries))
    let host = mountTopSheet()
    let groups = host.querySelectorAll('.g-wd-ss')
    expect(groups).toHaveLength(1)
    expect(groups[0].querySelector('.g-wd-ss-label').textContent).toBe('Superset')
    expect(groups[0].querySelectorAll('.g-wd-ex')).toHaveLength(2)
    expect(host.querySelectorAll('.g-wd-ex')).toHaveLength(3)

    useUI.setState({ sheets: [] })
    const combined = entries.map((e, i) => ({ ...e, rid: i < 2 ? 'A' : 'B' }))
    workoutDetailSheet(workout(combined, { routineIds: ['A', 'B'] }))
    host = mountTopSheet()
    expect(host.textContent).toContain('Freestyle')           // routines since deleted
    expect(host.querySelectorAll('.g-wd-ss .g-wd-ex')).toHaveLength(2)
  })

  it('shows an unpaired exercise without a superset label', () => {
    workoutDetailSheet(workout([
      { id: lifts[0], sg: 'sg1', target: { mode: 'reps' }, sets: [done(40, 10)] },
      { id: lifts[1], target: { mode: 'reps' }, sets: [done(20, 12)] },
    ]))
    expect(mountTopSheet().querySelector('.g-wd-ss')).toBeNull()
  })

  it('opens the exercise\'s history from its row', () => {
    const w = workout([{ id: lifts[0], target: { mode: 'reps' }, sets: [done(60, 5)] }])
    useStore.setState(s => ({ S: { ...s.S, workouts: [w] } }))
    workoutDetailSheet(w)
    const ex = mountTopSheet().querySelector('.g-wd-ex .g-xrow')
    expect(ex.tagName).toBe('BUTTON')
    act(() => { ex.click() })
    expect(useUI.getState().sheets).toHaveLength(2)
    const history = mountTopSheet()
    expect(history.querySelector('.g-ps-card')).toBeTruthy()
    expect(history.textContent).toContain('60×5')
  })

  it('offers the board\'s rows, each saying what it does', () => {
    workoutDetailSheet(workout([]))
    const host = mountTopSheet()
    expect([...host.querySelectorAll('.g-drow')].map(r => r.textContent)).toEqual([
      'Repeat todaySame exercises, last weights',
      `Save as routineBecomes “Push, ${fmtDate('2026-09-15')}”`,
      'Share as imageA card with the map and your bests',
      'Edit workoutSets, date and time, duration',
      'Export as .fit fileGarmin Connect can take it from there',
      'Copy as text',
      'Delete workoutUndo for 8 s',
    ])
    expect(row(host, 'Delete workout').querySelector('b').className).toBe('g-danger')
  })

  it('copies the workout as text, with the note as it stands in the box', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const w = workout([{ id: lifts[0], target: { mode: 'reps' }, sets: [done(60, 5, { phase: 'warmup' }), done(80, 5)] }])
    useStore.setState(s => ({ S: { ...s.S, workouts: [w] } }))
    workoutDetailSheet(w)
    const host = mountTopSheet()
    const note = host.querySelector('textarea')
    act(() => {
      Object.getOwnPropertyDescriptor(note.constructor.prototype, 'value').set.call(note, 'Good day')
      note.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { row(host, 'Copy as text').click() })
    expect(writeText).toHaveBeenCalledTimes(1)
    const text = writeText.mock.calls[0][0]
    expect(text.split('\n')[0]).toMatch(/^Push · /)
    expect(text).toContain('\n80×5\n')
    expect(text).not.toContain('60×5')
    expect(text.endsWith('\n\nGood day')).toBe(true)
    expect(toast).toHaveBeenCalledWith('Copied')
  })

  // One rule for both: a superset paired across two routines of a combined session is shown apart
  // in the drawer, each under its own routine, and the copied text does not call it a superset.
  it('groups a combined session\'s supersets the same way in the drawer and in the copied text', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const w = workout([
      { id: lifts[0], rid: 'A', sg: 'x', target: { mode: 'reps' }, sets: [done(40, 10)] },
      { id: lifts[1], rid: 'B', sg: 'x', target: { mode: 'reps' }, sets: [done(20, 12)] },
      { id: lifts[2], rid: 'B', target: { mode: 'reps' }, sets: [done(60, 5)] },
    ], { routineIds: ['A', 'B'] })
    useStore.setState(s => ({ S: { ...s.S, workouts: [w] } }))
    workoutDetailSheet(w)
    const host = mountTopSheet()
    expect(host.querySelector('.g-wd-ss')).toBeNull()
    expect(host.querySelectorAll('.g-wd-ex')).toHaveLength(3)
    await act(async () => { row(host, 'Copy as text').click() })
    expect(writeText.mock.calls[0][0]).not.toContain('Superset')
  })

  it('says so when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => Promise.reject(new Error('denied')) } })
    document.execCommand = () => false
    workoutDetailSheet(workout([{ id: lifts[0], target: { mode: 'reps' }, sets: [done(60, 5)] }]))
    const host = mountTopSheet()
    await act(async () => { row(host, 'Copy as text').click() })
    expect(toast).toHaveBeenCalledWith('Could not copy')
    delete document.execCommand
  })

  it('Share as image closes the drawer and opens the share drawer with the note as typed', () => {
    const w = workout([{ id: lifts[0], target: { mode: 'reps' }, sets: [done(60, 5)] }])
    useStore.setState(s => ({ S: { ...s.S, workouts: [w] } }))
    workoutDetailSheet(w)
    const host = mountTopSheet()
    act(() => { row(host, 'Share as image').click() })
    const sheets = useUI.getState().sheets
    expect(sheets).toHaveLength(1)
    const share = mountTopSheet()
    expect(share.querySelector('.g-bs-head h2').textContent).toBe('Share workout')
    expect([...share.querySelectorAll('.g-wd-share-acts button')].map(b => b.textContent)).toEqual(['Share', 'Save image', 'Copy text'])
  })

  it('Edit workout closes the drawer for a menu: Edit sets, Change date & time, Change duration', () => {
    const w = workout([{ id: lifts[0], target: { mode: 'reps' }, sets: [done(60, 5)] }])
    useStore.setState(s => ({ S: { ...s.S, workouts: [w] } }))
    workoutDetailSheet(w)
    const edit = row(mountTopSheet(), 'Edit workout')
    act(() => { edit.click() })
    expect(useUI.getState().sheets).toHaveLength(1)
    const menu = mountTopSheet()
    expect(menu.querySelector('.g-bs-head h2').textContent).toBe('Edit workout')
    expect(item(menu, 'Edit sets').disabled).toBe(false)
    act(() => { item(menu, 'Change duration').click() })
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(mountTopSheet().querySelector('h3').textContent).toBe('Change duration')
  })

  it('while another workout runs, Repeat today and Edit sets say to finish it first and do nothing', () => {
    const w = workout([{ id: lifts[0], target: { mode: 'reps' }, sets: [done(60, 5)] }])
    useStore.setState(s => ({ S: { ...s.S, workouts: [w], active: { id: 'a', entries: [] } } }))
    workoutDetailSheet(w)
    const host = mountTopSheet()
    const repeat = row(host, 'Repeat today')
    expect(repeat.tagName).toBe('DIV')
    expect(repeat.textContent).toBe('Repeat todayFinish the current workout first.')
    act(() => { row(host, 'Edit workout').click() })
    const sets = item(mountTopSheet(), 'Edit sets')
    expect(sets.disabled).toBe(true)
    expect(sets.textContent).toContain('Finish the current workout first.')
  })

  it('the date of a past workout opens its Day page, closing the drawer first', () => {
    const w = workout([{ id: lifts[0], target: { mode: 'reps' }, sets: [done(60, 5)] }])
    useStore.setState(s => ({ S: { ...s.S, workouts: [w, { ...w, id: 'w2', name: 'Pull', start: w.start + 7200e3, end: w.end + 7200e3 }] } }))
    const navigated = []
    setNav((to, opts) => navigated.push([to, opts]))
    history.replaceState(null, '', '#/train/history')
    workoutDetailSheet(w)
    const chip = mountTopSheet().querySelector('.g-bs-chip')
    act(() => { chip.click() })
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(navigated).toEqual([['/train/day/2026-09-15', undefined]])
  })
})

// openDay: a past day from the first log on goes to its Day page (/:tab/day/:date, PR-07); any
// other day keeps the sheets the calendar had.
describe('openDay', () => {
  it('a past day opens its Day page under the tab on screen, after closing the drawer it came from', () => {
    useStore.setState(s => ({ S: { ...s.S, workouts: [workout([])] } }))
    const navigated = []
    setNav((to, opts) => navigated.push([to, opts]))
    history.replaceState(null, '', '#/train/history')
    const close = vi.fn()
    openDay('2026-09-15', close)
    expect(close).toHaveBeenCalledTimes(1)
    expect(navigated).toEqual([['/train/day/2026-09-15', undefined]])
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('a day off with a note keeps the day sheet, where the note is', () => {
    useStore.setState(s => ({ S: { ...s.S, workouts: [workout([])], dayNotes: { '2026-09-10': { tag: 'sick', text: 'Flu', _ts: 1 } } } }))
    const navigated = []
    setNav((to, opts) => navigated.push([to, opts]))
    openDay('2026-09-10')
    expect(navigated).toEqual([])
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('today is never a Day page: its workouts as a list; one row opens its drawer', () => {
    const w = workout([], { d: todayISO() })
    useStore.setState(s => ({ S: { ...s.S, workouts: [w] } }))
    const close = vi.fn()
    openDay(todayISO(), close)
    expect(close).toHaveBeenCalledTimes(1)
    const day = mountTopSheet()
    act(() => { day.querySelector('.item').click() })
    expect(useUI.getState().sheets.at(-1)).toBeTruthy()
    expect(mountTopSheet().querySelector('.g-bs-head h2').textContent).toBe('Push')
  })

  it('a day without a workout opens the day sheet to plan a session', () => {
    openDay('2026-09-16')
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(mountTopSheet().textContent).toContain(fmtDate('2026-09-16', true))
  })
})

describe('delete with Undo (T8.4)', () => {
  const withMedia = () => workout([{ id: lifts[0], target: { mode: 'reps' }, sets: [done(60, 5)] }], {
    name: 'Push A', d: '2026-10-12', start: Date.UTC(2026, 9, 12, 17), end: Date.UTC(2026, 9, 12, 18),
    media: [{ kind: 'image', hash: hex(1), mime: 'image/webp', size: 9, width: 1600, height: 1200, poster: { hash: hex(2), mime: 'image/webp', size: 2, width: 480, height: 360 }, at: 1727000000000 }],
  })

  it('deletes at once, with no confirm, closes the drawer and says what went, with Undo for 8 s', () => {
    const w = withMedia()
    const other = { ...workout([]), id: 'w0', d: '2026-10-01', start: 1 }
    useStore.setState(s => ({ S: { ...s.S, workouts: [other, w] } }))
    workoutDetailSheet(w)
    const del = row(mountTopSheet(), 'Delete workout')
    act(() => { del.click() })
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(S().workouts.map(x => x.id)).toEqual(['w0'])
    expect(S().deleted.workouts.w1).toBeGreaterThan(0)
    const [msg, opts] = toast.mock.calls.at(-1)
    expect(msg).toBe('Deleted Push A from Mon 12 Oct')
    expect(opts).toMatchObject({ action: 'Undo', icon: 'trash', body: 'Its photo or video is deleted with it.' })
  })

  it('Undo puts back the exact record at its index, stamped as added back for the sync', () => {
    const w = withMedia()
    const list = [{ ...workout([]), id: 'w0', d: '2026-10-01', start: 1 }, w, { ...workout([]), id: 'w2', d: '2026-10-20', start: 2 }]
    useStore.setState(s => ({ S: { ...s.S, workouts: clone(list) } }))
    deleteWorkoutWithUndo(w)
    act(() => { toast.mock.calls.at(-1)[1].onAction() })
    expect(S().workouts.map(x => x.id)).toEqual(['w0', 'w1', 'w2'])
    expect(S().workouts[1]).toMatchObject({ name: 'Push A', media: w.media, entries: w.entries })
    expect(S().deleted.workouts.w1).toBeLessThan(0)
  })

  it('holds the workout\'s files from the local clean-up until the toast is gone, either way', () => {
    useStore.setState(s => ({ S: { ...s.S, workouts: [withMedia()] } }))
    deleteWorkoutWithUndo(withMedia())
    expect(media.isHeld(hex(1))).toBe(true)
    expect(media.isHeld(hex(2))).toBe(true)
    toast.mock.calls.at(-1)[1].onClose()
    expect(media.isHeld(hex(1))).toBe(false)
    expect(media.isHeld(hex(2))).toBe(false)

    // the real toast: an Undo, then its close, releases the hold too
    useUI.setState({ toast: realToast })
    useStore.setState(s => ({ S: { ...s.S, workouts: [withMedia()] } }))
    deleteWorkoutWithUndo(withMedia())
    expect(media.isHeld(hex(1))).toBe(true)
    act(() => { useUI.getState().runToastAction() })
    expect(S().workouts.map(x => x.id)).toEqual(['w1'])
    expect(media.isHeld(hex(1))).toBe(false)
  })

  it('a workout without files has no body line, and nothing to delete does nothing', () => {
    const w = workout([])
    useStore.setState(s => ({ S: { ...s.S, workouts: [w] } }))
    expect(deleteWorkoutWithUndo(w)).toBe(true)
    expect(toast.mock.calls.at(-1)[1].body).toBeNull()
    expect(deleteWorkoutWithUndo(w)).toBe(false)
    expect(toast).toHaveBeenCalledTimes(1)
  })
})

// #447: the workout as a Garmin .fit activity, saved as a download in the browser.
describe('export as .fit', () => {
  it('saves the saved record as a .fit file named after its day and time', async () => {
    const blobs = []
    const createObjectURL = vi.fn(blob => { blobs.push(blob); return 'blob:fit' })
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL, revokeObjectURL: vi.fn() }))
    const clicked = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { clicked.push(this.download) })
    const w = workout([{ id: lifts[0], target: { mode: 'reps' }, sets: [done(60, 5), done(60, 5)] }])
    useStore.setState(s => ({ S: { ...s.S, workouts: [w] } }))
    workoutDetailSheet(w)
    const host = mountTopSheet()
    await act(async () => { row(host, 'Export as .fit file').click() })
    expect(clicked).toHaveLength(1)
    expect(clicked[0]).toMatch(/^gains-2026-09-15-\d{4}\.fit$/)
    const bytes = new Uint8Array(await blobs[0].arrayBuffer())
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('.FIT')
    expect(toast).toHaveBeenCalledWith('Saved. Garmin Connect can take it from here.')
    click.mockRestore()
  })

  it('says so when the workout cannot be written', async () => {
    workoutDetailSheet({ id: 'x', name: 'Nowhen', entries: [], prs: [] })
    const host = mountTopSheet()
    await act(async () => { row(host, 'Export as .fit file').click() })
    expect(toast).toHaveBeenCalledWith('Could not create the file')
  })
})
