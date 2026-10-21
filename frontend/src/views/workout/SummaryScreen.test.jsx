// @vitest-environment happy-dom
// The summary (W2.0 Wk2Summary, W2.2 Wk2First) and its Done (W2.1 Wk2Saved): every section on a
// workout with a previous Push A, the first time, cardio, a missing id, the session note written
// to the saved record, and Done going back with the Saved toast and its Reopen. No Friends.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView, click } from '../../ds/render.test-util.js'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { setNav } from '../../lib/nav.js'
import { exOr } from '../../lib/exercises.js'
import { exerciseNameText } from '../../lib/format.js'
import { holdReopen, takeReopen } from './finish-drawers.js'
import { summaryOf } from './use-summary.js'

const mocks = vi.hoisted(() => ({ params: {}, back: vi.fn(), model: undefined }))
vi.mock('react-router-dom', async orig => ({ ...(await orig()), useParams: () => mocks.params }))
vi.mock('../../lib/use-tab-nav.js', async orig => ({ ...(await orig()), back: mocks.back }))
vi.mock('../../ds/BodyMap.jsx', () => ({ default: props => React.createElement('div', { 'data-body-map': JSON.stringify(props.levels) }) }))
vi.mock('../../components/WorkoutMedia.jsx', () => ({ default: props => React.createElement('div', { 'data-media': props.w.id, 'data-hint': String(!!props.hint) }) }))
vi.mock('./use-summary.js', async orig => {
  const actual = await orig()
  return { ...actual, useSummary: id => (mocks.model !== undefined ? mocks.model : actual.useSummary(id)) }
})

import SummaryScreen from './SummaryScreen.jsx'

const clone = v => JSON.parse(JSON.stringify(v))
const BENCH = '0025', FLY = '0227', SQUAT = '0043', RUN = '0334'
const name = id => exerciseNameText(exOr(id))
const at = (d, hm) => Date.parse(d + 'T' + hm + ':00')
const sets = (w, ...rs) => rs.map(r => ({ w, r, done: true }))
const workout = (id, d, routineIds, entries, over = {}) => ({
  id, d, start: at(d, '17:42'), end: at(d, '18:34'), routineIds, name: 'Push A', entries, ...over,
})
const routines = [{ id: 'push', name: 'Push A', ex: [{ id: BENCH, sets: 3, reps: 8, weight: 80 }] }]
const before = [
  workout('w0', '2026-10-04', ['other'], [{ id: FLY, sets: sets(17.5, 12, 12, 12) }], { name: 'Chest' }),
  workout('w1', '2026-10-11', ['push'], [{ id: BENCH, rid: 'push', sets: sets(80, 7, 7, 7) }]),
]
const today = (over = {}) => workout('w2', '2026-10-18', ['push'], [
  { id: BENCH, rid: 'push', sets: sets(80, 8, 8, 7) },
  { id: FLY, sets: sets(20, 12, 12, 12) },
  { id: RUN, target: { mode: 'cardio' }, sets: [{ min: 20, speed: 8, done: true }] },
], { prs: [FLY], ...over })

const S = () => useStore.getState().S
const view = useView()
const q = s => view.host.querySelector(s)
const qa = s => [...view.host.querySelectorAll(s)]
const headings = () => qa('.g-ssec h2').map(h => h.textContent)
const sectionOf = title => qa('section').find(s => s.querySelector('.g-ssec h2')?.textContent === title)
const buttonNamed = text => qa('button').find(b => b.textContent.trim() === text || b.textContent.includes(text))

function show(workouts, id = 'w2') {
  useStore.setState({ S: { ...clone(DEF), unit: 'kg', routines: clone(routines), workouts: clone(workouts) }, user: null })
  mocks.params = { id }
  view.render(<SummaryScreen />)
}

const typeInto = (el, value) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
const blur = el => act(() => { el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })

const snapshotOf = (over = {}) => ({
  at: Date.now() - 60_000, workoutId: 'w2', exWeights: {}, rotation: null,
  active: { id: 'w2', name: 'Push A', d: '2026-10-18', start: at('2026-10-18', '17:42'), cur: 0, entries: [] },
  ...over,
})

const to = vi.fn()
beforeEach(() => {
  mocks.back.mockClear()
  mocks.model = undefined
  to.mockClear()
  setNav(to)
  takeReopen('w2')
  useUI.setState({ toastMsg: '', toastAction: null })
})
afterEach(() => { setNav(() => {}) })

describe('the summary (W2.0)', () => {
  it('the eyebrow, ×, the title, the date and the tiles with the volume delta', () => {
    show([...before, today()])
    const m = summaryOf(S(), 'w2')
    expect(q('.g-sum-eyebrow').textContent).toBe('Workout saved')
    expect(q('.g-wtop button[aria-label="Close"]')).not.toBeNull()
    expect(q('h1').textContent).toBe('Push A, done')
    expect(q('.g-sum-date').textContent).toBe(m.dateLine)
    const tiles = qa('.g-stat').map(s => [...s.children].map(c => c.textContent))
    expect(tiles.map(x => x[0])).toEqual(['Time', 'Sets', 'Volume'])
    expect(tiles[2]).toEqual(['Volume', m.tiles[2].value, m.tiles[2].delta.text])
    // Up on the last Push A reads positive.
    expect(qa('.g-stat')[2].querySelector('.g-pos')).not.toBeNull()
  })

  it('the sections in order, and no Friends', () => {
    show([...before, today()])
    const m = summaryOf(S(), 'w2')
    const want = ['New bests', 'Muscles worked', 'What you just trained', 'Cardio', ...(m.next.length ? ['Next time'] : []), 'Session note', 'Photos and clips']
    expect(headings()).toEqual(want)
    expect(view.host.textContent).not.toContain('Friends')
    expect(view.host.textContent).not.toContain('Your first time')
  })

  it('new bests name the exercise and the set', () => {
    show([...before, today()])
    const rows = sectionOf('New bests').querySelectorAll('.g-glist-row')
    expect(rows[0].textContent).toContain(name(FLY))
    expect(rows[0].textContent).toContain('20 kg × 12 · best set ever')
    expect(rows[1].textContent).toContain(name(BENCH))
    expect(rows[1].textContent).toMatch(/Est\. 1RM .+ kg · up .+ kg/)
  })

  it('muscles worked: the map shaded from the workout, with its legend', () => {
    show([...before, today()])
    const levels = JSON.parse(sectionOf('Muscles worked').querySelector('[data-body-map]').dataset.bodyMap)
    expect(levels.chest).toBeGreaterThan(0)
    expect(sectionOf('Muscles worked').textContent).toContain('Less')
    expect(sectionOf('Muscles worked').textContent).toContain('More')
  })

  it('what you just trained: name, line and the trend in words', () => {
    show([...before, today()])
    const rows = [...sectionOf('What you just trained').querySelectorAll('.g-xrow')]
    const bench = rows.find(r => r.textContent.includes(name(BENCH)))
    expect(bench.textContent).toContain('80 kg, 8 · 8 · 7')
    expect(bench.querySelector('.g-tag').textContent).toBe('up on last time')
    expect(rows.some(r => r.textContent.includes(name(RUN)))).toBe(false)   // cardio has its own rows
  })

  it('cardio as logged', () => {
    show([...before, today()])
    const m = summaryOf(S(), 'w2')
    const row = sectionOf('Cardio').querySelector('.g-xrow')
    expect(row.textContent).toContain(name(RUN))
    expect(row.textContent).toContain(m.cardio[0].line)
  })

  it('no cardio: no Cardio section', () => {
    const t2 = today()
    t2.entries = t2.entries.filter(e => e.id !== RUN)
    show([...before, t2])
    expect(headings()).not.toContain('Cardio')
  })

  it('next time: each exercise and what to do, under "progression"', () => {
    show([...before, today()])
    mocks.model = { ...summaryOf(S(), 'w2'), next: [{ id: BENCH, name: 'Bench press', kind: 'up', text: 'Step up to 82.5 kg × 8' }] }
    view.render(<SummaryScreen />)
    const sec = sectionOf('Next time')
    expect(sec.querySelector('.g-ssec-act').textContent).toBe('progression')
    expect(sec.querySelector('.g-glist-row').textContent).toBe('Bench pressStep up to 82.5 kg × 8')
  })

  it('photos and clips: the workout\'s media section with its hint, on the saved record', () => {
    show([...before, today()])
    const media = sectionOf('Photos and clips').querySelector('[data-media]')
    expect(media.dataset.media).toBe('w2')
    expect(media.dataset.hint).toBe('true')
  })
})

describe('the first time (W2.2)', () => {
  it('"Your first time" with its line, no bests and no next time; rows say first time', () => {
    show([workout('f', '2026-10-18', ['push'], [{ id: SQUAT, sets: sets(80, 5, 5, 5) }], { prs: [SQUAT] })], 'f')
    expect(headings()).toEqual(['Your first time', 'Muscles worked', 'What you just trained', 'Session note', 'Photos and clips'])
    expect(q('.g-sum-first').textContent).toBe('Your first Push A. From the next one on, this shows what went up and your new bests.')
    expect(qa('.g-stat')[2].textContent).toContain('first time')
    const row = sectionOf('What you just trained').querySelector('.g-xrow')
    expect(row.textContent).toContain('3 sets at 80 kg')
    expect(row.querySelector('.g-tag').textContent).toBe('first time')
  })
})

describe('a missing workout', () => {
  it('says it is not there and goes back', () => {
    show([...before], 'gone')
    expect(q('.g-sempty').textContent).toContain('This workout isn’t in your history')
    expect(q('.g-stat')).toBeNull()
    click(buttonNamed('Back'))
    expect(mocks.back).toHaveBeenCalledOnce()
  })
})

describe('the session note', () => {
  it('"Add a note" opens the box; blur writes the saved workout\'s note, stamped', () => {
    show([...before, today()])
    expect(q('.g-sum-note textarea')).toBeNull()
    const row = buttonNamed('Add a note')
    expect(row.textContent).toContain('How it went, what to change')
    click(row)
    const box = q('.g-sum-note textarea')
    expect(box).not.toBeNull()
    typeInto(box, '  Felt strong  ')
    blur(box)
    const rec = S().workouts.find(w => w.id === 'w2')
    expect(rec.note).toBe('Felt strong')
    expect(rec._ts).toBeGreaterThan(0)
  })

  it('a note already there shows in the box', () => {
    show([...before, today({ note: 'Shoulder felt off' })])
    expect(q('.g-sum-note textarea').value).toBe('Shoulder felt off')
  })

  it('emptied, the note is deleted; an untouched box writes nothing', () => {
    show([...before, today({ note: 'Old' })])
    const box = q('.g-sum-note textarea')
    blur(box)
    expect(S().workouts.find(w => w.id === 'w2')._ts).toBeUndefined()
    typeInto(box, '')
    blur(box)
    expect('note' in S().workouts.find(w => w.id === 'w2')).toBe(false)
  })

  it('typed and left without a blur, it is written when the page goes', () => {
    show([...before, today()])
    click(buttonNamed('Add a note'))
    typeInto(q('.g-sum-note textarea'), 'Next time more rest')
    view.render(<div />)
    expect(S().workouts.find(w => w.id === 'w2').note).toBe('Next time more rest')
  })

  it('Done writes it too', () => {
    show([...before, today()])
    click(buttonNamed('Add a note'))
    typeInto(q('.g-sum-note textarea'), 'Done note')
    click(q('.g-sum-done button'))
    expect(S().workouts.find(w => w.id === 'w2').note).toBe('Done note')
  })
})

describe('Done and the Saved toast (W2.1)', () => {
  it('Done goes back and says Saved with Reopen for 10 s', () => {
    show([...before, today()])
    holdReopen(snapshotOf(), 'w2')
    click(q('.g-sum-done button'))
    expect(mocks.back).toHaveBeenCalledOnce()
    const ui = useUI.getState()
    expect(ui.toastMsg).toBe('Saved Push A')
    expect(ui.toastAction).toMatchObject({ label: 'Reopen', ms: 10000 })
  })

  it('× does what Done does, once', () => {
    show([...before, today()])
    holdReopen(snapshotOf(), 'w2')
    const x = q('.g-wtop button[aria-label="Close"]')
    click(x)
    click(x)
    expect(mocks.back).toHaveBeenCalledOnce()
    expect(useUI.getState().toastAction.label).toBe('Reopen')
  })

  it('Reopen, though the save was over 10 s ago, puts the session back and goes to the workout', () => {
    show([...before, today()])
    holdReopen(snapshotOf(), 'w2')
    click(q('.g-sum-done button'))
    act(() => useUI.getState().runToastAction())
    expect(S().active).toMatchObject({ id: 'w2', name: 'Push A' })
    expect(S().workouts.some(w => w.id === 'w2')).toBe(false)
    expect(to).toHaveBeenCalledWith('/train/workout')
  })

  it('once the toast is gone, its Reopen does nothing', () => {
    show([...before, today()])
    holdReopen(snapshotOf(), 'w2')
    click(q('.g-sum-done button'))
    const { run } = useUI.getState().toastAction
    act(() => useUI.getState().toast('Something else'))
    act(() => run())
    expect(S().active).toBeNull()
    expect(S().workouts.some(w => w.id === 'w2')).toBe(true)
    expect(to).not.toHaveBeenCalled()
  })

  it('the snapshot is not written to the store', () => {
    show([...before, today()])
    holdReopen(snapshotOf(), 'w2')
    click(q('.g-sum-done button'))
    expect(S().active).toBeNull()
    expect(Object.values(S()).some(v => v && typeof v === 'object' && v.workoutId === 'w2')).toBe(false)
  })

  it('no snapshot (a reload, a backfill): a plain Saved toast', () => {
    show([...before, today()])
    click(q('.g-sum-done button'))
    expect(mocks.back).toHaveBeenCalledOnce()
    expect(useUI.getState().toastMsg).toBe('Saved Push A')
    expect(useUI.getState().toastAction).toBeNull()
  })

  it('a snapshot held for another workout is not this one\'s', () => {
    show([...before, today()])
    holdReopen(snapshotOf({ workoutId: 'other' }), 'other')
    click(q('.g-sum-done button'))
    expect(useUI.getState().toastAction).toBeNull()
    expect(takeReopen('other')).not.toBeNull()
  })
})
